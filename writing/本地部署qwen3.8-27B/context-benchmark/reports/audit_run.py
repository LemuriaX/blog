"""Recalculate an existing run for a report; never edit its original evidence."""
import collections
import csv
import hashlib
import json
import re
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
csv.field_size_limit(16 * 1024 * 1024)
sys.path.insert(0, str(root / "source-snapshot"))
from benchmark_common import digest, score_json_answer, result_metrics, metric_summary
from run_context_benchmark import build_summary
from run_profile_benchmark import build_task_summaries

read = lambda p: json.loads(p.read_text(encoding="utf-8"))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
manifest = read(root / "run-manifest.json")
summary = read(root / "summary.json")
issues = []
audit = dict(run_id=root.name, stages=[])
for name, expected_sha in manifest["scripts"].items():
    if sha(root / "source-snapshot" / name) != expected_sha:
        issues.append("snapshot:" + name)
audit["source_snapshot_verified"] = not issues
corpora = {digest(read(p)) for p in (root / "cases").glob("*/case-*.json")}
performance_inputs = []
quality_inputs = []
quality_token_counts = []
for corpus in (root / "cases").glob("*/corpus.json"):
    for name, expected_sha in read(corpus)["files"].items():
        if sha(corpus.parent / name) != expected_sha:
            issues.append("corpus:" + name)
for stage in summary["stages"]:
    folder = root / stage["id"]
    expected = read(folder / "results.summary.json")
    events = [json.loads(line) for line in (folder / "results.events.jsonl").read_text(encoding="utf-8").splitlines()]
    starts = {e["request_id"]: e for e in events if e["event"] == "start"}
    rows = [e["row"] for e in events if e["event"] == "result"]
    plan = read(folder / "results.manifest.json")["planned"]

    def check(passed, message):
        if not passed:
            issues.append(stage["id"] + ":" + message)

    check(len(rows) == len(starts) == len(plan), "request count")
    check(all(r["attempt"] == 1 for r in rows), "first attempts")
    check({r["job_id"] for r in rows} == {j["job_id"] for j in plan}, "planned IDs")
    check(stage["summary"] == expected, "root summary")
    jobs = {j["job_id"]: j for j in plan}
    for event in starts.values():
        check(event["job"] == jobs[event["job_id"]], "request job " + event["job_id"])
        check(event["payload"]["messages"] == event["job"]["messages"], "request messages " + event["job_id"])
    for row in rows:
        if row["run_status"] == "completed":
            score = score_json_answer(row["answer"], row["expected"], row.get("code_fields", []))
            check(all(row[k] == v for k, v in score.items()), "rescore " + row["job_id"])
            metrics = result_metrics(row["raw_result"], row["counted_prompt_tokens"], row["effective_n_ctx"],
                                     starts[row["request_id"]]["payload"]["max_tokens"])
            check(all(row.get(k) == v for k, v in metrics.items()), "metrics " + row["job_id"])
            check(row["task_success"] == bool(row["measurement_valid"] and row["content_correct"] and row["format_valid"]),
                  "task verdict " + row["job_id"])
    with (folder / "results.csv").open(encoding="utf-8-sig", newline="") as stream:
        csv_rows = list(csv.DictReader(stream))
    check(len(csv_rows) == len(rows), "CSV row count")
    for actual, row in zip(csv_rows, rows):
        fields = ("job_id", "attempt", "run_status", "measurement_valid", "task_success", "matched_fields",
                  "finish_reason", "prompt_tps", "decode_tps", "ttft_client_s")
        check(all(actual[k] == ("" if row.get(k) is None else str(row[k])) for k in fields), "CSV " + row["job_id"])
    if stage["stage"]["kind"] == "quality":
        check(build_task_summaries(rows) == expected["tasks"], "task summaries")
        check(metric_summary(rows) == expected["metrics"], "quality metrics")
        settings = stage["stage"]
        for event in starts.values():
            payload = event["payload"]
            check(payload["enable_thinking"] == settings["thinking"] and
                  payload.get("reasoning_effort") == (settings["effort"] if settings["thinking"] else None),
                  "Thinking settings " + event["job_id"])
            check(payload["max_tokens"] == settings["output_budget"] and payload["seed"] == event["job"]["seed"],
                  "generation budget/seed " + event["job_id"])
            check(all(payload[k] == settings[k] for k in ("temperature", "top_p", "top_k", "presence_penalty")),
                  "sampling " + event["job_id"])
        quality_inputs.append(digest([{k: j.get(k) for k in ("job_id", "messages", "expected", "seed", "code_fields")} for j in plan]))
        quality_token_counts.append([r.get("counted_prompt_tokens") for r in rows])
        for job in plan:
            if job.get("family") == "D":
                check(any(job["messages"] == read(p)["messages"] and job["expected"] == read(p)["expected"]
                          for p in (root / "cases").glob("*/case-*.json")), "quality corpus " + job["job_id"])
    else:
        check(build_summary(rows) == expected, "performance/capacity summary")
    check(sha(folder / "llama-server.log") == read(folder / "backend-log-collection.json")["snapshot_sha256"], "log hash")
    if stage["stage"]["kind"] == "performance":
        performance_inputs.append([j["case_digest"] for j in plan])
    for job in plan:
        if "case_digest" in job:
            check(job["case_digest"] in corpora, "corpus digest")

    def counts(selected):
        return dict(planned=len(selected), completed=sum(r["run_status"] == "completed" for r in selected),
                    valid=sum(r.get("measurement_valid") is True for r in selected),
                    success=sum(r["task_success"] for r in selected),
                    content_correct=sum(bool(r.get("measurement_valid") and r.get("content_correct")) for r in selected),
                    format_valid=sum(bool(r.get("measurement_valid") and r.get("format_valid")) for r in selected))

    data = {k: stage.get(k) for k in ("id", "status", "configuration_verdict", "measurement_verdict", "cleanup_status", "unverified_checks")}
    data.update(counts(rows), metrics=expected["metrics"])
    data["budget_exhausted"] = sum(r.get("budget_exhausted") is True for r in rows)
    data["fenced_answers"] = sum(r.get("answer", "").lstrip().startswith("```") for r in rows)
    data["reasoning_field_nonempty"] = sum(bool(r.get("reasoning")) for r in rows)
    data["reported_reasoning_tokens"] = list(dict.fromkeys(r.get("reasoning_tokens") for r in rows))
    data["finish_reasons"] = dict(collections.Counter(r.get("finish_reason") for r in rows))
    if stage["stage"]["kind"] == "quality":
        data["request_groups"] = {}
        for name, selected in (("short", [r for r in rows if r["family"] != "D"]),
                               ("long", [r for r in rows if r["family"] == "D"])):
            tokens = [r["tokens_evaluated"] for r in selected if type(r.get("tokens_evaluated")) is int]
            data["request_groups"][name] = dict(counts(selected), metrics=metric_summary(selected),
                                               actual_input_range=[min(tokens), max(tokens)] if tokens else None)
        keys = ("job_id", "task_name", "tokens_evaluated", "output_tokens", "ttft_client_s", "ttfa_client_s", "total_s")
        data["long_requests"] = [{k: r.get(k) for k in keys} for r in rows if r["family"] == "D"]
        data["slowest_requests"] = [{k: r.get(k) for k in keys} for r in
                                     sorted((r for r in rows if type(r.get("total_s")) in (int, float)),
                                            key=lambda r: r["total_s"], reverse=True)[:3]]
    data["failures"] = [{k: r.get(k) for k in ("job_id", "error_kind", "runtime_error", "finish_reason", "budget_exhausted")}
                        for r in rows if not r.get("measurement_valid")]
    data["families"] = {family: counts([r for r in rows if r.get("family") == family])
                        for family in dict.fromkeys(r.get("family") for r in rows) if family}
    data["tasks"] = [{k: t[k] for k in ("task_id", "task_name", "family", "planned_runs", "completed_runs", "valid_runs",
                                       "content_correct_rate", "format_compliance_rate", "task_success_rate", "budget_exhausted")}
                     for t in expected.get("tasks", [])]
    if "measured_prompt_tokens" in expected:
        data["actual_input_range"] = [min(expected["measured_prompt_tokens"]), max(expected["measured_prompt_tokens"])]
    log = (folder / "llama-server.log").read_text(encoding="utf-8")
    data["gpu_buffers_mib"] = {}
    for label in ("model", "KV", "RS", "compute"):
        match = re.search(r"ROCm0\s+" + label + r" buffer size\s*=\s*([\d.]+) MiB", log)
        data["gpu_buffers_mib"][label] = float(match.group(1)) if match else None
    audit["stages"].append(data)
