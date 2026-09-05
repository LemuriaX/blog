#!/usr/bin/env python3
"""Shared orchestration for the full comparison and context-capacity entry points."""
from __future__ import annotations
import argparse
import csv
import errno
import json
import os
import platform
import re
import shutil
import socket
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

from benchmark_common import RequestFailure, digest, file_sha256, get_json, now, redact, write_json
from benchmark_validation import validate_runtime
from managed_process import ManagedProcess
from benchmark_console import (Activity, KINDS, clean, console, duration, show_stage,
                               show_stage_result, show_run_result, show_validation)

HERE = Path(__file__).resolve().parent


def build_plan(config, mode="full", selection="all", profiles=None, capacity=True,
               ablations=False, boundary=False):
    stages = []
    selected = profiles or [p["name"] for p in config["profiles"]]
    if not set(selected) <= {p["name"] for p in config["profiles"]}:
        raise ValueError("Unknown profile selection")
    if mode == "full":
        for profile in config["profiles"]:
            if profile["name"] not in selected:
                continue
            for kind in ("performance", "quality"):
                if selection not in {"all", kind}:
                    continue
                stages.append(dict(profile, id=f"{profile['name']}-{kind}", kind=kind,
                                   context=config["quality_context"] if kind == "quality" else config["common_context"],
                                   target=config["quality_target_tokens"] if kind == "quality" else config["common_target_tokens"]))
    if capacity and selection != "quality":
        context_profile = next(p for p in config["profiles"] if p["name"] == "context")
        for item in config["contexts"]:
            # The common Q3 8K stage already uses the same capacity criterion.
            existing = next((s for s in stages if s["id"] == "context-performance" and s["context"] == item["context"]
                             and s["target"] == item["target"]), None)
            if existing:
                existing["also_capacity"] = True
            else:
                stages.append(dict(context_profile, id=f"capacity-{item['name']}", kind="capacity",
                                   context=item["context"], target=item["target"]))
        if boundary:
            ctx = config["contexts"][-1]["context"]
            target = ctx - config["common_max_tokens"] - config["safety_margin"] - config["tolerance"]
            stages.append(dict(context_profile, id="capacity-boundary", kind="capacity", context=ctx, target=target))
    if ablations:
        for item in config["ablations"]:
            if selection != "all" and item["kind"] != selection and not (selection == "performance" and item["kind"] == "capacity"):
                continue
            stages.append(dict(item, id="ablation-" + item["name"], ablation=True))
    for stage in stages:
        if stage["kind"] == "quality":
            if stage.get("thinking") is not True or stage.get("effort") != "xhigh":
                raise ValueError(f"Quality tests require Thinking enabled with effort=xhigh: {stage['id']}")
        else:
            # Record the settings actually used by the performance/capacity runner.
            stage.update(thinking=False, effort=None, temperature=0.0, top_p=1.0, top_k=1,
                         presence_penalty=0.0, max_tokens=config["common_max_tokens"])
        stage["output_budget"] = stage["max_tokens"]
        if stage["target"] + config["tolerance"] + stage["output_budget"] + config["safety_margin"] > stage["context"]:
            raise ValueError(f"Input/output/context budget does not fit: {stage['id']}")
    if not stages:
        raise ValueError("No stages selected")
    return stages


