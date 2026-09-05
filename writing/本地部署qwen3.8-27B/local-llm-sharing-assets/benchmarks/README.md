# 本机实测配图

五张配图已插入[分享正文](../../27B模型如何塞进20GB显存-技术分享.md)和[实测报告](../../Qwen3.8-27B本机实测报告.md)。PNG 为 2,560 × 1,440，适合直接插入文档；SVG 可缩放，中文已转为轮廓，显示不依赖阅读设备的字体。

| 配图 | 内容 | 文件 |
|---|---|---|
| 共同性能 | 三种量化的 Prefill、Decode 中位数与最小—最大范围 | [PNG](01-common-performance.png) · [SVG](01-common-performance.svg) |
| Thinking 等待 | 首个输出与首个最终回答，分别展示总体和长文档的中位数 | [PNG](02-quality-wait.png) · [SVG](02-quality-wait.svg) |
| 逐请求分布 | 189 次质量请求的 TTFA，标出长文档、中位数和最慢请求 | [PNG](03-quality-distribution.png) · [SVG](03-quality-distribution.svg) |
| 上下文变化 | 实际输入长度与首个输出等待、生成速度 | [PNG](04-context-scaling.png) · [SVG](04-context-scaling.svg) |
| GPU 缓冲 | 16K 三种权重的分配，以及 Q3 随窗口增长的额外缓冲 | [PNG](05-gpu-buffers.png) · [SVG](05-gpu-buffers.svg) |

## 数据来源

- 性能与容量：[20260905-185546-067769](../../context-benchmark/runs/20260905-185546-067769/summary.md)，采用六个阶段、36 次请求；驱动 32.0.31035.1003，关闭 Thinking。
- 质量：[20260905-230353-216459](../../context-benchmark/runs/20260905-230353-216459/summary.md)，采用三个阶段、189 次请求；驱动 32.0.31041.1004，Thinking＋xhigh。

Q3 的 8K 请求同时用于性能与容量，在导出数据中只保留一份。原始请求和运行日志没有修改。

[chart-requests.csv](chart-requests.csv)保存 225 次首次请求用于绘图的字段，包括请求 ID、输入与输出 Token、耗时、速度及判定，不包含提示词、答案或推理原文。[chart-data.json](chart-data.json)保存统计值、GPU 缓冲、实际发送的生成参数、来源文件 SHA256、绘图库版本和输出规格。

## 读图方式

速度和时间由原始请求重新计算中位数，并与保存的阶段汇总核对。细线表示最小—最大范围，不是置信区间。绘图不包含预热或重试；有效请求数分别标在图中。

分布图中，每个点的位置由该请求的实际 TTFA 决定，纵向错开仅为便于阅读。长文档只有每组三次，使用三角形单独标出。总体中位数仍包含全部 63 次有效请求。

上下文图使用实际输入长度作横轴，窗口大小只作附加标注。8K 的内容检索正确、格式未通过，测速仍有效，图中保留该点与格式记录。

GPU 缓冲从各阶段 `llama-server.log` 读取，MiB 除以 1,024 转为 GiB。左图合计模型、KV、循环状态和计算缓冲；右图固定模型缓冲，只合计后三项。它们都是日志所列分配的算术和，运行时总显存峰值未采集。

## 重新生成

脚本：[generate_benchmark_charts.py](../../context-benchmark/reports/generate_benchmark_charts.py)。绘图额外依赖 Matplotlib：

```powershell
Set-Location 'E:\codex\技术分享\context-benchmark'
python -m pip install -r .\reports\charts-requirements.txt
python .\reports\generate_benchmark_charts.py
```

默认读取上面两次运行，生成文件写入本目录。更换数据来源时指定对应的运行目录：

```powershell
python .\reports\generate_benchmark_charts.py `
    --performance-run '.\runs\PERFORMANCE_RUN_ID' `
    --quality-run '.\runs\QUALITY_RUN_ID'
```

生成器面向本方案的三种量化与四档上下文；输入目录需包含相应阶段的完整首次请求。更换测试配置后，应同步检查坐标范围、图注和排版。脚本会核对阶段汇总、日志哈希和源文件是否变化，并检查文字是否超出画布。
