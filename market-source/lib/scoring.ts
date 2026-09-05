export type ObservationStatus = 'verified' | 'lagged' | 'proxy' | 'missing';
export type MetricRule = {
  id: string;
  group: number;
  label: string;
  weight: number;
  unit: string;
  window: string;
  knots: number[];
  inverse?: boolean;
  maxAgeDays: number;
};

export const METHOD_VERSION = 'sentiment-v2';
export const statusLabels: Record<ObservationStatus, string> = {
  verified: '已核验',
  lagged: '正常滞后',
  proxy: '代理指标',
  missing: '数据缺失',
};

// These are a fixed editorial rubric, not thresholds fitted to predict returns.
// Each knot maps to 0/25/50/75/100; interpolate and clamp outside the range.
export const metricRules: MetricRule[] = [
  {
    id: 'return20d',
    group: 0,
    label: '基准20交易日价格回报',
    weight: 12.5,
    unit: '%',
    window: '沪深300 / 标普500；同一价格指数连续20交易日',
    knots: [-10, -5, 0, 5, 10],
    maxAgeDays: 4,
  },
  {
    id: 'breadth50d',
    group: 0,
    label: '高于50日均线的成分股占比',
    weight: 12.5,
    unit: '%',
    window: '同一基准当期成分股；披露停牌及缺历史样本的分母',
    knots: [10, 30, 50, 70, 90],
    maxAgeDays: 4,
  },
  {
    id: 'fundFlow',
    group: 1,
    label: '本国股票基金周净流入 / 期初资产',
    weight: 25 / 3,
    unit: '%',
    window: '共同基金与ETF合并，严格去重；最新一周；缺资产分母则缺失',
    knots: [-0.5, -0.25, 0, 0.25, 0.5],
    maxAgeDays: 21,
  },
  {
    id: 'turnover',
    group: 1,
    label: '成交活跃度',
    weight: 25 / 3,
    unit: '倍',
    window:
      '最近5交易日平均成交额 / 此前60交易日平均；沪深两市 / NYSE+Nasdaq同口径',
    knots: [0.5, 0.75, 1, 1.25, 1.5],
    maxAgeDays: 4,
  },
  {
    id: 'leverage',
    group: 1,
    label: '杠杆余额变化',
    weight: 25 / 3,
    unit: '%',
    window:
      'A股融资余额20交易日变化 / 美国FINRA借方余额月环比；各自周度沿用最新发布值',
    knots: [-10, -5, 0, 5, 10],
    maxAgeDays: 75,
  },
  {
    id: 'volatility',
    group: 2,
    label: '波动率历史分位（反向）',
    weight: 10,
    unit: '百分位',
    window: '沪深300价格20日实现波动率 / VIX；各自过去3年、至少504个日值',
    knots: [0, 25, 50, 75, 100],
    inverse: true,
    maxAgeDays: 4,
  },
  {
    id: 'credit',
    group: 2,
    label: '信用利差历史分位（反向）',
    weight: 10,
    unit: '百分位',
    window:
      '中债10年AAA中票减10年国债 / ICE BofA US HY OAS；各自过去3年、至少504个日值',
    knots: [0, 25, 50, 75, 100],
    inverse: true,
    maxAgeDays: 4,
  },
  {
    id: 'valuation',
    group: 3,
    label: '估值历史分位',
    weight: 7.5,
    unit: '百分位',
    window: '沪深300滚动PE / 标普500未来12个月PE；各自过去5年、至少36个月末值',
    knots: [0, 25, 50, 75, 100],
    maxAgeDays: 10,
  },
  {
    id: 'concentration',
    group: 3,
    label: '前十大成分股权重历史分位',
    weight: 7.5,
    unit: '百分位',
    window: '各自基准当期权重；过去5年、至少36个月末值；月度更新',
    knots: [0, 25, 50, 75, 100],
    maxAgeDays: 45,
  },
  {
    id: 'survey',
    group: 4,
    label: '投资者看多减看空',
    weight: 7.5,
    unit: '百分点',
    window:
      'A股须预先锁定连续公开调查并升版本 / 美国AAII；最新调查，不混机构问卷',
    knots: [-40, -20, 0, 20, 40],
    maxAgeDays: 14,
  },
  {
    id: 'options',
    group: 4,
    label: '看涨 / 看跌期权成交比',
    weight: 7.5,
    unit: '倍',
    window:
      '沪深300ETF期权 / SPX期权；20交易日成交量之和的比值，披露具体合约集合',
    knots: [0.5, 0.75, 1, 1.25, 1.5],
    maxAgeDays: 4,
  },
];

export type Observation = {
  id: string;
  value: number | null;
  status: ObservationStatus;
  observedAt: string | null;
  publishedAt: string | null;
  retrievedAt: string;
  refs: string[];
  definition: string;
  note: string;
};

