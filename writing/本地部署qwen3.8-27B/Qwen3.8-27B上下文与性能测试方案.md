# Qwen3.8-27B 上下文与性能测试方案

修订日期：2026-09-06；结果格式版本（schema）：3。配套[分享正文](27B模型如何塞进20GB显存-技术分享.md)、[脚本说明](context-benchmark/README.md)。本文用于执行和复查测试，基础概念在分享正文中解释。

共同性能、上下文容量和三组 Thinking＋xhigh 质量测试均已有结果。性能与容量采用 18:55 开始的记录，质量采用 23:03 开始的补测结果，共选用九个阶段。来源、环境和执行情况见第 12 节及[本机实测报告](Qwen3.8-27B本机实测报告.md)。

## 1. 测什么

本方案分三部分：用相同输入比较配置的速度，用固定题目检查基础任务与接口格式，再用不同长度的文档测试上下文容量。

日常使用固定开启 Thinking，因此质量测试检查三套预设在 `xhigh` 下的正确率和格式合规，并记录最终答案等待时间。三组通过基础检查后，重点比较耗时、输出量与模型缓冲占用。三套预设仍有权重和 Batch 差异，结果用于比较整套配置；单项参数的影响需要另做控制变量对比。

题库包括合成长文档检索和有标准答案的短题，用于筛选本机配置。正式测试前固定题目，各组使用相同输入，并保留成功和失败结果。

## 2. 运行前的准备

所有配置以 [benchmark_config.json](context-benchmark/benchmark_config.json) 为准。检查工作在性能计时前完成。