def model_files(quant, config, model_dir=None):
    explicit = config.get("local_model_files", {}).get(quant)
    if explicit:
        candidate = Path(os.path.abspath(Path(explicit).expanduser()))
        if not candidate.is_file():
            raise ValueError(f"Local model does not exist: {candidate}")
        candidates = [candidate]
    else:
        roots = [Path(model_dir)] if model_dir else []
        if not model_dir:
            for env in ("HF_HUB_CACHE", "HUGGINGFACE_HUB_CACHE"):
                if os.getenv(env):
                    roots.append(Path(os.environ[env]) / "models--unsloth--Qwen3.8-27B-GGUF")
            roots += [Path(os.getenv("HF_HOME", str(Path.home() / ".cache" / "huggingface"))) /
                      "hub" / "models--unsloth--Qwen3.8-27B-GGUF"]
        candidates = []
        for root in roots:
            if root.exists():
                candidates += [p.absolute() for p in root.rglob("*.gguf")
                               if "qwen3.8-27b" in p.name.lower() and quant.lower() in p.name.lower()
                               and not re.search(r"mmproj|mtp", p.name, re.I)]
        candidates = sorted(set(candidates))
        first = [p for p in candidates if not re.search(r"-\d{5}-of-\d{5}\.gguf$", p.name)
                 or re.search(r"-00001-of-\d{5}\.gguf$", p.name)]
        if len(first) != 1:
            raise ValueError(f"{quant}: expected one local model, found {len(first)}; set local_model_files or --model-dir")
        candidates = first
    first = candidates[0]
    match = re.match(r"^(.*)-(\d{5})-of-(\d{5})\.gguf$", first.name)
    if match:
        prefix, _, total = match.groups()
        shards = [first.with_name(f"{prefix}-{i:05d}-of-{int(total):05d}.gguf") for i in range(1, int(total) + 1)]
    else:
        shards = [first]
    for path in shards:
        if not path.is_file() or path.stat().st_size == 0:
            raise ValueError(f"Missing or empty GGUF shard: {path}")
    if not re.search(r"qwen3\.8-27b", first.name, re.I) or quant.lower() not in first.name.lower():
        raise ValueError(f"GGUF filename does not identify the requested model and quantization: {first}")
    return shards


def server_command(executable, model, stage, config, port):
    return [str(executable), "run", "-H", "127.0.0.1", "-p", str(port), "--disable-tools", "--no-cloudflare",
            "--model", str(model), "--max-seq-length", str(stage["context"]), "--gpu-memory-mode", "manual",
            "--gpu-layers", str(config["gpu_layers_request"]), "--parallel", "1", "--speculative-type", "off",
            "--cache-type-k", stage["kv"], "--cache-type-v", stage["kv"], "--flash-attn", "on",
            "--batch-size", str(stage["batch"]), "--ubatch-size", str(stage["ubatch"]), "--kv-unified",
            "--no-cache-prompt", "--no-context-shift", "--no-mmproj", "--threads", "-1", "--perf",
            "--log-verbosity", "4"]


def missing_cli_options(text):
    plain = re.sub(r"\x1b\[[0-9;]*m", "", text)
    # GPU-layer and other llama.cpp passthrough flags need not be in Typer's help.
    options = set(re.findall(r"(?<![\w-])--[a-zA-Z][a-zA-Z0-9-]*", plain))
    return [flag for flag in ("--model", "--max-seq-length", "--gpu-memory-mode", "--parallel")
            if flag not in options]


def cli_help_supported(text, returncode):
    return returncode == 0 and not missing_cli_options(text)


def check_cli_help(executable, folder):
    # Captured Rich/Typer help defaults to a narrow table and truncates long
    # option names with ellipses. Override both libraries' width settings only
    # for this child process; an abbreviated name is not capability evidence.
    env = dict(os.environ, COLUMNS="240", TERMINAL_WIDTH="240", NO_COLOR="1",
               PYTHONIOENCODING="utf-8", PYTHONUTF8="1")
    command = [str(executable), "run", "--help"]
    result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8",
                            errors="replace", timeout=60, env=env,
                            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    output = redact(result.stdout + result.stderr)
    log_path = folder / "unsloth-run-help.txt"
    log_path.write_text(output, encoding="utf-8")
    missing = missing_cli_options(output) if result.returncode == 0 else None
    write_json(folder / "unsloth-cli-validation.json",
               dict(command=command, returncode=result.returncode, missing_options=missing,
                    help_width=240))
    if result.returncode != 0:
        raise ValueError(f"Unsloth 启动检查失败（退出码 {result.returncode}）；详情见 {log_path}")
    if missing:
        raise ValueError(f"Unsloth 帮助中未找到必需参数：{', '.join(missing)}；详情见 {log_path}")


def read_logs(folder):
    return "\n".join(p.read_text(encoding="utf-8", errors="replace") for p in
                     (folder / "server.stdout.log", folder / "server.stderr.log", folder / "llama-server.log") if p.exists())


