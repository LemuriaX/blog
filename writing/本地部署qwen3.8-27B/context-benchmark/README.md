# Qwen3.8-27B 本机测试脚本

脚本使用 Python 3.10+ 标准库，自动启动流程面向 Windows。正式测试需要已下载的 GGUF 模型，以及支持该模型和计数接口的 Unsloth Run。默认端口为 8001。

测试内容和结果字段见[测试方案](../Qwen3.8-27B上下文与性能测试方案.md)，基础概念见[分享正文](../27B模型如何塞进20GB显存-技术分享.md)。

当前质量测试统一开启 Thinking、使用 `xhigh`；三种量化使用相同采样参数、8,192 输出上限和 16K 窗口。共同性能与容量阶段保持关闭 Thinking，用于测速和检查输入容量。

## 开始使用

先空运行一次，查看执行计划和模型路径检查结果：

```powershell
Set-Location 'E:\codex\技术分享\context-benchmark'
.\run_full_benchmark.ps1 -DryRun
```

在 `benchmark_config.json` 的 `local_model_files` 中填写三种 GGUF 的路径，或通过 `-ModelDir` 指定目录。正式运行前，脚本会检查模型分片是否完整，并计算 SHA256。

```powershell
.\run_full_benchmark.ps1 -Suite extended
```

只执行三种量化的 Thinking＋xhigh 质量测试时，运行：

```powershell
.\run_full_benchmark.ps1 -Stage quality -Suite extended
```

这会执行三种量化各 63 次质量请求，共 189 次，自动跳过容量阶段，并建立新的时间戳目录。23:03 开始的质量补测使用的就是这条命令。结果回填按测试类型更新：质量补测替换质量成绩，性能与容量继续引用各自已完成的记录，并注明环境。输出上限包含推理和最终回答，达到上限仍记为预算耗尽。配置、题目或源码改变后，应新建运行，不对已有目录使用 `-Resume`。

需要指定 Python 或 Unsloth 时，使用下面两个参数。示例路径应替换成本机路径：

```powershell
.\run_full_benchmark.ps1 -DryRun `
    -PythonPath 'C:\Path\To\python.exe' `
    -UnslothPath 'C:\Path\To\unsloth.exe'
```

进入阶段时，终端会显示“阶段 1/3 · Q4_K_S · 质量测试”等标题，并列出窗口、Thinking 档位、采样和输出预算。接下来显示加载、配置核验、输入准备和逐题进度。模型加载后会常驻显存，只有实际处理请求时才持续进行推理计算。

每个阶段结束后，脚本会等待本次创建的服务及其子进程退出，并确认端口释放，再启动下一阶段。退出等待超时会停止后续阶段，原因保存在 `stage.json` 和根目录摘要中。

## 终端日志

日志使用统一的时间戳、阶段分隔和进度条，采用 UTF-8 纯文本，便于在 PowerShell 中查看和重定向保存。无需安装额外依赖。

- 启动时显示阶段数、正式请求数、模型大小及 SHA256 校验进度。
- 每题开始时显示名称、请求 ID、种子和尝试次数；结束时显示判定、Token 用量、首输出等待、最终答案等待、总耗时及引擎生成速度。
- 长时间等待时每 15 秒提示当前状态：输入计数、等待首个输出、生成推理、生成最终答案或保存结果。推理与答案状态依据实际收到的响应内容更新，不推算剩余 Token 数或剩余时间。
- 阶段结束后汇总运行状态、有效测量、任务成功率、时间中位数、配置核验与服务退出情况；答错、格式不合规、输出预算耗尽、调用失败分别显示。

逐题日志实时转发到终端，同时写入阶段内原有的执行器日志。运行根目录新增 `console.log`，汇集终端输出；API Key 脱敏，答案和推理原文仍到 JSONL/CSV 中查看。中位数只使用有效测量，缺少的字段显示“未提供”。

进度条统计本次已执行的请求次数，包括失败；恢复运行时只统计这次实际执行的任务。主表仍按每个计划请求的第一次结果计分。等待提示中的“已用”从请求准备开始，包含计数和保存；结果中的“总耗时”取生成调用计时，两者口径不同。

样式示例见[日志预览](reports/console-preview.txt)，其中数字为模拟数据。直接运行原命令即可使用新日志；`-DryRun` 可先查看计划和模型路径的输出样式。

## 常用参数

| 参数 | 用途 |
|---|---|
| `-DryRun` | 生成计划，检查模型路径；不启动推理、下载模型或计算大模型哈希 |
| `-Stage performance/quality` | 只运行性能或质量测试；默认 all |
| `-Profiles performance,quality,context` | 选择预设配置；逗号串作为一个参数传入 |
| `-Suite smoke/extended` | 选择快速检查或扩展题集；每套配置分别有 15/63 次质量请求，默认 smoke |
| `-SkipContextCapacity` | 跳过追加的容量测试 |
| `-WithAblations` | 增加量化、KV 和 Batch 的六个性能/容量对照阶段；已移除 Thinking 开关质量对照 |
| `-Boundary` | 增加接近最大窗口的容量测试 |
| `-OutputRoot` | 指定输出目录；新测试使用新目录，恢复时填写原目录 |
| `-Resume` | 检查输入、配置等是否一致，再继续未执行的任务 |
| `-RetryFailed` | 与 Resume 一起使用，额外重试运行失败的请求 |
| `-Config` | 指定另一份 JSON 配置 |

