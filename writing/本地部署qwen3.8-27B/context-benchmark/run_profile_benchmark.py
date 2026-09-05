#!/usr/bin/env python3
"""固定质量任务：按全部计划请求报告正确率、格式合规率及运行成功率。"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
from benchmark_common import (
    Journal, chat_payload, evidence_identity, execute_request, execution_status,
    get_json, metric_summary, resolve_model_id, score_json_answer, write_json,
)
from benchmark_console import RequestProgress, console


def parse_seeds(value):
    values = [int(x.strip()) for x in value.split(",") if x.strip()]
    if not values or len(set(values)) != len(values):
        raise argparse.ArgumentTypeError("至少需要一个不重复的整数 seed")
    return values


def load_short_tasks(path, suite="smoke"):
    tasks = json.loads(path.read_text(encoding="utf-8"))["tasks"]
    ids = [task["id"] for task in tasks]
    if len(set(ids)) != len(ids):
        raise ValueError("Duplicate task IDs")
    selected = [t for t in tasks if suite == "extended" or t.get("suite", "smoke") == "smoke"]
    for task in selected:
        if not isinstance(task.get("expected"), dict) or not task.get("prompt"):
            raise ValueError(f"Invalid task: {task['id']}")
    return selected


def build_task_summaries(rows):
    summaries = []
    for task_id in dict.fromkeys(r["task_id"] for r in rows):
        tasks = [r for r in rows if r["task_id"] == task_id]
        n = len(tasks)
        valid = sum(r.get("measurement_valid") is True for r in tasks)
        completed = sum(r.get("run_status") == "completed" for r in tasks)
        success = sum(r.get("task_success") is True for r in tasks)
        formats = sum(r.get("format_valid") is True and r.get("measurement_valid") is True for r in tasks)
        content = sum(r.get("content_correct") is True and r.get("measurement_valid") is True for r in tasks)
        summaries.append(dict(task_id=task_id, task_name=tasks[0]["task_name"],
                              family=tasks[0].get("family", task_id), planned_runs=n,
                              completed_runs=completed, valid_runs=valid, status=execution_status(tasks),
                              run_success_rate=completed / n, task_success_rate=success / n,
                              content_correct_rate=content / n, format_compliance_rate=formats / n,
                              budget_exhausted=sum(r.get("budget_exhausted") is True for r in tasks),
                              metrics=metric_summary(tasks)))
    return summaries


def write_summaries(profile, rows, output_path):
    tasks = build_task_summaries(rows)
    n = len(rows)
    summary = dict(profile=profile, status=execution_status(rows), planned_requests=n,
                   completed_requests=sum(r.get("run_status") == "completed" for r in rows),
                   valid_requests=sum(r.get("measurement_valid") is True for r in rows),
                   task_success_rate=sum(r.get("task_success") is True for r in rows) / n if n else 0,
                   content_correct_rate=sum(r.get("content_correct") is True and r.get("measurement_valid") is True for r in rows) / n if n else 0,
                   format_compliance_rate=sum(r.get("format_valid") is True and r.get("measurement_valid") is True for r in rows) / n if n else 0,
                   run_success_rate=sum(r.get("run_status") == "completed" for r in rows) / n if n else 0,
                   tasks=tasks, metrics=metric_summary(rows), primary_attempt_policy="first_attempt_per_planned_request")
    json_path = output_path.with_suffix(".summary.json")
    write_json(json_path, summary)
    lines = [f"# {profile} 质量测试摘要", "", f"状态：{summary['status']}；任务成功率：{summary['task_success_rate']:.1%}。",
             "所有比率以全部计划请求为分母；超时、缺失结果及预算耗尽不会从分母排除。",
             "", "| 任务 | 完成/计划 | 有效/计划 | 内容正确率 | 格式合规率 | 任务成功率 | 预算耗尽 |",
             "|---|---:|---:|---:|---:|---:|---:|"]
    for task in tasks:
        lines.append(f"| {task['task_name']} | {task['completed_runs']}/{task['planned_runs']} | {task['valid_runs']}/{task['planned_runs']} | {task['content_correct_rate']:.1%} | {task['format_compliance_rate']:.1%} | {task['task_success_rate']:.1%} | {task['budget_exhausted']} |")
    lines += ["", "任务成功要求：有效且正常结束的请求、内容正确、仅输出符合字段和类型要求的 JSON。",
              "重试保留为新的 attempt，主表始终使用第一次结果。Token、TTFT/TTFA 和两种测速来源见 JSON/CSV。",
              "简单代码题只做 AST 归一化，不执行模型输出，不把它解释为任意语义等价证明。"]
    md_path = output_path.with_suffix(".summary.md")
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return json_path, md_path


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8001")
    parser.add_argument("--api-key", default=os.getenv("UNSLOTH_API_KEY", ""))
    parser.add_argument("--model", default=os.getenv("UNSLOTH_MODEL_ID", ""))
    parser.add_argument("--profile", required=True)
    parser.add_argument("--tasks-file", type=Path, default=Path(__file__).with_name("benchmark_tasks.json"))
    parser.add_argument("--suite", choices=("smoke", "extended"), default="smoke")
    parser.add_argument("--long-cases-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--seeds", type=parse_seeds, default=parse_seeds("3407,3413,3433"))
    parser.add_argument("--max-tokens", type=int, default=8192)
    parser.add_argument("--enable-thinking", action="store_true", default=True,
                        help="质量测试固定开启 Thinking；保留此参数以兼容已有调用")
    parser.add_argument("--reasoning-effort", choices=("xhigh",), default="xhigh")
    parser.add_argument("--temperature", type=float, default=1.0)
    parser.add_argument("--top-p", type=float, default=.95)
    parser.add_argument("--top-k", type=int, default=20)
    parser.add_argument("--presence-penalty", type=float, default=0.0)
    parser.add_argument("--timeout", type=float, default=7200)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--retry-failed", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    if not args.api_key or (args.retry_failed and not args.resume):
        raise ValueError("需要 API Key；retry-failed 需要 resume")
    short_tasks = load_short_tasks(args.tasks_file, args.suite)
    long_paths = sorted(args.long_cases_dir.glob("case-*.json"))
    if len(long_paths) < len(args.seeds):
        raise ValueError("每个 seed 至少需要一个长文本样本")
    model = args.model or resolve_model_id(args.base_url, args.api_key, 30)
    status = get_json(args.base_url, "/api/inference/status", args.api_key, 30)
    planned = []
    for repeat, seed in enumerate(args.seeds, 1):
        case = json.loads(long_paths[repeat - 1].read_text(encoding="utf-8"))
        if case["configured_context"] != status.get("context_length"):
            raise ValueError("Long case context does not match the loaded server")
        tasks = short_tasks + [dict(id="D_long_context", name="D：长文档检索", family="D",
                                   messages=case["messages"], expected=case["expected"], needles=case["needles"], safety_margin=case.get("safety_margin", 0))]
        for task in tasks:
            planned.append(dict(job_id=f"{task['id']}-s{seed}", task_id=task["id"], task_name=task["name"],
                                family=task.get("family", task["id"][0]), repeat=repeat, seed=seed,
                                configured_context=status.get("context_length"), expected=task["expected"],
                                safety_margin=task.get("safety_margin", 0),
                                code_fields=task.get("code_fields", []), needles=task.get("needles", []),
                                messages=task.get("messages", [{"role": "user", "content": task.get("prompt", "")}])) )
    settings = dict(profile=args.profile, model=model, suite=args.suite, max_tokens=args.max_tokens,
                    enable_thinking=args.enable_thinking, reasoning_effort=args.reasoning_effort,
                    temperature=args.temperature, top_p=args.top_p, top_k=args.top_k,
                    presence_penalty=args.presence_penalty, server=evidence_identity(status), timeout=args.timeout)
    journal = Journal(args.output, planned, settings, args.resume)
    write_json(args.output.with_suffix(".server.json"), status)
    pending = [job for job in planned if not journal.done(job["job_id"], args.retry_failed)]
    console.emit("题集", f"计划 {len(planned)} 次 | 本次执行 {len(pending)} 次 | Thinking 开启 / {args.reasoning_effort}")
    if args.resume:
        console.detail("恢复运行；进度条只统计本次执行，主表保留每题首次结果。")
    try:
        for index, job in enumerate(pending, 1):
            payload = chat_payload(job["messages"], model, args.max_tokens, job["seed"],
                                   enable_thinking=args.enable_thinking, reasoning_effort=args.reasoning_effort,
                                   temperature=args.temperature, top_p=args.top_p, top_k=args.top_k,
                                   presence_penalty=args.presence_penalty)
            attempt = 1 + max((r["attempt"] for r in journal.rows if r["job_id"] == job["job_id"]), default=0)
            with RequestProgress(job, index, len(pending), attempt) as progress:
                row = execute_request(job, payload, journal, args.base_url, args.api_key, status, args.timeout,
                                      progress=progress.update)
            progress.finish(row)
    finally:
        write_summaries(args.profile, journal.primary_rows(), args.output)
    return 3 if any(r.get("run_status") != "completed" for r in journal.primary_rows()) else 0


if __name__ == "__main__":
    raise SystemExit(main())