export function metricScore(rule: MetricRule, value: number) {
  if (!Number.isFinite(value)) throw new Error('Metric value must be finite');
  let result = value <= rule.knots[0] ? 0 : 100;
  for (let i = 1; i < rule.knots.length; i++) {
    if (value > rule.knots[i - 1] && value <= rule.knots[i]) {
      result =
        (i - 1) * 25 +
        ((value - rule.knots[i - 1]) / (rule.knots[i] - rule.knots[i - 1])) *
          25;
      break;
    }
  }
  return rule.inverse ? 100 - result : result;
}

export function scoreSentiment(observations: Observation[], cutoff: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) throw new Error('Invalid cutoff');
  const seen = new Set<string>();
  let coverage = 0,
    weighted = 0;
  const groupCoverage = [0, 0, 0, 0, 0];
  const rows = metricRules.map((rule) => {
    const matches = observations.filter((o) => o.id === rule.id);
    if (matches.length > 1)
      throw new Error(`Duplicate observation: ${rule.id}`);
    const o = matches[0];
    if (!o)
      return { ...rule, score: null, effectiveWeight: 0, status: 'missing' };
    seen.add(o.id);
    if (!Object.hasOwn(statusLabels, o.status))
      throw new Error(`Invalid status: ${o.id}`);
    if (o.value !== null && !Number.isFinite(o.value))
      throw new Error(`Invalid value: ${o.id}`);
    for (const date of [o.observedAt, o.publishedAt, o.retrievedAt])
      if (
        date !== null &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          !Number.isFinite(Date.parse(date)) ||
          new Date(date).toISOString().slice(0, 10) !== date)
      )
        throw new Error(`Invalid observation date: ${o.id}`);
    if (
      o.value !== null &&
      (rule.unit === '百分位' || rule.id === 'breadth50d') &&
      (o.value < 0 || o.value > 100)
    )
      throw new Error(`Invalid percentage: ${o.id}`);
    if (o.value !== null && rule.unit === '倍' && o.value < 0)
      throw new Error(`Invalid ratio: ${o.id}`);
    if (o.status === 'missing' && o.value !== null)
      throw new Error(`Missing data cannot carry a value: ${o.id}`);
    if (
      (o.publishedAt && o.publishedAt > cutoff) ||
      (o.observedAt && o.observedAt > cutoff)
    )
      throw new Error(`Future information: ${o.id}`);
    const direct = o.status === 'verified' || o.status === 'lagged';
    if (
      direct &&
      (o.value === null ||
        !o.publishedAt ||
        !o.observedAt ||
        !o.refs.length ||
        !o.definition ||
        !o.retrievedAt)
    )
      throw new Error(`Incomplete verified observation: ${o.id}`);
    const age = o.observedAt
      ? (Date.parse(cutoff) - Date.parse(o.observedAt)) / 86400000
      : Infinity;
    if (direct && (!Number.isFinite(age) || age > rule.maxAgeDays || age < 0))
      throw new Error(`Stale observation: ${o.id}`);
    // Unapproved substitutions cannot silently become observations or neutral 50s.
    const score = direct ? metricScore(rule, o.value!) : null;
    if (score !== null) {
      coverage += rule.weight;
      weighted += score * rule.weight;
      groupCoverage[rule.group] += rule.weight;
    }
    return {
      ...rule,
      score,
      effectiveWeight: direct ? rule.weight : 0,
      status: o.status,
    };
  });
  if (observations.some((o) => !seen.has(o.id)))
    throw new Error('Unknown metric id');
  const eligible =
    coverage >= 70 - 1e-8 && groupCoverage.slice(0, 3).every((v) => v > 0);
  return {
    methodVersion: METHOD_VERSION,
    score: eligible ? Math.round(weighted / coverage) : null,
    coverage: Math.round(coverage * 100) / 100,
    range: [
      Math.floor(weighted / 100 + 1e-9),
      Math.ceil((weighted + (100 - coverage) * 100) / 100 - 1e-9),
    ] as [number, number],
    comparable: eligible && Math.abs(coverage - 100) < 1e-8,
    rows: rows.map((r) => ({
      ...r,
      effectiveWeight: coverage ? (r.effectiveWeight / coverage) * 100 : 0,
    })),
  };
}

export function canCompare(
  current: { methodVersion: string; observations: Observation[] },
  previous: { methodVersion: string; observations: Observation[] },
) {
  if (
    current.methodVersion !== previous.methodVersion ||
    current.methodVersion !== METHOD_VERSION
  )
    return false;
  return metricRules.every((rule) => {
    const a = current.observations.find((o) => o.id === rule.id);
    const b = previous.observations.find((o) => o.id === rule.id);
    return (
      !!a &&
      !!b &&
      ['verified', 'lagged'].includes(a.status) &&
      ['verified', 'lagged'].includes(b.status) &&
      a.definition === b.definition
    );
  });
}
