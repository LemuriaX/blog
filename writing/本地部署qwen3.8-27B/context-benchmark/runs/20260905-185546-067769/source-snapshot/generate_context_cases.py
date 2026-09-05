#!/usr/bin/env python3
"""为长上下文测试生成可复现的合成文本。

脚本只使用 Python 标准库。它调用 Unsloth Run 的
/v1/chat/count_tokens 接口，以当前模型的分词器和聊天模板精确计数。
"""

from __future__ import annotations

import argparse
import json
import os
import random
import string
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


POSITION_RATIOS = (0.10, 0.30, 0.50, 0.70, 0.90)
PROJECT_NAMES = ("ORION", "LYRA", "CYGNUS", "VEGA", "DRACO")
AREAS = ("华东", "华南", "华北", "西南", "西北", "东北")
STATES = ("正常", "待复核", "已归档", "已同步")


from benchmark_common import (chat_payload, count_prompt_tokens, resolve_model_id, get_json, digest, write_json)


def count_chat_tokens(base_url, messages, model, api_key, timeout):
    return count_prompt_tokens(base_url, api_key, chat_payload(messages, model, 1, 3407), timeout)


def random_group(rng: random.Random, length: int = 4) -> str:
    """生成便于人工核对的随机大写字母数字串。"""
    alphabet = string.ascii_uppercase + string.digits
    return "".join(rng.choice(alphabet) for _ in range(length))


def make_needles(seed: int, variant: str = "baseline") -> list[dict[str, Any]]:
    """生成五条放在不同位置的校验记录。"""
    rng = random.Random(seed)
    needles: list[dict[str, Any]] = []
    for name, ratio in zip(PROJECT_NAMES, POSITION_RATIOS):
        project = f"{name}-{rng.randrange(1000, 10000)}"
        code = f"{random_group(rng)}-{random_group(rng)}"
        needles.append(
            {
                "project": project,
                "code": code,
                "target_position": ratio,
                "variant": variant,
                "missing": variant == "challenge" and name == PROJECT_NAMES[-1],
            }
        )
    return needles