def collect_backend_log(folder, allowed_log_root=None):
    # Unsloth owns llama-server's stdout/stderr and rejects --log-file. Archive
    # only the latest child log explicitly announced by this stage's launcher.
    root = (allowed_log_root or Path.home() / ".unsloth/studio/logs/llama-server").resolve()
    references = []
    for name in ("server.stdout.log", "server.stderr.log"):
        path = folder / name
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            try:
                event = json.loads(line).get("event", "")
            except (ValueError, AttributeError):
                event = line
            if not isinstance(event, str):
                continue
            match = re.search(r"(?:^|\s)llama-server stdout/stderr\s*->\s*(.+)$", event)
            if match:
                references.append(match.group(1).strip().strip('\"\''))
    report = dict(status="not_reported", captured_at=now(), source=None)
    if references:
        try:
            source = Path(references[-1]).resolve()
            if source.parent != root or not re.fullmatch(r"llama-\d+-port-\d+-try\d+\.log", source.name):
                raise ValueError("Announced path is not a recognized log in the Unsloth llama-server log directory")
            report["source"] = str(source)
            content = source.read_bytes()
            destination = folder / "llama-server.log"
            destination.write_text(redact(content.decode("utf-8", errors="replace")), encoding="utf-8")
            report.update(status="captured", source_bytes=len(content), snapshot=destination.name,
                          snapshot_sha256=file_sha256(destination))
        except (OSError, ValueError) as exc:
            report.update(status="unavailable", error=redact(str(exc)))
    write_json(folder / "backend-log-collection.json", report)
    return report


def wait_ready(base_url, folder, managed, timeout):
    started = time.monotonic()
    deadline = started + timeout
    next_progress = started + 15
    api_key = os.getenv("UNSLOTH_API_KEY", "")
    last_error = "尚未从启动日志取得 API Key；请检查 server.stdout.log 和 server.stderr.log"
    while time.monotonic() < deadline:
        log = read_logs(folder)
        keys = re.findall(r"sk-unsloth-[A-Za-z0-9_-]+", log)
        if keys:
            api_key = keys[-1]
        if api_key:
            last_error = "已取得启动认证信息，等待接口报告模型就绪"
            try:
                status = get_json(base_url, "/api/inference/status", api_key, 3)
                models = get_json(base_url, "/v1/models", api_key, 3).get("data", [])
                if models and type(status.get("context_length")) is int and status["context_length"] > 0:
                    return api_key, status, models[0]["id"]
            except (RequestFailure, KeyError, ValueError) as exc:
                last_error = str(exc)
        # A launcher may exit after spawning its server; ownership is the Job, not the launcher PID.
        if managed.process.poll() not in (None, 0):
            raise RuntimeError(f"Server launcher exited {managed.process.returncode}; inspect startup logs")
        current = time.monotonic()
        if current >= next_progress:
            console.emit("加载", f"等待服务就绪 | 已用 {duration(current - started)}")
            console.detail(redact(last_error))
            next_progress = current + 15
        time.sleep(1)
    raise TimeoutError(f"Model readiness timeout: {redact(last_error)}")


def invoke(script, arguments, folder, env):
    command = [sys.executable, "-u", str(HERE / script)] + [str(x) for x in arguments]
    path = folder / (Path(script).stem + ".log")
    with path.open("a", encoding="utf-8", buffering=1) as handle:
        with subprocess.Popen(command, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                              text=True, encoding="utf-8", errors="replace", bufsize=1,
                              creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0) as process:
            try:
                for line in process.stdout:
                    text = clean(line).rstrip("\n")
                    handle.write(text + "\n")
                    console.raw(text)
                returncode = process.wait()
            except BaseException:
                # These Python runners have no descendants. Stop the owned runner
                # before run_stage closes the separately owned inference server.
                if process.poll() is None:
                    process.kill()
                process.wait()
                raise
    if returncode not in (0, 3):
        raise RuntimeError(f"{script} 退出码 {returncode}；详情见 {path}")
    return returncode


