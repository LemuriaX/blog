# A股市场手记维护

只维护A股。页面依次为价格与价值、20项市场钟摆、关键数据与后续条件。页头仅名称和日期；不再有市场总结、周期/攻守等分数、温度计、美股、情绪周线、固定评分、日期台账、上周条件复盘和二层思维章节。

## 执行顺序

使用Node≥22.13，本机优先Codex随附Node24。命令在源码根目录执行，发布仓库必须有已确认的写权限。

```text
npm run weekly -- preflight --date YYYY-MM-DD --repo <仓库绝对路径>
npm run weekly -- validate --date YYYY-MM-DD
npm run format
npm run weekly -- prepare --date YYYY-MM-DD
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run build:pages
npm run weekly -- archive --date YYYY-MM-DD --repo <仓库绝对路径>
```

prepare绑定报告、源码和提示词指纹，并校对研究输入的日期、修订号和估值表。之后改动相关内容必须重新prepare和构建。archive在全部冲突检查通过后复制并验证哈希，最后更新目录/latest；不执行Git推送。浏览器检查正文顺序、已删除内容、估值日期、缺失值、证据折叠、情景计算、钟摆筛选、链接和窄屏排版。

核对diff，在最新main上仅提交相关market/、market-source/内容，不强推。部署成功后执行npm run weekly -- verify-online --date YYYY-MM-DD --base https://www.acgnx.top/market/，核对线上实际字节。

## 数据与研究结构

- data/reports/YYYY-MM-DD.json：本期展示输入，schemaVersion=2、methodVersion=cn-value-v1。markets、informationCutoff及可选marketSessions只含cn，时区Asia/Shanghai。
- markets.cn.valueAnalysis：统一日期估值表、五类资产的支持与反证、判断边界、后续条件、估值情景、口径冲突。不保留hero、summary、score、signals、styleMap或defenseScore。
- data/inputs/YYYY-MM-DD/value-review.json：原始数值、单位、范围、日期、直接来源、PDF哈希、计算与排除记录。估值表与本期报告一致。
- prepare生成public/price-value-research.md及public/value-inputs.json供复核，同时生成lib/current-report.ts、历史、目录、提示词副本等。生成结果不手改。
- 历史字段兼容旧档，新周四个history数值全部写null；已发布周修订保留该日旧数值。prepare拒绝历史被改写。旧方法按旧规则校验，lib/scoring.ts只服务既有档案。
- data/guide-schema.json固定20项名称与两极。位置仅单项示意，缺失写null；不汇总评分。依据与原始引用需要逐项复核。

研究质量要求详见WEEKLY_MARKET_PROMPT.md：统一估值口径，区分指数/全板块/公司，核验扣非和套期损益、CFO与自由现金流、财务子公司和分红持续性；不能给无依据的历史分位或目标价。

## 归档与修订

同日同内容重跑不追加历史。快照冲突在写入前拒绝，部分复制可核对后恢复。已发布周修改应增加revision并写修订日期与原因，写入日期/revisions/NN/，目录只指向最新修订。旧快照保持不变。

2026-09-04是用户指定例外：旧版已删除，canonicalRevision=2、originalRetained=false。新周revision=1，并清除所有旧修订及特殊入口字段。保留CNAME、首页、daily、plans及其他无关文件；远端变化先整合，不覆盖用户修改。
