import type { ValueAnalysis, Source } from './market-types.ts';
import { valuationScenario } from './value-math.ts';

export function validateValueAnalysis(
  value: ValueAnalysis | undefined,
  cutoff: string,
  sources: Source[],
) {
  function requireValue(
    condition: unknown,
    message: string,
  ): asserts condition {
    if (!condition) throw new Error(`Price/value: ${message}`);
  }
  requireValue(value, 'analysis required');
  requireValue(
    /^\d{4}-\d{2}-\d{2}$/.test(value.valuationDate) &&
      value.valuationDate <= cutoff,
    'invalid or future valuation date',
  );
  requireValue(
    value.scopeNote && value.methodNote,
    'method and scope required',
  );
  requireValue(
    value.benchmarks.length >= 2,
    'multiple valuation benchmarks required',
  );
  requireValue(
    new Set(value.benchmarks.map((b) => b.code)).size ===
      value.benchmarks.length,
    'duplicate benchmark',
  );
  for (const b of value.benchmarks) {
    requireValue(
      Number.isInteger(b.samples) && b.samples > 0 && b.scope,
      'sample definition required',
    );
    requireValue(
      [b.pe, b.pb, b.dividendYield].every(
        (v) => v === null || (Number.isFinite(v) && v >= 0),
      ),
      'invalid valuation metric',
    );
    requireValue(
      b.refs.length &&
        b.refs.every((id) => {
          const source = sources.find((s) => s.id === id);
          return (
            source?.tier === '一手数据' &&
            source.observedAt === value.valuationDate
          );
        }),
      'benchmark needs primary source with matching observation date',
    );
  }
  requireValue(value.cases.length >= 3, 'multiple asset cases required');
  requireValue(
    new Set(value.cases.map((c) => c.id)).size === value.cases.length,
    'duplicate case',
  );
  for (const c of value.cases) {
    requireValue(
      c.support.text &&
        c.support.refs.length &&
        c.challenge.text &&
        c.challenge.refs.length,
      'support and counterevidence required',
    );
    requireValue(
      c.verdict && c.resolution && c.limitation && c.watch,
      'verdict, limitation and follow-up required',
    );
  }
  const benchmark = value.benchmarks.find(
    (b) => b.code === value.stress.benchmarkCode,
  );
  requireValue(
    benchmark && benchmark.pe === value.stress.entryPe,
    'scenario entry PE differs from cited benchmark',
  );
  requireValue(
    value.stress.years === 3,
    'current scenario display requires three years',
  );
  requireValue(
    [-10, 0, 10, 20, 30, 40].includes(value.stress.defaultGrowth) &&
      [30, 40, 50, 60, 79.82, 100].includes(value.stress.defaultExitPe),
    'scenario default unavailable in controls',
  );
  valuationScenario(
    value.stress.entryPe,
    value.stress.defaultExitPe,
    value.stress.defaultGrowth,
    value.stress.years,
  );
  requireValue(
    value.conflicts.length > 0 &&
      value.conflicts.every((c) => c.title && c.text && c.refs.length),
    'unresolved issues required',
  );
  requireValue(
    value.researchFile === './price-value-research.md',
    'research link must point to the bundled artifact',
  );
}