def prepare_cases(stage, config, run_root, folder, env, base_url):
    quality = stage["kind"] == "quality"
    # Same corpus across compared profiles, including the larger Thinking output reservation.
    budget = max(p["max_tokens"] for p in config["profiles"]) if quality else config["common_max_tokens"]
    budget = max(budget, stage["output_budget"])
    variant = "challenge" if quality else "baseline"
    spec = dict(context=stage["context"], target=stage["target"], cases=len(config["seeds"]),
                seed=config["seeds"][0], variant=variant, max_output_tokens=budget,
                tolerance=config["tolerance"], safety_margin=config["safety_margin"],
                enable_thinking=stage["thinking"], reasoning_effort=stage["effort"])
    case_dir = run_root / "cases" / digest(spec)[:16]
    manifest = case_dir / "corpus.json"
    if manifest.exists():
        saved = json.loads(manifest.read_text(encoding="utf-8"))
        if saved["spec"] != spec or any(not (case_dir / name).is_file() or file_sha256(case_dir / name) != sha
                                        for name, sha in saved["files"].items()):
            raise ValueError("Shared corpus changed; use a new run directory")
        console.emit("语料", f"复用 {spec['cases']} 份相同文本，文件哈希核对通过")
        return case_dir
    # An interrupted generation is kept as evidence, then restarted into a fresh sibling path.
    if case_dir.exists():
        case_dir.rename(case_dir.with_name(case_dir.name + "-incomplete-" + datetime.now().strftime("%H%M%S%f")))
    args = ["--base-url", base_url, "--ctx-size", spec["context"], "--target-tokens", spec["target"],
            "--cases", spec["cases"], "--seed", spec["seed"], "--variant", variant,
            "--max-output-tokens", budget, "--safety-margin", spec["safety_margin"],
            "--tolerance", spec["tolerance"], "--output-dir", case_dir]
    if spec["enable_thinking"]:
        args += ["--enable-thinking", "--reasoning-effort", spec["reasoning_effort"]]
    with Activity("语料生成与输入计数；此步骤不计入推理耗时"):
        invoke("generate_context_cases.py", args, folder, env)
    files = {p.name: file_sha256(p) for p in case_dir.glob("case-*")}
    if len(list(case_dir.glob("case-*.json"))) != spec["cases"]:
        raise ValueError("Corpus generation incomplete")
    write_json(manifest, dict(spec=spec, files=files))
    return case_dir


def port_is_listening(port):
    if os.name != "nt":
        with socket.socket() as probe:
            probe.settimeout(2)
            result = probe.connect_ex(("127.0.0.1", port))
            if result == 0:
                return True
            if result == errno.ECONNREFUSED:
                return False
            raise OSError(result, f"无法确认端口 {port} 的监听状态")

    # Windows may time out when connecting to an unused local port. Read its
    # IPv4 listener table instead; this server always binds to 127.0.0.1.
    import ctypes
    from ctypes import wintypes as w
    class TcpRow(ctypes.Structure):
        _fields_ = [(name, w.DWORD) for name in ("state", "local_addr", "local_port", "remote_addr", "remote_port", "pid")]

    query = ctypes.WinDLL("iphlpapi").GetExtendedTcpTable
    query.argtypes = [ctypes.c_void_p, ctypes.POINTER(w.DWORD), w.BOOL, w.ULONG, ctypes.c_int, w.ULONG]
    query.restype = w.DWORD
    buffer = ctypes.create_string_buffer(4096)
    while True:
        size = w.DWORD(len(buffer))
        result = query(buffer, ctypes.byref(size), False, socket.AF_INET, 3, 0)  # OWNER_PID_LISTENER
        if result == 122:  # ERROR_INSUFFICIENT_BUFFER
            buffer = ctypes.create_string_buffer(size.value)
            continue
        if result != 0:
            raise ctypes.WinError(result)
        count = w.DWORD.from_buffer(buffer).value
        loopback = int.from_bytes(socket.inet_aton("127.0.0.1"), sys.byteorder)
        for index in range(count):
            row = TcpRow.from_buffer(buffer, ctypes.sizeof(w.DWORD) + index * ctypes.sizeof(TcpRow))
            if row.local_addr in (0, loopback) and socket.ntohs(row.local_port & 0xffff) == port:
                return True
        return False


def wait_port_released(port, timeout=30):
    deadline = time.monotonic() + timeout
    while port_is_listening(port):
        if time.monotonic() >= deadline:
            raise TimeoutError(f"服务退出后仍无法确认端口 {port} 已释放，已停止切换阶段。")
        time.sleep(.1)


