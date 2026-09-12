import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { valuationScenario } from '../lib/value-math.ts';
import {
  validateReport,
  reportsAndHistory,
  renderIndex,
} from '../scripts/weekly.mjs';
import { renderValueResearch } from '../scripts/value-research.mjs';

const report = () =>
  JSON.parse(
    fs.readFileSync(
      new URL('../data/reports/2026-09-11.json', import.meta.url),
    ),
  );
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('valuation scenarios preserve price/earnings identities', () => {
  near(valuationScenario(20, 20, 0, 3).total, 0);
  near(valuationScenario(20, 20, 10, 3).annualized, 10);
  near(valuationScenario(20, 10, 0, 3).total, -50);
  const breakEven = valuationScenario(79.82, 50, 20, 3).breakEvenGrowth;
  near(valuationScenario(79.82, 50, breakEven, 3).total, 0);
  assert.ok(valuationScenario(79.82, 50, 20, 3).total > 8);
  assert.ok(valuationScenario(79.82, 50, 20, 3).total < 9);
  assert.ok(valuationScenario(20, 20, -10, 3).total < 0);
  for (const args of [
    [0, 20, 0, 3],
    [20, -1, 0, 3],
    [20, 20, -100, 3],
    [20, 20, 0, 0],
    [20, 20, NaN, 3],
  ])
    assert.throws(() => valuationScenario(...args), RangeError);
});

test('value research rejects mismatched dates, missing counterevidence and unsupported scores', () => {
  validateReport(report());
  const changes = [
    (r) => (r.markets.cn.valueAnalysis.valuationDate = '2026-09-12'),
    (r) => (r.markets.cn.valueAnalysis.benchmarks[0].refs = ['CN-02']),
    (r) => (r.markets.cn.valueAnalysis.cases[0].challenge.refs = []),
    (r) => (r.markets.cn.valueAnalysis.stress.entryPe = 50),
    (r) => (r.markets.cn.valueAnalysis.cases[0].limitation = ''),
    (r) => (r.markets.cn.score = 50),
  ];
  for (const change of changes) {
    const r = report();
    change(r);
    assert.throws(() => validateReport(r));
  }
  assert.equal(
    report().markets.cn.valueAnalysis.benchmarks.find(
      (b) => b.code === '000922',
    ).pe,
    null,
  );
});

test('research publication rejects a stale input table and renders direct citations', () => {
  const r = report();
  const review = JSON.parse(
    fs.readFileSync(
      new URL('../data/inputs/2026-09-11/value-review.json', import.meta.url),
    ),
  );
  const markdown = renderValueResearch(r, review);
  assert.ok(
    markdown.includes(
      'https://static.cninfo.com.cn/finalpage/2026-08-15/1225475868.PDF',
    ),
  );
  assert.ok(markdown.includes('8.24%'));
  assert.ok(markdown.includes('2026-08-31'));
  review.valuation.benchmarks[0].pe = 10;
  assert.throws(() => renderValueResearch(r, review), /do not match/);
});

test('archive directory shows no cycle or defensive scores', () => {
  const html = renderIndex(
    fs.readFileSync(
      new URL('../archive/template.html', import.meta.url),
      'utf8',
    ),
    reportsAndHistory().history,
  );
  for (const label of ['A股周期', '攻守位置', '周期60', '温度计', '0进攻'])
    assert.ok(!html.includes(label));
  assert.ok(html.includes('./2026-09-11/revisions/03/'));
});
