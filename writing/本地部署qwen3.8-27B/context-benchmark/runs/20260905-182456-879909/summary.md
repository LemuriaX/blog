# 测试运行摘要

配置证据缺失会标为 unverified；测量结果和配置认证分开记录。

| 阶段 | 运行状态 | 配置核验 | 测量判定 | 最终判定 |
|---|---|---|---|---|
| performance-performance | completed | unknown | pass | unverified |
| performance-quality | failed | unknown | — | unverified |
| quality-performance | failed | unknown | — | unverified |
| quality-quality | failed | unknown | — | unverified |
| context-performance | failed | unknown | — | unverified |
| context-quality | failed | unknown | — | unverified |
| capacity-32K | failed | unknown | — | unverified |
| capacity-64K | failed | unknown | — | unverified |
| capacity-128K | failed | unknown | — | unverified |

performance-performance 尚未确认的配置：context_shift, prompt_cache, vision_projector_loaded, speculative_decoding。

每个阶段的 results.summary.json 保存固定分母和测速来源；stage.json 保存失败原因、时间与复用信息。
context-performance 在 also_capacity=true 时同时计入 8K 容量；不重复运行。
手动监控数据见 manual-metrics.csv；空白表示尚未采集，不能视为零。
