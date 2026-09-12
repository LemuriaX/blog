import { ArrowRight, ArrowUpRight, ChevronDown } from 'lucide-react';
import type { Source, ValueAnalysis } from '@/lib/market-types';
import { SourceRefs } from './source-refs';

export function PriceValue({
  analysis,
  sources,
}: {
  analysis: ValueAnalysis;
  sources: Source[];
}) {
  return (
    <section id="value" className="border-b border-[#26382e]/10">
      <div className="mx-auto grid max-w-[1380px] gap-10 px-5 py-12 lg:grid-cols-[1.15fr_.85fr] lg:gap-14 lg:px-8 lg:py-16">
        <div className="min-w-0">
          <p className="font-mono text-xs tracking-[0.2em] text-[#26382e]/45">
            01 — PRICE / VALUE
          </p>
          <h1 className="font-display mt-3 text-4xl tracking-[-0.06em] text-[#26382e]">
            价格与价值
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-xs leading-6 text-[#697767]">
              确定性不是安全垫。好资产，也可能是坏价格。
            </p>
            <SourceRefs ids={['HM-04']} sources={sources} />
          </div>

          <div className="mt-7 border-t border-[#26382e]/11">
            {analysis.cases.map((item) => (
              <details
                key={item.id}
                className="group border-b border-[#26382e]/11"
              >
                <summary className="grid cursor-pointer list-none gap-x-5 gap-y-3 py-5 sm:grid-cols-[1.1fr_.9fr_.9fr_auto] sm:items-center [&::-webkit-details-marker]:hidden">
                  <span className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1">
                    <span className="font-display text-lg leading-7 text-[#26382e]/86">
                      {item.presentation.name}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-[#758d72] sm:hidden">
                      {item.presentation.posture}
                      <ChevronDown
                        className="size-3 group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </span>
                  </span>
                  <span className="block border-b border-[#7b9278]/45 pb-2">
                    <span className="block text-xs text-[#788474]">确定性</span>
                    <span className="mt-2 block text-sm text-[#597456]">
                      {item.presentation.certainty}
                    </span>
                  </span>
                  <span className="block border-b border-[#26382e]/25 pb-2">
                    <span className="block text-xs text-[#788474]">安全垫</span>
                    <span className="mt-2 block text-sm text-[#657061]">
                      {item.presentation.cushion}
                    </span>
                  </span>
                  <span className="hidden w-14 items-center justify-between gap-2 text-xs text-[#8b7663] sm:flex">
                    {item.presentation.posture}
                    <ChevronDown
                      className="size-3 transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </span>
                </summary>
                <div className="pb-6 text-sm leading-7 text-[#5f6f5d]">
                  <p className="font-medium text-[#415c43]">{item.verdict}</p>
                  <p className="mt-2 text-xs text-[#7a8572]">
                    价格参照 · {item.metric}（{analysis.valuationDate}）
                  </p>
                  <p className="mt-3">
                    <span className="mr-2 text-[#405b42]">依据</span>
                    {item.support.text}
                  </p>
                  <SourceRefs ids={item.support.refs} sources={sources} />
                  <p className="mt-3">
                    <span className="mr-2 text-[#946b53]">反证</span>
                    {item.challenge.text}
                  </p>
                  <SourceRefs ids={item.challenge.refs} sources={sources} />
                  <p className="mt-3">
                    <span className="mr-2 text-[#405b42]">判断</span>
                    {item.resolution}
                  </p>
                  <p className="mt-3 text-xs leading-6 text-[#768170]">
                    {item.limitation}
                  </p>
                  <p className="mt-2 text-xs leading-6 text-[#768170]">
                    继续验证 · {item.watch}
                  </p>
                </div>
              </details>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 text-xs text-[#75816e]">
            <span>
              估值参考 {analysis.valuationDate.replaceAll('-', '.')} ·
              点击行查看依据
            </span>
            <a
              href={analysis.researchFile}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[#627e5d] underline decoration-[#627e5d]/30 underline-offset-4"
            >
              数据与计算依据
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </a>
          </div>
        </div>

        <aside
          aria-labelledby="position-title"
          className="self-start rounded-[8px_34px_8px_34px] bg-[var(--market-panel)] text-[#26382e]"
        >
          <div className="border-b border-[#26382e]/12 px-6 py-6 sm:px-7">
            <p className="font-mono text-xs tracking-[0.18em] text-[#26382e]/42">
              OFFENSE / DEFENSE
            </p>
            <h2
              id="position-title"
              className="font-display mt-2 text-3xl tracking-[-0.06em]"
            >
              攻守位置
            </h2>
          </div>
          <div className="px-6 py-2 sm:px-7">
            <div className="border-b border-[#26382e]/12 py-6">
              <p className="font-display text-2xl leading-relaxed text-[#26382e]/82">
                {analysis.stance.label}
              </p>
              <p className="mt-4 text-sm leading-7 text-[#687b60]">
                {analysis.stance.reason}
              </p>
              <div className="mt-3">
                <SourceRefs ids={analysis.stance.refs} sources={sources} />
              </div>
            </div>
            {analysis.stance.actions.map(([label, text], index) => (
              <div
                key={label}
                className="grid grid-cols-[24px_1fr_auto] items-center gap-3 border-b border-[#26382e]/12 py-6 last:border-0 sm:grid-cols-[30px_1fr_auto] sm:gap-4"
              >
                <span className="font-mono text-xs text-[#26382e]/45">
                  0{index + 1}
                </span>
                <p className="font-display text-base leading-7 text-[#435d42]">
                  {label}：{text}
                </p>
                <ArrowRight
                  className="size-4 text-[#26382e]/35"
                  aria-hidden="true"
                />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
