# 市场手记维护

在源码根目录执行命令。数据从 data/reports/ 输入，页面、历史与目录由同一份输入生成。新周复制上一期 JSON 作为结构起点，再逐项研究；日期、原始观测、条件复盘、信源、方法版本必须更新，不能沿用旧结论。

## 常规更新

使用 Node 22.13 以上；本机优先把 Codex 随附 Node 24 的目录放在 PATH 前面。

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

prepare 写入用于绑定构建的数据及源码指纹。若之后修改产品源码或提示词，应重新 prepare、构建、检查；归档会拒绝不匹配的旧构建。格式变化也会改变源码指纹，所以最后一次 prepare 应在格式化之后。本地库默认是当前源码根下 weekly-reports，可用 --local-root 显式指定已有周报库。

archive 不推送 Git：它检查全部目标冲突，复制同一构建、验证每个文件和原有快照，再更新目录/latest。准备完成后核对 diff，在最新 main 上提交，仅发布 market/ 与 market-source/ 的相关改动。命令不证明已登录 GitHub；提前用 git push --dry-run 或已授权连接器确认写权限。

本周发布前须做市场切换、评分折叠、历史图、钟摆筛选、缺失项、链接和窄屏检查。部署成功后核对线上字节：

```text
npm run weekly -- verify-online --date YYYY-MM-DD --base https://www.acgnx.top/market/
```

## 重跑、中断与修订

- 同日相同数据不会重复追加历史；prepare 会检查现有历史分数，拒绝回改。
- 构建不变时 archive 可以重跑；部分文件已复制时逐个核对后继续。已有文件内容不同则在写入前拒绝，不能用覆盖参数绕过。
- 先完成两个快照并核对，再写目录/latest。网络失败或构建失败不应开始归档；远端只有完整提交才发布。操作系统在最后目录写入中断时重跑 archive 即可完成入口同步。
- 已发布周需要改进：revision 从1加到2，填写 revisedAt 和 revisionReason，保存到日期/revisions/02/。原日期目录和旧修订永远保留，目录保留原版链接；周度历史依旧一条。
- 修订用于说明事实纠错或展示变化，不把后见判断当原判断。数值历史维持当时记录，必要时在正文另列纠错值与原因。
- 写入目标是明确指定的发布仓库与本地库；不要指向旧的脏工作区。遇远端进展，先整合再发布，不强推。

## 数据与方法

data/guide-schema.json 固定20项与两极；lib/scoring.ts 固定v2指标、权重、锚点、最大观测年龄、缺项处理及可比性规则。data/reports/2026-09-04.json 保留旧主观分项，只在修订版标明证据不足；不能当作v2输入。

v2周数据增加 observations.cn / observations.us，每项字段为 id、value（数字或null）、status、observedAt、publishedAt、retrievedAt、refs、definition、note。id 从 metricRules 选择；definition 写固定序列、窗口与样本定义。原始序列/分位计算过程放在 data/inputs/，由 refs 指向来源并在 note 写文件名。每个有效观测必须有发布日期；未知发布时间不能假装verified。

总分和 history 的情绪值调用 scoreSentiment 后填入；缺覆盖返回null。v2不接受把代理或缺失填成50。前一期完整可比时才展示差值；方法变化保留历史断点。JSON中的 reading 保存首屏三件事、条件复盘及影响说明；所有文字均由研究结果填写，脚本不会自动生成投资判断。

周期、温度计、攻守、钟摆属于解释性判断；除新周期中值用5分刻度外，不宣称量化公式可替代投资判断。新规则没有历史回测，使用时观察稳定性，但不得看到结果后回调阈值再回改分数。
