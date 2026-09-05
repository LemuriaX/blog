from __future__ import annotations
import base64
import copy
import itertools
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import benchmark_common as bc
from benchmark_suite import (build_plan, model_files, server_command, run_stage, cli_help_supported,
                             check_cli_help, wait_ready, collect_backend_log, read_logs, wait_port_released, port_is_listening)
from benchmark_validation import validate_runtime
from managed_process import ManagedProcess
from run_context_benchmark import build_summary
from run_profile_benchmark import build_task_summaries, load_short_tasks, parse_args as parse_quality_args


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_POST(self):
        data = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        if self.path.endswith("count_tokens"):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"input_tokens":10}')
            return
        mode = data.get("test_mode", "ok")
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        try:
            if mode == "stall":
                time.sleep(.8)
                return
            self.wfile.write(b': comment\n\ndata: {"choices":[{"delta":{"reasoning":"check"}}]}\n\n')
            self.wfile.flush()
            if mode == "drip":
                for _ in range(25):
                    self.wfile.write(b': keepalive\n\n')
                    self.wfile.flush()
                    time.sleep(.04)
                return
            # Multi-line SSE data is legal: a newline remains valid JSON whitespace.
            event = {"choices": [{"index": 0, "delta": {"content": '{"x":1}'}}]}
            self.wfile.write(("data: " + json.dumps(event) + "\n\n").encode())
            self.wfile.flush()
            if mode == "broken":
                return
            finish = "length" if mode == "length" else "stop"
            self.wfile.write((f'data: {{"choices":[{{"finish_reason":"{finish}","delta":{{}}}}],\n'
                              'data: "usage":{"prompt_tokens":10,"completion_tokens":8}}\n\n').encode())
            if mode != "missing_done":
                self.wfile.write(b'data: [DONE]\n\n')
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass


class PipelineHandler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def json_response(self, value):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(json.dumps(value, ensure_ascii=False).encode("utf-8"))

    def do_GET(self):
        if self.path == "/v1/models":
            self.json_response({"data": [{"id": "mock-local-model"}]})
        else:
            self.json_response(dict(context_length=self.server.context_length, parallel_slots=1, chat_template="mock-template",
                                    mmproj_path=None, effective_speculative_type="off"))

    def do_POST(self):
        payload = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        self.server.requests.append((self.path, payload))
        content = payload["messages"][-1]["content"]
        # Deliberately simple fake tokenizer; it tests wiring, never model accuracy.
        count = len(content) + 10 + int(payload.get("enable_thinking", False)) * 3
        if self.path.endswith("count_tokens"):
            self.json_response({"input_tokens": count})
            return
        tasks = load_short_tasks(HERE / "benchmark_tasks.json", "extended")
        answer = next((t["expected"] for t in tasks if t["prompt"] == content), None)
        if answer is None:
            projects = re.search(r"查询项目：([^。]+)", content).group(1).split("、")
            records = dict(re.findall(r"项目记录：项目 ([^，]+)，版本 2，状态有效，校验码 ([^。]+)", content))
            answer = {project: records.get(project) for project in projects}
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        events = [{"choices": [{"delta": {"content": json.dumps(answer, ensure_ascii=False)}}]},
                  {"choices": [{"delta": {}, "finish_reason": "stop"}],
                   "usage": {"prompt_tokens": count, "completion_tokens": 100},
                   "timings": {"prompt_per_second": 400, "predicted_per_second": 20}}]
        if payload.get("enable_thinking"):
            events.insert(0, {"choices": [{"delta": {"reasoning_content": "mock reasoning"}}]})
        for event in events:
            self.wfile.write(("data: " + json.dumps(event) + "\n\n").encode())
        self.wfile.write(b"data: [DONE]\n\n")


