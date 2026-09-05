import { currentReport as report } from '@/lib/current-report';
import {
  metricRules,
  scoreSentiment,
  statusLabels,
  type ObservationStatus,
} from '@/lib/scoring';
import { marketHistory } from '@/lib/market-history';
import type { MarketKey, Source } from '@/lib/market-types';

function Refs({ ids, sources }: { ids: string[]; sources: Source[] }) {
  return (
    <span className="ml-2 inline-flex flex-wrap gap-2">
      {ids.map((id) => {
        const s = sources.find((x) => x.id === id);
        return s ? (
          <a
            key={id}
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-[var(--signal)] underline underline-offset-4"
            title={s.label}
          >
            {id}
          </a>
        ) : null;
      })}
    </span>
  );
}

export function WeeklyBrief({
  market,
  sources,
}: {
  market: MarketKey;
  sources: Source[];
}) {
  const reading = report.reading[market];
  return (
    <section
      className="mx-auto max-w-[1380px] px-5 py-8 lg:px-8"
      aria-labelledby="weekly-brief"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id="weekly-brief" className="font-display text-2xl">
          本周先看这三件事
        </h2>
        <div className="flex gap-4 text-sm text-[#526358]">
          <a href="#conditions" className="underline underline-offset-4">
            条件复盘
          </a>
          <a href="#method" className="underline underline-offset-4">
            评分与缺口
          </a>
          <a href="#guide" className="underline underline-offset-4">
            20项钟摆
          </a>
        </div>
      </div>
      <div className="grid gap-px overflow-hidden rounded-lg border border-[#26382e]/15 bg-[#26382e]/15 md:grid-cols-3">
        {reading.changes.map((item, i) => (
          <article key={item.label} className="bg-[#f7f2e8] p-5 lg:p-6">
            <p className="text-sm text-[var(--signal)]">
              0{i + 1} / {item.label}
            </p>
            <h3 className="font-display mt-3 text-xl leading-relaxed">
              {item.title}
            </h3>
            <p className="mt-3 text-base leading-7 text-[#526358]">
              {item.text}
              <Refs ids={item.refs} sources={sources} />
            </p>
          </article>
        ))}
      </div>
      <p className="mt-4 text-sm leading-6 text-[#526358]">
        数据截止 {report.date}
        {report.revision > 1 && (
          <>
            {' '}
            · 本页为 {report.revisedAt} 阅读修订版。{report.revisionReason}
            <a
              href={`https://www.acgnx.top/market/${report.date}/`}
              className="ml-2 underline underline-offset-4"
            >
              查看原版
            </a>
          </>
        )}
      </p>
    </section>
  );
}