独立容量入口是 `run_all_contexts.ps1`。两个 PowerShell 入口共用 `benchmark_entry.psm1` 和 `benchmark_suite.py`，统一管理配置、请求和进程。

## 查看结果

共同性能、上下文容量和 Thinking＋xhigh 质量均已有实测记录，文档按各部分最近一次完成的结果汇总：

| 部分 | 来源 | 已完成内容 |
|---|---|---|
| 共同性能与容量 | [20260905-185546-067769](runs/20260905-185546-067769/summary.md) | 六个阶段、36 次有效请求；包括三组 8K 性能及 Q3 的 32K/64K/128K 容量 |
| Thinking＋xhigh 质量 | [20260905-230353-216459](runs/20260905-230353-216459/summary.md) | 三个阶段、189 次有效请求，三组各 63/63 任务成功 |

Q3 的 8K 性能结果同时用于容量判定，因 Markdown 代码块导致格式不合规，原判定保留。32K 以上三档的检索与格式通过。质量补测确认三组均通过基础任务与接口格式检查；等待时间、驱动差异和 GPU 缓冲见[实测报告](../Qwen3.8-27B本机实测报告.md)。

从运行目录的 `summary.md` 查看各阶段状态。实际配置没有足够信息确认时，检查项标为 unknown，最终标为 unverified。

先核对“已完成、部分完成、失败、待执行”的阶段数。脚本结束不代表全部测试成功；阶段启动失败时，摘要会列出具体原因。`stage.json` 中的 `cleanup_status` 和 `cleanup_duration_s` 记录服务退出情况。

`completed, unverified` 表示计划请求已经执行完，但部分实际配置尚未确认。先查看 `results.summary.json` 中的有效请求数和测量判定，再看 `configuration-validation.json` 中具体缺少哪些证据。未确认的配置也会列在终端和运行摘要中。

脚本统一请求底层日志级别 4，并将本阶段 Unsloth 明确报告的底层日志归档为 `llama-server.log`；来源和快照哈希保存在 `backend-log-collection.json`。找不到日志或日志仍未给出实际值时，对应检查保持 unknown。

如果在启动检查时停止，查看 `unsloth-cli-validation.json` 中的退出码和缺少的参数，以及 `unsloth-run-help.txt` 中的原始输出。脚本会固定帮助表格的宽度，避免长参数名被省略后误报不兼容。

`results.events.jsonl` 按请求保存输入、响应或错误，CSV 从这些记录生成。主统计按全部计划请求计算，并使用每个请求的第一次结果；重试另存，保留首次失败。

任务答错、达到输出上限和 HTTP 请求失败分别记录。未测量的显存或引擎速度保持空白，外部监控数据填写到 `manual-metrics.csv`。

需要复核时，可分别读取两次运行。核对脚本使用各自的源码快照重算评分与指标，检查 CSV、输入及日志哈希，在 `reports` 下生成补充 JSON；不启动模型，也不改写原始结果。

```powershell
python .\reports\audit_run.py .\runs\20260905-185546-067769
python .\reports\audit_run.py .\runs\20260905-230353-216459
```

## 实测图表

五张配图已插入分享正文和实测报告，包含共同性能、Thinking 等待、逐请求分布、上下文变化及 GPU 缓冲。文件提供高清 PNG 和矢量 SVG，见[配图目录](../local-llm-sharing-assets/benchmarks/README.md)。

图表直接读取两轮原始 JSONL 和引擎日志；225 次请求的绘图字段、汇总值和来源哈希一并导出。重新生成时执行：

```powershell
python -m pip install -r .\reports\charts-requirements.txt
python .\reports\generate_benchmark_charts.py
```

默认按各测试类型使用已经确认的两次运行。指定其他来源和读图方式见配图目录中的说明。

## 中文显示

两个 PowerShell 入口会在运行期间统一使用 UTF-8，退出时恢复原来的终端和 Python 编码设置。为兼容 Windows PowerShell 5.1，包含中文的共享模块保存为带 BOM 的 UTF-8。[Microsoft 编码说明](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_character_encoding)。

如果需要为当前终端手动设置编码，在启动测试前执行：

```powershell
$benchmarkUtf8 = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $benchmarkUtf8
[Console]::OutputEncoding = $benchmarkUtf8
$OutputEncoding = $benchmarkUtf8
$env:PYTHONIOENCODING = 'utf-8'
$env:PYTHONUTF8 = '1'
```

已经显示的乱码不会自动恢复。脚本生成的日志、JSON 和 CSV 使用 UTF-8，可以重新打开原文件查看；在 Windows PowerShell 5.1 中读取日志时，为 `Get-Content` 指定 `-Encoding UTF8`。

## 验证脚本

```powershell
python -m unittest discover -s tests -v
```

回归测试使用本地模拟服务和短生命周期子进程，不加载 GPU 模型。真实模型的正确率、速度和可用输入长度仍需在目标机器测量。
