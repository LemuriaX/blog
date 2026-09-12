export type MarketKey = 'cn' | 'us';
type MarketRecords<T> = { cn: T; us?: T };
export type GuideSide = 'left' | 'middle' | 'right' | 'unknown';
export type GuideFilter = 'all' | GuideSide;
export type WeeklyReport = {
  schemaVersion: number;
  date: string;
  label: string;
  title: string;
  revision: number;
  canonicalRevision?: number;
  originalRetained?: boolean;
  revisedAt?: string;
  revisionReason?: string;
  methodVersion: string;
  nextMethodVersion?: string;
  comparison?: { comparable: boolean; reason: string };
  informationCutoff: MarketRecords<string>;
  marketSessions?: MarketRecords<{
    close: string;
    cutoff: string;
    timezone: string;
  }>;
  history: {
    date: string;
    label: string;
    cnSentiment: number | null;
    usSentiment: number | null;
    cnCycle: number | null;
    usCycle: number | null;
  };
  markets: MarketRecords<MarketData>;
  sentiment?: MarketRecords<
    Array<{
      label: string;
      weight: number;
      score: number;
      note: string;
      refs: string[];
      status: string;
      confidence: string;
      limitation: string;
    }>
  >;
  observations?: MarketRecords<import('./scoring').Observation[]>;
  reading?: MarketRecords<{
    changes: Array<{
      label: string;
      title: string;
      text: string;
      refs: string[];
    }>;
    conditionReview: Array<{
      condition: string;
      status: string;
      evidence: string;
      refs: string[];
    }>;
    missingImpact: string;
  }>;
};
export type Confidence = '高' | '中' | '低' | '无法判断';

export type Source = {
  id: string;
  label: string;
  url: string;
  tier: '方法框架' | '一手数据' | '交叉验证';
  observedAt?: string | null;
  publishedAt?: string | null;
  retrievedAt?: string;
  period?: string;
  availability?: string;
};

export type GuideItem = {
  category: string;
  current: string;
  leftPole: string;
  rightPole: string;
  position: number | null;
  review: { status: string; confidence: Confidence; note: string };
  basis: string;
  confidence: Confidence;
  refs: string[];
};

export type MarketData = {
  valueAnalysis?: ValueAnalysis;
  label: string;
  code: string;
  stage?: string;
  regime?: string;
  cycleStage?: string;
  cycleRange?: [number, number];
  cyclePhase?: string;
  cyclePhaseNote?: string;
  cycleReason?: string;
  cycleRefs?: string[];
  hero?: string;
  heroAccent?: string;
  summary?: string;
  posture?: string;
  treatment?: string;
  score?: number;
  accent: string;
  panel: string;
  signals?: Array<{
    name: string;
    value: number | null;
    label: string;
    note: string;
    icon: 'activity' | 'capital' | 'psychology' | 'price';
  }>;
  indices?: Array<{
    name: string;
    value: string;
    change: string;
    note: string;
    up: boolean;
  }>;
  crossChecks?: Array<{
    tag: string;
    title: string;
    text: string;
    refs: string[];
    tone: string;
  }>;
  guide: GuideItem[];
  styleMap?: Array<{
    name: string;
    certainty: number;
    cushion: number;
    posture: string;
    tone: string;
  }>;
  actions: Array<[string, string]>;
  defenseScore?: number;
  defenseLabel?: string;
  defenseReason?: string;
  evidence: Array<{
    label: string;
    value: string;
    note: string;
    tone: string;
    refs: string[];
  }>;
  triggers: Array<[string, string, string]>;
  sources: Source[];
};

export type ValueAnalysis = {
  valuationDate: string;
  scopeNote: string;
  methodNote: string;
  benchmarks: Array<{
    code: string;
    name: string;
    samples: number;
    pe: number | null;
    pb: number | null;
    dividendYield: number | null;
    scope: string;
    refs: string[];
  }>;
  cases: Array<{
    id: string;
    title: string;
    verdict: string;
    metric: string;
    support: { text: string; refs: string[] };
    challenge: { text: string; refs: string[] };
    resolution: string;
    limitation: string;
    watch: string;
    presentation: {
      name: string;
      certainty: string;
      cushion: string;
      posture: string;
    };
  }>;
  stance: {
    label: string;
    reason: string;
    refs: string[];
    actions: Array<[string, string]>;
  };
  stress: {
    benchmarkCode: string;
    entryPe: number;
    years: number;
    defaultGrowth: number;
    defaultExitPe: number;
    refs: string[];
  };
  conflicts: Array<{ title: string; text: string; refs: string[] }>;
  researchFile: string;
};