def run_stage(stage, config, root, args, models):
    folder = root / stage["id"]
    folder.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    for name in ("server.stdout.log", "server.stderr.log", "llama-server.log", "backend-log-collection.json",
                 "stage.json", "inference-status.json", "configuration-validation.json"):
        previous = folder / name
        if previous.exists():
            previous.rename(folder / (name + ".previous-" + stamp))
    record = dict(id=stage["id"], stage=stage, started_at=now(), status="running", verdict="unverified")
    write_json(folder / "stage.json", record)
    managed = None
    try:
        with socket.socket() as probe:
            if probe.connect_ex(("127.0.0.1", args.port)) == 0:
                raise ValueError(f"Port {args.port} is occupied; select another port. Existing processes are left alone.")
        command = server_command(args.unsloth_path, models[stage["quant"]][0]["path"], stage, config, args.port)
        write_json(folder / "requested-command.json", command)
        base_url = f"http://127.0.0.1:{args.port}"
        managed = ManagedProcess(command, folder / "server.stdout.log", folder / "server.stderr.log")
        console.emit("加载", f"服务进程已启动 | 端口 {args.port} | 就绪时限 {duration(args.server_timeout)}")
        key, status, model_id = wait_ready(base_url, folder, managed, args.server_timeout)
        record["model_ready_at"] = now()
        record["startup_to_ready_s"] = time.time() - datetime.fromisoformat(record["started_at"]).timestamp()
        console.emit("就绪", f"模型和接口已就绪 | 加载用时 {duration(record['startup_to_ready_s'])}")
        write_json(folder / "inference-status.json", status)
        collect_backend_log(folder)
        validation = validate_runtime(status, read_logs(folder), dict(stage, model_path=models[stage["quant"]][0]["path"]))
        record["configuration_verdict"] = validation["verdict"]
        record["unverified_checks"] = [item["name"] for item in validation["checks"] if item["status"] == "unknown"]
        write_json(folder / "configuration-validation.json", validation)
        show_validation(validation)
        if validation["verdict"] == "fail":
            raise ValueError("Effective configuration contradicts the requested settings")
        effective_identity = dict(status={k: status.get(k) for k in ("chat_template", "chat_template_override", "model_identifier", "gguf_variant")},
                                  validation=validation,
                                  backend_build=re.findall(r"(?:build:|version:)\s*[^\r\n]+", read_logs(folder), re.I))
        identity_path = folder / "effective-identity.json"
        if identity_path.exists() and json.loads(identity_path.read_text(encoding="utf-8")) != effective_identity:
            raise ValueError("Resume rejected: effective template, backend build or configuration evidence changed")
        write_json(identity_path, effective_identity)
        env = dict(os.environ, UNSLOTH_API_KEY=key, UNSLOTH_MODEL_ID=model_id, PYTHONIOENCODING="utf-8")
        console.emit("准备", "生成或复用测试文本，校验输入预算")
        cases = prepare_cases(stage, config, root, folder, env, base_url)
        record["measurement_started_at"] = now()
        console.emit("开始", "质量测试" if stage["kind"] == "quality" else "预热与正式测试")
        output = folder / "results.csv"
        common = ["--base-url", base_url, "--output", output, "--timeout", args.request_timeout]
        if args.resume and output.with_suffix(".manifest.json").exists():
            common += ["--resume"]
            if args.retry_failed:
                common += ["--retry-failed"]
        if stage["kind"] == "quality":
            common += ["--profile", stage["id"], "--suite", args.suite, "--long-cases-dir", cases,
                       "--seeds", ",".join(map(str, config["seeds"])), "--max-tokens", stage["output_budget"],
                       "--reasoning-effort", stage["effort"], "--enable-thinking"]
            for field in ("temperature", "top_p", "top_k", "presence_penalty"):
                common += ["--" + field.replace("_", "-"), stage[field]]
            code = invoke("run_profile_benchmark.py", common, folder, env)
        else:
            common += ["--cases-dir", cases, "--max-tokens", stage["output_budget"],
                       "--repeats", config["performance_repeats"], "--seed", config["seeds"][0]]
            code = invoke("run_context_benchmark.py", common, folder, env)
        summary = json.loads(output.with_suffix(".summary.json").read_text(encoding="utf-8"))
        record.update(status=summary["status"], runner_exit_code=code, summary=summary)
        measured = summary.get("capacity_verdict") if stage["kind"] == "capacity" or stage.get("also_capacity") else summary.get("performance_verdict", "measured")
        record["measurement_verdict"] = measured
        record["verdict"] = measured if validation["verdict"] == "pass" else "unverified"
    except (Exception, KeyboardInterrupt) as exc:
        record.update(status="failed", error=redact(str(exc)), error_type=type(exc).__name__)
        if isinstance(exc, KeyboardInterrupt):
            record["interrupted"] = True
    finally:
        record["finished_at"] = now()
        # Commit failure/partial state before cleanup, and always close the owned Job.
        try:
            write_json(folder / "stage.json", record)
        finally:
            if managed is not None:
                cleanup_started = time.monotonic()
                try:
                    console.emit("清理", "停止本阶段服务，等待子进程退出和端口释放")
                    with Activity("服务退出与端口释放"):
                        managed.close()
                        wait_port_released(args.port)
                    record["cleanup_status"] = "completed"
                except Exception as exc:
                    record["cleanup_error"] = redact(str(exc))
                    record["cleanup_status"] = "failed"
                    record["status"] = "failed"
                    record["verdict"] = "unverified"
                record["cleanup_duration_s"] = time.monotonic() - cleanup_started
                record["cleanup_finished_at"] = now()
        collect_backend_log(folder)
        for log_path in (folder / "server.stdout.log", folder / "server.stderr.log"):
            if log_path.exists():
                log_path.write_text(redact(log_path.read_text(encoding="utf-8", errors="replace")), encoding="utf-8")
        write_json(folder / "stage.json", record)
    return record


