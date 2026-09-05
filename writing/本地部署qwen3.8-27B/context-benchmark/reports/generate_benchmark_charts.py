"""Build publication figures from saved benchmark events and engine logs.

Only the output directory is written. Prompts, answers, reasoning and API keys
are never copied into the exported chart data.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import os
import re
import statistics as stats
from pathlib import Path

HERE = Path(__file__).resolve().parent
BENCHMARK = HERE.parent
DOCUMENTS = BENCHMARK.parent
DEFAULT_OUTPUT = DOCUMENTS / "local-llm-sharing-assets" / "benchmarks"
os.environ.setdefault("MPLCONFIGDIR", str(HERE / ".matplotlib-cache"))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.lines import Line2D
from matplotlib.patches import FancyBboxPatch, Patch
import numpy as np

BG = "#0f172a"
PANEL = "#162136"
FG = "#f1f5f9"
MUTED = "#b2bfd1"
GRID = "#34425a"
MODEL_COLORS = ["#60a5fa", "#34d399", "#f472b6"]
MODEL_NAMES = ["Q4_K_S", "Q4_K_XL", "Q3_K_XL"]
COMPONENT_COLORS = ["#7185ab", "#60a5fa", "#34d399", "#f472b6"]
PERFORMANCE_IDS = ["performance-performance", "quality-performance", "context-performance"]
QUALITY_IDS = ["performance-quality", "quality-quality", "context-quality"]
CAPACITY_IDS = ["context-performance", "capacity-32K", "capacity-64K", "capacity-128K"]
METRICS = ["prompt_tps", "decode_tps", "ttft_client_s", "ttfa_client_s", "total_s", "output_tokens"]
SAFE_FIELDS = ["job_id", "family", "seed", "attempt", "tokens_evaluated", "output_tokens",
               "prompt_tps", "decode_tps", "ttft_client_s", "ttfa_client_s", "total_s",
               "measurement_valid", "content_correct", "format_valid", "task_success",
               "run_status", "finish_reason", "budget_exhausted"]


def setup_fonts():
    for path in [Path("C:/Windows/Fonts/msyh.ttc"), Path("C:/Windows/Fonts/msyhbd.ttc")]:
        if path.is_file():
            font_manager.fontManager.addfont(str(path))
    available = {font.name for font in font_manager.fontManager.ttflist}
    families = [name for name in ["Microsoft YaHei", "Noto Sans CJK SC", "DejaVu Sans"] if name in available]
    plt.rcParams.update({
        "font.family": families,
        "font.size": 14,
        "axes.unicode_minus": False,
        "svg.fonttype": "path",
        "svg.hashsalt": "qwen-benchmark-20260906",
        "figure.facecolor": BG,
        "axes.facecolor": PANEL,
        "text.color": FG,
        "axes.labelcolor": MUTED,
        "xtick.color": MUTED,
        "ytick.color": FG,
        "savefig.facecolor": BG,
    })


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


class Evidence:
    def __init__(self):
        self.hashes = {}

    def text(self, path):
        path = path.resolve()
        payload = path.read_bytes()
        self.hashes[str(path)] = hashlib.sha256(payload).hexdigest()
        return payload.decode("utf-8-sig")

    def json(self, path):
        return json.loads(self.text(path))

    def unchanged(self):
        return all(sha(Path(path)) == digest for path, digest in self.hashes.items())


def metric(rows, name):
    values = [r[name] for r in rows if isinstance(r.get(name), (int, float)) and not isinstance(r[name], bool)]
    if not values:
        raise ValueError(f"Missing measurements: {name}")
    return {"n": len(values), "median": stats.median(values), "minimum": min(values), "maximum": max(values)}


def load_run(path, stage_ids, evidence):
    run = {"id": path.name, "path": str(path), "stages": {}}
    environment = evidence.json(path / "environment.json")
    run["driver"] = next(g["DriverVersion"] for g in environment["gpus"] if "7900 XT" in g["Name"])
    summary = evidence.json(path / "summary.json")
    entries = {s["id"]: s for s in summary["stages"]}
    for stage_id in stage_ids:
        folder = path / stage_id
        events = [json.loads(line) for line in evidence.text(folder / "results.events.jsonl").splitlines()]
        planned = evidence.json(folder / "results.manifest.json")["planned"]
        expected = evidence.json(folder / "results.summary.json")
        starts = {e["request_id"]: e for e in events if e["event"] == "start"}
        rows = [e["row"] for e in events if e["event"] == "result" and e["row"]["attempt"] == 1]
        if len(rows) != len(planned) or len({r["job_id"] for r in rows}) != len(rows):
            raise ValueError(f"Incomplete or duplicated first attempts: {stage_id}")
        valid = [r for r in rows if r.get("measurement_valid") is True]
        if not valid:
            raise ValueError(f"No valid measurements: {stage_id}")
        is_quality = stage_id.endswith("-quality")
        for row in rows:
            payload = starts[row["request_id"]]["payload"]
            if payload["enable_thinking"] is not is_quality:
                raise ValueError(f"Unexpected Thinking mode: {stage_id}")
            if is_quality and payload.get("reasoning_effort") != "xhigh":
                raise ValueError(f"Quality requests must use xhigh: {stage_id}")
        calculated = {name: metric(valid, name) for name in METRICS}
        for name, value in calculated.items():
            saved = expected["metrics"][name]
            if value["n"] != saved["n"] or not math.isclose(value["median"], saved["median"], abs_tol=1e-6):
                raise ValueError(f"Summary differs from original requests: {stage_id}/{name}")
        log = evidence.text(folder / "llama-server.log")
        log_record = evidence.json(folder / "backend-log-collection.json")
        if sha(folder / "llama-server.log") != log_record["snapshot_sha256"]:
            raise ValueError(f"Engine log hash mismatch: {stage_id}")
        buffers = {}
        for key in ["model", "KV", "RS", "compute"]:
            match = re.search(r"ROCm0\s+" + key + r" buffer size\s*=\s*([\d.]+) MiB", log)
            if not match:
                raise ValueError(f"Missing GPU buffer: {stage_id}/{key}")
            buffers[key] = float(match.group(1)) / 1024
        requested = entries[stage_id]["stage"]
        first_payload = starts[rows[0]["request_id"]]["payload"]
        settings = {key: requested[key] for key in ["quant", "batch", "ubatch", "kv", "context"]}
        settings.update({key: first_payload.get(key) for key in ["enable_thinking", "reasoning_effort", "max_tokens",
                                                               "temperature", "top_p", "top_k", "presence_penalty"]})
        run["stages"][stage_id] = {
            "id": stage_id, "run_id": path.name, "settings": settings,
            "planned": len(planned), "valid": len(valid),
            "success": sum(bool(r.get("task_success")) for r in rows),
            "format_valid": sum(bool(r.get("format_valid")) for r in valid),
            "rows": valid, "first_attempts": rows, "metrics": calculated, "buffers_gib": buffers,
            "input_median": stats.median(r["tokens_evaluated"] for r in valid),
            "input_range": [min(r["tokens_evaluated"] for r in valid), max(r["tokens_evaluated"] for r in valid)],
        }
    return run


def figure(title, subtitle, category):
    fig = plt.figure(figsize=(16, 9), dpi=160)
    fig.text(.05, .946, "QWEN3.8-27B  /  RX 7900 XT", fontsize=11, color=MUTED, weight="bold")
    fig.text(.95, .946, category, fontsize=12, color=MODEL_COLORS[0], ha="right")
    fig.text(.05, .882, title, fontsize=27, weight="bold")
    fig.text(.05, .834, subtitle, fontsize=13, color=MUTED)
    fig.add_artist(Line2D([.05, .95], [.797, .797], transform=fig.transFigure, color=GRID, linewidth=1))
    return fig


def panel(fig, rect, title, subtitle=None):
    x, y, w, h = rect
    fig.add_artist(FancyBboxPatch((x-.018, y-.022), w+.035, h+.087,
                                 boxstyle="round,pad=0.012,rounding_size=0.018",
                                 transform=fig.transFigure, facecolor=PANEL, edgecolor="none", zorder=0))
    ax = fig.add_axes(rect)
    ax.set_title(title, loc="left", fontsize=18, color=FG, weight="bold", pad=20 if not subtitle else 35)
    if subtitle:
        ax.text(0, 1.025, subtitle, fontsize=10.5, color=MUTED, transform=ax.transAxes)
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.tick_params(axis="both", length=0, labelsize=13, pad=9)
    ax.set_axisbelow(True)
    return ax


def footer(fig, first, second):
    fig.text(.05, .093, first, fontsize=11, color=MUTED)
    fig.text(.05, .052, second, fontsize=10, color="#8799b2")


def haxis(ax, maximum, ticks, label, names=MODEL_NAMES):
    ax.set_xlim(0, maximum)
    ax.set_ylim(-.65, len(names)-.3)
    ax.set_xticks(ticks)
    ax.set_yticks(list(range(len(names)-1, -1, -1)), names)
    ax.grid(axis="x", color=GRID, alpha=.65, linewidth=.75)
    ax.set_xlabel(label, fontsize=12.5, labelpad=13)


def sample_label(groups):
    sizes = [len(rows) for rows in groups]
    if len(set(sizes)) == 1:
        return f"每组 {sizes[0]} 次"
    return "有效次数 " + "/".join(map(str, sizes))


def input_range(stages):
    return f'{min(s["input_range"][0] for s in stages):,}—{max(s["input_range"][1] for s in stages):,}'


def save(fig, name, output, figures):
    fig.canvas.draw()
    renderer = fig.canvas.get_renderer()
    width, height = fig.canvas.get_width_height()
    outside = []
    for text in fig.findobj(plt.Text):
        if not text.get_visible() or not text.get_text():
            continue
        box = text.get_window_extent(renderer)
        if box.x0 < -2 or box.y0 < -2 or box.x1 > width+2 or box.y1 > height+2:
            outside.append(text.get_text())
    if outside:
        raise ValueError(f"Text outside figure {name}: {outside}")
    for extension in ["png", "svg"]:
        fig.savefig(output / f"{name}.{extension}", dpi=160,
                    metadata={"Title": name, "Description": "Derived from saved first-attempt benchmark measurements."})
    figures.append({"file": name, "pixels": [width, height], "out_of_canvas_text": outside})
    plt.close(fig)
    print(f"Generated {name}.png / .svg", flush=True)


def performance_chart(run, output, figures):
    stages = [run["stages"][name] for name in PERFORMANCE_IDS]
    context = stages[0]["settings"]["context"] // 1024
    count = sample_label([s["rows"] for s in stages])
    fig = figure("相同输入下，三套配置的处理速度", f"{context}K 窗口 · 关闭 Thinking · {count}有效请求 · 柱长为中位数，细线为最小—最大", "共同性能")
    for rect, key, title, maximum, ticks in [
        ([.15,.27,.34,.43], "prompt_tps", "输入处理 Prefill", 940, [0,200,400,600,800]),
        ([.63,.27,.32,.43], "decode_tps", "逐步生成 Decode", 42, [0,10,20,30,40]),
    ]:
        ax=panel(fig, rect, title)
        haxis(ax,maximum,ticks,"Token/s · 越高越快")
        for i,(s,color) in enumerate(zip(stages,MODEL_COLORS)):
            y=2-i
            m=s["metrics"][key]
            ax.barh(y,m["median"],height=.42,color=color,alpha=.85,zorder=2)
            ax.errorbar(m["median"],y,xerr=[[m["median"]-m["minimum"]],[m["maximum"]-m["median"]]],
                        fmt="none",ecolor=FG,elinewidth=1.7,capsize=7,zorder=3)
            ax.text(m["maximum"]+maximum*.025,y,f'{m["median"]:.2f}',va="center",fontsize=17,color=color,weight="bold")
    footer(fig,f'实际输入 {input_range(stages)} Token；K/V 为 {stages[0]["settings"]["kv"].upper()}。三组 Batch/UBatch 不同，比较的是整套预设。',
           f'来源 {run["id"]} · 驱动 {run["driver"]} · 后端计时；预热不计入')
    save(fig,"01-common-performance",output,figures)


def quality_latency_chart(run, output, figures):
    stages=[run["stages"][name] for name in QUALITY_IDS]
    context=stages[0]["settings"]["context"]//1024
    long_groups=[[r for r in s["rows"] if r["family"]=="D"] for s in stages]
    fig=figure("首个输出与最终答案，分别要等多久", f"Thinking + xhigh · {context}K 窗口 · 两种等待分别取中位数；两图横轴范围不同", "质量测试 / 等待")
    for rect, group, title, maximum, ticks in [
        ([.15,.28,.34,.42],"all","全部有效请求 · "+sample_label([s["rows"] for s in stages]),14,[0,4,8,12]),
        ([.63,.28,.32,.42],"long","长文档 · "+sample_label(long_groups),70,[0,20,40,60]),
    ]:
        ax=panel(fig,rect,title)
        haxis(ax,maximum,ticks,"等待时间 / 秒 · 越短越快")
        for i,(stage,color) in enumerate(zip(stages,MODEL_COLORS)):
            rows=stage["rows"] if group=="all" else [r for r in stage["rows"] if r["family"]=="D"]
            first=metric(rows,"ttft_client_s")["median"]
            answer=metric(rows,"ttfa_client_s")["median"]
            y=2-i
            ax.plot([first,answer],[y,y],color=color,linewidth=4,alpha=.42)
            ax.scatter(first,y,s=100,facecolor=PANEL,edgecolor=MUTED,linewidth=1.8,zorder=4)
            ax.scatter(answer,y,s=135,color=color,edgecolor=BG,linewidth=1.2,zorder=5)
            ax.text(answer,y+.20,f"{answer:.2f} s",ha="center",fontsize=17,weight="bold",color=color)
            ax.text(first,y-.25,f"{first:.2f} s",ha="center",fontsize=11.5,color=MUTED)
    handles=[Line2D([],[],marker="o",linestyle="",markerfacecolor=PANEL,markeredgecolor=MUTED,markersize=8,label="首个输出 TTFT"),
             Line2D([],[],marker="o",linestyle="",color=FG,markersize=8,label="首个最终回答 TTFA")]
    fig.legend(handles=handles,loc="center",bbox_to_anchor=(.53,.18),ncol=2,frameon=False,labelcolor=FG,fontsize=12.5)
    long_rows=[r for group in long_groups for r in group]
    long_range=f'{min(r["tokens_evaluated"] for r in long_rows):,}—{max(r["tokens_evaluated"] for r in long_rows):,}'
    success=sum(bool(r.get("task_success")) for r in long_rows)
    footer(fig,f"首个输出可能是推理内容。长文档实际输入 {long_range} Token；图中长文档任务成功 {success}/{len(long_rows)}。",
           f'来源 {run["id"]} · 驱动 {run["driver"]} · 客户端计时；不含模型加载和输入计数')
    save(fig,"02-quality-wait",output,figures)


def quality_distribution_chart(run, output, figures):
    stages=[run["stages"][name] for name in QUALITY_IDS]
    count=sample_label([s["rows"] for s in stages])
    success=sum(s["success"] for s in stages)
    planned=sum(s["planned"] for s in stages)
    fig=figure("每一次请求的最终答案等待", f"Thinking + xhigh · {count}有效请求 · 任务成功 {success}/{planned}（按全部计划请求）", "质量测试 / 原始分布")
    ax=panel(fig,[.15,.28,.79,.43],"短题与长文档的全部请求")
    haxis(ax,90,[0,15,30,45,60,75,90],"最终答案等待 TTFA / 秒")
    for i,(stage_id,color) in enumerate(zip(QUALITY_IDS,MODEL_COLORS)):
        stage=run["stages"][stage_id]
        y=2-i
        rng=np.random.default_rng(900+i)
        offsets=rng.uniform(-.21,.21,len(stage["rows"]))
        for j,row in enumerate(stage["rows"]):
            is_long=row["family"]=="D"
            ax.scatter(row["ttfa_client_s"],y+offsets[j],s=64 if is_long else 35,
                       marker="^" if is_long else "o",color=color,alpha=1 if is_long else .57,
                       edgecolors=FG if is_long else "none",linewidths=.7,zorder=4 if is_long else 3)
        median=stage["metrics"]["ttfa_client_s"]["median"]
        maximum=stage["metrics"]["ttfa_client_s"]["maximum"]
        ax.vlines(median,y-.31,y+.31,color=FG,linewidth=1.8,zorder=5)
        ax.text(median,y+.40,f"中位数 {median:.2f} s",ha="center",fontsize=13.5,color=FG,weight="bold")
        ax.text(maximum,y+.33,f"最慢 {maximum:.2f} s",ha="center",fontsize=12.5,color=color)
    short_count=sample_label([[r for r in s["rows"] if r["family"]!="D"] for s in stages])
    long_count=sample_label([[r for r in s["rows"] if r["family"]=="D"] for s in stages])
    handles=[Line2D([],[],marker="o",linestyle="",color=MUTED,markersize=7,label="短题 · "+short_count),
             Line2D([],[],marker="^",linestyle="",color=MUTED,markeredgecolor=FG,markersize=8,label="长文档 · "+long_count)]
    fig.legend(handles=handles,loc="center",bbox_to_anchor=(.53,.18),ncol=2,frameon=False,labelcolor=FG,fontsize=12.5)
    footer(fig,"每个点代表一次原始请求；纵向错开仅为便于阅读。白色竖线为中位数，超过一分钟的请求也完整保留。",
           f'来源 {run["id"]} · 驱动 {run["driver"]} · 图中仅含测量有效的首次请求，未汇入重试或预热')
    save(fig,"03-quality-distribution",output,figures)


def context_chart(run, output, figures):
    stages=[run["stages"][name] for name in CAPACITY_IDS]
    count=sample_label([s["rows"] for s in stages]).replace("每组","每档")
    fig=figure("输入变长后的等待与生成速度", f"Q3_K_XL · 关闭 Thinking · {stages[0]['settings']['kv'].upper()} K/V · {count}有效请求；点为中位数，细线为最小—最大", "上下文容量")
    inputs=[s["input_median"]/1000 for s in stages]
    labels=[f'{s["input_median"]:,.0f}\n{int(s["settings"]["context"])/1024:.0f}K 窗口' for s in stages]
    for rect,key,title,ylim,yticks in [
        ([.11,.29,.365,.42],"ttft_client_s","首个输出等待 / 秒",(0,405),[0,100,200,300,400]),
        ([.59,.29,.36,.42],"decode_tps","生成速度 / Token/s",(0,40),[0,10,20,30,40]),
    ]:
        ax=panel(fig,rect,title)
        medians=[s["metrics"][key]["median"] for s in stages]
        ax.plot(inputs,medians,color=MODEL_COLORS[2],linewidth=2.5,alpha=.75,zorder=2)
        for i,(x,y,s) in enumerate(zip(inputs,medians,stages)):
            m=s["metrics"][key]
            ax.errorbar(x,y,yerr=[[y-m["minimum"]],[m["maximum"]-y]],fmt="none",ecolor=MUTED,elinewidth=1.4,capsize=6)
            ax.scatter(x,y,s=92,facecolor=PANEL if i==0 else MODEL_COLORS[2],edgecolor=MODEL_COLORS[2],linewidth=2,zorder=4)
            ax.annotate(f"{y:.2f}",(x,y),xytext=(0,13),textcoords="offset points",ha="center",fontsize=14.5,weight="bold",color=FG)
        ax.set_xlim(-3,129)
        ax.set_ylim(*ylim)
        ax.set_xticks(inputs,labels,fontsize=11.5)
        ax.set_yticks(yticks)
        ax.grid(axis="y",color=GRID,alpha=.65,linewidth=.75)
        ax.set_xlabel("实际输入 Token（下方标注配置窗口）",fontsize=11.5,labelpad=12)
    status=[]
    for s in stages:
        window=s["settings"]["context"]//1024
        correct=sum(bool(r.get("content_correct")) for r in s["rows"])
        status.append(f'{window}K：内容 {correct}/{s["valid"]}，格式 {s["format_valid"]}/{s["valid"]}')
    footer(fig,"；".join(status)+"。",
           f'来源 {run["id"]} · 驱动 {run["driver"]} · Batch/UBatch = {stages[0]["settings"]["batch"]}/{stages[0]["settings"]["ubatch"]}；未测试窗口边界')
    save(fig,"04-context-scaling",output,figures)


def memory_chart(performance,quality,output,figures):
    fig=figure("引擎记录的 GPU 缓冲怎样分配", "左图比较三种权重；右图展示同一 Q3 权重下，窗口增长带来的额外缓冲", "显存分配")
    context=quality["stages"][QUALITY_IDS[0]]["settings"]["context"]//1024
    kv=quality["stages"][QUALITY_IDS[0]]["settings"]["kv"].upper()
    left=panel(fig,[.15,.28,.34,.42],f"{context}K 窗口 · 三种量化",f"三组均为 {kv} K/V；柱末标注四项合计")
    haxis(left,18,[0,4,8,12,16],"启动日志所列缓冲 / GiB")
    for i,name in enumerate(QUALITY_IDS):
        s=quality["stages"][name]
        x=0
        y=2-i
        for j,key in enumerate(["model","KV","RS","compute"]):
            value=s["buffers_gib"][key]
            left.barh(y,value,left=x,height=.42,color=COMPONENT_COLORS[j],edgecolor=PANEL,linewidth=.5)
            x+=value
        left.text(s["buffers_gib"]["model"]/2,y,f'模型 {s["buffers_gib"]["model"]:.3f}',ha="center",va="center",fontsize=14.5,weight="bold")
        left.text(x,y+.31,f"合计 {x:.3f}",ha="right",fontsize=12.5,color=MUTED)
    model_buffer=performance["stages"][CAPACITY_IDS[0]]["buffers_gib"]["model"]
    right=panel(fig,[.62,.28,.33,.42],"Q3 · 窗口与额外缓冲", f"模型缓冲固定为 {model_buffer:.3f} GiB，右图只画其余三项")
    haxis(right,5.5,[0,1,2,3,4,5],"KV、循环状态与计算缓冲 / GiB",["8K","32K","64K","128K"])
    for i,name in enumerate(CAPACITY_IDS):
        s=performance["stages"][name]
        x=0
        y=3-i
        for j,key in enumerate(["KV","RS","compute"],start=1):
            value=s["buffers_gib"][key]
            right.barh(y,value,left=x,height=.40,color=COMPONENT_COLORS[j],edgecolor=PANEL,linewidth=.5)
            x+=value
        right.text(x+.09,y,f"{x:.3f}",va="center",fontsize=12.5,color=MUTED)
    legend=[Patch(facecolor=color,label=label) for color,label in zip(COMPONENT_COLORS,["模型缓冲","KV 缓存","循环状态","计算缓冲"])]
    fig.legend(handles=legend,loc="center",bbox_to_anchor=(.53,.18),ncol=4,frameon=False,labelcolor=FG,fontsize=12.5)
    footer(fig,"这些值来自启动日志；合计仅包含图中项目。未采集运行时总显存峰值，图中不计算可用显存。",
           f'左：{quality["id"]} / {quality["driver"]}；右：{performance["id"]} / {performance["driver"]}')
    save(fig,"05-gpu-buffers",output,figures)


def export_data(runs, evidence, output, figures):
    records=[]
    stages=[]
    for run in runs:
        for stage in run["stages"].values():
            for row in stage["first_attempts"]:
                records.append({"run_id":run["id"],"stage_id":stage["id"],**{key:row.get(key) for key in SAFE_FIELDS}})
            stages.append({key:value for key,value in stage.items() if key not in ["rows","first_attempts"]})
    with (output/"chart-requests.csv").open("w",encoding="utf-8-sig",newline="") as stream:
        writer=csv.DictWriter(stream,fieldnames=["run_id","stage_id"]+SAFE_FIELDS)
        writer.writeheader()
        writer.writerows(records)
    content={
        "schema":1,"matplotlib":matplotlib.__version__,"figures":figures,
        "source_runs":[{"id":run["id"],"driver":run["driver"]} for run in runs],
        "selected_first_attempts":len(records),"stages":stages,
        "source_sha256":evidence.hashes,"original_evidence_unchanged":evidence.unchanged(),
        "notes":["CSV contains chart metrics only; no prompts, answers or reasoning.",
                 "Medians use valid first attempts; long-document groups contain only D-family requests.",
                 "Context 8K is reused from common performance, not counted twice.",
                 "GPU buffer totals are arithmetic sums of listed startup allocations, not measured peaks."]}
    if not content["original_evidence_unchanged"]:
        raise ValueError("Original evidence changed while charts were generated")
    (output/"chart-data.json").write_text(json.dumps(content,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--performance-run",type=Path,default=BENCHMARK/"runs/20260905-185546-067769")
    parser.add_argument("--quality-run",type=Path,default=BENCHMARK/"runs/20260905-230353-216459")
    parser.add_argument("--output-dir",type=Path,default=DEFAULT_OUTPUT)
    args=parser.parse_args()
    args.output_dir.mkdir(parents=True,exist_ok=True)
    setup_fonts()
    evidence=Evidence()
    performance=load_run(args.performance_run.resolve(),list(dict.fromkeys(PERFORMANCE_IDS+CAPACITY_IDS)),evidence)
    quality=load_run(args.quality_run.resolve(),QUALITY_IDS,evidence)
    figures=[]
    performance_chart(performance,args.output_dir,figures)
    quality_latency_chart(quality,args.output_dir,figures)
    quality_distribution_chart(quality,args.output_dir,figures)
    context_chart(performance,args.output_dir,figures)
    memory_chart(performance,quality,args.output_dir,figures)
    export_data([performance,quality],evidence,args.output_dir,figures)
    request_count = sum(s["valid"] for run in [performance,quality] for s in run["stages"].values())
    print(json.dumps({"figures":len(figures),"requests":request_count,"output":str(args.output_dir)},ensure_ascii=False))


if __name__=="__main__":
    main()