def filler_record(index: int, seed: int) -> str:
    """按序号生成无外部版权内容的中性运行记录。"""
    value = seed * 104729 + index * 8191
    area = AREAS[value % len(AREAS)]
    state = STATES[(value // 7) % len(STATES)]
    batch = value % 97 + 1
    latency = value % 241 + 8
    temperature = 180 + value % 161
    load = 20 + value % 79
    day = value % 28 + 1
    node = value % 800 + 100

    templates = (
        "记录 {i:06d}：{area}节点 N-{node} 在 2026-08-{day:02d} 完成第 {batch:02d} 批巡检；延迟 {latency} ms，状态为{state}。",
        "记录 {i:06d}：第 {batch:02d} 批数据来自{area}节点 N-{node}；负载 {load}%，温度 {temp:.1f}℃，状态为{state}。",
        "记录 {i:06d}：{area}节点 N-{node} 已写入归档索引；采集日为 2026-08-{day:02d}，处理耗时 {latency} ms。",
        "记录 {i:06d}：巡检批次 {batch:02d} 覆盖{area}节点 N-{node}；负载 {load}%，结果为{state}。",
    )
    template = templates[value % len(templates)]
    return template.format(
        i=index + 1,
        area=area,
        node=node,
        day=day,
        batch=batch,
        latency=latency,
        state=state,
        load=load,
        temp=temperature / 10,
    )


def build_user_content(record_count: int, needles: list[dict[str, Any]], seed: int) -> str:
    """Use ordinary records; challenge cases include obsolete values, near matches and a missing answer."""
    insertions: dict[int, list[str]] = {}
    for needle in needles:
        index = round(record_count * float(needle["target_position"]))
        project, code = needle["project"], needle["code"]
        if not needle.get("missing"):
            text = f"项目记录：项目 {project}，版本 2，状态有效，校验码 {code}。"
            insertions.setdefault(index, []).append(text)
        if needle.get("variant") == "challenge":
            if not needle.get("missing"):
                insertions.setdefault(min(record_count, index + 4), []).append(
                    f"项目记录：项目 {project}，版本 1，状态已失效，校验码 OLD0-0000。")
            insertions.setdefault(max(0, index - 3), []).append(
                f"项目记录：项目 {project}-ARCHIVE，版本 9，状态有效，校验码 DECO-Y999。")
    lines = ["以下是按归档位置排列的运行日志，位置顺序不代表版本先后。", ""]
    for index in range(record_count + 1):
        lines.extend(insertions.get(index, []))
        if index < record_count:
            lines.append(filler_record(index, seed))
    projects = "、".join(n["project"] for n in needles)
    lines += ["", f"查询项目：{projects}。", "按项目名称精确匹配，仅采用版本最高且状态有效的项目记录；找不到有效记录时返回 null。",
              "只输出 JSON 对象，键为上述项目名，值为校验码或 null；不输出解释、额外字段或 Markdown。"]
    return "\n".join(lines)


def evaluate_size(
    base_url: str,
    record_count: int,
    needles: list[dict[str, Any]],
    seed: int,
    model: str,
    api_key: str,
    timeout: int,
) -> tuple[int, str]:
    """构造文本并返回套用聊天模板后的输入 Token 数。"""
    content = build_user_content(record_count, needles, seed)
    messages = [{"role": "user", "content": content}]
    token_count = count_chat_tokens(base_url, messages, model, api_key, timeout)
    return token_count, content


def find_record_count(
    base_url: str,
    target_tokens: int,
    needles: list[dict[str, Any]],
    seed: int,
    model: str,
    api_key: str,
    timeout: int,
    tolerance: int,
) -> tuple[int, int, str]:
    """用二分查找找到最接近目标 Token 数的记录条数。"""
    high = max(32, target_tokens // 20)
    best: tuple[int, int, str] | None = None

    while True:
        count, content = evaluate_size(
            base_url, high, needles, seed, model, api_key, timeout
        )
        candidate = (high, count, content)
        if best is None or abs(count - target_tokens) < abs(best[1] - target_tokens):
            best = candidate
        if count >= target_tokens:
            break
        high *= 2
        if high > 1_000_000:
            raise RuntimeError("无法建立足够长的测试文本")

    low = 0
    while low <= high:
        middle = (low + high) // 2
        count, content = evaluate_size(
            base_url, middle, needles, seed, model, api_key, timeout
        )
        candidate = (middle, count, content)
        if best is None or abs(count - target_tokens) < abs(best[1] - target_tokens):
            best = candidate

        if abs(count - target_tokens) <= tolerance:
            best = candidate
            break
        if count < target_tokens:
            low = middle + 1
        else:
            high = middle - 1

    if best is None:
        raise RuntimeError("测试文本生成失败")
    return best


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="生成指定 Token 长度的长上下文测试文本")
    parser.add_argument("--base-url", default="http://127.0.0.1:8001", help="Unsloth 地址")
    parser.add_argument(
        "--api-key",
        default=os.getenv("UNSLOTH_API_KEY", ""),
        help="Unsloth API Key；默认读取 UNSLOTH_API_KEY",
    )
    parser.add_argument(
        "--model",
        default=os.getenv("UNSLOTH_MODEL_ID", ""),
        help="模型 ID；留空时从 /v1/models 读取",
    )
    parser.add_argument("--ctx-size", type=int, required=True, help="服务配置的上下文长度")
    parser.add_argument("--target-tokens", type=int, required=True, help="目标输入 Token 数")
    parser.add_argument("--variant", choices=("baseline", "challenge"), default="baseline")
    parser.add_argument("--max-output-tokens", type=int, default=192)
    parser.add_argument("--safety-margin", type=int, default=128)
    parser.add_argument("--cases", type=int, default=3, help="生成的测试样本数")
    parser.add_argument("--seed", type=int, default=3407, help="随机种子")
    parser.add_argument("--tolerance", type=int, default=64, help="允许的 Token 数偏差")
    parser.add_argument("--timeout", type=int, default=1800, help="单次 HTTP 请求超时，单位为秒")
    parser.add_argument("--output-dir", type=Path, required=True, help="输出目录")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.api_key:
        print("缺少 Unsloth API Key；请设置 UNSLOTH_API_KEY 或传入 --api-key", file=sys.stderr)
        return 2
    if args.cases < 1:
        print("--cases 至少为 1", file=sys.stderr)
        return 2
    if min(args.target_tokens, args.ctx_size, args.max_output_tokens) < 1 or args.tolerance < 0 or args.safety_margin < 0:
        raise ValueError("Invalid token budget or tolerance")
    if args.target_tokens + args.tolerance + args.max_output_tokens + args.safety_margin > args.ctx_size:
        print("目标输入、容差、最大输出与安全余量之和超过上下文", file=sys.stderr)
        return 2

    model = args.model or resolve_model_id(args.base_url, args.api_key, args.timeout)
    status = get_json(args.base_url, "/api/inference/status", args.api_key, 30)
    if status.get("context_length") != args.ctx_size:
        raise ValueError("Generator context does not match the loaded server")
    args.output_dir.mkdir(parents=True, exist_ok=True)

    for case_index in range(1, args.cases + 1):
        case_seed = args.seed + case_index * 1009
        needles = make_needles(case_seed, args.variant)
        record_count, actual_tokens, content = find_record_count(
            args.base_url,
            args.target_tokens,
            needles,
            case_seed,
            model,
            args.api_key,
            args.timeout,
            args.tolerance,
        )
        if abs(actual_tokens - args.target_tokens) > args.tolerance:
            raise ValueError("Generated token count outside tolerance")
        if actual_tokens + args.max_output_tokens + args.safety_margin > args.ctx_size:
            raise ValueError("Generated case does not leave the requested output budget")
        empty_tokens = count_chat_tokens(args.base_url, [{"role": "user", "content": ""}], model, args.api_key, args.timeout)
        for needle in needles:
            marker = f"项目记录：项目 {needle['project']}，版本 2，状态有效"
            offset = content.find(marker)
            needle["token_prefix_count"] = None
            needle["token_position_estimate"] = None
            if offset >= 0:
                prefix_count = count_chat_tokens(args.base_url, [{"role": "user", "content": content[:offset]}], model, args.api_key, args.timeout)
                needle["token_prefix_count"] = prefix_count
                needle["token_position_estimate"] = round(max(0, prefix_count - empty_tokens) / max(1, actual_tokens - empty_tokens), 6)
            if needle.get("missing"):
                needle["code"] = None
        expected = {item["project"]: item["code"] for item in needles}
        data = {
            "schema_version": 3,
            "variant": args.variant,
            "reserved_output_tokens": args.max_output_tokens,
            "safety_margin": args.safety_margin,
            "position_method": "tokenized_prefix_minus_empty_chat; token boundary is approximate",
            "template_status_digest": digest({k: status.get(k) for k in ("chat_template", "chat_template_override")}),
            "test_type": "synthetic_multi_needle_retrieval",
            "model": model,
            "configured_context": args.ctx_size,
            "target_prompt_tokens": args.target_tokens,
            "actual_prompt_tokens": actual_tokens,
            "record_count": record_count,
            "seed": case_seed,
            "thinking_enabled": False,
            "messages": [{"role": "user", "content": content}],
            "needles": needles,
            "expected": expected,
        }

        stem = f"case-{case_index:02d}"
        json_path = args.output_dir / f"{stem}.json"
        text_path = args.output_dir / f"{stem}.txt"
        if json_path.exists():
            old = json.loads(json_path.read_text(encoding="utf-8"))
            if old != data:
                raise ValueError(f"Refusing to replace different case: {json_path}")
        write_json(json_path, data)
        text_path.write_text(content, encoding="utf-8")
        difference = actual_tokens - args.target_tokens
        print(
            f"{json_path}: {actual_tokens} Token "
            f"(目标 {args.target_tokens}，偏差 {difference:+d})"
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
