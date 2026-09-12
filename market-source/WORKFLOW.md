# A股市场手记维护

从 data/reports/YYYY-MM-DD.json 生成页面、历史与目录。只维护A股，页面依次为本周判断、四个温度计、20项钟摆、价格与价值、关键数据与后续行动。取消美股切换、情绪周线、固定评分、日期取数台账、上周条件复盘和二层思维章节。

## 常规更新

使用 Node 22.13 以上；本机优先使用 Codex 随附 Node 24。命令在源码根目录执行。

```text
npm run weekly -- preflight --date YYYY-MM-DD --repo <仓库绝对路径>
npm run weekly -- validate --date YYYY-MM-DD
npm run format
npm run weekly -- prepare --date YYYY-MM-DD
npm run format
npm run format:check
npm run lint
npm run typecheck
npm test
npm run weekly -- prepare --date YYYY-MM-DD
npm run build
npm run build:pages
npm run weekly -- archive --date YYYY-MM-DD --repo <仓库绝对路径>
```

prepare 绑定数据、源码和提示词指纹；之后改动任何相关内容都要重新 prepare 和构建。archive 拒绝不匹配的旧构建，并在全部冲突检查通过后复制、核对哈希和更新入口。本地默认库是 weekly-reports/，可用 --local-root 指定。

发布前用浏览器检查只显示A股、已删除章节未出现、钟摆筛选和资料不足状态、目录/提示词链接及窄屏排版。archive 不执行 Git 推送：核对 diff，在最新 main 上仅提交 market/ 和 market-source/ 的相关内容。提前通过 Git 或已授权连接器确认写权限，不强推。

部署成功后执行 npm run weekly -- verify-online --date YYYY-MM-DD --base https://www.acgnx.top/market/，核对线上实际字节。

## 数据结构

新周从最新 JSON 起步并逐项重新研究，使用 schemaVersion=2、methodVersion=cn-brief-v1。markets、informationCutoff 和可选 marketSessions 只包含 cn；时区为 Asia/Shanghai。无需 reading、sentiment、observations、comparison 或 crossChecks，不再研究美股和固定加权情绪分项。

history 保留兼容旧档的字段：新周 cnSentiment、usSentiment、usCycle 写 null，cnCycle 等于 markets.cn.score。修订现有日期保留该日已有历史数值，prepare 会拒绝历史被改写。旧 legacy-v1 和 sentiment-v2 记录仍按旧规则校验，lib/scoring.ts 仅用于这些既有档案，不是新周要求。

data/guide-schema.json 固定20项名称与两极。每项保留位置或 null、依据、引用、复核状态和信心；缺失不是中性50。周期中值以5分为刻度，温度计与攻守是有依据的判断值，不是收益预测。

核心事实的观测期、公开日期、取数日期、单位、口径、直接来源和原始计算保存在 data/inputs/YYYY-MM-DD/；来源也可在 sources 记录日期供校验。这些记录供复核使用，不生成独立网页台账。只使用截止日内公开信息，不从文件名猜日期。

## 重跑与修订

- 同日同内容重跑不重复追加历史；已有快照内容冲突时在写入前拒绝。部分复制可以核对后继续，两个快照验证完成才更新目录/latest。
- 修改已发布页面，revision 加一并填写 revisedAt、revisionReason，写入日期/revisions/02/ 等目录。旧快照保存在档案中，目录只链接该周最新修订，不并列展示原版；数值历史保持一条。
- 2026-09-04旧版已按用户要求删除，正式入口为优化版，canonicalRevision=2、originalRetained=false。其他周不继承特殊字段；新周 revision=1，清除 revisedAt、revisionReason、canonicalRevision、originalRetained。
- 写入目标是明确的发布仓库与本地库；保留 CNAME、首页、daily、plans 及其他无关文件。远端更新时先整合，不覆盖用户修改。