audit["common_performance_inputs_identical"] = all(items == performance_inputs[0] for items in performance_inputs) if performance_inputs else None
if audit["common_performance_inputs_identical"] is False:
    issues.append("common performance inputs differ")
audit["quality_inputs_identical"] = all(value == quality_inputs[0] for value in quality_inputs) if quality_inputs else None
audit["quality_input_token_counts_identical"] = all(value == quality_token_counts[0] for value in quality_token_counts) if quality_token_counts else None
if audit["quality_inputs_identical"] is False:
    issues.append("quality inputs differ")
audit["totals"] = {key: sum(s[key] for s in audit["stages"]) for key in ("planned", "completed", "valid")}
audit["issues"] = issues
evidence_names = {"summary.json", "stage.json", "results.events.jsonl", "results.csv", "results.summary.json", "configuration-validation.json"}
audit["evidence_sha256"] = {str(p.relative_to(root)): sha(p) for p in root.rglob("*") if p.is_file() and p.name in evidence_names}
output = Path(__file__).with_name("结果核对-" + root.name + ".json")
output.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(dict(totals=audit["totals"], issues=issues, common_inputs=audit["common_performance_inputs_identical"]), ensure_ascii=False))
for stage in audit["stages"]:
    print(stage["id"], {k: stage[k] for k in ("planned", "completed", "valid", "success", "content_correct", "format_valid", "budget_exhausted", "fenced_answers")})
    if stage["families"]:
        print("families", stage["families"])
