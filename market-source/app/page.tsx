'use client';

import { useState, type CSSProperties } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  ExternalLink,
  Landmark,
  LineChart,
  Scale,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { GuideSide, GuideFilter, Source } from '@/lib/market-types';
import { currentReport as report } from '@/lib/current-report';
const icons = {
  activity: Activity,
  capital: CircleDollarSign,
  psychology: Sparkles,
  price: Landmark,
};

function guideSide(position: number | null): GuideSide {
  if (position === null) return 'unknown';
  if (position <= 40) return 'left';
  if (position >= 60) return 'right';
  return 'middle';
}

function SourceRefs({ ids, sources }: { ids: string[]; sources: Source[] }) {
  return (
    <span className="inline-flex flex-wrap gap-x-1.5 gap-y-1">
      {ids.map((id) => {
        const source = sources.find((item) => item.id === id);
        if (!source) return null;
        return (
          <a
            key={id}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            title={source.label}
            className="font-mono text-xs tracking-[0.04em] text-[var(--signal)]/76 underline decoration-[var(--signal)]/22 underline-offset-4 transition-colors hover:text-[var(--signal)]"
          >
            {id}
          </a>
        );
      })}
    </span>
  );
}

function CycleGauge({
  score,
  color,
  stage,
  range,
  phase,
  phaseNote,
}: {
  score: number;
  color: string;
  stage: string;
  range: [number, number];
  phase: string;
  phaseNote: string;
}) {
  const arcLength = 251.4;
  const progress = (score / 100) * arcLength;

  return (
    <div
      className="mx-auto w-full max-w-[360px]"
      aria-label={`${stage}，周期位置 ${score}`}
    >
      <div className="relative">
        <svg viewBox="0 0 240 138" className="h-auto w-full">
          <title>周期位置</title>
          <path
            d="M 32 118 A 88 88 0 0 1 208 118"
            fill="none"
            stroke="rgba(38,56,46,.12)"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <path
            d="M 32 118 A 88 88 0 0 1 208 118"
            fill="none"
            stroke={color}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${progress} ${arcLength}`}
            className="transition-all duration-700 ease-out"
          />
          {[0, 50, 100].map((tick, index) => {
            const angle = Math.PI - (index * Math.PI) / 2;
            const x = 120 + Math.cos(angle) * 105;
            const y = 118 - Math.sin(angle) * 105;
            return (
              <text
                key={tick}
                x={x}
                y={y}
                textAnchor="middle"
                fill="rgba(38,56,46,.38)"
                fontSize="8"
                className="font-mono"
              >
                {tick}
              </text>
            );
          })}
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <div className="font-display text-[48px] leading-none tracking-[-0.09em] text-[#26382e]">
            {range[0]}—{range[1]}
          </div>
          <div className="mt-1 font-mono text-xs tracking-[0.22em] text-[#26382e]/42">
            合理区间 · 中值 {score}
          </div>
        </div>
      </div>

      <div className="mt-7">
        <div className="flex justify-between font-mono text-xs tracking-[0.08em] text-[#26382e]/38">
          <span>0 · 本轮起点</span>
          <span>100 · 本轮末期</span>
        </div>
        <div className="relative mt-2 h-1.5 rounded-full bg-[#26382e]/10">
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-[var(--signal)]/60"
            style={{ width: `${score}%` }}
          />
          <span
            className="absolute inset-y-[-3px] rounded-full border border-[var(--signal)]/28 bg-[var(--market-panel)]/50"
            style={{
              left: `${range[0]}%`,
              width: `${range[1] - range[0]}%`,
            }}
          />
          <span
            className="absolute top-1/2 block size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[var(--market-panel)] bg-[var(--signal)] shadow-[0_0_0_1px_rgba(38,56,46,0.14)]"
            style={{ left: `${score}%` }}
          />
        </div>
        <div className="mt-4 border-t border-[#26382e]/9 pt-4">
          <p className="font-display text-base text-[#26382e]/78">{phase}</p>
          <p className="mt-1 text-sm leading-5 text-[#26382e]/44">
            {phaseNote}
          </p>
        </div>
      </div>
    </div>
  );
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

      <section className="relative border-b border-[#26382e]/10">
        <div className="pointer-events-none absolute inset-y-0 left-[8%] w-px bg-[#26382e]/[0.035]" />
        <div className="pointer-events-none absolute inset-y-0 right-[8%] w-px bg-[#26382e]/[0.035]" />
        <div className="mx-auto grid max-w-[1380px] gap-12 px-5 py-12 lg:grid-cols-[1.12fr_.88fr] lg:px-8 lg:py-12">
          <div className="flex min-w-0 flex-col justify-between">
            <div>
              <Badge className="mb-8 h-6 border border-[var(--signal)]/28 bg-[var(--signal)]/8 px-2.5 font-mono text-xs tracking-[0.16em] text-[var(--signal)] hover:bg-[var(--signal)]/8">
                {active.code} / {active.stage}
              </Badge>
              <h1 className="font-display max-w-4xl text-[clamp(2.5rem,4.2vw,4.5rem)] font-medium leading-[1.05] tracking-[-0.06em] text-[#26382e]">
                {active.hero}
                <span className="mt-2 block italic text-[var(--signal)]">
                  {active.heroAccent}
                </span>
              </h1>
              <p className="font-display mt-10 max-w-2xl text-xl leading-relaxed tracking-[0.02em] text-[#26382e]/68 sm:text-2xl">
                {active.summary}
              </p>
            </div>
            <div className="mt-10 max-w-2xl border-l border-[var(--signal)]/36 pl-4">
              <div className="flex items-center gap-3 text-xs text-[var(--signal)]">
                <ShieldCheck className="size-4" />
                <span>{active.posture}</span>
              </div>
              <p className="mt-2 text-xs leading-6 text-[#26382e]/50">
                {active.treatment}
              </p>
            </div>
          </div>

          <Card className="relative gap-0 rounded-[38px_8px_38px_8px] bg-[var(--market-panel)] py-0 ring-1 ring-white/70">
            <span className="pointer-events-none absolute right-6 top-6 size-2 border-r border-t border-[#26382e]/18" />
            <CardHeader className="flex-row items-start justify-between border-b border-[#26382e]/9 px-6 py-5">
              <div>
                <p className="font-mono text-xs tracking-[0.18em] text-[#26382e]/40">
                  MARKET REGIME
                </p>
                <p className="font-display mt-1 text-2xl text-[#26382e]/84">
                  {active.regime}
                </p>
              </div>
              <Badge className="border border-[var(--signal)]/24 bg-[var(--signal)]/8 text-sm font-normal text-[var(--signal)] hover:bg-[var(--signal)]/8">
                {active.cycleStage}
              </Badge>
            </CardHeader>
            <CardContent className="px-6 pb-7 pt-6">
              <CycleGauge
                score={active.score}
                color={active.accent}
                stage={active.cycleStage}
                range={active.cycleRange}
                phase={active.cyclePhase}
                phaseNote={active.cyclePhaseNote}
              />
              <div className="mt-7 border-t border-[#26382e]/10 pt-5">
                <p className="text-sm leading-5 text-[#26382e]/52">
                  {active.cycleReason}
                </p>
                <div className="mt-3">
                  <SourceRefs ids={active.cycleRefs} sources={active.sources} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-[1380px] px-5 py-12 lg:px-8 lg:py-12">
        <div className="mb-7 flex items-end justify-between">
          <div>
            <SectionMark number="01" label="TEMPERATURE" />
            <h2 className="font-display mt-3 text-3xl tracking-[-0.05em] text-[#26382e]">
              四个温度计
            </h2>
            <p className="mt-2 text-sm text-[#26382e]/36">
              高分代表更热，不代表更好。
            </p>
          </div>
          <a
            href="#guide"
            className="hidden items-center gap-2 font-mono text-xs tracking-[0.12em] text-[#26382e]/40 transition-colors hover:text-[#26382e]/70 sm:flex"
          >
            20项扫描 <ArrowRight className="size-3" />
          </a>
        </div>

        <div className="grid border-l border-t border-[#26382e]/10 sm:grid-cols-2 xl:grid-cols-4">
          {active.signals.map((signal) => {
            const Icon = icons[signal.icon];
            return (
              <div
                key={signal.name}
                className="border-b border-r border-[#26382e]/10 p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[#26382e]/58">
                    <Icon className="size-3.5" aria-hidden="true" />
                    {signal.name}
                  </div>
                  <span className="font-mono text-sm text-[#26382e]/38">
                    {signal.value ?? '—'}
                  </span>
                </div>
                <div className="mt-7 flex items-end justify-between gap-4">
                  <strong className="font-display text-3xl font-normal text-[#26382e]/90">
                    {signal.label}
                  </strong>
                  <span className="mb-1 text-sm text-[#26382e]/40">
                    {signal.note}
                  </span>
                </div>
                {signal.value !== null && (
                  <Progress
                    value={signal.value}
                    aria-label={`${signal.name} ${signal.value} 分`}
                    className="mt-5 gap-0 [&_[data-slot=progress-indicator]]:bg-[var(--signal)] [&_[data-slot=progress-track]]:h-px [&_[data-slot=progress-track]]:bg-[#26382e]/7"
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="grid border-x border-b border-[#26382e]/10 sm:grid-cols-4">
          {active.indices.map((index) => (
            <div
              key={index.name}
              className="border-b border-[#26382e]/8 px-5 py-4 last:border-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[#26382e]/40">{index.name}</span>
                <span className="font-mono text-xs text-[#26382e]/28">
                  {index.note}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="font-mono text-sm text-[#26382e]/78">
                  {index.value}
                </span>
                <span
                  className={
                    index.up
                      ? 'text-sm text-[var(--signal)]'
                      : 'text-sm text-[#b8796f]'
                  }
                >
                  {index.up ? (
                    <ArrowUpRight className="inline size-3" />
                  ) : (
                    <ArrowDownRight className="inline size-3" />
                  )}
                  {index.change}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

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

      <section className="border-b border-[#26382e]/10">
        <div className="mx-auto grid max-w-[1380px] gap-14 px-5 py-16 lg:grid-cols-[1.15fr_.85fr] lg:px-8 lg:py-20">
          <div>
            <SectionMark number="03" label="PRICE / VALUE" />
            <h2 className="font-display mt-3 text-4xl tracking-[-0.06em] text-[#26382e]">
              价格与价值
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="text-xs text-[#26382e]/42">
                确定性不是安全垫。好资产，也可能是坏价格。
              </p>
              <SourceRefs ids={['HM-04']} sources={active.sources} />
            </div>

            <div className="mt-7 border-t border-[#26382e]/11">
              {active.styleMap.map((row) => (
                <div
                  key={row.name}
                  className="grid gap-4 border-b border-[#26382e]/11 py-5 sm:grid-cols-[1.1fr_.9fr_.9fr_auto] sm:items-center"
                  style={{ '--row-tone': row.tone } as CSSProperties}
                >
                  <div className="flex items-center justify-between sm:block">
                    <h3 className="font-display text-lg text-[#26382e]/86">
                      {row.name}
                    </h3>
                    <span
                      className="text-xs sm:hidden"
                      style={{ color: row.tone }}
                    >
                      {row.posture}
                    </span>
                  </div>
                  <div>
                    <div className="mb-2 flex justify-between text-xs text-[#26382e]/40">
                      <span>确定性</span>
                      <span className="font-mono">{row.certainty}</span>
                    </div>
                    <Progress
                      value={row.certainty}
                      aria-label={`${row.name}确定性 ${row.certainty} 分`}
                      className="gap-0 [&_[data-slot=progress-indicator]]:bg-[var(--row-tone)] [&_[data-slot=progress-track]]:h-px [&_[data-slot=progress-track]]:bg-[#26382e]/7"
                    />
                  </div>
                  <div>
                    <div className="mb-2 flex justify-between text-xs text-[#26382e]/40">
                      <span>安全垫</span>
                      <span className="font-mono">{row.cushion}</span>
                    </div>
                    <Progress
                      value={row.cushion}
                      aria-label={`${row.name}安全垫 ${row.cushion} 分`}
                      className="gap-0 [&_[data-slot=progress-indicator]]:bg-[#26382e]/32 [&_[data-slot=progress-track]]:h-px [&_[data-slot=progress-track]]:bg-[#26382e]/7"
                    />
                  </div>
                  <span
                    className="hidden w-10 text-right text-xs sm:block"
                    style={{ color: row.tone }}
                  >
                    {row.posture}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Card className="self-start rounded-[8px_34px_8px_34px] bg-[var(--market-panel)] py-0 text-[#26382e] ring-0">
            <CardHeader className="border-b border-[#26382e]/12 px-7 py-6">
              <p className="font-mono text-xs tracking-[0.18em] text-[#26382e]/42">
                OFFENSE / DEFENSE
              </p>
              <h2 className="font-display mt-2 text-3xl tracking-[-0.06em]">
                攻守位置
              </h2>
            </CardHeader>
            <CardContent className="px-7 py-2">
              <div className="border-b border-[#26382e]/12 py-6">
                <div className="flex items-end justify-between gap-4">
                  <strong className="font-display text-2xl font-normal text-[#26382e]/82">
                    {active.defenseLabel}
                  </strong>
                  <span className="font-mono text-sm text-[var(--signal)]">
                    {active.defenseScore}
                  </span>
                </div>
                <div className="mt-4 flex justify-between font-mono text-xs text-[#26382e]/34">
                  <span>0 · 进攻</span>
                  <span>100 · 防守</span>
                </div>
                <div className="relative mt-2 h-1.5 rounded-full bg-[#26382e]/10">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-[var(--signal)]/56"
                    style={{ width: `${active.defenseScore}%` }}
                  />
                  <span
                    className="absolute top-1/2 block size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[var(--market-panel)] bg-[var(--signal)]"
                    style={{ left: `${active.defenseScore}%` }}
                  />
                </div>
                <p className="mt-4 text-base leading-7 text-[#26382e]/44">
                  {active.defenseReason}
                </p>
                <div className="mt-2">
                  <SourceRefs ids={['HM-06']} sources={active.sources} />
                </div>
              </div>
              {active.actions.map(([label, copy], index) => (
                <div
                  key={label}
                  className="grid grid-cols-[36px_1fr_auto] items-center gap-4 border-b border-[#26382e]/12 py-6 last:border-0"
                >
                  <span className="font-mono text-sm text-[#26382e]/48">
                    0{index + 1}
                  </span>
                  <p className="font-display text-lg leading-relaxed">
                    {label}：{copy}
                  </p>
                  <ArrowRight
                    className="size-4 text-[#26382e]/35"
                    aria-hidden="true"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-[1380px] px-5 py-16 lg:px-8 lg:py-20">
          <div className="flex items-end justify-between gap-5">
            <div>
              <SectionMark number="04" label="EVIDENCE" />
              <h2 className="font-display mt-3 text-4xl tracking-[-0.06em] text-[#26382e]">
                关键数据
              </h2>
            </div>
            <Scale className="hidden size-5 text-[#26382e]/28 sm:block" />
          </div>

          <div className="mt-8 grid border-l border-t border-[#26382e]/10 sm:grid-cols-3 xl:grid-cols-6">
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
                        <ExternalLink className="size-2.5" aria-hidden="true" />
                      </a>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}