class PipelineTests(unittest.TestCase):
    def test_generator_both_runners_and_stage_aggregation(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            config = json.loads((HERE / "benchmark_config.json").read_text(encoding="utf-8"))
            with socket.socket() as probe:
                probe.bind(("127.0.0.1", 0))
                port = probe.getsockname()[1]
            args = SimpleNamespace(port=port, unsloth_path="unused", server_timeout=5, request_timeout=5,
                                   resume=False, retry_failed=False, suite="extended")
            owners = []

            class FakeManaged:
                def __init__(self, command, stdout, stderr):
                    self.server = ThreadingHTTPServer(("127.0.0.1", port), PipelineHandler)
                    context_length = int(command[command.index("--max-seq-length") + 1])
                    self.server.context_length = context_length
                    self.server.requests = []
                    self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
                    self.thread.start()
                    self.process = SimpleNamespace(poll=lambda: None)
                    self.closed = False
                    stdout.write_text(f"sk-unsloth-test-key\nllama_model_loader: loaded meta data from mock.gguf\noffloaded 72/72 layers to GPU\nn_ctx_per_seq = {context_length}\nn_batch = 1024\nn_ubatch = 512\ntype_k = 'q8_0' type_v = 'q8_0'\nflash_attn = 1\ncontext_shift = false\ncache_prompt = false", encoding="utf-8")
                    stderr.write_text("", encoding="utf-8")
                    owners.append(self)

                def close(self):
                    self.server.shutdown()
                    self.server.server_close()
                    self.thread.join()
                    self.closed = True

            stages = build_plan(config, selection="all", profiles=["performance"], capacity=False)
            for stage in stages:
                stage["target"] = 1800
                with patch("benchmark_suite.ManagedProcess", FakeManaged):
                    result = run_stage(stage, config, folder, args, {stage["quant"]: [{"path": "mock.gguf"}]})
                self.assertEqual(result["status"], "completed", result)
                self.assertEqual(result["configuration_verdict"], "pass")
                self.assertEqual(result["cleanup_status"], "completed")
                self.assertEqual(result["summary"]["task_success_rate"], 1)
                self.assertEqual(result["summary"]["planned_requests"], 63 if stage["kind"] == "quality" else 6)
                self.assertNotIn("sk-unsloth-test-key", (folder / stage["id"] / "server.stdout.log").read_text())
                requests = owners[-1].server.requests
                generations = [payload for path, payload in requests if path.endswith("completions")]
                for path, payload in requests:
                    # Check the generator, request counter and actual HTTP generation together.
                    self.assertEqual(payload["enable_thinking"], stage["kind"] == "quality")
                    if stage["kind"] == "quality":
                        self.assertEqual(payload["reasoning_effort"], "xhigh")
                    else:
                        self.assertNotIn("reasoning_effort", payload)
                for payload in generations:
                    if stage["kind"] == "quality":
                        self.assertEqual(payload["max_tokens"], 8192)
                        self.assertEqual((payload["temperature"], payload["top_p"], payload["presence_penalty"]),
                                         (1.0, .95, 0.0))
                    else:
                        self.assertIn(payload["max_tokens"], (32, 192))
                cases = list((folder / "cases").glob("*/case-01.json"))
                case = next(json.loads(p.read_text(encoding="utf-8")) for p in cases
                            if json.loads(p.read_text(encoding="utf-8"))["configured_context"] == stage["context"])
                self.assertEqual(case["thinking_enabled"], stage["kind"] == "quality")
                events = [json.loads(line) for line in (folder / stage["id"] / "results.events.jsonl").read_text(encoding="utf-8").splitlines()]
                starts = [event for event in events if event.get("event") == "start"]
                self.assertEqual(len(starts), len(generations) if stage["kind"] == "quality" else len(generations) - 1)
            self.assertTrue(all(owner.closed for owner in owners))

            class CleanupFailure(FakeManaged):
                def close(self):
                    super().close()
                    raise TimeoutError("test cleanup timeout")

            failed_stage = dict(stages[0], id="cleanup-failure")
            with patch("benchmark_suite.ManagedProcess", CleanupFailure):
                result = run_stage(failed_stage, config, folder, args, {failed_stage["quant"]: [{"path": "mock.gguf"}]})
            self.assertEqual(result["status"], "failed")
            self.assertEqual(result["verdict"], "unverified")
            self.assertEqual(result["cleanup_error"], "test cleanup timeout")
            self.assertEqual(result["summary"]["valid_requests"], 6)


class TransportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.server.daemon_threads = True
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def payload(self, mode):
        return dict(bc.chat_payload([{"role": "user", "content": "test"}], "mock", 20, 1), test_mode=mode)

    def test_complete_multiline_sse_and_reasoning_alias(self):
        result = bc.stream_chat_completion(self.url, self.payload("ok"), "secret", 2)
        self.assertTrue(result["stream_complete"])
        self.assertEqual(result["answer"], '{"x":1}')
        self.assertEqual(result["reasoning"], "check")
        self.assertIsNotNone(result["ttfa_client_s"])
        self.assertTrue(bc.result_metrics(result, 10, 100, 20)["measurement_valid"])

    def test_progress_follows_received_reasoning_and_answer_without_changing_result(self):
        phases = []
        result = bc.stream_chat_completion(self.url, self.payload("ok"), "secret", 2, progress=phases.append)
        self.assertEqual(phases, ["生成推理，尚未收到最终答案", "生成最终答案"])
        self.assertEqual(result["reasoning"], "check")
        self.assertEqual(result["answer"], '{"x":1}')
        self.assertTrue(bc.result_metrics(result, 10, 100, 20)["measurement_valid"])

    def test_eof_and_missing_done_retain_partial(self):
        for mode in ("broken", "missing_done"):
            with self.subTest(mode=mode), self.assertRaises(bc.RequestFailure) as caught:
                bc.stream_chat_completion(self.url, self.payload(mode), "secret", 2)
            self.assertEqual(caught.exception.kind, "incomplete_stream")
            self.assertEqual(caught.exception.partial["answer"], '{"x":1}')

    def test_output_length_is_not_input_truncation(self):
        result = bc.stream_chat_completion(self.url, self.payload("length"), "secret", 2)
        metrics = bc.result_metrics(result, 10, 100, 20)
        self.assertTrue(metrics["budget_exhausted"])
        self.assertFalse(metrics["truncated"])
        self.assertFalse(metrics["measurement_valid"])

    def test_socket_read_timeout_is_classified(self):
        with self.assertRaises(bc.RequestFailure) as caught:
            bc.stream_chat_completion(self.url, self.payload("stall"), "secret", 2, read_timeout=.1)
        self.assertEqual(caught.exception.kind, "read_timeout")

    def test_keepalive_cannot_extend_absolute_deadline(self):
        started = time.monotonic()
        with self.assertRaises(bc.RequestFailure) as caught:
            bc.stream_chat_completion(self.url, self.payload("drip"), "secret", .22)
        self.assertEqual(caught.exception.kind, "deadline_timeout")
        self.assertLess(time.monotonic() - started, .75)
        self.assertEqual(caught.exception.partial["reasoning"], "check")

    def test_success_survives_later_timeout(self):
        with tempfile.TemporaryDirectory() as tmp:
            jobs = [dict(job_id=str(i), expected={"x": 1}) for i in range(2)]
            journal = bc.Journal(Path(tmp) / "out.csv", jobs, {})
            bc.execute_request(jobs[0], self.payload("ok"), journal, self.url, "secret", {"context_length": 100}, 2)
            bc.execute_request(jobs[1], self.payload("stall"), journal, self.url, "secret", {"context_length": 100}, .1)
            resumed = bc.Journal(Path(tmp) / "out.csv", jobs, {}, resume=True)
            self.assertEqual([r["run_status"] for r in resumed.rows], ["completed", "failed"])
            self.assertIn(resumed.rows[1]["error_kind"], {"read_timeout", "deadline_timeout"})
            self.assertIn('"usage"', resumed.path.read_text(encoding="utf-8"))
            self.assertTrue((Path(tmp) / "out.csv").exists())


class ScoringTests(unittest.TestCase):
    def test_ast_parentheses_and_spaces(self):
        expected = {"replacement": "return total / len(values)"}
        actual = json.dumps({"replacement": "return (total / (len(values)))"})
        self.assertTrue(bc.score_json_answer(actual, expected, ["replacement"])["content_correct"])
        self.assertFalse(bc.score_json_answer('{"replacement":"__import__(\"os\").system(\"bad\")"}', expected,
                                               ["replacement"])["content_correct"])

    def test_nested_types_bool_int_and_null(self):
        self.assertFalse(bc.type_matches({"x": [True]}, {"x": [1]}))
        self.assertFalse(bc.type_matches({"x": [1.0]}, {"x": [1]}))
        self.assertTrue(bc.type_matches({"x": [None, 1]}, {"x": [None, 1.0]}))

    def test_duplicate_keys_nonfinite_and_surrounding_prose(self):
        for answer in ('{"x":1,"x":1}', '{"x":NaN}', '{"x":Infinity}', '{"x":1e999}'):
            result = bc.score_json_answer(answer, {"x": 1})
            self.assertFalse(result["content_correct"])
        result = bc.score_json_answer('answer: {"x":1}', {"x": 1})
        self.assertTrue(result["content_correct"])
        self.assertFalse(result["format_valid"])

    def test_all_wrong_never_high_score(self):
        rows = [dict(task_id="a", task_name="a", measurement_valid=True, run_status="completed",
                     **bc.score_json_answer('{"x":2}', {"x": 1}), task_success=False) for _ in range(3)]
        summary = build_task_summaries(rows)[0]
        self.assertEqual(summary["task_success_rate"], 0)
        self.assertEqual(summary["content_correct_rate"], 0)
        self.assertEqual(summary["format_compliance_rate"], 1)

    def test_failures_remain_in_denominator(self):
        rows = [dict(task_id="a", task_name="a", run_status="completed", task_success=True,
                     content_correct=True, format_valid=True, measurement_valid=True)]
        rows += [dict(task_id="a", task_name="a", run_status="failed", measurement_valid=False)] * 2
        self.assertEqual(build_task_summaries(rows)[0]["task_success_rate"], 1 / 3)

    def test_backend_and_estimates_never_mix(self):
        stats = bc.metric_summary([dict(measurement_valid=True, prompt_tps=100),
                                   dict(measurement_valid=True, client_prompt_tps_est=900)])
        self.assertEqual(stats["prompt_tps"]["median"], 100)
        self.assertEqual(stats["prompt_tps"]["n"], 1)
        self.assertEqual(stats["client_prompt_tps_est"]["median"], 900)

    def test_task_counts_and_ground_truth_constraints(self):
        tasks = load_short_tasks(HERE / "benchmark_tasks.json", "extended")
        self.assertEqual(len(tasks), 20)
        self.assertEqual(len(load_short_tasks(HERE / "benchmark_tasks.json")), 4)
        for task in tasks:
            result = bc.score_json_answer(json.dumps(task["expected"]), task["expected"], task.get("code_fields", []))
            self.assertTrue(result["content_correct"], task["id"])
        solutions = [p for p in itertools.permutations("林赵陈王")
                     if p.index("林") + 1 == p.index("赵") and p.index("陈") > p.index("赵") and p.index("王") in (1, 2)]
        self.assertEqual(solutions, [tuple("林赵王陈")])
        items = [("A", 6, 13), ("B", 5, 12), ("C", 4, 10), ("D", 3, 7)]
        choices = [subset for n in range(5) for subset in itertools.combinations(items, n) if sum(x[1] for x in subset) <= 10]
        best = max(choices, key=lambda subset: sum(x[2] for x in subset))
        self.assertEqual([x[0] for x in best], ["A", "C"])


class JournalTests(unittest.TestCase):
    def test_resume_fingerprint_rejects_changes(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "result.csv"
            bc.Journal(path, [dict(job_id="1")], {"effort": "medium"})
            with self.assertRaises(ValueError):
                bc.Journal(path, [dict(job_id="1")], {"effort": "xhigh"}, resume=True)

    def test_interrupt_tail_and_retry_preserve_primary_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "result.csv"
            job = dict(job_id="1", expected={"x": 1})
            journal = bc.Journal(path, [job], {})
            journal.start(job, {"api_key": "secret"})
            with journal.path.open("ab") as handle:
                handle.write(b'{"event":')
            resumed = bc.Journal(path, [job], {}, resume=True)
            self.assertEqual(resumed.rows[0]["error_kind"], "interrupted")
            self.assertTrue(list(Path(tmp).glob("*.incomplete-*")))
            self.assertNotIn("secret", resumed.path.read_text(encoding="utf-8"))
            self.assertFalse(resumed.done("1", retry_failed=True))
            event = resumed.start(job, {})
            resumed.finish(event, dict(run_status="completed", measurement_valid=True, task_success=True))
            self.assertFalse(resumed.primary_rows()[0]["task_success"])
            self.assertEqual(resumed.rows[-1]["attempt"], 2)


class PlanValidationTests(unittest.TestCase):
    def setUp(self):
        self.config = json.loads((HERE / "benchmark_config.json").read_text(encoding="utf-8"))
        self.stage = build_plan(self.config)[0]

    def test_port_release_waits_and_leaves_unrelated_listener_alone(self):
        with patch("benchmark_suite.port_is_listening", side_effect=OSError("probe unavailable")):
            with self.assertRaises(OSError):
                wait_port_released(8001, timeout=0)
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            listener.listen(16)
            port = listener.getsockname()[1]
            self.assertTrue(port_is_listening(port))
            with self.assertRaisesRegex(TimeoutError, str(port)):
                wait_port_released(port, timeout=.05)
            self.assertEqual(listener.getsockname()[1], port)
            closer = threading.Timer(.15, listener.close)
            closer.start()
            try:
                wait_port_released(port, timeout=2)
                self.assertEqual(listener.fileno(), -1)
                self.assertFalse(port_is_listening(port))
            finally:
                closer.join()

    def test_cli_help_distinguishes_native_and_passthrough_flags(self):
        native_help = "\x1b[1m--model\x1b[0m --max-seq-length --gpu-memory-mode --parallel"
        self.assertTrue(cli_help_supported(native_help, 0))
        self.assertFalse(cli_help_supported(native_help, 1))
        self.assertFalse(cli_help_supported("--model", 0))
        self.assertFalse(cli_help_supported(native_help.replace("--model", "--model-extra"), 0))

    def test_cli_help_avoids_rich_truncation_without_changing_parent_environment(self):
        narrow = "│ --model,--hf-re… │ --max-seq-lengt… │ --gpu-memory-mo… │ --parallel,--n-… │"
        full = "│ --model,--hf-repo │ --max-seq-length │ --gpu-memory-mode │ --parallel,--n-parallel │"
        self.assertFalse(cli_help_supported(narrow, 0))

        def render_help(command, **kwargs):
            env = kwargs["env"]
            width = min(int(env["COLUMNS"]), int(env["TERMINAL_WIDTH"]))
            return subprocess.CompletedProcess(command, 0, full if width >= 200 else narrow, "")

        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ, COLUMNS="80", TERMINAL_WIDTH="80"):
            folder = Path(tmp)
            with patch("benchmark_suite.subprocess.run", side_effect=render_help):
                check_cli_help("unsloth.exe", folder)
            self.assertEqual(os.environ["COLUMNS"], "80")
            self.assertEqual(os.environ["TERMINAL_WIDTH"], "80")
            self.assertEqual((folder / "unsloth-run-help.txt").read_text(encoding="utf-8"), full)
            report = json.loads((folder / "unsloth-cli-validation.json").read_text(encoding="utf-8"))
            self.assertEqual(report["returncode"], 0)
            self.assertEqual(report["missing_options"], [])

    def test_cli_help_reports_process_failure_separately_from_missing_options(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            failed = subprocess.CompletedProcess([], 1, "", "Unable to create process")
            with patch("benchmark_suite.subprocess.run", return_value=failed):
                with self.assertRaisesRegex(ValueError, "退出码 1"):
                    check_cli_help("unsloth.exe", folder)
            report = json.loads((folder / "unsloth-cli-validation.json").read_text(encoding="utf-8"))
            self.assertIsNone(report["missing_options"])
            self.assertIn("Unable to create process", (folder / "unsloth-run-help.txt").read_text(encoding="utf-8"))

            incomplete = subprocess.CompletedProcess([], 0, "--model --parallel", "")
            with patch("benchmark_suite.subprocess.run", return_value=incomplete):
                with self.assertRaisesRegex(ValueError, "--max-seq-length, --gpu-memory-mode"):
                    check_cli_help("unsloth.exe", folder)
            report = json.loads((folder / "unsloth-cli-validation.json").read_text(encoding="utf-8"))
            self.assertEqual(report["missing_options"], ["--max-seq-length", "--gpu-memory-mode"])

    def test_full_plan_reuses_8k_and_keeps_quality_budget(self):
        plan = build_plan(self.config, ablations=True, boundary=True)
        self.assertEqual(len(plan), 16)
        self.assertTrue(next(s for s in plan if s["id"] == "context-performance")["also_capacity"])
        self.assertFalse(any(s["id"] == "capacity-8K" for s in plan))
        self.assertTrue(all(s["target"] + s["output_budget"] + 128 + 64 <= s["context"] for s in plan))
        quality = [s for s in plan if s["kind"] == "quality"]
        self.assertEqual(len(quality), 3)
        self.assertTrue(all(s["thinking"] and s["effort"] == "xhigh" and s["context"] == 16384
                            and s["output_budget"] == 8192 for s in quality))
        for stage in plan:
            if stage["kind"] != "quality":
                self.assertFalse(stage["thinking"])
                self.assertIsNone(stage["effort"])
                self.assertEqual(stage["max_tokens"], 192)

    def test_quality_only_selection_and_rejected_thinking_settings(self):
        plan = build_plan(self.config, selection="quality", ablations=True, boundary=True)
        self.assertEqual({s["id"] for s in plan}, {"performance-quality", "quality-quality", "context-quality"})
        for overrides in ({"thinking": False}, {"effort": "medium"}, {"effort": "low"}):
            config = copy.deepcopy(self.config)
            config["profiles"][0].update(overrides)
            with self.subTest(overrides=overrides), self.assertRaisesRegex(ValueError, "Thinking enabled with effort=xhigh"):
                build_plan(config, selection="quality")
        config = copy.deepcopy(self.config)
        config["ablations"].append(dict(config["profiles"][0], name="old-thinking-off", kind="quality",
                                        context=16384, target=4600, thinking=False))
        with self.assertRaisesRegex(ValueError, "ablation-old-thinking-off"):
            build_plan(config, ablations=True)
        config = copy.deepcopy(self.config)
        config["quality_context"] = 8192
        with self.assertRaisesRegex(ValueError, "budget does not fit"):
            build_plan(config)

    def test_standalone_quality_runner_defaults_to_xhigh(self):
        argv = ["run_profile_benchmark.py", "--profile", "test", "--long-cases-dir", "cases", "--output", "results.csv"]
        with patch.object(sys, "argv", argv):
            args = parse_quality_args()
        self.assertTrue(args.enable_thinking)
        self.assertEqual(args.reasoning_effort, "xhigh")
        self.assertEqual(args.max_tokens, 8192)

    def test_request_echo_is_not_gpu_proof(self):
        report = validate_runtime({"gpu_layers": 999, "context_length": 8192}, "", self.stage)
        self.assertEqual(report["verdict"], "unknown")
        check = next(c for c in report["checks"] if c["name"] == "all_layers_on_gpu")
        self.assertEqual(check["status"], "unknown")

    def test_external_backend_log_uses_latest_announced_file_and_current_log_format(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "stage"
            folder.mkdir()
            backend = Path(tmp) / "llama-server"
            backend.mkdir()
            previous = backend / "llama-100-port-3770-try0.log"
            current = backend / "llama-100-port-3770-try1.log"
            previous.write_text("offloaded 1/65 layers to GPU", encoding="utf-8")
            model_path = str(Path(tmp) / "model.gguf")
            current.write_text(f"0.00 I srv load_model: loading model '{model_path}'\n"
                               "0.04 I srv load_model: initializing, n_slots = 1, n_ctx_slot = 8192\n"
                               "0.04 I srv llama_server: model loaded\n"
                               "API Key: sk-unsloth-test-backend\n", encoding="utf-8")
            (folder / "server.stdout.log").write_text("\n".join(
                json.dumps({"event": "llama-server stdout/stderr -> " + str(path)})
                for path in (previous, current)), encoding="utf-8")
            report = collect_backend_log(folder, backend)
            self.assertEqual(report["status"], "captured")
            self.assertEqual(report["source"], str(current.resolve()))
            captured = (folder / "llama-server.log").read_text(encoding="utf-8")
            self.assertNotIn("sk-unsloth-test-backend", captured)
            self.assertNotIn("offloaded 1/65", captured)
            validation = validate_runtime({"context_length": 8192, "gpu_layers": 999},
                                          read_logs(folder), dict(self.stage, model_path=model_path))
            checks = {item["name"]: item["status"] for item in validation["checks"]}
            self.assertEqual(checks["loaded_model_file"], "pass")
            self.assertEqual(checks["context_per_sequence"], "pass")
            self.assertEqual(checks["all_layers_on_gpu"], "unknown")
            self.assertEqual(validation["verdict"], "unknown")
            command = server_command("unsloth.exe", model_path, self.stage, self.config, 8001)
            self.assertEqual(command[command.index("--log-verbosity") + 1], "4")
            self.assertNotIn("--log-file", command)

    def test_backend_log_capture_rejects_paths_outside_expected_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "stage"
            folder.mkdir()
            outside = Path(tmp) / "llama-100-port-3770-try0.log"
            outside.write_text("unrelated content", encoding="utf-8")
            (folder / "server.stdout.log").write_text(
                json.dumps({"event": "llama-server stdout/stderr -> " + str(outside)}), encoding="utf-8")
            report = collect_backend_log(folder, Path(tmp) / "llama-server")
            self.assertEqual(report["status"], "unavailable")
            self.assertFalse((folder / "llama-server.log").exists())

    def test_actual_partial_offload_is_failure(self):
        report = validate_runtime({"context_length": 8192}, "offloaded 64/65 layers to GPU", self.stage)
        self.assertEqual(report["verdict"], "fail")

    def test_effective_evidence_can_pass_without_hardcoded_layer_count(self):
        log = "llama_model_loader: loaded meta data from mock.gguf\noffloaded 72/72 layers to GPU\nn_ctx_per_seq = 8192\nn_batch = 1024\nn_ubatch = 512\ntype_k = 'q8_0', type_v = 'q8_0'\nflash_attn = 1\ncontext_shift = false\ncache_prompt = false"
        status = dict(context_length=8192, parallel_slots=1, mmproj_path=None, effective_speculative_type="off")
        stage = dict(self.stage, model_path="mock.gguf")
        self.assertEqual(validate_runtime(status, log, stage)["verdict"], "pass")
        self.assertEqual(validate_runtime(status, log, dict(stage, model_path="other.gguf"))["verdict"], "fail")

    def test_shards_and_ambiguity(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            first = folder / "Qwen3.8-27B-UD-Q4_K_S-00001-of-00002.gguf"
            first.write_bytes(b"mock")
            config = dict(local_model_files={"UD-Q4_K_S": str(first)})
            with self.assertRaises(ValueError):
                model_files("UD-Q4_K_S", config)
            second = folder / "Qwen3.8-27B-UD-Q4_K_S-00002-of-00002.gguf"
            second.write_bytes(b"mock")
            self.assertEqual(model_files("UD-Q4_K_S", config), [first, second])
            (folder / "Qwen3.8-27B-UD-Q4_K_S.gguf").write_bytes(b"mock")
            with patch.dict(os.environ, {"HF_HOME": str(folder / "none"), "HF_HUB_CACHE": "", "HUGGINGFACE_HUB_CACHE": ""}):
                with self.assertRaises(ValueError):
                    model_files("UD-Q4_K_S", {}, folder)

    def test_dry_run_never_launches_cli(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = subprocess.run([sys.executable, str(HERE / "benchmark_suite.py"), "--dry-run", "--output-root", tmp,
                                     "--unsloth-path", "DOES-NOT-EXIST.exe"], capture_output=True, timeout=30)
            self.assertEqual(result.returncode, 0, result.stderr.decode(errors="replace"))
            self.assertTrue((Path(tmp) / "plan.json").exists())
            self.assertFalse((Path(tmp) / "run-manifest.json").exists())


@unittest.skipUnless(os.name == "nt", "PowerShell native output encoding")
class PowerShellEncodingTests(unittest.TestCase):
    def test_entry_decodes_utf8_and_restores_legacy_console_settings(self):
        shells = [path for name in ("powershell.exe", "pwsh.exe") if (path := shutil.which(name))]
        if not shells:
            self.skipTest("PowerShell is not installed")
        for shell in shells:
            with self.subTest(shell=shell), tempfile.TemporaryDirectory() as tmp:
                folder = Path(tmp) / "中文测试"
                folder.mkdir()
                shutil.copyfile(HERE / "benchmark_entry.psm1", folder / "benchmark_entry.psm1")
                (folder / "benchmark_suite.py").write_text(
                    "import os\nprint('模型和接口已就绪。')\n"
                    "print('python_utf8=' + os.environ.get('PYTHONUTF8', '') + ';io=' + os.environ.get('PYTHONIOENCODING', ''))\n"
                    "raise SystemExit(3)\n", encoding="utf-8")
                quote = lambda value: "'" + str(value).replace("'", "''") + "'"
                report = folder / "report.json"
                script = f"""
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.Encoding]::GetEncoding(936)
[Console]::OutputEncoding = [Text.Encoding]::GetEncoding(936)
$OutputEncoding = [Text.Encoding]::ASCII
$env:PYTHONIOENCODING = 'cp936'
$env:PYTHONUTF8 = '0'
Import-Module {quote(folder / 'benchmark_entry.psm1')} -Force
$received = @(Invoke-BenchmarkSuite -Mode full -Options @{{ PythonPath = {quote(sys.executable)} }})
$data = @{{
    output = $received
    inputCodePage = [Console]::InputEncoding.CodePage
    outputCodePage = [Console]::OutputEncoding.CodePage
    pipelineCodePage = $OutputEncoding.CodePage
    pythonIOEncoding = $env:PYTHONIOENCODING
    pythonUtf8 = $env:PYTHONUTF8
}}
try {{ Invoke-BenchmarkSuite -Mode full -Options @{{ PythonPath = {quote(folder / 'missing.exe')} }} }}
catch {{ $data['missingPythonError'] = $_.Exception.Message }}
[IO.File]::WriteAllText({quote(report)}, ($data | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
"""
                encoded = base64.b64encode(script.encode("utf-16-le")).decode("ascii")
                # RemoteSigned applies only to this test process and allows the
                # newly created local fixture without changing the user's policy.
                result = subprocess.run([shell, "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "RemoteSigned",
                                         "-EncodedCommand", encoded],
                                        capture_output=True, timeout=20, creationflags=subprocess.CREATE_NO_WINDOW)
                self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8", errors="replace"))
                data = json.loads(report.read_text(encoding="utf-8"))
                self.assertEqual(data["output"], ["模型和接口已就绪。", "python_utf8=1;io=utf-8", 3])
                self.assertEqual(data["inputCodePage"], 936)
                self.assertEqual(data["outputCodePage"], 936)
                self.assertEqual(data["pipelineCodePage"], 20127)
                self.assertEqual(data["pythonIOEncoding"], "cp936")
                self.assertEqual(data["pythonUtf8"], "0")
                self.assertIn("找不到可用的 Python 3.10+", data["missingPythonError"])


@unittest.skipUnless(os.name == "nt", "Windows Job Object regression")
class OwnershipTests(unittest.TestCase):
    def test_hidden_process_forwards_output_for_readiness(self):
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ, UNSLOTH_API_KEY=""):
            folder = Path(tmp)
            child = "import sys; print('API Key: sk-unsloth-startup-test', flush=True); print('backend-ready', file=sys.stderr, flush=True)"
            managed = ManagedProcess([sys.executable, "-u", "-c", child],
                                     folder / "server.stdout.log", folder / "server.stderr.log")
            try:
                self.assertEqual(managed.process.wait(timeout=5), 0)
                self.assertIn("sk-unsloth-startup-test", (folder / "server.stdout.log").read_text())
                self.assertIn("backend-ready", (folder / "server.stderr.log").read_text())

                def status_api(base_url, endpoint, key, timeout):
                    self.assertEqual(key, "sk-unsloth-startup-test")
                    return {"context_length": 8192} if endpoint.endswith("status") else {"data": [{"id": "test-model"}]}

                with patch("benchmark_suite.get_json", side_effect=status_api):
                    key, status, model_id = wait_ready("http://unused", folder, managed, 2)
                self.assertEqual(model_id, "test-model")
            finally:
                managed.close()

    def test_exited_launcher_descendant_is_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            marker = folder / "child.pid"
            child = "import os,time; from pathlib import Path; Path(" + repr(str(marker)) + ").write_text(str(os.getpid())); time.sleep(30)"
            launcher = "import subprocess,sys; subprocess.Popen([sys.executable,'-c'," + repr(child) + "])"
            managed = ManagedProcess([sys.executable, "-c", launcher], folder / "out", folder / "err")
            try:
                end = time.monotonic() + 5
                while not marker.exists() and time.monotonic() < end:
                    time.sleep(.02)
                self.assertTrue(marker.exists())
                managed.process.wait(timeout=5)
                pid = int(marker.read_text())
                import ctypes
                kernel = ctypes.WinDLL("kernel32", use_last_error=True)
                kernel.OpenProcess.restype = ctypes.c_void_p
                handle = kernel.OpenProcess(0x100000, False, pid)
                self.assertTrue(handle)
                try:
                    managed.close()
                    kernel.WaitForSingleObject.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
                    # close() must finish descendant termination before the next
                    # stage starts; waiting here would hide the shutdown race.
                    self.assertEqual(kernel.WaitForSingleObject(handle, 0), 0)
                finally:
                    kernel.CloseHandle.argtypes = [ctypes.c_void_p]
                    kernel.CloseHandle(handle)
            finally:
                managed.close()

    def test_consecutive_launchers_can_reuse_descendants_port(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            with socket.socket() as probe:
                probe.bind(("127.0.0.1", 0))
                port = probe.getsockname()[1]
            for index in range(3):
                with self.subTest(stage=index):
                    marker = folder / f"ready-{index}"
                    child = ("import socket,time; from pathlib import Path; "
                             "s=socket.socket(); s.bind(('127.0.0.1'," + str(port) + ")); "
                             "s.listen(); Path(" + repr(str(marker)) + ").write_text('ready'); time.sleep(30)")
                    launcher = "import subprocess,sys; subprocess.Popen([sys.executable,'-c'," + repr(child) + "])"
                    managed = ManagedProcess([sys.executable, "-c", launcher], folder / "out", folder / "err")
                    try:
                        managed.process.wait(timeout=5)
                        deadline = time.monotonic() + 5
                        while not marker.exists() and time.monotonic() < deadline:
                            time.sleep(.02)
                        self.assertTrue(marker.exists(), (folder / "err").read_text())
                        managed.close()
                        with socket.socket() as probe:
                            # A live descendant listener rejects an exclusive bind.
                            probe.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
                            probe.bind(("127.0.0.1", port))
                    finally:
                        managed.close()


if __name__ == "__main__":
    unittest.main()
