# 测试运行摘要

共 9 个阶段：已完成 8，失败 0，待执行 0。

配置证据缺失会标为 unverified；测量结果和配置认证分开记录。

| 阶段 | 运行状态 | 配置核验 | 测量判定 | 最终判定 |
|---|---|---|---|---|
| performance-performance | completed | unknown | pass | unverified |
| performance-quality | partial | unknown | measured | unverified |
| quality-performance | completed | unknown | pass | unverified |
| quality-quality | completed | unknown | measured | unverified |
| context-performance | completed | unknown | fail | unverified |
| context-quality | completed | unknown | measured | unverified |
| capacity-32K | completed | unknown | pass | unverified |
| capacity-64K | completed | unknown | pass | unverified |
| capacity-128K | completed | unknown | pass | unverified |

performance-performance 尚未确认的配置：context_shift, prompt_cache, vision_projector_loaded, speculative_decoding。

performance-quality 尚未确认的配置：context_shift, prompt_cache, vision_projector_loaded, speculative_decoding。

quality-performance 尚未确认的配置：context_shift, prompt_cache, vision_projector_loaded, speculative_decoding。

quality-quality 尚未确认的配置：context_shift, prompt_cache, vision_projector_loaded, speculative_decoding。

context-performance 尚未确认的配置：context_shift, prompt_cache, vision_projector_loaded, speculative_decoding。

context-quality 尚未确认的配置：context_shift, prompt_cache, vision_projector_loaded, speculative_decoding。

capacity-32K 尚未确认的配置：context_shift, prompt_cache, vision_projector_loaded, speculative_decoding。

capacity-64K 尚未确认的配置：context_shift, prompt_cache, vision_projector_loaded, speculative_decoding。

capacity-128K 尚未确认的配置：context_shift, prompt_cache, vision_projector_loaded, speculative_decoding。

每个阶段的 results.summary.json 保存固定分母和测速来源；stage.json 保存失败原因、时间与复用信息。
context-performance 在 also_capacity=true 时同时计入 8K 容量；不重复运行。
手动监控数据见 manual-metrics.csv；空白表示尚未采集，不能视为零。
