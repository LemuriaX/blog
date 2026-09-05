"""Shared, standard-library-only transport, evidence and result handling."""
from __future__ import annotations

import ast
import csv
import hashlib
import http.client
import json
import math
import os
import re
import socket
import statistics
import threading
import time
import uuid
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

SCHEMA_VERSION = 3
POSITION_COLUMNS = ("pos_10", "pos_30", "pos_50", "pos_70", "pos_90")


def now() -> str:
    return datetime.now().astimezone().isoformat(timespec="milliseconds")


def digest(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                     allow_nan=False).encode("utf-8")).hexdigest()


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(8 * 1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: "[REDACTED]" if k.lower() in {"authorization", "api_key", "api-key"}
                else redact(v) for k, v in value.items()}
    if isinstance(value, list):
        return [redact(v) for v in value]
    if isinstance(value, str):
        return re.sub(r"sk-unsloth-[A-Za-z0-9_-]+", "[REDACTED]", value)
    return value


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    with temporary.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(redact(value), handle, ensure_ascii=False, indent=2, allow_nan=False)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, path)


class RequestFailure(RuntimeError):
    def __init__(self, kind: str, message: str, partial: dict | None = None):
        super().__init__(redact(message))
        self.kind = kind
        self.partial = partial or {}


@contextmanager
def http_response(base_url: str, path: str, api_key: str, payload: dict | None,
                  timeout: float, connect_timeout: float = 15, read_timeout: float | None = None):
    """Separate connect/read timeouts plus a hard wall-clock deadline, including headers."""
    if timeout <= 0:
        raise ValueError("timeout must be positive")
    parsed = urlsplit(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username:
        raise ValueError("base-url must be an HTTP(S) origin without credentials")
    cls = http.client.HTTPSConnection if parsed.scheme == "https" else http.client.HTTPConnection
    connection = cls(parsed.hostname, parsed.port, timeout=min(connect_timeout, timeout))
    expired = threading.Event()
    sockets: list[socket.socket] = []

    def abort():
        expired.set()
        for sock in sockets:
            try:
                sock.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass

    timer = threading.Timer(timeout, abort)
    timer.daemon = True
    phase = "connect"
    timer.start()
    try:
        connection.connect()
        if connection.sock is not None:
            sockets.append(connection.sock)
            connection.sock.settimeout(min(read_timeout or timeout, timeout))
        if expired.is_set():
            raise RequestFailure("deadline_timeout", "Request deadline expired while connecting")
        phase = "read"
        headers = {"Content-Type": "application/json", "User-Agent": "context-benchmark/3"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        data = None if payload is None else json.dumps(payload, ensure_ascii=False,
                                                     allow_nan=False).encode("utf-8")
        connection.request("GET" if payload is None else "POST",
                           parsed.path.rstrip("/") + path, body=data, headers=headers)
        response = connection.getresponse()
        if not 200 <= response.status < 300:
            detail = response.read(65536).decode("utf-8", errors="replace")
            raise RequestFailure("http_error", f"HTTP {response.status}: {detail}")
        yield response
        if expired.is_set():
            raise RequestFailure("deadline_timeout", "Request exceeded its total time budget")
    except RequestFailure as exc:
        if expired.is_set():
            raise RequestFailure("deadline_timeout", "Request exceeded its total time budget", exc.partial) from exc
        raise
    except (OSError, http.client.HTTPException) as exc:
        kind = "deadline_timeout" if expired.is_set() else (
            f"{phase}_timeout" if isinstance(exc, TimeoutError) else "connection_error")
        raise RequestFailure(kind, str(exc)) from exc
    finally:
        timer.cancel()
        connection.close()


def get_json(base_url: str, path: str, api_key: str, timeout: float) -> dict:
    return request_json(base_url, path, api_key, None, timeout)


def post_json(base_url: str, path: str, payload: dict, api_key: str, timeout: float) -> dict:
    return request_json(base_url, path, api_key, payload, timeout)


def request_json(base_url, path, api_key, payload, timeout):
    try:
        with http_response(base_url, path, api_key, payload, timeout) as response:
            value = strict_loads(response.read().decode("utf-8"))
        if not isinstance(value, dict):
            raise ValueError("Expected a JSON object")
        return value
    except (ValueError, UnicodeError) as exc:
        raise RequestFailure("protocol_error", str(exc)) from exc


def resolve_model_id(base_url: str, api_key: str, timeout: float) -> str:
    data = get_json(base_url, "/v1/models", api_key, timeout).get("data", [])
    if not data or not isinstance(data[0], dict) or not data[0].get("id"):
        raise RequestFailure("model_not_ready", "No loaded model in /v1/models")
    return data[0]["id"]


def chat_payload(messages, model, max_tokens, seed, stream=True, *, enable_thinking=False,
                 reasoning_effort="medium", temperature=0.0, top_p=1.0, top_k=1,
                 presence_penalty=0.0):
    if reasoning_effort not in {"low", "medium", "xhigh"}:
        raise ValueError("Qwen3.8 effort must be low, medium or xhigh")
    if max_tokens < 1:
        raise ValueError("max_tokens must be positive")
    value = dict(model=model, messages=messages, max_tokens=max_tokens, seed=seed,
                 temperature=temperature, top_p=top_p, top_k=top_k, min_p=0.0,
                 repetition_penalty=1.0, presence_penalty=presence_penalty,
                 frequency_penalty=0.0, enable_thinking=enable_thinking,
                 preserve_thinking=False, enable_tools=False, tools=[], tool_choice="none",
                 cache_prompt=False, stream=stream)
    if enable_thinking:
        value["reasoning_effort"] = reasoning_effort
    if stream:
        value["stream_options"] = {"include_usage": True}
    return value


def count_prompt_tokens(base_url, api_key, payload, timeout):
    keys = ("model", "messages", "enable_thinking", "reasoning_effort", "preserve_thinking",
            "enable_tools", "tools", "tool_choice")
    counted = post_json(base_url, "/v1/chat/count_tokens",
                        {k: payload[k] for k in keys if k in payload}, api_key, timeout)
    count = counted.get("input_tokens")
    if type(count) is not int or count < 0:
        raise RequestFailure("protocol_error", "count_tokens did not return input_tokens")
    return count


def stream_chat_completion(base_url, payload, api_key, timeout, *, read_timeout=None):
    start = time.perf_counter()
    result = dict(started_at=now(), answer="", reasoning="", usage={}, timings={}, events=[],
                  ttft_client_s=None, ttfa_client_s=None, last_chunk_s=None,
                  stream_complete=False, finish_reason="", context_truncated=None)
    done = False

    def consume(data):
        nonlocal done
        elapsed = time.perf_counter() - start
        if data == "[DONE]":
            done = True
            result["events"].append({"elapsed_s": elapsed, "data": "[DONE]"})
            return
        event = strict_loads(data)
        if not isinstance(event, dict):
            raise ValueError("SSE event must be an object")
        result["events"].append({"elapsed_s": elapsed, "data": event})
        if event.get("error") is not None:
            raise RequestFailure("server_error", json.dumps(event["error"], ensure_ascii=False))
        for field in ("usage", "timings"):
            if isinstance(event.get(field), dict):
                result[field].update(event[field])
        if event.get("context_truncated"):
            result["context_truncated"] = event["context_truncated"]
        choices = event.get("choices", [])
        if not isinstance(choices, list):
            raise ValueError("SSE choices must be an array")
        for choice in choices:
            if not isinstance(choice, dict):
                raise ValueError("SSE choice must be an object")
            if choice.get("index", 0) != 0:
                continue
            if choice.get("finish_reason"):
                result["finish_reason"] = choice["finish_reason"]
            delta = choice.get("delta") or {}
            if not isinstance(delta, dict):
                raise ValueError("SSE delta must be an object")
            reasoning = delta.get("reasoning_content") or delta.get("reasoning") or ""
            content = delta.get("content") or ""
            if not isinstance(content, str) or not isinstance(reasoning, str):
                raise ValueError("Expected text deltas")
            if reasoning or content:
                if result["ttft_client_s"] is None:
                    result["ttft_client_s"] = elapsed
                result["last_chunk_s"] = elapsed
            if content and result["ttfa_client_s"] is None:
                result["ttfa_client_s"] = elapsed
            result["answer"] += content
            result["reasoning"] += reasoning

    try:
        with http_response(base_url, "/v1/chat/completions", api_key, payload,
                           timeout, read_timeout=read_timeout) as response:
            data_lines = []
            while not done:
                raw = response.readline()
                if not raw:
                    if data_lines:
                        consume("\n".join(data_lines))
                    break
                line = raw.decode("utf-8").rstrip("\r\n")
                if not line:
                    if data_lines:
                        consume("\n".join(data_lines))
                        data_lines = []
                elif line.startswith("data:"):
                    data_lines.append(line[5:].lstrip(" "))
            if not done or not result["finish_reason"]:
                raise RequestFailure("incomplete_stream", "Missing [DONE] or finish_reason")
            if result["finish_reason"] not in {"stop", "length"}:
                raise RequestFailure("unexpected_finish", str(result["finish_reason"]))
        result["stream_complete"] = True
    except (RequestFailure, ValueError, UnicodeError, OSError, http.client.HTTPException) as exc:
        failure = exc if isinstance(exc, RequestFailure) else RequestFailure("protocol_error", str(exc))
        result.update(total_s=time.perf_counter() - start, finished_at=now())
        failure.partial = result
        raise failure
    result.update(total_s=time.perf_counter() - start, finished_at=now())
    return result


def numeric_value(mapping, key):
    value = mapping.get(key)
    return round(value, 6) if type(value) in {int, float} and math.isfinite(value) else None


def context_value(status, key):
    return status.get(key) if type(status.get(key)) is int else None


def result_metrics(result, counted, context, max_tokens):
    usage, timings = result.get("usage", {}), result.get("timings", {})
    prompt, completion = usage.get("prompt_tokens"), usage.get("completion_tokens")
    match = prompt == counted if type(prompt) is int and type(counted) is int else None
    ttft, last = result.get("ttft_client_s"), result.get("last_chunk_s")
    truncated = True if result.get("context_truncated") else (False if match is True else None)
    problems = []
    if not result.get("stream_complete"):
        problems.append("incomplete_stream")
    if match is not True:
        problems.append("token_count_mismatch" if match is False else "missing_usage")
    if type(completion) is not int or completion < 0:
        problems.append("missing_completion_usage")
    elif completion > max_tokens:
        problems.append("completion_exceeds_requested_budget")
    if truncated is not False:
        problems.append("prompt_truncation_or_unknown")
    exhausted = result.get("finish_reason") == "length"
    if exhausted:
        problems.append("budget_exhausted")
    if not result.get("answer"):
        problems.append("empty_answer")
    if type(context) is not int or type(counted) is not int or counted + max_tokens > context:
        problems.append("context_budget_invalid")
    reasoning_details = usage.get("completion_tokens_details") or {}
    if not isinstance(reasoning_details, dict):
        reasoning_details = {}
        problems.append("invalid_completion_details")
    return dict(counted_prompt_tokens=counted, tokens_evaluated=prompt,
                usage_matches_count=match, output_tokens=completion,
                reasoning_tokens=reasoning_details.get("reasoning_tokens"),
                prompt_tps=numeric_value(timings, "prompt_per_second"),
                decode_tps=numeric_value(timings, "predicted_per_second"),
                client_prompt_tps_est=prompt / ttft if type(prompt) is int and ttft else None,
                client_decode_tps_est=(completion - 1) / (last - ttft)
                if type(completion) is int and completion > 1 and ttft is not None and last and last > ttft else None,
                ttft_client_s=ttft, ttfa_client_s=result.get("ttfa_client_s"),
                total_s=result.get("total_s"), stream_complete=result.get("stream_complete", False),
                truncated=truncated, budget_exhausted=exhausted,
                finish_reason=result.get("finish_reason", ""), effective_n_ctx=context,
                measurement_valid=not problems, validation_errors=problems)


def strict_loads(text):
    def unique(pairs):
        obj = {}
        for key, value in pairs:
            if key in obj:
                raise ValueError(f"Duplicate JSON key: {key}")
            obj[key] = value
        return obj
    def invalid(value):
        raise ValueError(f"Non-finite JSON number: {value}")
    def finite_float(value):
        number = float(value)
        if not math.isfinite(number):
            return invalid(value)
        return number
    return json.loads(text, object_pairs_hook=unique, parse_constant=invalid, parse_float=finite_float)


def extract_json_object(text):
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        raise ValueError("No JSON object in answer")
    value = strict_loads(text[start:end + 1])
    if not isinstance(value, dict):
        raise ValueError("Answer must be a JSON object")
    return value


def type_matches(actual, expected):
    if expected is None:
        return actual is None
    if type(expected) is int:
        return type(actual) is int
    if type(expected) is float:
        return type(actual) in {int, float} and math.isfinite(actual)
    if type(actual) is not type(expected):
        return False
    if isinstance(expected, dict):
        return set(actual) == set(expected) and all(type_matches(actual[k], v) for k, v in expected.items())
    if isinstance(expected, list):
        return len(actual) == len(expected) and all(type_matches(a, b) for a, b in zip(actual, expected))
    return True


def score_json_answer(answer, expected, code_fields=()):
    """AST normalization never executes model code. Content and format are separate metrics."""
    result = dict(content_correct=False, format_valid=False, matched_fields=0,
                  expected_fields=len(expected), score_error="", parsed_answer=None)
    try:
        actual = extract_json_object(answer)
        result["parsed_answer"] = actual
        pure = strict_loads(answer.strip()) == actual
    except (ValueError, TypeError):
        pure = False
        try:
            actual = extract_json_object(answer)
            result["parsed_answer"] = actual
        except (ValueError, TypeError) as exc:
            result["score_error"] = str(exc)
            return result
    result["format_valid"] = pure and type_matches(actual, expected)
    for key, value in expected.items():
        if key not in actual or not type_matches(actual[key], value):
            continue
        if key in code_fields:
            try:
                matched = ast.dump(ast.parse(actual[key].strip())) == ast.dump(ast.parse(value.strip()))
            except (SyntaxError, ValueError, TypeError):
                matched = False
        else:
            matched = actual[key] == value
        result["matched_fields"] += int(matched)
    result["content_correct"] = result["matched_fields"] == len(expected)
    return result


def median_numeric(rows, field):
    values = [r[field] for r in rows if type(r.get(field)) in {int, float} and math.isfinite(r[field])]
    return round(statistics.median(values), 6) if values else None


def metric_summary(rows):
    valid = [r for r in rows if r.get("measurement_valid") is True]
    stats = {}
    for field in ("prompt_tps", "decode_tps", "client_prompt_tps_est", "client_decode_tps_est",
                  "ttft_client_s", "ttfa_client_s", "total_s", "output_tokens", "reasoning_tokens"):
        values = [r[field] for r in valid if type(r.get(field)) in {int, float} and math.isfinite(r[field])]
        stats[field] = dict(median=median_numeric(valid, field), n=len(values),
                            minimum=min(values) if values else None, maximum=max(values) if values else None,
                            source="client_estimate" if field.endswith("_est") else
                            ("backend" if field in {"prompt_tps", "decode_tps", "output_tokens", "reasoning_tokens"} else "client"))
    return stats


class Journal:
    """JSONL is authoritative; CSV is a rebuildable view. First attempts stay in primary statistics."""
    def __init__(self, output: Path, planned: list[dict], settings: dict, resume=False):
        self.output = output
        self.path = output.with_suffix(".events.jsonl")
        self.manifest_path = output.with_suffix(".manifest.json")
        self.rows = []
        self.starts = {}
        manifest = dict(schema_version=SCHEMA_VERSION, planned=planned, settings=settings)
        self.planned = planned
        self.fingerprint = digest(manifest)
        if self.path.exists() or self.manifest_path.exists():
            if not resume:
                raise ValueError(f"Existing results: {output}; use --resume or a new output path")
            old = json.loads(self.manifest_path.read_text(encoding="utf-8"))
            if old["fingerprint"] != self.fingerprint:
                raise ValueError("Resume rejected: inputs, settings or effective model configuration changed")
            if self.path.exists():
                raw = self.path.read_bytes()
                # A killed process can leave an unterminated final JSONL line. Keep it as evidence.
                if raw and not raw.endswith(b"\n"):
                    split = raw.rfind(b"\n") + 1
                    self.path.with_name(self.path.name + ".incomplete-" + uuid.uuid4().hex).write_bytes(raw[split:])
                    self.path.write_bytes(raw[:split])
                for line in self.path.read_text(encoding="utf-8").splitlines():
                    event = json.loads(line)
                    if event["event"] == "start":
                        self.starts[event["request_id"]] = event
                    elif event["event"] == "result":
                        self.rows.append(event["row"])
            finished = {r["request_id"] for r in self.rows}
            for request_id, event in list(self.starts.items()):
                if request_id not in finished:
                    self.finish(event, dict(runtime_error="Interrupted before a result was committed",
                                            error_kind="interrupted", run_status="failed", measurement_valid=False))
        else:
            write_json(self.manifest_path, dict(manifest, fingerprint=self.fingerprint))

    def append(self, event):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8", newline="\n") as handle:
            handle.write(json.dumps(redact(event), ensure_ascii=False, allow_nan=False) + "\n")
            handle.flush()
            os.fsync(handle.fileno())

    def done(self, job_id, retry_failed=False):
        previous = [r for r in self.rows if r["job_id"] == job_id]
        if not previous:
            return False
        return not retry_failed or previous[-1].get("run_status") == "completed"

    def start(self, job, payload):
        event = dict(event="start", job_id=job["job_id"], request_id=uuid.uuid4().hex,
                     attempt=1 + sum(r["job_id"] == job["job_id"] for r in self.rows),
                     started_at=now(), job=job, payload=payload)
        self.append(event)
        self.starts[event["request_id"]] = event
        return event

    def finish(self, event, row):
        merged = dict(event["job"], request_id=event["request_id"], attempt=event["attempt"],
                      request_started_at=event["started_at"], request_finished_at=now(), **row)
        merged.setdefault("runtime_error", "")
        merged.setdefault("task_success", False)
        self.append(dict(event="result", row=merged))
        self.rows.append(merged)
        self.write_csv()
        return merged

    def primary_rows(self):
        primary = {}
        for row in self.rows:
            primary.setdefault(row["job_id"], row)
        return [primary.get(job["job_id"], dict(job, run_status="pending", task_success=False,
                                               measurement_valid=False)) for job in self.planned]

    def write_csv(self):
        columns = list(dict.fromkeys(k for row in self.rows for k in row if k != "raw_result"))
        if not columns:
            return
        tmp = self.output.with_name(self.output.name + ".tmp")
        with tmp.open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=columns)
            writer.writeheader()
            for row in self.rows:
                writer.writerow({k: json.dumps(redact(v), ensure_ascii=False) if isinstance(v, (dict, list)) else v
                                 for k, v in row.items() if k != "raw_result"})
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, self.output)


