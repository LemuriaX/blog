"""Distinguish effective runtime evidence from requested launch arguments."""
from __future__ import annotations
import re
import os


def validate_runtime(status, log, stage):
    checks = []

    def check(name, expected, actual, source):
        checks.append(dict(name=name, expected=expected, actual=actual, source=source,
                           status="unknown" if actual is None else "pass" if actual == expected else "fail"))

    def last(pattern, cast=str):
        matches = re.findall(pattern, log, re.I)
        return cast(matches[-1]) if matches else None

    # gpu_layers, requested_n_batch, speculative_type and disable_vision in the
    # native status schema are request echoes, not proof that the backend applied them.
    loaded = last(r"llama_model_loader:[^\r\n]*\bfrom\s+(.+?\.gguf)")
    if loaded is None:
        loaded = last(r"\bload_model:\s+loading model\s+['\"]([^'\"\r\n]+\.gguf)['\"]")
    expected_path = stage.get("model_path")
    same_path = None
    if loaded is not None and expected_path:
        normalize = lambda value: os.path.normcase(os.path.abspath(value.strip().strip('\"\'')))
        same_path = normalize(loaded) == normalize(expected_path)
    check("loaded_model_file", True, same_path, "backend model-load path compared with preflight-hashed GGUF")
    variant = status.get("gguf_variant")
    if variant is not None:
        # Useful contradiction detection; the source file check remains necessary.
        check("reported_quant_variant", stage["quant"], variant, "native reported GGUF variant; paired with file identity")
    context_per_sequence = last(r"\bn_ctx_per_seq\s*=\s*(\d+)", int)
    if context_per_sequence is None:
        context_per_sequence = last(r"\bn_ctx_slot\s*=\s*(\d+)", int)
    check("context_per_sequence", stage["context"], context_per_sequence,
          "llama.cpp startup log (n_ctx_per_seq or n_ctx_slot)")
    check("status_context", stage["context"], status.get("context_length"), "native status")
    check("parallel_slots", 1, status.get("parallel_slots"), "native effective parallel_slots")
    offload = re.findall(r"offloaded\s+(\d+)\s*/\s*(\d+)\s+layers\s+to\s+GPU", log, re.I)
    check("all_layers_on_gpu", True, (int(offload[-1][0]) == int(offload[-1][1]))
          if offload else None, "llama.cpp offloaded N/N log (including output layer)")
    for key, expected in (("n_batch", stage["batch"]), ("n_ubatch", stage["ubatch"])):
        check(key, expected, last(r"\b" + key + r"\s*=\s*(\d+)", int), "llama.cpp startup log")
    for suffix in ("k", "v"):
        value = last(r"\btype_" + suffix + r"\s*=\s*['\"]?([a-z0-9_]+)")
        if value is None:
            value = status.get("cache_type_" + suffix) or status.get("cache_type_kv")
        check("cache_type_" + suffix, stage["kv"], value, "native cache dtype or startup log")
    flash = last(r"\bflash_attn\s*=\s*(\w+)")
    check("flash_attention", True, None if flash is None else flash.lower() in {"1", "true", "on", "enabled"},
          "llama.cpp startup log")
    # These controls are deliberately reported as unknown when only a request echo exists.
    for name, pattern, expected in (
        ("context_shift", r"\b(?:context_shift|ctx_shift)\s*=\s*(true|false|on|off|0|1)\b", False),
        ("prompt_cache", r"\bcache_prompt\s*=\s*(true|false|on|off|0|1)\b", False),
    ):
        value = last(pattern)
        check(name, expected, None if value is None else value.lower() in {"true", "on", "1"},
              "explicit effective backend log; missing is unknown")
    mmproj = status.get("mmproj_path")
    check("vision_projector_loaded", False, bool(mmproj) if "mmproj_path" in status else None,
          "effective mmproj_path, if backend exposes it")
    spec = status.get("effective_speculative_type")
    check("speculative_decoding", "off", spec, "effective_speculative_type, if exposed")
    verdict = "fail" if any(c["status"] == "fail" for c in checks) else (
        "unknown" if any(c["status"] == "unknown" for c in checks) else "pass")
    return dict(verdict=verdict, checks=checks,
                note="Requested flags are stored separately. Unknown settings permit diagnostic results, not a verified configuration claim.")