def aggregate(root, plan):
    records = []
    for stage in plan:
        path = root / stage["id"] / "stage.json"
        records.append(json.loads(path.read_text(encoding="utf-8")) if path.exists() else
                       dict(id=stage["id"], stage=stage, status="pending", verdict="unverified"))
    write_json(root / "summary.json", dict(stages=records, generated_at=now()))
    counts = {status: sum(r["status"] == status for r in records) for status in ("completed", "partial", "failed", "pending")}
    lines = ["# 测试运行摘要", "",
             f"共 {len(records)} 个阶段：已完成 {counts['completed']}，部分完成 {counts['partial']}，失败 {counts['failed']}，待执行 {counts['pending']}。", "",
             "配置证据缺失会标为 unverified；测量结果和配置认证分开记录。", "",
             "| 阶段 | 运行状态 | 配置核验 | 测量判定 | 最终判定 |", "|---|---|---|---|---|"]
    for r in records:
        lines.append(f"| {r['id']} | {r['status']} | {r.get('configuration_verdict', 'unknown')} | {r.get('measurement_verdict', '—')} | {r['verdict']} |")
    for r in records:
        for key, label in (("error", "失败原因"), ("cleanup_error", "服务退出失败")):
            if r.get(key):
                lines += ["", f"{r['id']} {label}：{redact(r[key])}"]
        if r.get("unverified_checks"):
            lines += ["", f"{r['id']} 尚未确认的配置：{', '.join(r['unverified_checks'])}。"]
    lines += ["", "每个阶段的 results.summary.json 保存固定分母和测速来源；stage.json 保存失败原因、时间与复用信息。",
              "context-performance 在 also_capacity=true 时同时计入 8K 容量；不重复运行。",
              "手动监控数据见 manual-metrics.csv；空白表示尚未采集，不能视为零。"]
    (root / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return records


def environment_info():
    info = dict(os=platform.platform(), python=sys.version, python_path=sys.executable,
                processor=platform.processor(), gpu_vram_bytes=None, gpu_vram_source="unmeasured",
                note="Win32_VideoController.AdapterRAM is uint32; it is not used to measure a 20 GiB GPU.")
    if os.name == "nt":
        command = "$m=(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory; $g=Get-CimInstance Win32_VideoController | Select-Object Name,DriverVersion; @{ram_bytes=$m;gpus=@($g)} | ConvertTo-Json -Depth 4 -Compress"
        result = subprocess.run(["powershell.exe", "-NoProfile", "-Command", command], capture_output=True, text=True,
                                timeout=30, creationflags=subprocess.CREATE_NO_WINDOW)
        try:
            info.update(json.loads(result.stdout))
            info["ram_gib"] = info["ram_bytes"] / 2 ** 30
        except (ValueError, KeyError, TypeError):
            info["system_probe_error"] = result.stderr.strip()
    return info


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=("full", "capacity"), default="full")
    parser.add_argument("--config", type=Path, default=HERE / "benchmark_config.json")
    parser.add_argument("--stage", choices=("all", "performance", "quality"), default="all")
    parser.add_argument("--profiles", help="Comma-separated preset names")
    parser.add_argument("--suite", choices=("smoke", "extended"), default="smoke")
    parser.add_argument("--skip-context-capacity", action="store_true")
    parser.add_argument("--with-ablations", action="store_true")
    parser.add_argument("--boundary", action="store_true")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--retry-failed", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--model-dir", type=Path)
    parser.add_argument("--unsloth-path", default=shutil.which("unsloth") or str(Path.home() / ".unsloth/studio/bin/unsloth.exe"))
    parser.add_argument("--output-root", type=Path)
    parser.add_argument("--port", type=int, default=8001)
    parser.add_argument("--server-timeout", type=float, default=1800)
    parser.add_argument("--request-timeout", type=float, default=7200)
    return parser.parse_args()


