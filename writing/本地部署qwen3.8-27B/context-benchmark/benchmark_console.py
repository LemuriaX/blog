"""Readable UTF-8 progress output; measurement records remain the source of truth."""
from __future__ import annotations

import math
import re
import sys
import threading
import time
from datetime import datetime

from benchmark_common import redact


KINDS = {"quality": "质量测试", "performance": "共同性能", "capacity": "上下文容量"}
STATES = {"completed": "完成", "partial": "部分完成", "failed": "失败", "pending": "待执行"}
CHECKS = {
    "context_shift": "旧 Token 移出（Context Shift）",
    "prompt_cache": "输入前缀缓存（Prompt Cache）",
    "vision_projector_loaded": "视觉投影组件",
    "speculative_decoding": "推测解码",
}


def clean(value):
    text = str(value)
    text = re.sub(r"\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)", "", text)
    text = re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", text)
    text = re.sub(r"[\x00-\x08\x0b-\x1f\x7f]", "", text)
    return redact(text)


def number(value, digits=2, suffix=""):
    if type(value) not in (int, float) or not math.isfinite(value):
        return "未提供"
    return f"{value:,.{digits}f}{suffix}"


def duration(value):
    if type(value) not in (int, float) or not math.isfinite(value):
        return "未提供"
    if value < 60:
        return f"{value:.2f}s"
    minutes, seconds = divmod(int(value), 60)
    hours, minutes = divmod(minutes, 60)
    return f"{hours}h {minutes:02d}m {seconds:02d}s" if hours else f"{minutes}m {seconds:02d}s"


def progress_bar(done, total, width=16):
    ratio = min(1, max(0, done / total)) if total else 0
    filled = int(ratio * width)
    return f"[{'#' * filled}{'-' * (width - filled)}] {done}/{total}"


class Console:
    def __init__(self, stream=None):
        self.stream = stream
        self.log = None
        self.lock = threading.RLock()

    def set_log(self, path):
        self.close()
        self.log = path.open("a", encoding="utf-8", buffering=1)

    def close(self):
        with self.lock:
            if self.log:
                self.log.close()
                self.log = None

    def raw(self, value=""):
        text = clean(value).rstrip("\n")
        with self.lock:
            if self.log:
                self.log.write(text + "\n")
            print(text, file=self.stream or sys.stdout, flush=True)

    def emit(self, label, message):
        self.raw(f"{datetime.now():%H:%M:%S}  [{label}] {message}")

    def detail(self, message):
        self.raw(f"                 {message}")

    def section(self, title):
        self.raw()
        self.raw("=" * 76)
        self.raw(f"  {title}")
        self.raw("=" * 76)


console = Console()


class Activity:
    """Occasional status on a separate thread; never print individual tokens."""
    def __init__(self, message, interval=15, output=None):
        self.message = message
        self.interval = interval
        self.output = output or console
        self.stop_event = threading.Event()
        self.started = None
        self.thread = None

    def __enter__(self):
        self.started = time.monotonic()
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()
        return self

    def _run(self):
        while not self.stop_event.wait(self.interval):
            message = self.message() if callable(self.message) else self.message
            self.output.emit("进行", f"{message} | 已用 {duration(time.monotonic() - self.started)}")

    def __exit__(self, *args):
        self.stop_event.set()
        self.thread.join()


class RequestProgress(Activity):
    def __init__(self, job, index, total, attempt=1, interval=15, output=None):
        self.job = job
        self.index, self.total, self.attempt = index, total, attempt
        self.phase = "输入计数"
        self.input_tokens = None
        super().__init__(self.status, interval, output)

    def status(self):
        counted = f" | 输入 {self.input_tokens:,} Token" if self.input_tokens is not None else ""
        return f"请求 {self.index:02d}/{self.total} | {self.phase}{counted}"

    def update(self, phase, **details):
        # Called only at phase boundaries. No terminal I/O in the SSE consumer.
        self.phase = phase
        if "input_tokens" in details:
            self.input_tokens = details["input_tokens"]

    def __enter__(self):
        title = self.job.get("task_name") or self.job.get("case_file") or self.job["job_id"]
        seed = f" | seed {self.job['seed']}" if "seed" in self.job else ""
        retry = f" | 第 {self.attempt} 次尝试" if self.attempt > 1 else ""
        self.output.emit("请求", f"{self.index:02d}/{self.total}  {title}{seed}{retry}")
        self.output.detail(f"ID {self.job['job_id']}")
        return super().__enter__()

    def finish(self, row):
        if row.get("run_status") != "completed":
            result = "调用失败"
        elif row.get("budget_exhausted"):
            result = "输出预算耗尽"
        elif not row.get("measurement_valid"):
            result = "测量无效"
        elif row.get("task_success"):
            result = "通过"
        else:
            result = "、".join(label for key, label in (("content_correct", "内容错误"),
                                                       ("format_valid", "格式不合规")) if not row.get(key))
        self.output.emit("结果", f"{progress_bar(self.index, self.total)}  {result}")
        self.output.detail(f"总耗时 {duration(row.get('total_s'))} | 首输出 {duration(row.get('ttft_client_s'))}"
                           f" | 最终答案 {duration(row.get('ttfa_client_s'))}")
        self.output.detail(f"Token 输入 {number(row.get('tokens_evaluated', row.get('counted_prompt_tokens')), 0)}"
                           f" / 输出 {number(row.get('output_tokens'), 0)}"
                           f" | 生成 {number(row.get('decode_tps'), 2, ' Token/s')}（引擎）")
        if row.get("runtime_error"):
            self.output.detail(f"原因 [{row.get('error_kind', 'error')}] {row['runtime_error']}")
        elif row.get("validation_errors"):
            self.output.detail("测量检查：" + ", ".join(row["validation_errors"]))
        self.output.raw()


