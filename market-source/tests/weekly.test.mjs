import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  metricRules,
  metricScore,
  scoreSentiment,
  canCompare,
} from '../lib/scoring.ts';
import {
  sourceRoot,
  validateReport,
  reportsAndHistory,
  prepare,
  archive,
  files,
  safePath,
  renderIndex,
} from '../scripts/weekly.mjs';

const cutoff = '2026-09-04';
const observations = () =>
  metricRules.map((r) => ({
    id: r.id,
    value: r.knots[2],
    status: 'verified',
    observedAt: cutoff,
    publishedAt: cutoff,
    retrievedAt: '2026-09-06',
    refs: ['TEST-01'],
    definition: r.window,
    note: 'Synthetic test data, never published',
  }));
const clone = (value) => structuredClone(value);
const report = () =>
  JSON.parse(
    fs.readFileSync(
      path.join(sourceRoot, 'data/reports/2026-09-04.json'),
      'utf8',
    ),
  );
test('fixed anchors interpolate, reverse and clamp', () => {
  const r = metricRules.find((r) => r.id === 'return20d');
  assert.equal(metricScore(r, 4), 70);
  assert.equal(metricScore(r, 8), 90);
  assert.equal(metricScore(r, 25), 100);
  assert.equal(
    metricScore(
      metricRules.find((r) => r.id === 'credit'),
      10,
    ),
    90,
  );
  const result = scoreSentiment(observations(), cutoff);
  assert.equal(result.coverage, 100);
  assert.equal(result.score, 50);
  assert.deepEqual(result.range, [50, 50]);
});
test('missing and proxies do not become neutral observations', () => {
  const o = observations();
  o.at(-1).status = 'missing';
  o.at(-1).value = null;
  o.at(-2).status = 'proxy';
  const result = scoreSentiment(o, cutoff);
  assert.equal(result.coverage, 85);
  assert.equal(result.score, 50);
  assert.deepEqual(result.range, [42, 58]);
  assert.equal(result.comparable, false);
  assert.equal(result.rows.at(-2).effectiveWeight, 0);
});
test('coverage and essential group gates suppress unsupported totals', () => {
  const o = observations().filter(
    (o) => !['return20d', 'breadth50d'].includes(o.id),
  );
  assert.equal(scoreSentiment(o, cutoff).coverage, 75);
  assert.equal(scoreSentiment(o, cutoff).score, null);
  assert.equal(scoreSentiment(observations().slice(0, 4), cutoff).score, null);
});
test('future, stale, duplicate and malformed data are rejected', () => {
  const variants = [
    (o) => (o[0].publishedAt = '2026-09-05'),
    (o) => (o[0].observedAt = '2026-08-01'),
    (o) => o.push(clone(o[0])),
    (o) => (o[0].publishedAt = null),
    (o) => (o[0].status = 'missing'),
    (o) => (o[0].retrievedAt = 'bad'),
    (o) => (o[1].value = 120),
  ];
  for (const mutate of variants) {
    const o = observations();
    mutate(o);
    assert.throws(() => scoreSentiment(o, cutoff));
  }
});
test('history comparison requires matching full measurement definitions', () => {
  const a = { methodVersion: 'sentiment-v2', observations: observations() };
  const b = clone(a);
  assert.equal(canCompare(a, b), true);
  b.observations[0].definition = 'changed universe';
  assert.equal(canCompare(a, b), false);
  assert.equal(
    canCompare(a, { methodVersion: 'legacy-v1', observations: [] }),
    false,
  );
});
test('real report preserves original dates and definitions', () => {
  validateReport(report());
  const { history } = reportsAndHistory();
  assert.ok(history.length >= 2);
  assert.deepEqual(
    history.slice(0, 2).map((r) => [r.date, r.cnSentiment, r.usSentiment]),
    [
      ['2026-08-28', 66, 73],
      ['2026-09-04', 64, 67],
    ],
  );
  const invalid = report();
  invalid.markets.cn.guide.pop();
  assert.throws(() => validateReport(invalid));
  const future = report();
  future.markets.us.sources.find((s) => s.id === 'US-01').publishedAt =
    '2026-09-05';
  assert.throws(() => validateReport(future));
});
test('archive interpolation escapes content and preserves original links', () => {
  const { history } = reportsAndHistory();
  history.at(-1).title = '<img src=x onerror=alert(1)>';
  const html = renderIndex(
    fs.readFileSync(path.join(sourceRoot, 'archive/template.html'), 'utf8'),
    history,
  );
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('./2026-09-04/'));
  assert.ok(html.includes('./2026-09-04/revisions/02/'));
  assert.throws(() => safePath(sourceRoot, '../outside'));
});

