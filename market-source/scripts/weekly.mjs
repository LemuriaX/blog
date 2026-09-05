import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { scoreSentiment, canCompare, METHOD_VERSION } from '../lib/scoring.ts';

export const sourceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const json = (file) =>
  JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const digest = (value) =>
  crypto.createHash('sha256').update(value).digest('hex');
const read = (file) => fs.readFileSync(file);
const fail = (message) => {
  throw new Error(message);
};
const assert = (condition, message) => {
  if (!condition) fail(message);
};
const iso = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(value).toISOString().slice(0, 10) === value;
const score = (value) =>
  value === null || (Number.isFinite(value) && value >= 0 && value <= 100);
const escape = (value) =>
  String(value ?? '—').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
export function safePath(root, relative) {
  const result = path.resolve(root, relative);
  assert(
    result.startsWith(path.resolve(root) + path.sep),
    'Path escapes the selected archive',
  );
  return result;
}
export function files(root) {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .flatMap((e) => {
      assert(!e.isSymbolicLink(), 'Symlink not allowed in artifact');
      const p = path.join(root, e.name);
      return e.isDirectory() ? files(p) : [p];
    })
    .sort();
}
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file) && read(file).equals(Buffer.from(value))) return;
  fs.writeFileSync(file, value);
}
const reportPath = (root, date) => safePath(root, `data/reports/${date}.json`);
export const routeFor = (report) =>
  report.revision === 1
    ? `${report.date}/`
    : `${report.date}/revisions/${String(report.revision).padStart(2, '0')}/`;
const historyKeys = ['cnSentiment', 'usSentiment', 'cnCycle', 'usCycle'];

