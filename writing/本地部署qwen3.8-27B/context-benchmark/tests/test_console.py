from __future__ import annotations

import io
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import benchmark_suite as suite
from benchmark_console import Activity, Console, RequestProgress, clean, show_stage_result


class ConsoleTests(unittest.TestCase):
    def test_live_relay_arrives_before_child_exit_and_redacts_both_destinations(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            gate = folder / "continue"
            (folder / "child.py").write_text(
                "import pathlib, sys, time\n"
                "print('中文请求 \\x1b[31msk-unsloth-test-secret\\x1b[0m', flush=True)\n"
                "deadline = time.monotonic() + 5\n"
                "while not pathlib.Path(sys.argv[1]).exists() and time.monotonic() < deadline: time.sleep(.01)\n"
                "print('已完成', flush=True)\nraise SystemExit(3)\n", encoding="utf-8")
            received = threading.Event()

            class Output(io.StringIO):
                def write(self, text):
                    result = super().write(text)
                    if "中文请求" in text:
                        received.set()
                    return result

            output = Output()
            result = []
            errors = []
            def run():
                try:
                    result.append(suite.invoke("child.py", [gate], folder, dict(os.environ, PYTHONIOENCODING="utf-8")))
                except BaseException as exc:
                    errors.append(exc)
            with patch.object(suite, "HERE", folder), patch.object(suite, "console", Console(output)):
                thread = threading.Thread(target=run)
                thread.start()
                try:
                    self.assertTrue(received.wait(3), "Output was buffered until child exit")
                    self.assertTrue(thread.is_alive())
                    self.assertIn("[REDACTED]", (folder / "child.log").read_text(encoding="utf-8"))
                finally:
                    gate.touch()
                    thread.join(6)
            self.assertFalse(thread.is_alive())
            self.assertEqual(errors, [])
            self.assertEqual(result, [3])
            for text in (output.getvalue(), (folder / "child.log").read_text(encoding="utf-8")):
                self.assertIn("已完成", text)
                self.assertNotIn("sk-unsloth-", text)
                self.assertNotIn("\x1b", text)

    def test_relay_interrupt_stops_owned_runner(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            (folder / "child.py").write_text("import time\nprint('ready', flush=True)\ntime.sleep(30)\n", encoding="utf-8")
            created = []
            original = subprocess.Popen
            def launch(*args, **kwargs):
                process = original(*args, **kwargs)
                created.append(process)
                return process
            with patch.object(suite, "HERE", folder), patch.object(suite.subprocess, "Popen", side_effect=launch), \
                 patch.object(suite.console, "raw", side_effect=KeyboardInterrupt):
                with self.assertRaises(KeyboardInterrupt):
                    suite.invoke("child.py", [], folder, os.environ.copy())
            self.assertEqual(len(created), 1)
            self.assertIsNotNone(created[0].poll())
            self.assertTrue(created[0].stdout.closed)

    def test_heartbeat_reports_phase_and_stops_without_slowing_short_requests(self):
        emitted = threading.Event()
        output = io.StringIO()
        target = Console(output)
        original = target.emit
        def emit(label, text):
            original(label, text)
            if label == "进行":
                emitted.set()
        with patch.object(target, "emit", side_effect=emit):
            with RequestProgress(dict(job_id="A-s3407", task_name="A：计算", seed=3407), 1, 3,
                                 interval=.02, output=target) as progress:
                progress.update("生成推理，尚未收到最终答案", input_tokens=100)
                self.assertTrue(emitted.wait(2))
            self.assertFalse(progress.thread.is_alive())
        self.assertIn("生成推理", output.getvalue())
        self.assertIn("输入 100 Token", output.getvalue())
        self.assertNotIn("预计剩余", output.getvalue())

    def test_results_distinguish_format_budget_and_transport_without_dumping_answers(self):
        output = io.StringIO()
        progress = RequestProgress(dict(job_id="test"), 1, 3, output=Console(output))
        progress.finish(dict(run_status="completed", measurement_valid=True, content_correct=True,
                             format_valid=False, task_success=False, answer="private answer"))
        self.assertIn("格式不合规", output.getvalue())
        self.assertNotIn("内容错误", output.getvalue())
        self.assertIn("未提供", output.getvalue())
        self.assertNotIn("private answer", output.getvalue())
        output.seek(0)
        output.truncate()
        progress.finish(dict(run_status="completed", measurement_valid=False, budget_exhausted=True))
        self.assertIn("输出预算耗尽", output.getvalue())
        progress.finish(dict(run_status="failed", error_kind="http_error", runtime_error="HTTP 503 sk-unsloth-test-error"))
        self.assertIn("调用失败", output.getvalue())
        self.assertIn("HTTP 503 [REDACTED]", output.getvalue())

    def test_terminal_control_sequences_and_log_file_are_plain_text(self):
        self.assertEqual(clean("\x1b]0;title\x07中文\r\x1b[2J\x1b[31m日志\x1b[0m"), "中文日志")
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "console.log"
            output = io.StringIO()
            target = Console(output)
            target.set_log(path)
            try:
                target.emit("检查", "中文 sk-unsloth-test-file")
            finally:
                target.close()
            self.assertEqual(path.read_text(encoding="utf-8"), output.getvalue())
            self.assertIn("[REDACTED]", output.getvalue())

    def test_unknown_configuration_and_partial_execution_are_not_reported_as_passed(self):
        from benchmark_console import show_run_result
        with patch("benchmark_console.console", Console(io.StringIO())) as output:
            record = dict(id="test", stage=dict(kind="quality"), status="partial",
                          configuration_verdict="unknown", verdict="unverified", cleanup_status="completed")
            show_stage_result(record, Path("stage"))
            show_run_result([record], Path("run"), 90)
            text = output.stream.getvalue()
        self.assertIn("部分完成（partial）", text)
        self.assertIn("待确认（unverified）", text)
        self.assertIn("部分完成 1", text)
        self.assertNotIn("全部通过", text)


if __name__ == "__main__":
    unittest.main()
