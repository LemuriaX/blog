'use client';

/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- The horizontally scrolling valuation table must be keyboard reachable. */

import { useState } from 'react';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import type { Source, ValueAnalysis } from '@/lib/market-types';
import { valuationScenario } from '@/lib/value-math';
import { SourceRefs } from './source-refs';

const percent = (value: number) =>
  `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

export function PriceValue({
  analysis,
  sources,
}: {
  analysis: ValueAnalysis;
  sources: Source[];
}) {
  const [growth, setGrowth] = useState(analysis.stress.defaultGrowth);
  const [exitPe, setExitPe] = useState(analysis.stress.defaultExitPe);
  const result = valuationScenario(
    analysis.stress.entryPe,
    exitPe,
    growth,
    analysis.stress.years,
  );
  return (
    <section
      id="value"
      className="mx-auto max-w-[1380px] px-5 py-12 lg:px-8 lg:py-16"
    >
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-[#6c796c]">
            01 — PRICE / VALUE
          </p>
          <h1 className="font-display mt-3 text-4xl tracking-[-0.04em] sm:text-5xl">
            价格与价值
          </h1>
        </div>
        <a
          href={analysis.researchFile}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-[#536f59] underline underline-offset-4"
        >
          完整研究与推导 <ArrowUpRight className="size-4" aria-hidden="true" />
        </a>
      </div>
      <p className="mt-6 max-w-4xl text-sm leading-6 text-[#59695d]">
        {analysis.scopeNote}
      </p>
      <section
        className="mt-5 overflow-x-auto border-y border-[#26382e]/15"
        aria-label="同日指数估值表"
        tabIndex={0}
      >
        <table className="w-full min-w-[620px] text-left text-sm">
          <caption className="sr-only">
            中证指数{analysis.valuationDate}估值参考，股息率单位为百分比
          </caption>
          <thead>
            <tr className="border-b border-[#26382e]/15 text-xs text-[#697568]">
              <th scope="col" className="py-4 pr-4 font-normal">
                指数 / 样本
              </th>
              <th scope="col" className="px-3 text-right font-normal">
                PE · TTM
              </th>
              <th scope="col" className="px-3 text-right font-normal">
                PB
              </th>
              <th scope="col" className="px-3 text-right font-normal">
                股息率
              </th>
              <th scope="col" className="pl-5 font-normal">
                比较边界
              </th>
            </tr>
          </thead>
          <tbody>
            {analysis.benchmarks.map((b) => (
              <tr
                key={b.code}
                className="border-b border-[#26382e]/8 last:border-b-0"
              >
                <th scope="row" className="py-4 pr-4 font-normal">
                  <span className="font-medium">{b.name}</span>
                  <span className="ml-2 font-mono text-xs text-[#748071]">
                    {b.code} · {b.samples}只
                  </span>
                </th>
                <td className="px-3 text-right font-mono tabular-nums">
                  {b.pe?.toFixed(2) ?? '—'}
                </td>
                <td className="px-3 text-right font-mono tabular-nums">
                  {b.pb?.toFixed(2) ?? '—'}
                </td>
                <td className="px-3 text-right font-mono tabular-nums">
                  {b.dividendYield?.toFixed(2) ?? '—'}
                  {b.dividendYield === null ? '' : '%'}
                </td>
                <td className="py-4 pl-5 text-xs text-[#637161]">
                  <span className="mr-2">{b.scope}</span>
                  <SourceRefs ids={b.refs} sources={sources} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="mt-3 text-xs leading-6 text-[#6c776b]">
        {analysis.methodNote}
      </p>

      <div className="mt-10 flex items-center justify-between gap-4">
        <h2 className="font-display text-2xl">五类资产，逐项核验</h2>
        <span className="text-xs text-[#6c776b]">展开查看依据与反证</span>
      </div>
      <div className="mt-4 divide-y divide-[#26382e]/12 border-y border-[#26382e]/12">
        {analysis.cases.map((item, i) => (
          <details key={item.id} className="group" open={i === 0}>
            <summary className="flex cursor-pointer list-none items-center gap-5 py-6 [&::-webkit-details-marker]:hidden">
              <span className="hidden font-mono text-xs text-[#829080] sm:block">
                0{i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <span className="font-display text-xl">{item.title}</span>
                  <span className="font-mono text-xs text-[#6e7b6d]">
                    {item.metric}
                  </span>
                </span>
                <span className="mt-2 block text-sm leading-6 text-[#546c58]">
                  {item.verdict}
                </span>
              </span>
              <ChevronDown
                className="size-4 shrink-0 text-[#71866e] transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="pb-7 sm:pl-9">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="border-l-2 border-[#7f9b7e] pl-4">
                  <h3 className="text-xs font-medium tracking-wider text-[#557154]">
                    支持证据
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-[#4e5c50]">
                    {item.support.text}
                  </p>
                  <SourceRefs ids={item.support.refs} sources={sources} />
                </div>
                <div className="border-l-2 border-[#b98b77] pl-4">
                  <h3 className="text-xs font-medium tracking-wider text-[#935e49]">
                    最强反证
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-[#4e5c50]">
                    {item.challenge.text}
                  </p>
                  <SourceRefs ids={item.challenge.refs} sources={sources} />
                </div>
              </div>
              <p className="mt-5 text-sm leading-7">
                <span className="mr-3 text-[#6f7d6c]">判断</span>
                {item.resolution}
              </p>
              <p className="mt-2 text-sm leading-7">
                <span className="mr-3 text-[#6f7d6c]">继续验证</span>
                {item.watch}
              </p>
              <p className="mt-3 text-xs leading-6 text-[#758071]">
                样本边界 · {item.limitation}
              </p>
            </div>
          </details>
        ))}
      </div>

      <div className="mt-9 border border-[#26382e]/12 bg-[#e6eadc]/65 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl">高增长，能否抵消估值收缩？</h2>
          <SourceRefs ids={analysis.stress.refs} sources={sources} />
        </div>
        <p className="mt-3 text-sm leading-6 text-[#65745f]">
          以科创50的{analysis.stress.entryPe.toFixed(2)}倍PE为起点，假设持有
          {analysis.stress.years}年。调整两个假设，查看价格回报。
        </p>
        <div className="mt-6 grid items-end gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-[#576d52]">
            每股盈利年增长
            <select
              aria-label="每股盈利年增长"
              value={growth}
              onChange={(event) => setGrowth(Number(event.target.value))}
              className="mt-2 block w-full rounded-none border border-[#26382e]/20 bg-[#f5f2e9] px-3 py-2.5 font-mono text-base text-[#26382e]"
            >
              {[-10, 0, 10, 20, 30, 40].map((v) => (
                <option key={v} value={v}>
                  {percent(v)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-[#576d52]">
            三年后PE
            <select
              aria-label="三年后PE"
              value={exitPe}
              onChange={(event) => setExitPe(Number(event.target.value))}
              className="mt-2 block w-full rounded-none border border-[#26382e]/20 bg-[#f5f2e9] px-3 py-2.5 font-mono text-base text-[#26382e]"
            >
              {[30, 40, 50, 60, 79.82, 100].map((v) => (
                <option key={v} value={v}>
                  {v}倍
                </option>
              ))}
            </select>
          </label>
          <div>
            <p className="text-xs text-[#68775f]">三年价格回报</p>
            <output
              aria-live="polite"
              className="mt-2 block font-mono text-3xl tabular-nums"
            >
              {percent(result.total)}
            </output>
          </div>
          <div>
            <p className="text-xs text-[#68775f]">折合年化</p>
            <output
              aria-live="polite"
              className="mt-2 block font-mono text-3xl tabular-nums"
            >
              {percent(result.annualized)}
            </output>
          </div>
        </div>
        <p className="mt-5 text-sm leading-6 text-[#586d53]">
          若退出PE为{exitPe}倍，每股盈利年增长需达到
          {result.breakEvenGrowth.toFixed(1)}%，才能使三年价格回报为零。
        </p>
        <p className="mt-3 text-xs leading-6 text-[#6d7968]">
          情景计算，不是预测。固定样本、每股盈利口径，不计分红、税费和指数调样；价格回报
          = (1 + 盈利增速)³ × 退出PE ÷ 起始PE − 1。
        </p>
      </div>
      <details className="mt-6 border-b border-[#26382e]/12 pb-5">
        <summary className="cursor-pointer text-sm text-[#687563]">
          口径冲突与未解决的问题
        </summary>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {analysis.conflicts.map((c) => (
            <div key={c.title}>
              <h3 className="text-sm font-medium">{c.title}</h3>
              <p className="my-2 text-sm leading-7 text-[#647060]">{c.text}</p>
              <SourceRefs ids={c.refs} sources={sources} />
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