export function EvidenceMethod({
  market,
  sources,
}: {
  market: MarketKey;
  sources: Source[];
}) {
  const components = report.sentiment[market];
  const legacy = report.methodVersion === 'legacy-v1';
  const computed = legacy
    ? null
    : scoreSentiment(
        report.observations?.[market] ?? [],
        report.informationCutoff[market],
      );
  const counts = Object.entries(statusLabels)
    .map(([status, label]) => ({
      label,
      count: components.filter((x) => x.status === status).length,
    }))
    .filter((x) => x.count > 0);
  return (
    <section
      id="method"
      className="border-b border-[#26382e]/15 bg-[#f7f2e8] scroll-mt-5"
    >
      <div className="mx-auto max-w-[1380px] px-5 py-10 lg:px-8">
        <div className="flex flex-wrap justify-between gap-4">
          <h2 className="font-display text-3xl">分数背后的证据</h2>
          <span className="self-center rounded-full border border-[#26382e]/20 px-3 py-1 text-sm">
            本期：{legacy ? '旧口径 v1' : '固定规则 v2'}
          </span>
        </div>
        <div className="mt-5 grid gap-6 md:grid-cols-[.8fr_1.2fr]">
          <div className="rounded-lg bg-[var(--market-panel)] p-5">
            <h3 className="font-display text-xl">
              完整指标覆盖率：{computed ? `${computed.coverage}%` : '未建立'}
            </h3>
            <p className="mt-2 text-base leading-7 text-[#526358]">
              {computed
                ? `总分：${computed.score ?? '资料不足'}；缺项敏感性范围 ${computed.range[0]}—${computed.range[1]}，不是统计置信区间。`
                : '旧口径没有固定到单项指标和时间窗口，不能补算一个精确覆盖率。'}
            </p>
            {legacy && (
              <div className="mt-4 flex flex-wrap gap-2">
                {counts.map((c) => (
                  <span
                    key={c.label}
                    className="rounded border border-[#26382e]/20 px-2 py-1 text-sm"
                  >
                    {c.label} {c.count}/5
                  </span>
                ))}
              </div>
            )}
            <p className="mt-3 text-sm leading-6 text-[#526358]">
              {legacy
                ? '上方按五个分项归类证据状态，未按权重折算。'
                : '有效原权重至少70%，且前三组各有有效观测，才给总分；代理只作旁证。'}
            </p>
          </div>
          <div className="border-l-2 border-[#b98358]/60 pl-5">
            <h3 className="font-display text-xl">怎样理解本周差值</h3>
            <p className="mt-2 text-base leading-7 text-[#526358]">
              {report.comparison.reason}
            </p>
            <p className="mt-2 text-base leading-7 text-[#526358]">
              {report.reading[market].missingImpact}
            </p>
          </div>
        </div>
        <details className="mt-6 border-t border-[#26382e]/15 pt-5">
          <summary className="cursor-pointer font-display text-xl">
            展开本期分项台账 · {market === 'cn' ? 'A股' : '美股'}
          </summary>
          {legacy ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {components.map((c) => (
                <article
                  key={c.label}
                  className="rounded-lg border border-[#26382e]/15 p-4"
                >
                  <div className="flex justify-between gap-3">
                    <h4 className="font-medium text-base">{c.label}</h4>
                    <span className="shrink-0 font-mono text-sm">
                      {c.weight}%
                    </span>
                  </div>
                  <p className="mt-3 text-sm">
                    <strong className="text-xl font-normal">
                      {c.status === 'missing' ? '—' : c.score}
                    </strong>{' '}
                    · {statusLabels[c.status as ObservationStatus]} · 信心
                    {c.confidence}
                  </p>
                  <p className="mt-2 text-base leading-7 text-[#526358]">
                    {c.limitation}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#526358]">
                    {c.note}
                    <Refs ids={c.refs} sources={sources} />
                  </p>
                  {c.status === 'missing' && (
                    <p className="mt-2 text-sm text-[#85543c]">
                      原记录使用50；仅为解释旧总分保留，不是中性观测。
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {computed?.rows.map((r) => (
                <article
                  key={r.id}
                  className="rounded-lg border border-[#26382e]/15 p-4"
                >
                  <h4 className="text-base">
                    {r.label} · {r.score === null ? '—' : r.score.toFixed(1)}
                  </h4>
                  <p className="mt-2 text-sm leading-6">
                    {statusLabels[r.status as ObservationStatus]} · 原权重
                    {r.weight.toFixed(2)}% · 有效权重
                    {r.effectiveWeight.toFixed(2)}%
                  </p>
                  <p className="mt-2 text-sm leading-6">
                    {
                      report.observations?.[market].find((o) => o.id === r.id)
                        ?.note
                    }
                    <Refs
                      ids={
                        report.observations?.[market].find((o) => o.id === r.id)
                          ?.refs ?? []
                      }
                      sources={sources}
                    />
                  </p>
                </article>
              ))}
            </div>
          )}
          {legacy && (
            <p className="mt-4 break-words text-sm leading-7">
              原稿计算：
              {components
                .map((c) => `${c.score} × ${c.weight}%`)
                .join(' + ')} ={' '}
              {components
                .reduce((n, c) => n + (c.weight * c.score) / 100, 0)
                .toFixed(1)}
              ，四舍五入为{' '}
              {market === 'cn'
                ? report.history.cnSentiment
                : report.history.usSentiment}
              。本次未重打历史分。
            </p>
          )}
        </details>
        <details className="mt-5 border-t border-[#26382e]/15 pt-5">
          <summary className="cursor-pointer font-display text-xl">
            {legacy ? '下一期开始：' : '本期采用：'}固定评分规则 v2
          </summary>
          <p className="mt-4 max-w-5xl text-base leading-7 text-[#526358]">
            保留25 / 25 / 20 / 15 /
            15的五项权重。每个原始值按下表固定锚点线性插值；五个锚点对应0、25、50、75、100分，反向项颠倒。锚点是本站自定尺度，不是经过回测的收益预测模型。跨市场指标不同，只比较各市场自己的历史。
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm leading-6">
              <caption className="sr-only">
                情绪评分v2的指标、权重、窗口和锚点
              </caption>
              <thead>
                <tr className="border-b border-[#26382e]/20">
                  <th className="p-3">指标 / 权重</th>
                  <th className="p-3">固定窗口与口径</th>
                  <th className="p-3">五个原始值锚点</th>
                </tr>
              </thead>
              <tbody>
                {metricRules.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[#26382e]/10 align-top"
                  >
                    <td className="p-3">
                      {r.label}
                      <br />
                      <span className="font-mono">
                        {Number(r.weight.toFixed(2))}%
                      </span>
                    </td>
                    <td className="max-w-lg p-3">{r.window}</td>
                    <td className="p-3 font-mono">
                      {r.knots.join(' / ')} {r.unit}
                      {r.inverse ? '（反向）' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-5 list-disc space-y-2 pl-5 text-base leading-7 text-[#526358]">
            <li>
              缺失填空值；未经预先批准的代理只作旁证，不进入定量分。正常发布滞后的资料，在固定有效期内可纳入。
            </li>
            <li>
              有效原权重至少70%，且前三组各有直接观测，才显示总分；否则显示“资料不足”。有效权重重新归一并公开。
            </li>
            <li>
              同时显示缺项取0—100时的总分边界；这是敏感性范围，不是统计置信区间。代理误差不伪装成可测误差。
            </li>
            <li>
              只有同版本、全覆盖、指标定义相同的连续两期才显示可比变化；更换方法或缺项时断开连线，保留原记录。
            </li>
            <li>
              周期先给阶段与区间，新中值按5分刻度表达；攻守单独依据估值、信用、现金流和被迫卖出风险。
            </li>
          </ul>
          <a
            href="./weekly-market-prompt.md"
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-block text-base underline underline-offset-4"
          >
            查看完整更新提示词 →
          </a>
        </details>
        <details className="mt-5 border-t border-[#26382e]/15 pt-5">
          <summary className="cursor-pointer font-display text-xl">
            观测日、发布日期与取数记录
          </summary>
          <p className="mt-3 text-sm leading-6 text-[#526358]">
            取数晚于截止日不等于使用后来信息。旧稿未记录的精确发布日期保留为空；这部分不能据此认证为v2合格输入。
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm leading-6">
              <thead>
                <tr className="border-b border-[#26382e]/20">
                  <th className="p-3">信源 / 观测期</th>
                  <th className="p-3">观测截止</th>
                  <th className="p-3">发布</th>
                  <th className="p-3">取数</th>
                </tr>
              </thead>
              <tbody>
                {sources
                  .filter((s) => s.tier !== '方法框架')
                  .map((s) => (
                    <tr key={s.id} className="border-b border-[#26382e]/10">
                      <td className="p-3">
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline underline-offset-4"
                        >
                          {s.id} · {s.label}
                        </a>
                        <div className="text-[#526358]">{s.period}</div>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {s.observedAt ?? '未核验'}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {s.publishedAt ?? '旧稿未记录'}
                      </td>
                      <td className="p-3 whitespace-nowrap">{s.retrievedAt}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </section>
  );
}

export function ConditionReview({
  market,
  sources,
}: {
  market: MarketKey;
  sources: Source[];
}) {
  return (
    <section
      id="conditions"
      className="mx-auto max-w-[1380px] scroll-mt-5 px-5 py-12 lg:px-8"
    >
      <h2 className="font-display text-3xl">上周的等待，兑现了吗</h2>
      <p className="mt-3 text-base leading-7 text-[#526358]">
        逐条复核
        {marketHistory.filter((r) => r.date < report.date).at(-1)?.date ??
          '上一期'}
        写下的条件。多个条件要求同时成立；缺一项，就不算已经触发。
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {report.reading[market].conditionReview.map((c) => (
          <article
            key={c.condition}
            className="rounded-lg border border-[#26382e]/15 p-5"
          >
            <span className="rounded-full bg-[var(--market-panel)] px-3 py-1 text-sm">
              {c.status}
            </span>
            <h3 className="font-display mt-4 text-xl leading-relaxed">
              {c.condition}
            </h3>
            <p className="mt-3 text-base leading-7 text-[#526358]">
              {c.evidence}
              <Refs ids={c.refs} sources={sources} />
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