启动参数已对照 [Unsloth CLI 源码](https://github.com/unslothai/unsloth/blob/main/unsloth_cli/commands/studio.py)：`--model` 接受本地路径；部分参数由 Unsloth 处理，部分转交 llama.cpp。转交的参数不一定出现在 `unsloth run --help` 中，其实际效果要查看后端日志。

1. 确认 Python 3.10+ 和 Unsloth 可执行程序；保存 CLI 帮助、版本输出和可执行文件 SHA256。帮助检查使用固定宽度，避免长参数名被表格省略；退出码和缺少的参数记录在 `unsloth-cli-validation.json`。
2. 查找本地 Qwen3.8-27B GGUF，确认全部分片存在且非空，计算每个分片字节数和 SHA256。
3. 保存系统、驱动、Python 信息以及配置、任务 JSON、Python/PowerShell 源文件快照。
4. 固定端口、输入样本、随机种子、监控工具与采样周期；关闭影响测量的其他重负载。

请提前下载完整模型。在 `local_model_files` 中按量化名填写文件路径；模型分成多个文件时，可指定第一片。也可传 `-ModelDir`，或让脚本查找标准 Hugging Face 缓存目录。找到多个副本、缺少分片或存在空文件时，脚本会停止检查并报告原因。

配置路径示例（需替换成实际文件）：

```json
"local_model_files": {
  "UD-Q4_K_S": "E:/models/Qwen3.8-27B/Qwen3.8-27B-UD-Q4_K_S.gguf",
  "UD-Q4_K_XL": "E:/models/Qwen3.8-27B/Qwen3.8-27B-UD-Q4_K_XL.gguf",
  "UD-Q3_K_XL": "E:/models/Qwen3.8-27B/Qwen3.8-27B-UD-Q3_K_XL.gguf"
}
```

系统内存记录字节数与 GiB。未测量的 GPU 总显存和峰值保留为 null 或空白。`Win32_VideoController.AdapterRAM` 使用 uint32，无法表达 20 GiB，因此脚本不使用它测量这张显卡。[Microsoft 字段定义](https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-videocontroller)。

## 3. 三套测试配置

| 项目 | performance | quality | context |
|---|---|---|---|
| 模型量化 | UD-Q4_K_S | UD-Q4_K_XL | UD-Q3_K_XL |
| 共同性能窗口 | 8,192 | 8,192 | 8,192 |
| 质量窗口 | 16,384 | 16,384 | 16,384 |
| Batch / UBatch | 1,024 / 512 | 512 / 256 | 256 / 128 |
| K/V 类型 | q8_0 / q8_0 | q8_0 / q8_0 | q8_0 / q8_0 |
| 质量阶段 Thinking | true，xhigh | true，xhigh | true，xhigh |
| 质量阶段最大输出 | 8,192 | 8,192 | 8,192 |
| 质量阶段 temperature | 1.0 | 1.0 | 1.0 |
| 质量阶段 top_p / top_k | 0.95 / 20 | 0.95 / 20 | 0.95 / 20 |
| 质量阶段 presence_penalty | 0.0 | 0.0 | 0.0 |

共同性能与容量阶段统一 Non-Thinking、temperature=0、top_p=1、top_k=1、presence_penalty=0、最大输出 192。所有请求固定 min_p=0、repetition_penalty=1、frequency_penalty=0，并显式关闭工具和 Prompt Cache。

关闭 Thinking 的阶段用于测量输入处理、生成速度和输入容量；日常回答质量以开启 Thinking 的质量阶段为准。容量通过也不代表已验证同样长输入下的 `xhigh` 回答质量。

配置中的 `profiles` 保存质量生成参数；构建性能和容量计划时，脚本会明确覆盖成上述共同参数。质量阶段若关闭 Thinking 或使用非 `xhigh` 档位，会在启动模型前报错。单独调用质量执行器也默认开启 Thinking、使用 `xhigh`。

Qwen3.8 模板的推理档位支持 `low / medium / xhigh`，默认 `xhigh`；没有 `high`。档位用于控制推理行为，输出上限另由 `max_tokens` 设置。计数与生成使用相同的 `enable_thinking`、`reasoning_effort`、工具和模板相关字段。[官方模板](https://huggingface.co/Qwen/Qwen3.8-27B/raw/main/chat_template.jinja)。

## 4. 检查实际生效的配置

脚本在手动模式下传入 `gpu_layers=999`，请求尽可能多地把层放到 GPU。实际数量由引擎决定，还可能计入语言模型 64 个 block 之外的输出层。[llama.cpp 卸载实现](https://github.com/ggml-org/llama.cpp/blob/master/src/llama-model.cpp)。

每个阶段分别保存启动参数、状态返回值和检查结果：

| 文件 | 内容 |
|---|---|
| `requested-command.json` | 本次启动发送了哪些参数 |
| `inference-status.json` | 状态接口返回的信息；其中部分字段只原样返回请求值 |
| `configuration-validation.json` | 每项检查的预期值 expected、实际值 actual、来源 source，以及 pass/fail/unknown |
| `llama-server.log` | 本阶段底层引擎日志的归档副本；各组统一请求日志级别 4 |
| `backend-log-collection.json` | 底层日志来源、采集状态、时间和快照哈希 |

脚本检查加载的 GGUF 是否与预检文件一致，并核对量化版本（若有）、每条序列的上下文长度 `n_ctx_per_seq` 或 `n_ctx_slot`、状态中的上下文、实际并发数、GPU 层数、K/V 类型、Batch/UBatch 和 Flash Attention。`gpu_layers`、`requested_n_batch` 等字段可能只是请求值，需要结合实际运行信息判断。底层日志从本阶段启动日志明确记录的位置采集；未取得的证据仍记为 unknown。

本轮还请求关闭旧 Token 移出（Context Shift）、跨请求前缀复用（Prompt Cache）、视觉投影和推测解码。当前版本没有返回有效状态或明确日志时，相应项目记为 `unknown`。例如，`is_vision=true` 可能只表示模型支持视觉输入；确认是否加载视觉组件，还要看实际路径或加载日志。

- 实际值与预期不符：停止该阶段，保存原因和日志。
- 缺少实际值：保留测量数据，但最终标为 `unverified`，表示配置尚未确认。
- 全部检查通过：结合测量结果判断该配置的表现。

启动器退出后，子进程可能仍在运行。Windows 入口用 Job Object 管理本次创建的进程，结束时发出终止指令，等待各进程退出并确认端口释放，再切换阶段。退出等待超时会停止后续阶段，并在摘要中保留原因；`stage.json` 记录退出状态和耗时。启动前发现指定端口已被占用时，脚本报告冲突。

## 5. 共同性能测试

每种预设在 8,192 窗口下读取完全相同的三份文本，输入目标为 6,800 Token。每份文本正式重复两次，共 **6 次请求**；生成 seed 固定为 3407。三份文本的合成种子不同，但在比较组间固定。

测量前使用第一份长输入预热一次，输出上限 32，预热结果单独保存，不纳入统计。预热允许因短预算而以 length 结束；正式请求要求正常 stop。运行脚本默认请求关闭 Prompt Cache，并在每次正式请求前重新调用计数接口。

输入长度依据已套用聊天模板的计数，不靠字符数估算；计数操作在流式计时之前单独执行。三份输入在同一 run 中生成一次并按 SHA256 固定，跨权重复用；每个候选仍按自己实际加载的模板重新计数。

引擎返回 Prefill 与 Decode tok/s 时，记录这些值；缺少时留空。客户端估算另列，并分别报告来源、有效样本数 n、中位数、最小值和最大值。

192 是输出上限，实际回答可能更短。比较 Decode 速度时，一起展示实际输出长度。若要测长篇持续生成速度，需要另设输出更长、长度相近的任务。

当前流程没有控制操作系统文件缓存，所以只记录“服务启动到模型可用”的时间。冷、热加载对比需要另设缓存条件。

## 6. 质量测试与评分

### 6.1 任务集

固定短题见 [benchmark_tasks.json](context-benchmark/benchmark_tasks.json)，其中保存题目、标准答案、题目类别、测试版本和需要比较代码的字段。`smoke` 用于快速检查，`extended` 包含全部扩展题目。

| 类别 | 内容 | smoke 短题数 | extended 短题数 |
|---|---|---:|---:|
| A | 单位换算、量化块、KV、计时计算 | 1 | 5 |
| B | 定点代码修复、边界与零值 | 1 | 5 |
| C | 排列、依赖、容量与无解约束 | 1 | 5 |
| E | 筛选、排序、版本、类型、空结果 | 1 | 5 |

每个 seed 还配一份 D 类长文档。三份文档都加入失效版本、相似项目名，并各保留一个没有有效匹配记录的查询。缺失项的标准答案是 JSON null。

固定生成 seeds 为 3407、3413、3433：smoke 每套配置有 **(4+1)×3=15 请求**；extended 有 **(20+1)×3=63 请求**。总体成功率是成功请求数除以全部计划请求数，extended 中长文档题占 3/63。各类题目的请求数不同，因此还要查看每道题的结果。

### 6.2 输入与输出预算

质量长文目标 4,600 Token，质量窗口 16,384，三组统一预留 8,192 输出 Token、128 安全余量和 64 输入容差：`4,600 + 8,192 + 128 + 64 = 12,984 ≤ 16,384`。语料生成、空模板和位置估计的计数、正式请求前的计数与生成，均开启 Thinking 并传入 `xhigh`。三组复用相同文本，各自重新统计实际输入长度。

8,192 是三组统一的输出限制，不是 `xhigh` 的固定配额。最新一轮最高实际输出为 2,759 Token，未出现预算耗尽；更难的任务仍需检查预算。共同性能方案使用 8K 窗口。

达到输出上限时，记录预算耗尽，不据此单独判断模型能力。需要提高上限时，修改配置并使用新的输出目录，保留原结果作对照。

### 6.3 评分方式

所有比率以**该阶段全部计划请求数**为分母；失败、待完成和预算耗尽不会被排除。

| 指标 | 进入分子的条件 |
|---|---|
| 运行完成率 | HTTP/SSE 请求正常结束，取得完整结果；length 仍属于传输完成 |
| 内容正确率 | 测量有效且全部预期字段的答案正确 |
| 格式合规率 | 测量有效，只输出 JSON，字段、类型及嵌套结构正确 |
| 任务成功率 | 测量有效 + 内容正确 + 格式合规 |

测量有效要求流完整、输入计数与 usage 一致、上下文空间足够、输出非空且未因输出上限而结束。传输完成与答案正确分开统计。

JSON 禁止重复键、NaN/Infinity，递归检查类型；整数题不会把 `true` 当作 `1`。内容与格式分开评估：答案有额外说明但预期字段正确时，内容可以正确，格式不合规，任务不成功。

代码修复题比较 Python 解析后的语法树（AST），忽略不影响结构的空格和括号，不执行模型代码。这种方法适用于限定修改位置和表达式的题目；结构不同但行为相同的代码，仍可能被判为不匹配。

## 7. 上下文容量

使用 context 预设的 Q3 权重、Q8 K/V、Batch/UBatch=256/128、Non-Thinking，保持其余条件一致。

| 配置窗口 | 输入目标 | 正式最大输出 | 安全余量 | 输入容差 |
|---:|---:|---:|---:|---:|
| 8,192 | 6,800 | 192 | 128 | ±64 |
| 32,768 | 29,000 | 192 | 128 | ±64 |
| 65,536 | 58,000 | 192 | 128 | ±64 |
| 131,072 | 116,000 | 192 | 128 | ±64 |

每档三份样本，每份重复两次。每份有五条精确匹配检索项，目标插入位置约为 10%、30%、50%、70%、90%。实际位置另通过分词前缀长度减去空聊天模板长度估计；Token 边界和模板相互作用使其仍是估计值，不能写成精确索引。挑战语料中的缺失项没有实际插入位置，保存 null。

容量通过要求：

1. 全部计划请求测量有效，usage 与请求前计数一致，未发现输入截断，输出正常 stop。
2. 全部 JSON 格式合规，五项总体检索正确率 ≥90%。
3. 每个目标位置至少在 2/3 请求中检索正确（六次请求对应至少四次）。

完整运行中，Q3 的 8K 性能阶段也按上述规则判断容量，标记为 `also_capacity=true`，并复用这组结果。独立容量入口仍执行 8K 测试。

可选 `-Boundary` 在最大配置处增加输入目标 `窗口 − 192 − 128 − 64`，默认等于 130,688。边界输入仍预留生成空间，生成后的实测 Token 数必须再次满足预算。

在 128K 配置下通过 116K 输入的测试，报告写作“本任务在该实际输入长度通过”。更长输入和其他任务需要分别验证。

## 8. 可选的控制变量对比

`-WithAblations` 添加以下对照实验，默认不执行。

| 阶段 / 比较组 | 控制条件 | 允许改变的内容 |
|---|---|---|
| quant-q4s / quant-q4xl / quant-q3 | 8K、6,800 输入、Q8 KV、256/128、相同性能采样 | 权重量化；本组测性能与长文档检索，不覆盖其他质量任务 |
| kv-q8 / kv-q4 | 同 Q3、64K、58,000 输入、256/128 | K/V 同时从 Q8_0 改为 Q4_0 |
| batch-large / quant-q4s | 同 Q4_S、8K、6,800 输入、Q8 KV | Batch/UBatch 组合从 256/128 改为 1,024/512 |

当前保留六个附加阶段，均测性能或容量。原来的 `thinking-off / thinking-medium` 质量对照已移除；开启此选项也不会增加关闭 Thinking 或使用 `medium` 的质量测试。

## 9. HTTP、断流和结果恢复

HTTP 请求的公共实现见 [benchmark_common.py](context-benchmark/benchmark_common.py)。脚本分别限制连接等待、读取等待和一次调用的总耗时；服务发送 SSE 心跳也不会延长总时限。计数和生成是两个调用，各自计时。

正常 SSE 结果要求同时收到结束标记 `[DONE]` 与可识别的 `finish_reason`。支持多行 data、reasoning/reasoning_content 和 usage/timings；EOF、缺少结束标志或服务错误记录为失败，并保存已经收到的回答、推理和事件。

以下情况分开记录：

| 情况 | 表示含义 |
|---|---|
| `budget_exhausted` | 输出因 length 结束，推理或答案达到生成上限 |
| `truncated=true` | 服务明确报告输入截断 |
| 计数不一致 / 截断状态 unknown | 无法确认全部输入被处理，测量无效；不武断归因为输入截断 |
| `incomplete_stream` | 没有完整流结束证据 |
| connect/read/deadline timeout | 对应阶段或总时限超时 |

每次请求开始前，先保存请求 ID、任务、尝试次数 attempt、请求内容 payload 和时间。结果写入 JSONL，即每行一条 JSON 记录的文件，并调用 fsync 刷写文件缓冲。请求结束或失败后，再追加 Token 用量 usage、计时 timings、原始事件、回答和评分或错误。CSV 从这些记录生成，通过替换临时文件更新。

恢复时，脚本检查计划、模型哈希、源代码、题目、配置、模板和能够取得的后端标识是否一致。JSONL 最后一行若不完整，会另存保留；只有开始记录、没有结果的请求标为 interrupted（已中断）。默认继续尚未执行的任务，加 `-RetryFailed` 才重试运行失败的请求。

**主表使用每个计划请求的第一次结果。** 重试作为新的 attempt 保存，后续成功也保留首次失败。后端没有返回版本或构建信息时，仍需人工查看启动日志。

## 10. 监控数据与结果文件

`manual-metrics.csv` 为每个测试阶段建立一行，用来填写监控工具版本、采样间隔、GPU 总显存、显存和系统内存采样峰值、功耗、温度及备注。显存和内存统一用 GiB；阶段起止时间见 `stage.json`。

采样峰值是监控工具采到的最大值，两次采样之间可能存在更短的尖峰。填写功耗和温度时，在 notes 中说明记录的是峰值、中位数还是稳定区间。

保留监控原始时间序列，结合 `model_ready_at`、请求开始、首内容块和结束时间，划分加载后与请求运行区间。首内容块只能作为 Prefill/Decode 的近似分界。若要比较任务能耗，对同一请求区间的功率积分；只记录峰值功率无法得到能耗。

| 位置 | 内容 |
|---|---|
| 运行根目录 | plan、run-manifest、model-preflight、environment、source-snapshot、Unsloth 版本/帮助 |
| `cases/` | 输入 JSON/TXT、期望答案、插入位置估计、样本校验和 |
| 每阶段目录 | 启动请求、有效配置、后端状态、日志、时间、失败原因 |
| `results.events.jsonl` | 每次请求及响应/错误证据；包含全部 attempts |
| `results.csv` | 逐请求结果，包含 Token、TTFT/TTFA、答案与评分 |
| `results.summary.json/.md` | 固定分母、每任务结果、指标来源和有效 n |
| 根目录 `summary.json/.md` | 各阶段状态、配置核验、测量与最终判定 |
| 根目录 `console.log` | UTF-8 终端日志，含阶段参数、实时逐题进度、等待提示和结果摘要 |
| `manual-metrics.csv` | 待补录的监控数据 |

当前流程不自动测量逐 Token ITL、p95 或冷/热启动时间；缺少的引擎速度保留为空。API Key 从环境变量传给子进程，结构化结果和已结束阶段日志会脱敏。启动中的日志可能短暂包含本地 Key，分享前检查最终导出内容。

终端每题显示任务、进度、判定、Token 用量和等待时间；长请求每 15 秒提示一次当前状态。状态更新依据输入计数和实际收到的推理、答案内容，不逐 Token 刷屏；推理接口计时仍在原位置采集。终端日志实时转发并脱敏，使用方式和样式见[脚本说明](context-benchmark/README.md)。

## 11. 执行顺序与命令

```powershell
Set-Location 'E:\codex\技术分享\context-benchmark'

# 只检查三个质量阶段的计划和模型路径。
.\run_full_benchmark.ps1 -Stage quality -Suite extended -DryRun

# 复现质量补测：三种量化统一 Thinking + xhigh，共 189 次请求。
.\run_full_benchmark.ps1 -Stage quality -Suite extended

# 单独试跑一套预设的共同性能。
.\run_full_benchmark.ps1 -Stage performance -Profiles performance -SkipContextCapacity

# 执行完整计划：三套预设的性能、扩展质量和追加容量。
.\run_full_benchmark.ps1 -Suite extended

# 检查附加对照实验与容量边界的计划。
.\run_full_benchmark.ps1 -DryRun -WithAblations -Boundary

# 独立容量测试。
.\run_all_contexts.ps1

# 恢复时必须复用原配置、选择参数及输出目录。
.\run_full_benchmark.ps1 -Stage quality -Suite extended `
    -OutputRoot '.\runs\YOUR_RUN_ID' -Resume
```

可以通过 `-PythonPath`、`-UnslothPath` 指定程序，`-Config` 指定配置，`-Port` 修改默认 8001 端口，`-RequestTimeoutSeconds`/`-ServerTimeoutSeconds` 修改时限。`-Stage quality` 只运行质量阶段，自动跳过容量。

默认完整计划有 9 个阶段：三套配置分别做性能与质量测试，共 6 个；再加 32K/64K/128K 容量测试，共 3 个。Q3 8K 容量复用共同性能结果。启用全部对照实验与边界测试后为 16 个阶段。`-Profiles` 只筛选预设配置；跳过追加容量测试需同时传 `-SkipContextCapacity`。

空运行目录只保存计划和路径检查，正式测试使用新目录。恢复时若发现输入、配置等内容已改变，也使用新目录开始测试，保留原记录。

23:03 开始的一轮使用 `-Stage quality -Suite extended`，只补测三个质量阶段。文档按测试类型更新：单独补测时，只替换对应类型的结果，保留其他已完成测试及其来源环境。需要重新测试时建立新目录；配置、题目或源码改变后，不对已有运行使用 `-Resume`。

退出码 0 表示所选阶段的请求执行完成，容量、准确率和实际配置的判断保存在 summary 中。部分完成或失败的阶段返回 3；预检异常返回非零值。

正式 GPU 测试前可运行不依赖模型的回归验证：

```powershell
python -m unittest discover -s tests -v
```

模拟服务只验证计数、流、生成器、两个请求执行器和结果汇总的衔接，不产生真实模型性能或质量结论。

## 12. 已完成的测试记录

文档采用此前的共同性能与容量结果，以及最新的 Thinking＋xhigh 质量结果。两轮选用九个阶段，共 225 次首次请求；Q3 的 8K 性能与容量共用六次请求，只计一次。

### 12.1 共同性能与上下文容量

来源：[20260905-185546-067769](context-benchmark/runs/20260905-185546-067769/summary.json)，运行时段 2026-09-05 18:55—20:31，驱动 32.0.31035.1003。本文采用该轮的六个性能/容量阶段，共 36 次请求，均正常返回且测量有效。配置见[运行时快照](context-benchmark/runs/20260905-185546-067769/source-snapshot/effective-config.json)。

| 阶段 | 运行状态 | 有效请求 | 结果 |
|---|---|---:|---|
| performance-performance | completed | 6/6 | 30/30 检索项正确，6/6 格式合规 |
| quality-performance | completed | 6/6 | 30/30 检索项正确，6/6 格式合规 |
| context-performance | completed | 6/6 | 30/30 检索项正确，0/6 格式合规；兼任的 8K 容量判定未通过 |
| capacity-32K | completed | 6/6 | 输入 28,942～28,959 Token，检索及格式通过 |
| capacity-64K | completed | 6/6 | 输入 57,964～57,975 Token，检索及格式通过 |
| capacity-128K | completed | 6/6 | 输入 116,043～116,057 Token，检索及格式通过 |

这六个阶段均关闭 Thinking。共同性能使用相同的约 6.8K 输入，三组 Prefill 中位数分别为 780.85、733.39、649.66 Token/s，Decode 为 34.00、31.17、33.34 Token/s。三套预设的 Batch/UBatch 不同。

Q3 的 8K 回答带 Markdown 代码块，因此格式不合规；测速有效，容量判定按原规则保留失败。32K、64K、128K 各有 30/30 检索项正确且 6/6 格式合规，容量测量通过。128K 窗口下首个输出等待中位数为 348.96 秒，总耗时为 353.84 秒。

### 12.2 Thinking＋xhigh 质量补测

来源：[20260905-230353-216459](context-benchmark/runs/20260905-230353-216459/summary.json)，运行时段 2026-09-05 23:03—23:57，驱动 32.0.31041.1004。配置见[运行时快照](context-benchmark/runs/20260905-230353-216459/source-snapshot/effective-config.json)。

三组均使用 16K 窗口、Q8 K/V、Thinking＋xhigh、8,192 输出上限和相同采样。189 次计划请求全部在首次尝试正常返回，测量有效、内容正确且格式合规；没有重试、调用失败或预算耗尽。

| 阶段 | 权重 | 运行状态 | 有效请求 | 任务成功 |
|---|---|---|---:|---:|
| performance-quality | Q4_K_S | completed | 63/63 | 63/63（100%） |
| quality-quality | Q4_K_XL | completed | 63/63 | 63/63（100%） |
| context-quality | Q3_K_XL | completed | 63/63 | 63/63（100%） |

每组包括 60 次短题和 3 次长文档请求。短题输入为 111～145 Token，长文档为 4,599～4,616 Token；三组的文本、标准答案、种子和实际输入计数均一致。评分沿用纯 JSON、字段与类型检查以及定点代码修复的 AST 比较。

三组均通过基础任务与接口格式检查，总体 TTFA 中位数分别为 8.41、10.76、9.70 秒，总耗时中位数为 9.00、11.31、10.08 秒。Batch/UBatch 和输出长度仍不同，时间用于比较该批次的整套配置。按输入长度拆分的结果与慢请求见[实测报告](Qwen3.8-27B本机实测报告.md)。

189 次响应均含推理内容，结束原因为 stop，但后端细分字段 `reasoning_tokens` 全为 0。本组不据此统计推理 Token 数，继续分别记录总输出、TTFT 和 TTFA。

### 12.3 共同的核验记录与范围

本文选用的九个阶段均为 11 项自动检查通过、4 项 unknown，最终保留 unverified。未确认项为 Context Shift、Prompt Cache、视觉投影组件和推测解码。底层日志另有未配置推测解码实现的记录，未据此改写自动判定。九个阶段的服务退出检查均通过。

两轮驱动及输入、输出条件不同，因此按测试类型和批次分别报告。质量补测的最长输入为 4,616 Token；上下文容量的最长输入约为 116K，后者关闭 Thinking。相同长输入下的 xhigh 质量、接近最大窗口的边界输入、控制变量对比和 RAG 尚未测量。

两轮 `manual-metrics.csv` 的监控栏均为空，显存和系统内存峰值、功耗及温度均未采集；启动日志列出的缓冲另行报告。

核对结果见[性能与容量来源记录](context-benchmark/reports/结果核对-20260905-185546-067769.json)、[质量补测记录](context-benchmark/reports/结果核对-20260905-230353-216459.json)，两者的 issues 均为空。原始请求、评分和运行证据保持不变。
