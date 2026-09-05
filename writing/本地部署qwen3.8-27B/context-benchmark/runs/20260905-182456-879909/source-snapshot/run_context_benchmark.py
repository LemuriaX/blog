#!/usr/bin/env python3
"""长上下文检索与性能：每请求落盘、首轮统计、失败保留。"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
from benchmark_common import (
    POSITION_COLUMNS, Journal, RequestFailure, chat_payload, digest, evidence_identity,
    execute_request, execution_status, get_json, metric_summary, resolve_model_id,
    stream_chat_completion, write_json,
)


def build_summary(rows):
    n = len(rows)
    completed = sum(r.get("run_status") == "completed" for r in rows)
    valid = sum(r.get("measurement_valid") is True for r in rows)
    total_items = sum(len(r.get("expected", {})) for r in rows)
    correct = sum(r.get("matched_fields", 0) if r.get("measurement_valid") else 0 for r in rows)
    positions = {column: sum(r.get(column, 0) if r.get("measurement_valid") else 0 for r in rows)
                 for column in POSITION_COLUMNS}
    ratio = correct / total_items if total_items else 0
    all_formats = all(r.get("format_valid") is True for r in rows)
    position_threshold = (2 * n + 2) // 3
    capacity_pass = n > 0 and valid == n and all_formats and ratio >= .9 and all(
        value >= position_threshold for value in positions.values())
    reasons = sorted({reason for r in rows for reason in r.get("validation_errors", [])} |
                     {r["error_kind"] for r in rows if r.get("error_kind")})
    if valid < n:
        reasons.append("not_all_planned_requests_valid")
    if not all_formats:
        reasons.append("json_format_invalid")
    if ratio < .9:
        reasons.append("retrieval_accuracy_below_threshold")
    if any(v < position_threshold for v in positions.values()):
        reasons.append("position_recall_below_threshold")
    return dict(status=execution_status(rows), planned_requests=n, completed_requests=completed,
                valid_requests=valid, task_success_rate=sum(r.get("task_success", False) for r in rows) / n if n else 0,
                run_success_rate=completed / n if n else 0, overall_accuracy=ratio,
                total_items=total_items, correct_items=correct, positions=positions,
                capacity_verdict="pass" if capacity_pass else "fail",
                performance_verdict="pass" if n and valid == n else "fail",
                failure_reasons=reasons, metrics=metric_summary(rows),
                measured_prompt_tokens=[r.get("tokens_evaluated") for r in rows],
                configured_contexts=sorted({r["configured_context"] for r in rows}),
                primary_attempt_policy="first_attempt_per_planned_request")


def write_summary(rows, output_path):
    summary = build_summary(rows)
    write_json(output_path.with_suffix(".summary.json"), summary)
    lines = ["# 长上下文测试摘要", "", f"执行状态：{summary['status']}；容量判定：{summary['capacity_verdict']}。",
             f"有效请求：{summary['valid_requests']}/{summary['planned_requests']}；检索正确率：{summary['overall_accuracy']:.1%}。",
             "", "| 指标 | 来源 | 有效样本数 | 中位数 | 最小值 | 最大值 |", "|---|---|---:|---:|---:|---:|"]
    for name, stat in summary["metrics"].items():
        lines.append(f"| {name} | {stat['source']} | {stat['n']} | {stat['median']} | {stat['minimum']} | {stat['maximum']} |")
    lines += ["", f"配置容量：{summary['configured_contexts']}；实际输入 Token：{summary['measured_prompt_tokens']}。",
              f"各位置正确次数：{summary['positions']}。", f"未通过原因：{summary['failure_reasons']}。",
              "首轮结果以全部计划请求为分母；重试单独留在 CSV/JSONL，不替换第一次失败。",
              "后端测速与客户端估算分别展示；显存为外部监控的采样值，需补录。"]
    path = output_path.with_suffix(".summary.md")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8001")
    parser.add_argument("--api-key", default=os.getenv("UNSLOTH_API_KEY", ""))
    parser.add_argument("--model", default=os.getenv("UNSLOTH_MODEL_ID", ""))
    parser.add_argument("--cases-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--max-tokens", type=int, default=192)
    parser.add_argument("--seed", type=int, default=3407)
    parser.add_argument("--repeats", type=int, default=1)
    parser.add_argument("--timeout", type=float, default=7200)
    parser.add_argument("--skip-warmup", action="store_true")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--retry-failed", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    if not args.api_key or args.repeats < 1 or (args.retry_failed and not args.resume):
        raise ValueError("需要 API Key、正数 repeats；retry-failed 需要 resume")
    paths = sorted(args.cases_dir.glob("case-*.json"))
    if not paths:
        raise ValueError("没有测试样本")
    model = args.model or resolve_model_id(args.base_url, args.api_key, 30)
    status = get_json(args.base_url, "/api/inference/status", args.api_key, 30)
    planned = []
    for path in paths:
        case = json.loads(path.read_text(encoding="utf-8"))
        if case["configured_context"] != status.get("context_length"):
            raise ValueError("样本上下文与实际服务不一致")
        if not isinstance(case.get("expected"), dict) or not case.get("needles"):
            raise ValueError(f"无效样本：{path}")
        for repeat in range(1, args.repeats + 1):
            planned.append(dict(job_id=f"{path.stem}-r{repeat}", case_file=path.name, repeat=repeat,
                                case_digest=digest(case), expected=case["expected"], needles=case["needles"],
                                configured_context=case["configured_context"], safety_margin=case.get("safety_margin", 0), messages=case["messages"]))
    journal = Journal(args.output, planned, dict(model=model, max_tokens=args.max_tokens,
                      seed=args.seed, server=evidence_identity(status), timeout=args.timeout), args.resume)
    write_json(args.output.with_suffix(".server.json"), status)
    try:
        if not args.skip_warmup and any(not journal.done(j["job_id"], args.retry_failed) for j in planned):
            # Match prefill shape. A short generation budget is allowed only for warmup.
            warmup = chat_payload(planned[0]["messages"], model, min(32, args.max_tokens), args.seed)
            try:
                raw = stream_chat_completion(args.base_url, warmup, args.api_key, args.timeout)
                write_json(args.output.with_suffix(".warmup.json"), raw)
            except RequestFailure as exc:
                write_json(args.output.with_suffix(".warmup.json"), dict(error=str(exc), kind=exc.kind, partial=exc.partial))
                raise
        for job in planned:
            if journal.done(job["job_id"], args.retry_failed):
                continue
            row = execute_request(job, chat_payload(job["messages"], model, args.max_tokens, args.seed),
                                  journal, args.base_url, args.api_key, status, args.timeout)
            print(f"{job['job_id']}: {row['run_status']}, valid={row['measurement_valid']}")
    finally:
        write_summary(journal.primary_rows(), args.output)
    return 3 if any(r.get("run_status") != "completed" for r in journal.primary_rows()) else 0


if __name__ == "__main__":
    raise SystemExit(main())