def show_stage(stage, index, total, requests):
    console.section(f"阶段 {index}/{total} · {stage['quant'].removeprefix('UD-')} · {KINDS[stage['kind']]}")
    console.emit("配置", f"{stage['id']} | 正式请求 {requests} 次")
    thinking = f"开启 / {stage['effort']}" if stage["thinking"] else "关闭"
    console.detail(f"窗口 {stage['context']:,} | 长文目标 {stage['target']:,} | 最大输出 {stage['output_budget']:,} Token")
    console.detail(f"Thinking {thinking} | KV {stage['kv']} | Batch/UBatch {stage['batch']}/{stage['ubatch']}")
    console.detail(f"Temperature {stage['temperature']:g} | Top-p {stage['top_p']:g} | Top-k {stage['top_k']}"
                   f" | Presence Penalty {stage['presence_penalty']:g}")


def show_validation(validation):
    counts = {state: sum(item["status"] == state for item in validation["checks"]) for state in ("pass", "fail", "unknown")}
    console.emit("核验", f"通过 {counts['pass']} 项 | 不一致 {counts['fail']} 项 | 待确认 {counts['unknown']} 项")
    for item in validation["checks"]:
        if item["status"] == "unknown":
            console.detail("待确认：" + CHECKS.get(item["name"], item["name"]))
        elif item["status"] == "fail":
            console.detail(f"不一致：{item['name']} | 预期 {item['expected']} | 实际 {item['actual']}")
    if counts["unknown"]:
        console.detail("继续测量；配置保留 unverified，不等于请求失败。")


def show_stage_result(record, folder):
    status = record["status"]
    console.emit("阶段", f"{STATES.get(status, status)}（{status}） | {record['id']}")
    summary = record.get("summary", {})
    n = summary.get("planned_requests", 0)
    if n:
        console.detail(f"正常返回 {summary['completed_requests']}/{n} | 有效测量 {summary['valid_requests']}/{n}"
                       f" | 任务成功率 {summary['task_success_rate']:.1%}")
        if record["stage"]["kind"] == "quality":
            exhausted = sum(task.get("budget_exhausted", 0) for task in summary.get("tasks", []))
            console.detail(f"内容正确 {summary['content_correct_rate']:.1%} | 格式合规 {summary['format_compliance_rate']:.1%}"
                           f" | 预算耗尽 {exhausted} 次")
        else:
            console.detail(f"检索正确 {summary['correct_items']}/{summary['total_items']}")
            if record["stage"]["kind"] == "capacity" or record["stage"].get("also_capacity"):
                console.detail("容量任务：" + ("通过" if summary["capacity_verdict"] == "pass" else "未通过"))
        metrics = summary.get("metrics", {})
        median = lambda key: metrics.get(key, {}).get("median")
        console.detail(f"中位数：首输出 {duration(median('ttft_client_s'))} | 最终答案 {duration(median('ttfa_client_s'))}"
                       f" | 总耗时 {duration(median('total_s'))}")
        console.detail(f"引擎中位数：Prefill {number(median('prompt_tps'))} | Decode {number(median('decode_tps'))} Token/s")
    config = record.get("configuration_verdict", "unknown")
    console.detail("实际配置：" + {"pass": "已核验", "unknown": "待确认（unverified）", "fail": "不一致"}.get(config, config))
    if record.get("cleanup_status"):
        console.detail(f"服务退出：{STATES.get(record['cleanup_status'], record['cleanup_status'])}"
                       f" | 用时 {duration(record.get('cleanup_duration_s'))}")
    for key in ("error", "cleanup_error"):
        if record.get(key):
            console.emit("错误", record[key])
    console.detail(f"阶段记录：{folder}")


def show_run_result(records, root, elapsed):
    console.section("运行结束")
    counts = {key: sum(r["status"] == key for r in records) for key in STATES}
    console.emit("汇总", " | ".join(f"{STATES[key]} {counts[key]}" for key in STATES))
    summaries = [r["summary"] for r in records if r.get("summary")]
    console.detail(f"已有请求汇总：计划 {sum(s['planned_requests'] for s in summaries)}"
                   f" | 正常返回 {sum(s['completed_requests'] for s in summaries)}"
                   f" | 有效测量 {sum(s['valid_requests'] for s in summaries)}")
    unknown = sum(r.get("configuration_verdict") == "unknown" for r in records)
    console.detail(f"本次运行用时 {duration(elapsed)} | 配置待确认 {unknown} 个阶段")
    console.detail(f"结果摘要：{root / 'summary.md'}")
    console.detail(f"终端日志：{root / 'console.log'}")