def evidence_identity(status):
    keys = ("active_model", "model_identifier", "gguf_variant", "context_length", "gpu_memory_mode",
            "gpu_layers", "cache_type_k", "cache_type_v", "cache_type_kv", "batch_size", "ubatch_size")
    result = {k: status[k] for k in keys if k in status}
    result["template_digest"] = digest({k: status.get(k) for k in ("chat_template", "chat_template_override")})
    return result


def execute_request(job, payload, journal, base_url, api_key, status, timeout):
    event = journal.start(job, payload)
    counted = None
    try:
        counted = count_prompt_tokens(base_url, api_key, payload, timeout)
        context = status.get("context_length")
        margin = job.get("safety_margin", 0)
        if type(context) is not int or counted + payload["max_tokens"] + margin > context:
            raise RequestFailure("context_budget_invalid", f"prompt={counted}, output={payload['max_tokens']}, context={context}")
        raw = stream_chat_completion(base_url, payload, api_key, timeout)
        metrics = result_metrics(raw, counted, context, payload["max_tokens"])
        scoring = score_json_answer(raw["answer"], job["expected"], job.get("code_fields", []))
        row = dict(metrics, **scoring, run_status="completed", raw_result=raw,
                   answer=raw["answer"], reasoning=raw["reasoning"], runtime_error="", error_kind="",
                   task_success=metrics["measurement_valid"] and scoring["content_correct"] and scoring["format_valid"])
        actual = scoring.get("parsed_answer") or {}
        for needle in job.get("needles", []):
            position = round(needle["target_position"] * 100)
            row[f"pos_{position}"] = int(needle["project"] in actual and
                                             actual[needle["project"]] == needle["code"])
    except (RequestFailure, OSError, ValueError) as exc:
        raw = getattr(exc, "partial", {})
        row = dict(run_status="failed", measurement_valid=False, task_success=False,
                   counted_prompt_tokens=counted, runtime_error=str(exc),
                   error_kind=getattr(exc, "kind", "client_error"), raw_result=raw,
                   answer=raw.get("answer", ""), reasoning=raw.get("reasoning", ""))
    return journal.finish(event, row)


def execution_status(rows):
    finished = sum(r.get("run_status") == "completed" for r in rows)
    pending = sum(r.get("run_status") == "pending" for r in rows)
    return "completed" if finished == len(rows) and rows else ("partial" if finished or pending else "failed")