export function validateReport(report, root = sourceRoot) {
  assert(report.schemaVersion === 2, 'Unsupported report schema');
  assert(iso(report.date), 'Invalid report date');
  assert(
    Number.isInteger(report.revision) && report.revision >= 1,
    'Invalid revision',
  );
  assert(
    report.revision === 1 || (iso(report.revisedAt) && report.revisionReason),
    'Revision needs date and reason',
  );
  assert(
    report.history.date === report.date,
    'History date differs from report',
  );
  assert(
    report.methodVersion === 'legacy-v1' ||
      report.methodVersion === METHOD_VERSION,
    'Unknown method version',
  );
  assert(
    report.methodVersion !== 'legacy-v1' || report.date === '2026-09-04',
    'Legacy scoring is only retained for the existing report',
  );
  const schema = json(path.join(root, 'data/guide-schema.json'));
  for (const key of ['cn', 'us']) {
    const market = report.markets[key];
    assert(
      iso(report.informationCutoff[key]) &&
        report.informationCutoff[key] <= report.date,
      'Invalid information cutoff',
    );
    assert(
      score(market.score) &&
        market.score !== null &&
        score(market.defenseScore) &&
        market.defenseScore !== null,
      'Invalid judgment score',
    );
    assert(
      Array.isArray(market.cycleRange) &&
        market.cycleRange.length === 2 &&
        market.cycleRange.every(score) &&
        market.cycleRange[0] <= market.score &&
        market.cycleRange[1] >= market.score,
      'Cycle range must contain midpoint',
    );
    assert(
      report.methodVersion === 'legacy-v1' || market.score % 5 === 0,
      'New cycle midpoints must use five-point steps',
    );
    assert(
      market.guide.length === 20,
      'Expected exactly 20 guide rows per market',
    );
    const ids = new Set(market.sources.map((s) => s.id));
    assert(ids.size === market.sources.length, 'Duplicate source ID');
    for (const s of market.sources) {
      assert(/^https?:\/\//.test(s.url), 'Source needs direct URL');
      for (const field of ['observedAt', 'publishedAt'])
        if (s[field])
          assert(
            iso(s[field]) && s[field] <= report.informationCutoff[key],
            `Future or invalid source date: ${s.id}`,
          );
      if (s.retrievedAt) assert(iso(s.retrievedAt), 'Invalid retrieval date');
    }
    const refs = (value) => {
      if (!value || typeof value !== 'object') return;
      for (const [k, v] of Object.entries(value)) {
        if ((k === 'refs' || k === 'cycleRefs') && Array.isArray(v))
          v.forEach((id) => assert(ids.has(id), `Unknown source ${id}`));
        else refs(v);
      }
    };
    refs(market);
    refs(report.reading[key]);
    refs(report.sentiment[key]);
    market.guide.forEach((g, i) => {
      assert(
        ['category', 'leftPole', 'rightPole'].every(
          (k) => g[k] === schema[i][k],
        ),
        `Guide definition changed at ${i + 1}`,
      );
      assert(score(g.position), 'Invalid guide position');
      assert(
        ['高', '中', '低', '无法判断'].includes(g.review?.confidence) &&
          g.review?.status &&
          g.review?.note,
        'Guide review is incomplete',
      );
      assert(g.basis && g.refs.length, 'Guide needs evidence and sources');
    });
    assert(
      report.reading[key].changes.length === 3 &&
        report.reading[key].conditionReview.length > 0,
      'Weekly brief or prior conditions missing',
    );
    assert(market.actions.length === 4, 'Four action categories required');
    assert(
      report.history[`${key}Cycle`] === market.score,
      'Cycle differs from historical record',
    );
    if (report.methodVersion === 'legacy-v1') {
      const c = report.sentiment[key];
      assert(
        c.length === 5 &&
          JSON.stringify(c.map((x) => x.weight)) === '[25,25,20,15,15]',
        'Legacy weights changed',
      );
      assert(
        c.every((x) => score(x.score) && x.score !== null),
        'Invalid component score',
      );
      assert(
        Math.round(c.reduce((n, x) => n + (x.weight * x.score) / 100, 0)) ===
          report.history[`${key}Sentiment`],
        'Sentiment arithmetic mismatch',
      );
    } else {
      const observations = report.observations?.[key];
      assert(Array.isArray(observations), 'v2 needs raw observations');
      refs(observations);
      const result = scoreSentiment(
        observations,
        report.informationCutoff[key],
      );
      assert(
        result.score === report.history[`${key}Sentiment`],
        'v2 score differs from computed result',
      );
    }
  }
  assert(
    historyKeys.every((k) => score(report.history[k])),
    'Invalid history score',
  );
  return report;
}

export function reportsAndHistory(root = sourceRoot) {
  const reports = files(path.join(root, 'data/reports'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const r = validateReport(json(f), root);
      assert(
        path.basename(f) === `${r.date}.json`,
        'Report filename/date mismatch',
      );
      return r;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const history = json(path.join(root, 'data/legacy-history.json')).map(
    (r) => ({ ...r, comparable: false }),
  );
  for (const [i, r] of reports.entries()) {
    const previous = reports[i - 1];
    const comparable =
      !!previous &&
      ['cn', 'us'].every((key) =>
        canCompare(
          {
            methodVersion: r.methodVersion,
            observations: r.observations?.[key] ?? [],
          },
          {
            methodVersion: previous.methodVersion,
            observations: previous.observations?.[key] ?? [],
          },
        ),
      );
    history.push({
      ...r.history,
      methodVersion: r.methodVersion,
      comparable,
      route: routeFor(r),
      revision: r.revision,
      title: r.title,
    });
  }
  history.sort((a, b) => a.date.localeCompare(b.date));
  assert(
    new Set(history.map((r) => r.date)).size === history.length,
    'Duplicate weekly date',
  );
  assert(
    history.every((r) => iso(r.date) && historyKeys.every((k) => score(r[k]))),
    'Invalid historical entry',
  );
  return { reports, history };
}

export function sourceFingerprint(root = sourceRoot) {
  const roots = ['app', 'components', 'hooks', 'lib', 'data', 'pages'];
  const paths = roots
    .flatMap((r) => files(path.join(root, r)))
    .concat(
      [
        'package.json',
        'package-lock.json',
        'vite.config.ts',
        'vite.pages.config.ts',
        'postcss.config.mjs',
        'WEEKLY_MARKET_PROMPT.md',
      ].map((p) => path.join(root, p)),
    );
  return digest(
    paths
      .sort((a, b) => a.localeCompare(b))
      .map(
        (p) =>
          `${path.relative(root, p).replaceAll('\\', '/')}\0${digest(read(p))}`,
      )
      .join('\n'),
  );
}

export function renderIndex(template, history) {
  const latest = history.at(-1);
  const metrics = [
    ['A股周期', latest.cnCycle],
    ['A股情绪', latest.cnSentiment],
    ['美股周期', latest.usCycle],
    ['美股情绪', latest.usSentiment],
  ]
    .map(
      ([label, v]) =>
        `<div class="metric"><span>${label}</span><strong>${escape(v)}</strong></div>`,
    )
    .join('\n');
  const card = `<a class="latest" href="./${escape(latest.route)}"><time datetime="${latest.date}">${latest.date.replaceAll('-', '.')}${latest.revision > 1 ? ' · 阅读修订版' : ''}</time><h2>${escape(latest.title ?? '本周市场手记')}</h2><div class="metrics">${metrics}</div><div class="card-foot"><span>数据截止日 · 保留原始历史分</span><b>阅读本期 →</b></div></a>`;
  const rows = history
    .slice()
    .reverse()
    .map(
      (r) =>
        `<li><a href="./${escape(r.route)}"><time datetime="${r.date}">${r.date.replaceAll('-', '.')}</time><span>A股 周期${escape(r.cnCycle)} / 情绪${escape(r.cnSentiment)} · 美股 周期${escape(r.usCycle)} / 情绪${escape(r.usSentiment)}</span><em>${r.revision > 1 ? `修订${r.revision}` : '原版'}</em></a>${r.revision > 1 ? `<a href="./${r.date}/" class="original-link">查看 ${r.date} 原版 →</a>` : ''}</li>`,
    )
    .join('\n');
  assert(
    template.includes('<ol>') && template.includes('<a class="latest"'),
    'Invalid archive template',
  );
  return template
    .replace(/<a class="latest"[\s\S]*?<\/a>/, card)
    .replace(/<ol>[\s\S]*?<\/ol>/, `<ol>\n${rows}\n</ol>`);
}

export async function prepare(date, root = sourceRoot) {
  const { reports, history } = reportsAndHistory(root);
  const report = reports.find((r) => r.date === date);
  assert(report, 'Selected report not found');
  assert(
    history.at(-1).date === date,
    'Prepare only the newest report; use revisions for existing current reports',
  );
  const historyFile = path.join(root, 'lib/market-history.ts');
  if (fs.existsSync(historyFile)) {
    const { marketHistory: old } = await import(
      pathToFileURL(historyFile).href + `?check=${Date.now()}`
    );
    for (const o of old) {
      const next = history.find((r) => r.date === o.date);
      assert(
        next && historyKeys.every((k) => next[k] === o[k]),
        `Refusing to alter historical scores: ${o.date}`,
      );
    }
  }
  const historical = history.map(
    ({
      date,
      label,
      cnSentiment,
      usSentiment,
      cnCycle,
      usCycle,
      methodVersion,
      comparable,
    }) => ({
      date,
      label,
      cnSentiment,
      usSentiment,
      cnCycle,
      usCycle,
      methodVersion,
      comparable,
    }),
  );
  write(
    historyFile,
    `// Generated from data/reports and immutable legacy history.\nexport type WeeklyMarketSnapshot = {date:string;label:string;cnSentiment:number|null;usSentiment:number|null;cnCycle:number;usCycle:number;methodVersion:string;comparable:boolean};\nexport const marketHistory: WeeklyMarketSnapshot[] = ${JSON.stringify(historical, null, 2)};\n`,
  );
  write(
    path.join(root, 'lib/current-report.ts'),
    `// Generated by scripts/weekly.mjs; edit data/reports instead.\nimport report from '../data/reports/${date}.json';\nimport type { WeeklyReport } from './market-types';\nexport const currentReport = report as unknown as WeeklyReport;\n`,
  );
  const formatter = path.join(sourceRoot, 'node_modules/oxfmt/bin/oxfmt');
  execFileSync(
    process.execPath,
    [formatter, historyFile, path.join(root, 'lib/current-report.ts')],
    { cwd: root, stdio: 'pipe' },
  );
  const index = renderIndex(
    fs.readFileSync(path.join(root, 'archive/template.html'), 'utf8'),
    history,
  );
  const route = routeFor(report);
  const latest = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=../${route}"><title>最新市场手记</title><a href="../${route}">阅读最新一期 ${date}</a></html>\n`;
  write(path.join(root, 'archive/index.html'), index);
  write(path.join(root, 'archive/latest/index.html'), latest);
  write(
    path.join(root, 'public/weekly-market-prompt.md'),
    read(path.join(root, 'WEEKLY_MARKET_PROMPT.md')),
  );
  write(
    path.join(root, 'public/report-data.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  const meta = {
    date,
    revision: report.revision,
    methodVersion: report.methodVersion,
    inputHash: digest(JSON.stringify(report)),
    sourceHash: sourceFingerprint(root),
    promptHash: digest(read(path.join(root, 'WEEKLY_MARKET_PROMPT.md'))),
  };
  write(
    path.join(root, 'public/report-meta.json'),
    JSON.stringify(meta, null, 2) + '\n',
  );
  return { report, history, route, meta };
}

export function preflight(date, repo, root = sourceRoot) {
  assert(iso(date), 'Use --date YYYY-MM-DD');
  const [major, minor] = process.versions.node.split('.').map(Number);
  assert(major > 22 || (major === 22 && minor >= 13), 'Node >=22.13 required');
  assert(
    fs.existsSync(path.join(root, 'node_modules/typescript/package.json')),
    'Install project dependencies first',
  );
  const result = { node: process.versions.node, date, sourceRoot: root };
  if (repo) {
    const git = (...a) =>
      execFileSync('git', a, { cwd: repo, encoding: 'utf8' }).trim();
    assert(
      git('remote', 'get-url', 'origin').replace(/\.git$/, '') ===
        'https://github.com/LemuriaX/blog',
      'Unexpected publishing repository',
    );
    git('fetch', 'origin', 'main');
    result.head = git('rev-parse', 'HEAD');
    result.remote = git('rev-parse', 'origin/main');
    assert(
      result.head === result.remote,
      'Remote moved: integrate in a clean checkout before publishing',
    );
    result.dirty = git('status', '--porcelain').length > 0;
    result.authentication =
      'Git push or authorized GitHub connector must be checked by the publishing agent; this command does not prove write access.';
  }
  return result;
}

function artifactPlan(build, targets) {
  const entries = files(build).map((f) => ({
    path: path.relative(build, f).replaceAll('\\', '/'),
    bytes: fs.statSync(f).size,
    sha256: digest(read(f)),
    source: f,
  }));
  for (const target of targets) {
    for (const e of entries) {
      const p = safePath(target, e.path);
      if (fs.existsSync(p))
        assert(
          digest(read(p)) === e.sha256,
          `Immutable snapshot conflict: ${p}`,
        );
    }
    for (const p of files(target)) {
      const relative = path.relative(target, p).replaceAll('\\', '/');
      if (relative === 'manifest.json' || relative.startsWith('revisions/'))
        continue;
      assert(
        entries.some((e) => e.path === relative),
        `Unexpected existing artifact: ${p}`,
      );
    }
  }
  return entries;
}

export function archive(date, { repo, localRoot, root = sourceRoot }) {
  assert(repo, 'archive requires --repo');
  const { reports, history } = reportsAndHistory(root);
  const report = reports.find((r) => r.date === date);
  assert(report, 'Report not found');
  assert(history.at(-1).date === date, 'Only newest report may update latest');
  const build = path.join(root, 'dist-pages');
  const meta = json(path.join(build, 'report-meta.json'));
  assert(
    meta.date === date && meta.revision === report.revision,
    'Build belongs to a different report/revision',
  );
  assert(
    meta.inputHash === digest(JSON.stringify(report)),
    'Build contains stale report input',
  );
  assert(
    meta.sourceHash === sourceFingerprint(root),
    'Source changed since prepare/build',
  );
  assert(
    meta.promptHash ===
      digest(read(path.join(build, 'weekly-market-prompt.md'))) &&
      meta.promptHash ===
        digest(read(path.join(root, 'WEEKLY_MARKET_PROMPT.md'))),
    'Stale prompt in build',
  );
  const html = fs.readFileSync(path.join(build, 'index.html'), 'utf8');
  const assets = [
    ...html.matchAll(/(?:src|href)="(\.\/assets\/[^"?#]+)"/g),
  ].map((m) => m[1]);
  assert(
    assets.some((x) => x.endsWith('.js')) &&
      assets.some((x) => x.endsWith('.css')),
    'Missing JS/CSS entry',
  );
  assets.forEach((a) =>
    assert(fs.existsSync(path.join(build, a)), 'Missing build asset'),
  );
  const local = path.resolve(localRoot ?? path.join(root, 'weekly-reports'));
  const remote = path.resolve(repo, 'market');
  assert(local !== remote, 'Local archive and repository archive must differ');
  const route = routeFor(report);
  const targets = [safePath(local, route), safePath(remote, route)];
  const prior = Object.fromEntries(
    [local, remote]
      .flatMap((d) =>
        files(d).filter((p) =>
          /^\d{4}-\d{2}-\d{2}\//.test(
            path.relative(d, p).replaceAll('\\', '/'),
          ),
        ),
      )
      .map((p) => [p, digest(read(p))]),
  );
  for (const d of [local, remote])
    for (const h of history.filter((h) => h.date !== date))
      assert(
        fs.existsSync(safePath(d, h.route + 'index.html')),
        `Archive link missing: ${h.route}`,
      );
  const entries = artifactPlan(build, targets);
  const manifest = {
    ...meta,
    route,
    files: entries.map(({ source: _source, ...e }) => e),
  };
  for (const target of targets) {
    const m = path.join(target, 'manifest.json');
    if (fs.existsSync(m))
      assert(
        JSON.stringify(json(m)) === JSON.stringify(manifest),
        'Manifest conflicts with immutable snapshot',
      );
  }
  // All conflicts are checked before any copies. Partial copies can be resumed.
  for (const target of targets) {
    for (const e of entries) {
      const p = safePath(target, e.path);
      if (!fs.existsSync(p)) write(p, read(e.source));
      assert(digest(read(p)) === e.sha256, 'Copied artifact checksum mismatch');
    }
    write(
      path.join(target, 'manifest.json'),
      JSON.stringify(manifest, null, 2) + '\n',
    );
  }
  for (const [p, hash] of Object.entries(prior))
    assert(digest(read(p)) === hash, `Old snapshot changed: ${p}`);
  const index = read(path.join(root, 'archive/index.html'));
  const latest = read(path.join(root, 'archive/latest/index.html'));
  assert(
    index.includes(Buffer.from(`./${route}`)) &&
      latest.includes(Buffer.from(`../${route}`)),
    'Stale archive entry; run prepare',
  );
  for (const d of [local, remote]) {
    write(path.join(d, 'index.html'), index);
    write(path.join(d, 'latest/index.html'), latest);
    write(
      path.join(d, 'weekly-market-prompt.md'),
      read(path.join(root, 'WEEKLY_MARKET_PROMPT.md')),
    );
  }
  const sourcePaths = [
    'app',
    'lib',
    'data',
    'scripts',
    'tests',
    'public',
    'pages',
    'archive',
    'components/market-review.tsx',
    'package.json',
    'WEEKLY_MARKET_PROMPT.md',
    'WORKFLOW.md',
    'tsconfig.weekly.json',
    'vite.pages.config.ts',
    'postcss.config.mjs',
  ];
  for (const relative of sourcePaths) {
    const p = path.join(root, relative);
    if (fs.statSync(p).isDirectory())
      for (const f of files(p))
        write(
          path.join(repo, 'market-source', path.relative(root, f)),
          read(f),
        );
    else write(path.join(repo, 'market-source', relative), read(p));
  }
  return {
    date,
    route,
    artifactFiles: entries.length,
    preservedFiles: Object.keys(prior).length,
    local,
    remote,
  };
}

export async function verifyOnline(
  date,
  { base = 'https://www.acgnx.top/market/', localRoot, root = sourceRoot },
) {
  const report = validateReport(json(reportPath(root, date)), root);
  const route = routeFor(report);
  const local = path.resolve(localRoot ?? path.join(root, 'weekly-reports'));
  const snapshot = safePath(local, route);
  const paths = [
    'index.html',
    'latest/index.html',
    ...files(snapshot).map(
      (p) => route + path.relative(snapshot, p).replaceAll('\\', '/'),
    ),
  ];
  const checks = await Promise.all(
    paths.map(async (relative) => {
      const url = new URL(relative, base.endsWith('/') ? base : base + '/');
      const response = await fetch(url, {
        headers: { 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(30000),
      });
      assert(response.ok, `HTTP ${response.status}: ${url}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const hash = digest(bytes);
      assert(
        hash === digest(read(safePath(local, relative))),
        `Online bytes differ: ${relative}`,
      );
      const mime = response.headers.get('content-type') ?? '';
      if (relative.endsWith('.js'))
        assert(/javascript/.test(mime), 'Incorrect JS MIME');
      if (relative.endsWith('.css'))
        assert(/text\/css/.test(mime), 'Incorrect CSS MIME');
      return { path: relative, sha256: hash, mime };
    }),
  );
  return { date, route, verified: checks.length, checks };
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    assert(
      /^--[a-z-]+$/.test(args[i]) && args[i + 1],
      'Expected --option value',
    );
    assert(
      ['--date', '--repo', '--local-root', '--base'].includes(args[i]),
      'Unknown option',
    );
    options[args[i].slice(2)] = args[i + 1];
  }
  const date = options.date;
  assert(iso(date), 'Use --date YYYY-MM-DD');
  const config = {
    repo: options.repo,
    localRoot: options['local-root'],
    base: options.base,
  };
  let result;
  if (command === 'preflight') result = preflight(date, options.repo);
  else if (command === 'validate') {
    const { reports, history } = reportsAndHistory();
    assert(
      reports.some((r) => r.date === date),
      'Selected report not found',
    );
    result = {
      date,
      reports: reports.length,
      history: history.length,
      valid: true,
    };
  } else if (command === 'prepare') {
    const { route, meta } = await prepare(date);
    result = { date, route, meta };
  } else if (command === 'archive') result = archive(date, config);
  else if (command === 'verify-online')
    result = await verifyOnline(date, config);
  else fail('Commands: preflight, validate, prepare, archive, verify-online');
  console.log(JSON.stringify(result, null, 2));
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
