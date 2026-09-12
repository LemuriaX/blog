'use client';

import { useState, type CSSProperties } from 'react';
import {
  ArrowRight,
  CalendarDays,
  ExternalLink,
  LineChart,
  Scale,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { GuideSide, GuideFilter } from '@/lib/market-types';
import { currentReport as report } from '@/lib/current-report';
import { PriceValue } from './price-value';
import { SourceRefs } from './source-refs';

function guideSide(position: number | null): GuideSide {
  if (position === null) return 'unknown';
  if (position <= 40) return 'left';
  if (position >= 60) return 'right';
  return 'middle';
}

function SectionMark({ number, label }: { number: string; label: string }) {
  return (
    <div className="flex items-center gap-3 font-mono text-sm tracking-[0.2em] text-[#26382e]/40">
      <span>{number}</span>
      <span className="h-px w-8 bg-[#26382e]/14" />
      <span>{label}</span>
    </div>
  );
}

export default function Home() {
  const [guideFilter, setGuideFilter] = useState<GuideFilter>('all');
  const active = report.markets.cn;
  const filteredGuide =
    guideFilter === 'all'
      ? active.guide
      : active.guide.filter(
          (item) =>
            guideSide(
              item.review.confidence === '无法判断' ? null : item.position,
            ) === guideFilter,
        );
  const filterOptions: Array<{ key: GuideFilter; label: string }> = [
    { key: 'all', label: '全部' },
    { key: 'left', label: '左侧' },
    { key: 'middle', label: '中间' },
    { key: 'right', label: '右侧' },
    { key: 'unknown', label: '资料不足' },
  ];

  return (
    <main
      className="min-h-screen overflow-x-hidden bg-background text-foreground"
      style={
        {
          '--signal': active.accent,
          '--market-panel': active.panel,
        } as CSSProperties
      }
    >
      <header className="border-b border-[#26382e]/10">
        <div className="mx-auto flex min-h-16 max-w-[1380px] flex-wrap items-center justify-between gap-3 px-5 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-7 place-items-center rounded-full border border-[var(--signal)]/38">
              <LineChart
                className="size-3.5 text-[var(--signal)]"
                aria-hidden="true"
              />
            </div>
            <div>
              <div className="font-display text-[15px] tracking-[0.14em]">
                市场手记
              </div>
              <div className="font-mono text-xs tracking-[0.2em] text-[#26382e]/36">
                A股 · {report.date.slice(0, 4)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-sm tracking-[0.08em] text-[#26382e]/50">
            <CalendarDays className="size-3" aria-hidden="true" />
            <span>{report.date.replaceAll('-', '.')}</span>
            <span className="ml-1 size-1 rounded-full bg-[var(--signal)]" />
          </div>
        </div>
      </header>

      {active.valueAnalysis && (
        <PriceValue analysis={active.valueAnalysis} sources={active.sources} />
      )}

      <section id="guide" className="scroll-mt-4 bg-[#e7decd] text-[#26382e]">
        <div className="mx-auto max-w-[1380px] px-5 py-16 lg:px-8 lg:py-20">
          <div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
            <div>
              <SectionMark number="02" label="MARKET PENDULUM" />
              <h2 className="font-display mt-3 text-4xl tracking-[-0.06em] sm:text-5xl">
                市场钟摆
              </h2>
              <p className="mt-3 text-xs tracking-[0.05em] text-[#26382e]/48">
                原表20项完整保留 · 判断环境偏冷或偏热，不预测具体点位
              </p>
            </div>
            <fieldset className="flex flex-wrap gap-2" aria-label="指南筛选">
              {filterOptions.map((option) => {
                const count =
                  option.key === 'all'
                    ? active.guide.length
                    : active.guide.filter(
                        (item) =>
                          guideSide(
                            item.review.confidence === '无法判断'
                              ? null
                              : item.position,
                          ) === option.key,
                      ).length;
                const isActive = guideFilter === option.key;
                return (
                  <Button
                    key={option.key}
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-pressed={isActive}
                    onClick={() => setGuideFilter(option.key)}
                    className={
                      isActive
                        ? 'h-8 rounded-full border-[#26382e] bg-[#26382e] px-3 text-xs text-[#e7decd] hover:bg-[#26382e]/90'
                        : 'h-8 rounded-full border-[#26382e]/15 bg-transparent px-3 text-xs text-[#26382e]/48 hover:bg-[#26382e]/5 hover:text-[#26382e]'
                    }
                  >
                    {option.label}
                    <span className="font-mono text-xs opacity-45">
                      {count}
                    </span>
                  </Button>
                );
              })}
            </fieldset>
          </div>

          <div className="mt-9 border-y border-[#26382e]/14">
            <Table className="min-w-[940px]">
              <TableHeader>
                <TableRow className="border-[#26382e]/12 hover:bg-transparent">
                  <TableHead className="w-[170px] px-2 font-mono text-xs tracking-[0.16em] text-[#26382e]/40">
                    指标
                  </TableHead>
                  <TableHead className="px-2 font-mono text-xs tracking-[0.16em] text-[#26382e]/40">
                    左极 · 当前位置 · 右极
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGuide.map((item) => {
                  const side = guideSide(
                    item.review.confidence === '无法判断'
                      ? null
                      : item.position,
                  );
                  const meta =
                    side === 'left'
                      ? { color: '#557663', wash: '#d9e4d6' }
                      : side === 'right'
                        ? { color: '#a85f56', wash: '#ead7d1' }
                        : { color: '#687c92', wash: '#dbe0e4' };
                  return (
                    <TableRow
                      key={item.category}
                      className="border-[#26382e]/9 hover:bg-[#26382e]/[0.025]"
                    >
                      <TableCell className="px-2 py-5 align-top">
                        <p className="text-xs font-medium text-[#26382e]/62">
                          {item.category}
                        </p>
                        <p className="mt-2 font-mono text-xs text-[#26382e]/30">
                          信心 {item.review.confidence}
                        </p>
                        <p className="mt-2 text-sm text-[#526358]">
                          {item.review.status}
                        </p>
                      </TableCell>
                      <TableCell className="px-2 py-5">
                        <div className="grid grid-cols-2 gap-10 text-sm leading-relaxed text-[#26382e]/60">
                          <span className="max-w-[320px]">{item.leftPole}</span>
                          <span className="ml-auto max-w-[360px] text-right">
                            {item.rightPole}
                          </span>
                        </div>
                        {item.position !== null &&
                        item.review.confidence !== '无法判断' ? (
                          <div className="relative mb-7 mt-3 h-1.5 rounded-full bg-gradient-to-r from-[#9fb79c]/55 via-[#b7b4a5]/45 to-[#c59a8d]/50">
                            <span className="absolute inset-y-[-3px] left-1/2 w-px bg-[#26382e]/18" />
                            <span
                              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                              style={{ left: `${item.position}%` }}
                            >
                              <span
                                className="block size-3 rounded-full border-[3px] border-[#e7decd] shadow-[0_0_0_1px_rgba(38,56,46,0.12)]"
                                style={{ backgroundColor: meta.color }}
                              />
                            </span>
                            <span
                              className="absolute top-4 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-sm font-medium tracking-[0.04em] shadow-[0_1px_0_rgba(38,56,46,0.06)]"
                              style={{
                                left: `${item.position}%`,
                                color: meta.color,
                                backgroundColor: meta.wash,
                              }}
                            >
                              {item.current}
                            </span>
                          </div>
                        ) : (
                          <p className="my-4 text-base text-[#85543c]">
                            资料不足 · 暂不定位
                          </p>
                        )}
                        <div className="mt-4 flex items-start justify-between gap-5 border-t border-[#26382e]/7 pt-3">
                          <p className="max-w-3xl text-sm leading-5 text-[#26382e]/46">
                            {item.basis}
                          </p>
                          <SourceRefs
                            ids={item.refs}
                            sources={active.sources}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-[1380px] px-5 py-16 lg:px-8 lg:py-20">
          <div className="flex items-end justify-between gap-5">
            <div>
              <SectionMark number="03" label="EVIDENCE" />
              <h2 className="font-display mt-3 text-4xl tracking-[-0.06em] text-[#26382e]">
                关键数据
              </h2>
            </div>
            <Scale className="hidden size-5 text-[#26382e]/28 sm:block" />
          </div>

          <div className="mt-8 grid border-l border-t border-[#26382e]/10 sm:grid-cols-2 xl:grid-cols-4">
            {active.evidence.map((item) => (
              <div
                key={item.label}
                className="border-b border-r border-[#26382e]/10 px-4 py-6"
                style={{ '--tone': item.tone } as CSSProperties}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-[#26382e]/40">{item.label}</p>
                  <SourceRefs ids={item.refs} sources={active.sources} />
                </div>
                <p className="mt-3 font-display text-2xl tracking-[-0.04em] text-[var(--tone)]">
                  {item.value}
                </p>
                <p className="mt-1 font-mono text-xs text-[#26382e]/34">
                  {item.note}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs tracking-[0.18em] text-[#26382e]/36">
                PREPARE, DON&apos;T PREDICT
              </p>
              <h3 className="font-display mt-2 text-2xl tracking-[-0.04em] text-[#26382e]/82">
                准备，不预测
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-sm text-[#26382e]/36">条件变，攻守才变。</p>
              <SourceRefs ids={['HM-02', 'HM-06']} sources={active.sources} />
            </div>
          </div>

          <div className="mt-5 grid gap-px overflow-hidden border border-[#26382e]/10 bg-[#26382e]/7 sm:grid-cols-3">
            {active.triggers.map(([tag, copy, color]) => (
              <div
                key={tag}
                className="flex items-center justify-between gap-6 bg-[#eee7d9] px-6 py-6"
              >
                <div>
                  <span
                    className="font-mono text-xs tracking-[0.16em]"
                    style={{ color }}
                  >
                    {tag}
                  </span>
                  <p className="font-display mt-2 text-lg leading-relaxed text-[#26382e]/82">
                    {copy}
                  </p>
                </div>
                <ArrowRight
                  className="size-4 shrink-0 text-[#26382e]/30"
                  aria-hidden="true"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-[#26382e]/10 bg-[#e9e1d2]">
        <div className="mx-auto max-w-[1380px] px-5 py-10 lg:px-8">
          <div className="flex flex-col justify-between gap-5 border-b border-[#26382e]/10 pb-7 lg:flex-row lg:items-end">
            <div>
              <p className="font-display text-base text-[#26382e]/72">
                参考资料 · {active.label}
              </p>
              <p className="mt-2 max-w-xl text-sm leading-5 text-[#26382e]/36">
                正文引用均链接至原始资料。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-[#26382e]/34">
              <a
                href="https://www.acgnx.top/market/"
                className="transition-colors hover:text-[#26382e]/66"
              >
                周报目录
              </a>
              <a
                href="./weekly-market-prompt.md"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 transition-colors hover:text-[#26382e]/66"
              >
                每周更新提示词
                <ExternalLink className="size-2.5" aria-hidden="true" />
              </a>
              <span>框架判断，不是投资建议。</span>
            </div>
          </div>

          <details className="mt-6">
            <summary className="cursor-pointer text-sm text-[#526452]">
              全部参考资料（{active.sources.length}）
            </summary>
            <div className="mt-7 grid gap-7 lg:grid-cols-3">
              {(['方法框架', '一手数据', '交叉验证'] as const).map((tier) => (
                <div key={tier}>
                  <p className="font-mono text-xs tracking-[0.16em] text-[#26382e]/36">
                    {tier}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                    {active.sources
                      .filter((source) => source.tier === tier)
                      .map((source) => (
                        <a
                          key={source.id}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-[#26382e]/42 transition-colors hover:text-[#26382e]/72"
                        >
                          <span className="font-mono text-xs text-[var(--signal)]/70">
                            {source.id}
                          </span>
                          {source.label}
                          <ExternalLink
                            className="size-2.5"
                            aria-hidden="true"
                          />
                        </a>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      </footer>
    </main>
  );
}