function fixture() {
  const parent = path.join(sourceRoot, 'work/weekly-test-runs');
  fs.mkdirSync(parent, { recursive: true });
  const workspace = fs.mkdtempSync(path.join(parent, 'run-'));
  const root = path.join(workspace, 'source');
  fs.mkdirSync(root);
  for (const name of [
    'app',
    'components',
    'hooks',
    'lib',
    'data',
    'pages',
    'public',
    'archive',
    'scripts',
    'tests',
    'package.json',
    'package-lock.json',
    'vite.config.ts',
    'vite.pages.config.ts',
    'postcss.config.mjs',
    'WEEKLY_MARKET_PROMPT.md',
    'WORKFLOW.md',
    'tsconfig.weekly.json',
  ])
    fs.cpSync(path.join(sourceRoot, name), path.join(root, name), {
      recursive: true,
    });
  const repo = path.join(workspace, 'repo'),
    localRoot = path.join(workspace, 'local');
  for (const archiveRoot of [localRoot, path.join(repo, 'market')])
    for (const date of ['2026-08-28', '2026-09-04']) {
      const dir = path.join(archiveRoot, date);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'index.html'),
        `untouched original ${date}`,
      );
    }
  return { root, repo, localRoot };
}
async function fakeBuild(f) {
  await prepare(cutoff, f.root);
  const dir = path.join(f.root, 'dist-pages');
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.cpSync(path.join(f.root, 'public'), dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'index.html'),
    '<script src="./assets/test.js"></script><link href="./assets/test.css">',
  );
  fs.writeFileSync(path.join(dir, 'assets/test.js'), '/* test */');
  fs.writeFileSync(path.join(dir, 'assets/test.css'), '/* test */');
}
test('prepare is idempotent; changing a historical score is blocked', async () => {
  const f = fixture();
  await prepare(cutoff, f.root);
  const before = fs.readFileSync(path.join(f.root, 'lib/market-history.ts'));
  await prepare(cutoff, f.root);
  assert.deepEqual(
    fs.readFileSync(path.join(f.root, 'lib/market-history.ts')),
    before,
  );
  const p = path.join(f.root, 'data/legacy-history.json');
  const baseline = JSON.parse(fs.readFileSync(p));
  baseline[0].cnSentiment = 10;
  fs.writeFileSync(p, JSON.stringify(baseline));
  await assert.rejects(() => prepare(cutoff, f.root), /historical/);
});
test('partial copy resumes, repeat succeeds, old snapshots stay identical', async () => {
  const f = fixture();
  await fakeBuild(f);
  const partial = path.join(f.localRoot, '2026-09-04/revisions/02/assets');
  fs.mkdirSync(partial, { recursive: true });
  fs.copyFileSync(
    path.join(f.root, 'dist-pages/assets/test.js'),
    path.join(partial, 'test.js'),
  );
  const first = archive(cutoff, f),
    second = archive(cutoff, f);
  assert.equal(first.artifactFiles, second.artifactFiles);
  for (const base of [f.localRoot, path.join(f.repo, 'market')])
    assert.equal(
      fs.readFileSync(path.join(base, '2026-09-04/index.html'), 'utf8'),
      'untouched original 2026-09-04',
    );
  for (const local of files(path.join(f.localRoot, first.route))) {
    const relative = path.relative(f.localRoot, local);
    assert.deepEqual(
      fs.readFileSync(local),
      fs.readFileSync(path.join(f.repo, 'market', relative)),
    );
  }
});
test('conflicts and stale source refuse publication before changing latest', async () => {
  const f = fixture();
  await fakeBuild(f);
  const latest = path.join(f.localRoot, 'latest/index.html');
  fs.mkdirSync(path.dirname(latest), { recursive: true });
  fs.writeFileSync(latest, 'old latest');
  const conflict = path.join(
    f.repo,
    'market/2026-09-04/revisions/02/assets/test.js',
  );
  fs.mkdirSync(path.dirname(conflict), { recursive: true });
  fs.writeFileSync(conflict, 'different existing bytes');
  assert.throws(() => archive(cutoff, f), /conflict/);
  assert.equal(fs.readFileSync(latest, 'utf8'), 'old latest');
  fs.appendFileSync(path.join(f.root, 'app/page.tsx'), '\n// source changed');
  assert.throws(() => archive(cutoff, f), /Source changed/);
  assert.equal(fs.readFileSync(latest, 'utf8'), 'old latest');
});