def planned_requests(stage, config, suite):
    if stage["kind"] == "quality":
        from run_profile_benchmark import load_short_tasks
        return (len(load_short_tasks(HERE / "benchmark_tasks.json", suite)) + 1) * len(config["seeds"])
    return len(config["seeds"]) * config["performance_repeats"]


def main():
    started = time.monotonic()
    args = parse_args()
    if (args.resume and (not args.output_root or args.dry_run)) or (args.retry_failed and not args.resume):
        raise ValueError("Resume requires --output-root and cannot be combined with dry-run; retry-failed requires --resume")
    if not 1 <= args.port <= 65535 or min(args.server_timeout, args.request_timeout) <= 0:
        raise ValueError("Invalid port or timeout")
    config = json.loads(args.config.read_text(encoding="utf-8-sig"))
    plan = build_plan(config, args.mode, args.stage, args.profiles.split(",") if args.profiles else None,
                      not args.skip_context_capacity, args.with_ablations, args.boundary)
    root = (args.output_root or HERE / "runs" / datetime.now().strftime("%Y%m%d-%H%M%S-%f")).resolve()
    if root.exists() and any(root.iterdir()) and not args.resume:
        raise ValueError("Output directory is not empty; use a new directory or --resume")
    root.mkdir(parents=True, exist_ok=True)
    if not args.resume:
        console.set_log(root / "console.log")
    request_counts = {s["id"]: planned_requests(s, config, args.suite) for s in plan}
    console.section("Qwen3.8-27B · " + ("空运行检查" if args.dry_run else "本机测试"))
    console.emit("计划", f"{len(plan)} 个阶段 | {sum(request_counts.values())} 次正式请求 | 题集 {args.suite}")
    console.detail(f"端口 {args.port} | 单次调用时限 {duration(args.request_timeout)}")
    console.detail(f"结果目录：{root}")
    if args.dry_run:
        console.detail("只检查计划和模型路径；不启动服务、不推理、不下载、不计算模型哈希。")
    for index, stage in enumerate(plan, 1):
        thinking = f"Thinking {stage['effort']}" if stage["thinking"] else "Thinking 关闭"
        console.detail(f"{index:02d}. {stage['id']} | {request_counts[stage['id']]} 次 | 窗口 {stage['context']:,} | {thinking}")
    if not args.resume:
        write_json(root / "plan.json", dict(stages=plan, dry_run=args.dry_run))
    models, missing = {}, {}
    for quant in dict.fromkeys(s["quant"] for s in plan):
        try:
            files = model_files(quant, config, args.model_dir)
            models[quant] = []
            for index, path in enumerate(files, 1):
                size = path.stat().st_size
                console.emit("模型", f"{quant} | 分片 {index}/{len(files)} | {size / 2 ** 30:.3f} GiB")
                checksum = None
                if not args.dry_run:
                    console.detail("计算文件 SHA256；此步骤只读取磁盘，不运行 GPU 推理。")
                    hashed_at = time.monotonic()
                    with Activity(f"{quant} | 正在计算 SHA256"):
                        checksum = file_sha256(path)
                    console.emit("校验", f"SHA256 完成 | 用时 {duration(time.monotonic() - hashed_at)}")
                models[quant].append(dict(path=str(path), bytes=size, sha256=checksum))
        except (OSError, ValueError) as exc:
            missing[quant] = str(exc)
            console.emit("错误", f"{quant} | {exc}")
    if not args.resume:
        write_json(root / "model-preflight.json", dict(models=models, missing=missing))
    if args.dry_run:
        console.emit("检查", f"空运行结束 | {len(plan)} 个阶段 | 模型路径问题 {len(missing)} 项")
        console.detail(f"执行计划：{root / 'plan.json'}")
        console.detail(f"模型检查：{root / 'model-preflight.json'}")
        return 0
    if missing:
        raise ValueError("Local models missing or ambiguous; see model-preflight.json. No downloads were started.")
    scripts = {p.name: file_sha256(p) for p in HERE.iterdir() if p.suffix in {".py", ".ps1", ".psm1", ".json"}}
    executable = Path(args.unsloth_path)
    if not executable.is_file():
        resolved = shutil.which(args.unsloth_path)
        if not resolved:
            raise ValueError("Unsloth executable not found; set --unsloth-path")
        executable = Path(resolved)
    args.unsloth_path = str(executable.resolve())
    version = subprocess.run([args.unsloth_path, "--version"], capture_output=True, text=True,
                             encoding="utf-8", errors="replace", timeout=30,
                             creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    identity = dict(config=config, plan=plan, suite=args.suite, scripts=scripts, models=models,
                    unsloth_path=args.unsloth_path, unsloth_executable_sha256=file_sha256(executable),
                    unsloth_version=version.stdout + version.stderr,
                    server_timeout=args.server_timeout, request_timeout=args.request_timeout)
    manifest_path = root / "run-manifest.json"
    if manifest_path.exists():
        old = json.loads(manifest_path.read_text(encoding="utf-8"))
        if old["fingerprint"] != digest(identity):
            raise ValueError("Resume rejected: code, configuration, task set or model files changed")
    elif args.resume:
        raise ValueError("Resume directory has no committed run-manifest.json")
    else:
        write_json(manifest_path, dict(identity, fingerprint=digest(identity), created_at=now()))
        snapshot = root / "source-snapshot"
        snapshot.mkdir()
        for name in scripts:
            shutil.copy2(HERE / name, snapshot / name)
        shutil.copy2(args.config, snapshot / "effective-config.json")
        write_json(root / "environment.json", environment_info())
        with (root / "manual-metrics.csv").open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(["stage", "tool_version", "sample_interval_ms", "gpu_vram_total_gib", "gpu_vram_sampled_peak_gib",
                             "system_ram_sampled_peak_gib", "gpu_power_w", "gpu_temperature_c", "notes"])
            writer.writerows([[s["id"]] + [""] * 8 for s in plan])
    if args.resume:
        console.set_log(root / "console.log")
        console.emit("恢复", "源码、配置、题目和模型身份检查通过，继续原运行")
    write_json(root / "unsloth-version.json", dict(returncode=version.returncode, output=version.stdout + version.stderr))
    # Check the local CLI surface before starting any model. It must advertise native options;
    # llama.cpp passthrough flags are preserved verbatim in requested-command.json.
    console.emit("检查", "核对 Unsloth 启动参数")
    with Activity("Unsloth 启动接口检查"):
        check_cli_help(args.unsloth_path, root)
    console.emit("检查", "Unsloth 启动接口检查通过")
    aggregate(root, plan)
    for index, stage in enumerate(plan, 1):
        previous = root / stage["id"] / "stage.json"
        if args.resume and previous.exists() and json.loads(previous.read_text(encoding="utf-8"))["status"] == "completed":
            console.emit("跳过", f"阶段 {index}/{len(plan)} | {stage['id']} 已完成，保留原结果")
            continue
        show_stage(stage, index, len(plan), request_counts[stage["id"]])
        record = run_stage(stage, config, root, args, models)
        aggregate(root, plan)
        show_stage_result(record, root / stage["id"])
        if record.get("interrupted") or record.get("cleanup_error"):
            break
    records = aggregate(root, plan)
    show_run_result(records, root, time.monotonic() - started)
    return 3 if any(r["status"] != "completed" for r in records) else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        console.emit("中断", "已收到停止请求")
        raise SystemExit(130)
    except Exception as exc:
        console.emit("错误", str(exc))
        if console.log:
            import traceback
            console.log.write(clean(traceback.format_exc()) + "\n")
            console.detail(f"详细错误：{console.log.name}")
        raise SystemExit(1)
    finally:
        console.close()
