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
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { marketHistory } from '@/lib/market-history';

type MarketKey = 'cn' | 'us';
type GuideSide = 'left' | 'middle' | 'right';
type GuideFilter = 'all' | GuideSide;
type Confidence = '高' | '中';

type Source = {
  id: string;
  label: string;
  url: string;
  tier: '方法框架' | '一手数据' | '交叉验证';
};

type GuideItem = {
  category: string;
  current: string;
  leftPole: string;
  rightPole: string;
  position: number;
  basis: string;
  confidence: Confidence;
  refs: string[];
};

type MarketData = {
  label: string;
  code: string;
  stage: string;
  regime: string;
  cycleStage: string;
  cycleRange: [number, number];
  cyclePhase: string;
  cyclePhaseNote: string;
  cycleReason: string;
  cycleRefs: string[];
  hero: string;
  heroAccent: string;
  summary: string;
  posture: string;
  treatment: string;
  score: number;
  accent: string;
  panel: string;
  signals: Array<{
    name: string;
    value: number;
    label: string;
    note: string;
    icon: typeof Activity;
  }>;
  indices: Array<{
    name: string;
    value: string;
    change: string;
    note: string;
    up: boolean;
  }>;
  crossChecks: Array<{
    tag: string;
    title: string;
    text: string;
    refs: string[];
    tone: string;
  }>;
  guide: GuideItem[];
  styleMap: Array<{
    name: string;
    certainty: number;
    cushion: number;
    posture: string;
    tone: string;
  }>;
  actions: Array<[string, string]>;
  defenseScore: number;
  defenseLabel: string;
  defenseReason: string;
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

const frameworkSources: Source[] = [
  {
    id: 'HM-01',
    label: '《投资最重要的事》｜哥伦比亚大学出版社',
    url: 'https://cup.columbia.edu/book/the-most-important-thing/9780231153683/',
    tier: '方法框架',
  },
  {
    id: 'HM-02',
    label: 'Howard Marks｜Taking the Temperature',
    url: 'https://www.oaktreecapital.com/insights/memo/taking-the-temperature',
    tier: '方法框架',
  },
  {
    id: 'HM-03',
    label: 'Howard Marks｜Bull Market Rhymes',
    url: 'https://www.oaktreecapital.com/docs/default-source/memos/bull-market-rhymes.pdf',
    tier: '方法框架',
  },
  {
    id: 'HM-04',
    label: 'Howard Marks｜The Calculus of Value',
    url: 'https://www.oaktreecapital.com/insights/memo/the-calculus-of-value',
    tier: '方法框架',
  },
  {
    id: 'HM-05',
    label: 'Howard Marks｜I Beg to Differ',
    url: 'https://www.oaktreecapital.com/insights/memo/i-beg-to-differ',
    tier: '方法框架',
  },
  {
    id: 'HM-06',
    label: 'Howard Marks｜Ruminating on Asset Allocation',
    url: 'https://www.oaktreecapital.com/insights/memo/ruminating-on-asset-allocation',
    tier: '方法框架',
  },
];

const cnData: MarketData = {
  label: 'A股',
  code: 'A · SHARE',
  stage: '资金热 / 经济冷',
  regime: '结构性牛市',
  cycleStage: '牛市中后段',
  cycleRange: [58, 70],
  cyclePhase: '第二阶段后半',
  cyclePhaseNote: '改善已被多数人看见，但还没人敢说“一切只会更好”。',
  cycleReason:
    '宽松、利润与成交支持上涨；高估值与拥挤说明已经过了起步期，但内需和基金热度尚未进入全面亢奋。',
  cycleRefs: ['CN-01', 'CN-03', 'CN-07', 'CN-08', 'HM-02', 'HM-03', 'HM-04'],
  hero: '结构行情',
  heroAccent: '不是全面牛市',
  summary: '钱不缺，需求仍弱。科技和出口撑住盈利，地产与消费拖住总量。',
  posture: '留在场内 · 不追拥挤',
  treatment:
    '核心仓继续持有；新增资金略偏防守，只为盈利兑现买单，不为热度加价。',
  score: 64,
  accent: '#718f72',
  panel: '#e4ead8',
  signals: [
    {
      name: '基本面',
      value: 56,
      label: '外强内弱',
      note: '内需拖后',
      icon: Activity,
    },
    {
      name: '资本供给',
      value: 82,
      label: '总量充足',
      note: '需求偏弱',
      icon: CircleDollarSign,
    },
    {
      name: '心理钟摆',
      value: 66,
      label: '偏向乐观',
      note: '科技拥挤',
      icon: Sparkles,
    },
    {
      name: '价格压力',
      value: 70,
      label: '热门偏贵',
      note: '价值分层',
      icon: Landmark,
    },
  ],
  indices: [
    {
      name: '上证',
      value: '3,952.18',
      change: '-0.11%',
      note: '08.28',
      up: false,
    },
    {
      name: '深证',
      value: '13,953.07',
      change: '-0.68%',
      note: '08.28',
      up: false,
    },
    {
      name: '创业板',
      value: '3,424.40',
      change: '-1.41%',
      note: '08.28',
      up: false,
    },
    {
      name: '成交',
      value: '2.12 万亿',
      change: '活跃',
      note: '全市场',
      up: true,
    },
  ],
  crossChecks: [
    {
      tag: '市场共识',
      title: '钱松，科技强',
      text: '工业利润、出口和成交都不弱，主流判断是结构行情还能延续。',
      refs: ['CN-01', 'CN-03', 'CN-08'],
      tone: '#718f72',
    },
    {
      tag: '价格已计入',
      title: '好消息不再便宜',
      text: '科创板估值约 125 倍。科技景气是真的，但市场已经为它付了高价。',
      refs: ['CN-07', 'HM-04'],
      tone: '#b98358',
    },
    {
      tag: '二层判断',
      title: '对方向，未必有好赔率',
      text: '消费、投资和地产仍弱。应买盈利超预期，不该只买人人看好的叙事。',
      refs: ['CN-01', 'CN-02', 'CN-03', 'HM-05'],
      tone: '#7e8fa1',
    },
    {
      tag: '仍不知道',
      title: '内需何时接棒',
      text: '信用宽松能否传到居民和地产，没有可靠时点。保留余地比猜日期重要。',
      refs: ['CN-04', 'CN-12', 'HM-01'],
      tone: '#b8796f',
    },
  ],
  guide: [
    {
      category: '经济现状',
      current: '外强内弱',
      leftPole: '生机勃勃',
      rightPole: '停滞不前',
      position: 62,
      basis: 'Q2 GDP +4.3%；PMI 49.2。出口、高技术尚强，消费和投资偏弱。',
      confidence: '高',
      refs: ['CN-01', 'CN-02'],
    },
    {
      category: '经济展望',
      current: '有托底，难加速',
      leftPole: '正面有利',
      rightPole: '负面不利',
      position: 56,
      basis: 'IMF 看 4.6%，世行看 4.4%；政策托底在，地产与居民需求仍是拖累。',
      confidence: '中',
      refs: ['CN-10', 'CN-11'],
    },
    {
      category: '贷款机构',
      current: '愿放，需求弱',
      leftPole: '急于放贷',
      rightPole: '缄默谨慎',
      position: 39,
      basis: 'M2 +7.7%，但前七月居民贷款净减 8271 亿元；供给比需求强。',
      confidence: '高',
      refs: ['CN-04', 'CN-12'],
    },
    {
      category: '资本市场',
      current: '交易宽松',
      leftPole: '宽松',
      rightPole: '紧缩',
      position: 22,
      basis: '8 月 28 日成交 2.12 万亿元，流动性没有收缩迹象。',
      confidence: '高',
      refs: ['CN-08'],
    },
    {
      category: '资本供给',
      current: '总量充足',
      leftPole: '充足',
      rightPole: '短缺',
      position: 18,
      basis: '社融存量 +7.4%，政府债和企业债仍在扩张。',
      confidence: '高',
      refs: ['CN-04'],
    },
    {
      category: '融资条款',
      current: '价格宽，信用分层',
      leftPole: '宽松',
      rightPole: '严格',
      position: 27,
      basis: 'LPR 仍低，但居民、地产和弱主体的信用需求明显弱于国企与政府端。',
      confidence: '中',
      refs: ['CN-05', 'CN-12'],
    },
    {
      category: '利率水平',
      current: '很低',
      leftPole: '低',
      rightPole: '高',
      position: 12,
      basis: '1 年 LPR 3.0%，5 年期以上 3.5%；十年国债约 1.69%。',
      confidence: '高',
      refs: ['CN-05', 'CN-06'],
    },
    {
      category: '利差水平',
      current: '很窄',
      leftPole: '窄',
      rightPole: '宽',
      position: 16,
      basis: '十年 AAA 中票约 2.09%，对国债利差约 40bp，风险定价不紧。',
      confidence: '高',
      refs: ['CN-06'],
    },
    {
      category: '投资者',
      current: '热，但会跑',
      leftPole: '乐观／自信／渴望买进',
      rightPole: '悲观／忧虑／无心买进',
      position: 30,
      basis:
        '两融余额仍在 2.6 万亿元高位，近期曾连续回落；风险偏好强，持仓并不稳。',
      confidence: '中',
      refs: ['CN-13'],
    },
    {
      category: '资产持有人',
      current: '仍愿意拿',
      leftPole: '乐于持有',
      rightPole: '急于卖出离场',
      position: 35,
      basis: '指数高位震荡而成交维持高位，尚未出现一致性离场。',
      confidence: '中',
      refs: ['CN-08'],
    },
    {
      category: '卖家',
      current: '高位轮动',
      leftPole: '稀少',
      rightPole: '众多',
      position: 44,
      basis: '三大指数回落但超过 3000 只股票上涨，卖压集中在拥挤方向。',
      confidence: '中',
      refs: ['CN-08'],
    },
    {
      category: '市场',
      current: '科技拥挤',
      leftPole: '人群拥挤',
      rightPole: '乏人问津',
      position: 24,
      basis: '科创板平均市盈率约 125 倍，远高于沪市主板约 14 倍。',
      confidence: '高',
      refs: ['CN-07'],
    },
    {
      category: '基金',
      current: '产品多，钱不挤',
      leftPole: '申购门槛高／每天都发新基金／基金管理人说了算',
      rightPole: '向所有人开放申购／只有最好的基金才能募资／基金投资人有话语权',
      position: 43,
      basis:
        '公募供给充足，但没有重现排队抢购。此项缺少高频一手口径，信心较低。',
      confidence: '中',
      refs: ['CN-09'],
    },
    {
      category: '近期业绩',
      current: '利润强，分布窄',
      leftPole: '强劲',
      rightPole: '萎靡',
      position: 29,
      basis: '工业利润 +17.6%；电子 +110%，但汽车 -20.4%，行业差异很大。',
      confidence: '高',
      refs: ['CN-03'],
    },
    {
      category: '资产价格',
      current: '结构偏高',
      leftPole: '高',
      rightPole: '低',
      position: 32,
      basis: '沪市整体 PE 17.43 倍尚可，科创板 124.62 倍已经不便宜。',
      confidence: '高',
      refs: ['CN-07'],
    },
    {
      category: '预期收益',
      current: '热门偏低',
      leftPole: '低',
      rightPole: '高',
      position: 28,
      basis: '高估值先透支未来回报；低估值板块仍有安全垫，不能一概而论。',
      confidence: '中',
      refs: ['CN-07'],
    },
    {
      category: '风险',
      current: '正在被低估',
      leftPole: '高',
      rightPole: '低',
      position: 31,
      basis: '利差很窄、杠杆交易高、热门估值贵；系统流动性暂时不紧。',
      confidence: '高',
      refs: ['CN-06', 'CN-07', 'CN-13', 'HM-01'],
    },
    {
      category: '流行风格',
      current: '追科技与主题',
      leftPole: '激进／四处投资',
      rightPole: '审慎且自律／精挑细选',
      position: 24,
      basis: '资金集中在高景气和高弹性方向，成交活跃但轮动很快。',
      confidence: '高',
      refs: ['CN-07', 'CN-08'],
    },
    {
      category: '正确风格',
      current: '价格纪律优先',
      leftPole: '审慎且自律／精挑细选',
      rightPole: '激进／四处投资',
      position: 22,
      basis: '盈利要兑现，价格要留余地；热门方向尤其需要安全边际。',
      confidence: '中',
      refs: ['CN-01', 'CN-03', 'CN-07', 'HM-04'],
    },
    {
      category: '易犯错误',
      current: '把好故事当好价格',
      leftPole: '买进太多／高价追涨／承受太多风险',
      rightPole: '买进太少／离开市场／承受太少风险',
      position: 20,
      basis: '钱多不等于需求强，好行业也不等于任何价格都值得买。',
      confidence: '中',
      refs: ['CN-01', 'CN-04', 'CN-12'],
    },
  ],
  styleMap: [
    {
      name: '高景气科技',
      certainty: 78,
      cushion: 22,
      posture: '精选',
      tone: '#b98358',
    },
    {
      name: '出口 / 制造',
      certainty: 74,
      cushion: 55,
      posture: '偏配',
      tone: '#6f9584',
    },
    {
      name: '大盘价值 / 红利',
      certainty: 68,
      cushion: 63,
      posture: '平衡',
      tone: '#718f72',
    },
    {
      name: '内需 / 地产链',
      certainty: 31,
      cushion: 46,
      posture: '观察',
      tone: '#b8796f',
    },
  ],
  actions: [
    ['可持', '盈利兑现的科技、出口龙头'],
    ['可等', '高估值回撤，宽基降温'],
    ['少碰', '只靠故事、弱现金流、地产拖累链'],
  ],
  defenseScore: 62,
  defenseLabel: '略偏防守',
  defenseReason: '不离场，但把新增资金留给价格回到价值附近的机会。',
  evidence: [
    {
      label: 'GDP',
      value: '+4.7%',
      note: '上半年',
      tone: '#b98358',
      refs: ['CN-01'],
    },
    {
      label: '零售',
      value: '+0.6%',
      note: '7月同比',
      tone: '#b8796f',
      refs: ['CN-01'],
    },
    {
      label: '固定投资',
      value: '-6.7%',
      note: '1—7月',
      tone: '#b8796f',
      refs: ['CN-01'],
    },
    {
      label: '工业利润',
      value: '+17.6%',
      note: '1—7月',
      tone: '#718f72',
      refs: ['CN-03'],
    },
    {
      label: 'M2',
      value: '+7.7%',
      note: '7月末',
      tone: '#6f9584',
      refs: ['CN-04'],
    },
    {
      label: '十年国债',
      value: '1.69%',
      note: '08.28',
      tone: '#7e8fa1',
      refs: ['CN-06'],
    },
  ],
  triggers: [
    ['更进攻', '消费、PMI、居民信贷一起回升', '#718f72'],
    ['维持', '利润扩张，成交不塌，利差仍窄', '#7e8fa1'],
    ['更防守', '盈利收窄，科技杀估值，成交退潮', '#b8796f'],
  ],
  sources: [
    ...frameworkSources,
    {
      id: 'CN-01',
      label: '国家统计局｜7月经济',
      url: 'https://www.stats.gov.cn/sj/zxfb/202608/t20260817_1965056.html',
      tier: '一手数据',
    },
    {
      id: 'CN-02',
      label: '国家统计局｜7月PMI',
      url: 'https://www.stats.gov.cn/zwfwck/sjfb/202607/t20260731_1964253.html',
      tier: '一手数据',
    },
    {
      id: 'CN-03',
      label: '国家统计局｜工业利润',
      url: 'https://www.stats.gov.cn/sj/zxfb/202608/t20260827_1965126.html',
      tier: '一手数据',
    },
    {
      id: 'CN-04',
      label: '新华社 / 央行｜金融数据',
      url: 'https://www.news.cn/20260814/6fa0381f296748b9b4cd6fb392dc3a70/c.html',
      tier: '一手数据',
    },
    {
      id: 'CN-05',
      label: '中国货币网｜LPR',
      url: 'https://www.chinamoney.com.cn/chinese/rdgz/20260720/3379021.html',
      tier: '一手数据',
    },
    {
      id: 'CN-06',
      label: '中债｜收益率曲线',
      url: 'https://yield.chinabond.com.cn/cbweb-pbc-web/pbc/more?locale=cn_zh',
      tier: '一手数据',
    },
    {
      id: 'CN-07',
      label: '上交所｜市场数据',
      url: 'https://www.sse.com.cn/',
      tier: '一手数据',
    },
    {
      id: 'CN-08',
      label: '新华财经｜8月28日收盘',
      url: 'https://www.cnfin.com/yw-lb/detail/20260828/4461881_1.html',
      tier: '一手数据',
    },
    {
      id: 'CN-09',
      label: '基金业协会｜公募数据',
      url: 'https://www.amac.org.cn/sjtj/tjbg/gmjj/',
      tier: '一手数据',
    },
    {
      id: 'CN-10',
      label: 'IMF｜7月全球展望',
      url: 'https://www.imf.org/en/publications/weo/issues/2026/07/08/world-economic-outlook-update-july-2026',
      tier: '交叉验证',
    },
    {
      id: 'CN-11',
      label: '世界银行｜中国经济简报',
      url: 'https://www.worldbank.org/en/news/press-release/2026/07/07/rebalancing-growth-china-economic-update',
      tier: '交叉验证',
    },
    {
      id: 'CN-12',
      label: '澎湃｜信用结构拆分',
      url: 'https://www.thepaper.cn/newsDetail_forward_33783788',
      tier: '交叉验证',
    },
    {
      id: 'CN-13',
      label: '证券时报｜两融变化',
      url: 'https://www.stcn.com/article/detail/4138103.html',
      tier: '交叉验证',
    },
  ],
};

const usData: MarketData = {
  label: '美股',
  code: 'U · S · MARKET',
  stage: '盈利热 / 利率高',
  regime: '盈利牛市',
  cycleStage: '牛市后段',
  cycleRange: [72, 84],
  cyclePhase: '第二向第三阶段过渡',
  cyclePhaseNote: '改善早已成为共识，部分资产开始按“好事会持续”定价。',
  cycleReason:
    '盈利和资金仍在推升价格；高估值、窄利差与低波动已把钟摆推向乐观一侧，但投资者问卷尚未全面亢奋。',
  cycleRefs: [
    'US-11',
    'US-12',
    'US-13',
    'US-15',
    'US-16',
    'HM-02',
    'HM-03',
    'HM-04',
  ],
  hero: '盈利很强',
  heroAccent: '赔率变薄',
  summary:
    '企业利润撑住指数，就业和消费开始变软。低波动、窄利差、高估值同时出现。',
  posture: '持有质量 · 少追久期',
  treatment:
    '不猜顶部，也不追估值；保留高质量核心仓，把新增风险留到价格或利率更友好时。',
  score: 78,
  accent: '#8b7d63',
  panel: '#ece2cf',
  signals: [
    {
      name: '基本面',
      value: 68,
      label: '仍在扩张',
      note: '就业转弱',
      icon: Activity,
    },
    {
      name: '资本供给',
      value: 72,
      label: '信用宽',
      note: '利差很窄',
      icon: CircleDollarSign,
    },
    {
      name: '心理钟摆',
      value: 73,
      label: '偏向乐观',
      note: '人心谨慎',
      icon: Sparkles,
    },
    {
      name: '价格压力',
      value: 82,
      label: '明显偏高',
      note: '长债 4.67%',
      icon: Landmark,
    },
  ],
  indices: [
    {
      name: 'S&P 500',
      value: '7,711.76',
      change: '-0.20%',
      note: '年内 +12.7%',
      up: false,
    },
    {
      name: 'Nasdaq',
      value: '26,402.42',
      change: '-0.50%',
      note: '年内 +13.6%',
      up: false,
    },
    {
      name: 'Dow',
      value: '53,559.99',
      change: '近持平',
      note: '年内 +11.4%',
      up: true,
    },
    {
      name: 'Russell 2000',
      value: '2,972.37',
      change: '-1.40%',
      note: '年内 +19.8%',
      up: false,
    },
  ],
  crossChecks: [
    {
      tag: '市场共识',
      title: '盈利与AI继续托市',
      text: '利润、PMI 和 ETF 流量都强，主流判断是龙头盈利足以消化估值。',
      refs: ['US-06', 'US-13', 'US-14'],
      tone: '#718f72',
    },
    {
      tag: '价格已计入',
      title: '好公司已经是贵资产',
      text: '标普远期 PE 约 20 倍，长债 4.67%，高收益债利差仅 2.63%。',
      refs: ['US-10', 'US-11', 'US-13', 'HM-04'],
      tone: '#b98358',
    },
    {
      tag: '二层判断',
      title: '盈利强，不等于回报高',
      text: '人人看见的好消息不构成优势。下一段上涨需要盈利继续超出已经很高的预期。',
      refs: ['US-12', 'US-13', 'HM-04', 'HM-05'],
      tone: '#7e8fa1',
    },
    {
      tag: '仍不知道',
      title: '软着陆能否维持',
      text: '就业走弱与通胀偏高可能先后反复。无法精确预测，只能控制买价和仓位。',
      refs: ['US-02', 'US-03', 'US-07', 'HM-01'],
      tone: '#b8796f',
    },
  ],
  guide: [
    {
      category: '经济现状',
      current: '增长尚在，动能分裂',
      leftPole: '生机勃勃',
      rightPole: '停滞不前',
      position: 45,
      basis: 'Q2 GDP +1.5%，国内私人最终销售 +4.2%；7 月就业却减少 2.3 万。',
      confidence: '高',
      refs: ['US-01', 'US-03'],
    },
    {
      category: '经济展望',
      current: '滞胀风险升',
      leftPole: '正面有利',
      rightPole: '负面不利',
      position: 55,
      basis:
        '联储预计增长 2.2%；核心 CPI 2.5% 与核心 PCE 3.3% 分叉，就业又走弱。',
      confidence: '中',
      refs: ['US-02', 'US-03', 'US-04', 'US-08'],
    },
    {
      category: '贷款机构',
      current: '企业宽，居民紧',
      leftPole: '急于放贷',
      rightPole: '缄默谨慎',
      position: 48,
      basis: '企业贷款标准大体稳定、需求增强；信用卡趋紧，居民信贷需求偏弱。',
      confidence: '高',
      refs: ['US-09'],
    },
    {
      category: '资本市场',
      current: '信用仍宽',
      leftPole: '宽松',
      rightPole: '紧缩',
      position: 25,
      basis: '高收益债利差仅 2.63%，ETF 继续吸金，融资环境没有显著收紧。',
      confidence: '高',
      refs: ['US-11', 'US-14'],
    },
    {
      category: '资本供给',
      current: '很充足',
      leftPole: '充足',
      rightPole: '短缺',
      position: 20,
      basis: 'ETF 单周净流入 517 亿美元，企业信用利差靠近历史低位。',
      confidence: '高',
      refs: ['US-11', 'US-14'],
    },
    {
      category: '融资条款',
      current: '企业尚可，消费偏紧',
      leftPole: '宽松',
      rightPole: '严格',
      position: 50,
      basis: '大中企业融资尚可；信用卡和部分消费信贷标准处在偏紧一侧。',
      confidence: '高',
      refs: ['US-09'],
    },
    {
      category: '利率水平',
      current: '高',
      leftPole: '低',
      rightPole: '高',
      position: 80,
      basis: '联邦基金目标 3.50%—3.75%，十年美债 4.67%。',
      confidence: '高',
      refs: ['US-07', 'US-10'],
    },
    {
      category: '利差水平',
      current: '信用窄，期限正',
      leftPole: '窄',
      rightPole: '宽',
      position: 24,
      basis: '高收益债 OAS 2.63%；10Y—2Y 约 +46bp，信用风险定价很松。',
      confidence: '高',
      refs: ['US-11', 'US-19'],
    },
    {
      category: '投资者',
      current: '价格乐观，人心谨慎',
      leftPole: '乐观／自信／渴望买进',
      rightPole: '悲观／忧虑／无心买进',
      position: 42,
      basis: 'VIX 14.51，但 AAII 看空 44.4%。价格与问卷情绪并不一致。',
      confidence: '高',
      refs: ['US-15', 'US-16'],
    },
    {
      category: '资产持有人',
      current: '继续持有',
      leftPole: '乐于持有',
      rightPole: '急于卖出离场',
      position: 28,
      basis: '主要指数接近高位且年内涨幅两位数，没有广泛离场迹象。',
      confidence: '高',
      refs: ['US-17'],
    },
    {
      category: '卖家',
      current: '不急，但在换仓',
      leftPole: '稀少',
      rightPole: '众多',
      position: 38,
      basis: '低 VIX 表明抛压不大；共同基金赎回与 ETF 流入并存，结构上在换仓。',
      confidence: '中',
      refs: ['US-14', 'US-15'],
    },
    {
      category: '市场',
      current: '指数拥挤，广度改善',
      leftPole: '人群拥挤',
      rightPole: '乏人问津',
      position: 26,
      basis:
        '英伟达仍能单独抬指数，但 Russell 2000 年内 +19.8%，并非只有七巨头。',
      confidence: '高',
      refs: ['US-17', 'US-18'],
    },
    {
      category: '基金',
      current: 'ETF吸金，主动赎回',
      leftPole: '申购门槛高／每天都发新基金／基金管理人说了算',
      rightPole: '向所有人开放申购／只有最好的基金才能募资／基金投资人有话语权',
      position: 38,
      basis:
        'ETF 单周 +517 亿美元；长期共同基金同期 -175 亿美元。钱偏向被动工具。',
      confidence: '高',
      refs: ['US-14'],
    },
    {
      category: '近期业绩',
      current: '很强但集中',
      leftPole: '强劲',
      rightPole: '萎靡',
      position: 18,
      basis: 'Q2 标普盈利 +50.4%；剔除 Alphabet 和 Amazon 后仍有 +32.0%。',
      confidence: '高',
      refs: ['US-13'],
    },
    {
      category: '资产价格',
      current: '高',
      leftPole: '高',
      rightPole: '低',
      position: 18,
      basis: '标普远期 PE 20 倍，高于十年均值 19 倍；联储也称估值压力偏高。',
      confidence: '高',
      refs: ['US-12', 'US-13'],
    },
    {
      category: '预期收益',
      current: '被利率压薄',
      leftPole: '低',
      rightPole: '高',
      position: 20,
      basis:
        '20 倍 PE 对应约 5% 盈利收益率，十年美债已到 4.67%，风险补偿很薄。',
      confidence: '高',
      refs: ['US-10', 'US-13'],
    },
    {
      category: '风险',
      current: '损失风险被低波动遮住',
      leftPole: '高',
      rightPole: '低',
      position: 22,
      basis: 'VIX 低、利差窄，同时估值高、对冲基金杠杆接近纪录。',
      confidence: '高',
      refs: ['US-11', 'US-12', 'US-15', 'HM-01'],
    },
    {
      category: '流行风格',
      current: 'AI、动量、ETF',
      leftPole: '激进／四处投资',
      rightPole: '审慎且自律／精挑细选',
      position: 18,
      basis: 'AI 龙头主导指数边际变化，被动资金持续流入，趋势交易仍占上风。',
      confidence: '高',
      refs: ['US-14', 'US-18'],
    },
    {
      category: '正确风格',
      current: '质量优先，更重价格',
      leftPole: '审慎且自律／精挑细选',
      rightPole: '激进／四处投资',
      position: 20,
      basis: '高利率下，高现金流与盈利兑现比远期故事更值钱。',
      confidence: '中',
      refs: ['US-07', 'US-10', 'US-13', 'HM-04'],
    },
    {
      category: '易犯错误',
      current: '把好资产当好投资',
      leftPole: '买进太多／高价追涨／承受太多风险',
      rightPole: '买进太少／离开市场／承受太少风险',
      position: 18,
      basis:
        '利润强是真的，但价格、利率和杠杆也高。把好公司等同于好价格，是主要风险。',
      confidence: '中',
      refs: ['US-10', 'US-12', 'US-13'],
    },
  ],
  styleMap: [
    {
      name: 'AI / 大型科技',
      certainty: 86,
      cushion: 18,
      posture: '精选',
      tone: '#b98358',
    },
    {
      name: '标普质量',
      certainty: 80,
      cushion: 32,
      posture: '核心',
      tone: '#718f72',
    },
    {
      name: '小盘 / 价值',
      certainty: 61,
      cushion: 43,
      posture: '观察',
      tone: '#7e8fa1',
    },
    {
      name: '长久期 / 无盈利',
      certainty: 40,
      cushion: 12,
      posture: '低配',
      tone: '#b8796f',
    },
  ],
  actions: [
    ['可持', '高自由现金流、有定价权的龙头'],
    ['可等', '长债利率回落，再加久期'],
    ['少碰', '把低 VIX 当成安全垫'],
  ],
  defenseScore: 76,
  defenseLabel: '偏防守',
  defenseReason: '不猜顶部；保留强资产，同时降低对估值继续扩张的依赖。',
  evidence: [
    {
      label: 'Q2 GDP',
      value: '+1.5%',
      note: '年化',
      tone: '#7e8fa1',
      refs: ['US-01'],
    },
    {
      label: '核心PCE',
      value: '+3.3%',
      note: '7月同比',
      tone: '#b8796f',
      refs: ['US-02'],
    },
    {
      label: '非农',
      value: '-2.3万',
      note: '7月',
      tone: '#b8796f',
      refs: ['US-03'],
    },
    {
      label: 'Q2盈利',
      value: '+50.4%',
      note: '标普',
      tone: '#718f72',
      refs: ['US-13'],
    },
    {
      label: '十年美债',
      value: '4.67%',
      note: '08.27',
      tone: '#b98358',
      refs: ['US-10'],
    },
    {
      label: 'VIX',
      value: '14.51',
      note: '08.28',
      tone: '#7e8fa1',
      refs: ['US-15'],
    },
  ],
  triggers: [
    ['更进攻', '通胀回落，就业稳住，长债低于 4.2%', '#718f72'],
    ['维持', '盈利上修，HY利差低于 3%，消费不衰退', '#7e8fa1'],
    ['更防守', '盈利下修，HY利差高于 3.5%，VIX站上20', '#b8796f'],
  ],
  sources: [
    ...frameworkSources,
    {
      id: 'US-01',
      label: 'BEA｜Q2 GDP 二次估计',
      url: 'https://www.bea.gov/news/2026/gdp-second-estimate-and-corporate-profits-2nd-quarter-2026',
      tier: '一手数据',
    },
    {
      id: 'US-02',
      label: 'BEA｜7月收入与支出',
      url: 'https://www.bea.gov/news/2026/personal-income-and-outlays-july-2026',
      tier: '一手数据',
    },
    {
      id: 'US-03',
      label: 'BLS｜7月就业',
      url: 'https://www.bls.gov/news.release/empsit.htm',
      tier: '一手数据',
    },
    {
      id: 'US-04',
      label: 'BLS｜7月CPI',
      url: 'https://www.bls.gov/news.release/archives/cpi_08122026.htm',
      tier: '一手数据',
    },
    {
      id: 'US-05',
      label: '密歇根大学｜消费者信心',
      url: 'https://www.sca.isr.umich.edu/',
      tier: '一手数据',
    },
    {
      id: 'US-07',
      label: '美联储｜7月FOMC',
      url: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20260729a.htm',
      tier: '一手数据',
    },
    {
      id: 'US-08',
      label: '美联储｜6月经济预测',
      url: 'https://www.federalreserve.gov/monetarypolicy/fomcprojtabl20260617.htm',
      tier: '一手数据',
    },
    {
      id: 'US-09',
      label: '美联储｜7月银行信贷调查',
      url: 'https://www.federalreserve.gov/data/sloos/sloos-202607.htm',
      tier: '一手数据',
    },
    {
      id: 'US-10',
      label: 'FRED｜美债收益率',
      url: 'https://fred.stlouisfed.org/series/DGS10',
      tier: '一手数据',
    },
    {
      id: 'US-11',
      label: 'FRED｜高收益债利差',
      url: 'https://fred.stlouisfed.org/series/BAMLH0A0HYM2',
      tier: '一手数据',
    },
    {
      id: 'US-19',
      label: 'FRED｜10年—2年期限差',
      url: 'https://fred.stlouisfed.org/series/T10Y2Y',
      tier: '一手数据',
    },
    {
      id: 'US-12',
      label: '美联储｜金融稳定报告',
      url: 'https://www.federalreserve.gov/publications/2026-may-financial-stability-report-overview.htm',
      tier: '一手数据',
    },
    {
      id: 'US-14',
      label: 'ICI｜基金与ETF流量',
      url: 'https://www.ici.org/research/stats/combined_flows',
      tier: '一手数据',
    },
    {
      id: 'US-15',
      label: 'Cboe｜VIX',
      url: 'https://www.cboe.com/tradable-products/vix/',
      tier: '一手数据',
    },
    {
      id: 'US-06',
      label: 'S&P Global｜8月PMI',
      url: 'https://www.spglobal.com/market-intelligence/en/news-insights/research/2026/08/us-flash-pmi-signals-welcome-mix-of-hotter-output-growth-cooler-inflation',
      tier: '交叉验证',
    },
    {
      id: 'US-13',
      label: 'FactSet｜Q2盈利',
      url: 'https://insight.factset.com/sp-500-earnings-season-update-august-7-2026',
      tier: '交叉验证',
    },
    {
      id: 'US-16',
      label: 'AAII｜投资者情绪',
      url: 'https://www.aaii.com/sentimentsurvey/sent_results',
      tier: '交叉验证',
    },
    {
      id: 'US-17',
      label: 'AP｜8月28日收盘',
      url: 'https://apnews.com/article/3f3477bcea915ac53ec2ae905ae57919',
      tier: '交叉验证',
    },
    {
      id: 'US-18',
      label: 'AP｜指数集中度',
      url: 'https://apnews.com/article/b4216a1f191d0304b4ed59e6912e23a4',
      tier: '交叉验证',
    },
  ],
};

const marketData: Record<MarketKey, MarketData> = {
  cn: cnData,
  us: usData,
};

const sentimentChartConfig = {
  cnSentiment: {
    label: 'A股情绪',
    color: '#718f72',
  },
  usSentiment: {
    label: '美股情绪',
    color: '#b98358',
  },
} satisfies ChartConfig;

function guideSide(position: number): GuideSide {
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
            className="font-mono text-[9px] tracking-[0.04em] text-[var(--signal)]/76 underline decoration-[var(--signal)]/22 underline-offset-4 transition-colors hover:text-[var(--signal)]"
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
          <div className="font-display text-[74px] leading-none tracking-[-0.09em] text-[#26382e]">
            {score}
          </div>
          <div className="mt-1 font-mono text-[9px] tracking-[0.22em] text-[#26382e]/42">
            CYCLE POSITION
          </div>
        </div>
      </div>

      <div className="mt-7">
        <div className="flex justify-between font-mono text-[8px] tracking-[0.08em] text-[#26382e]/38">
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
        <div className="mt-3 flex items-center justify-between text-[10px]">
          <span className="font-mono text-[#26382e]/42">
            {range[0]}—{range[1]} / 中值 {score}
          </span>
          <strong className="font-normal text-[var(--signal)]">{stage}</strong>
        </div>
        <div className="mt-4 border-t border-[#26382e]/9 pt-4">
          <p className="font-display text-base text-[#26382e]/78">{phase}</p>
          <p className="mt-1 text-[10px] leading-5 text-[#26382e]/44">
            {phaseNote}
          </p>
        </div>
      </div>
    </div>
  );
}

function SectionMark({ number, label }: { number: string; label: string }) {
  return (
    <div className="flex items-center gap-3 font-mono text-[10px] tracking-[0.2em] text-[#26382e]/40">
      <span>{number}</span>
      <span className="h-px w-8 bg-[#26382e]/14" />
      <span>{label}</span>
    </div>
  );
}

export default function Home() {
  const [market, setMarket] = useState<MarketKey>('cn');
  const [guideFilter, setGuideFilter] = useState<GuideFilter>('all');
  const active = marketData[market];
  const latestSnapshot = marketHistory[marketHistory.length - 1];
  const filteredGuide =
    guideFilter === 'all'
      ? active.guide
      : active.guide.filter((item) => guideSide(item.position) === guideFilter);
  const filterOptions: Array<{ key: GuideFilter; label: string }> = [
    { key: 'all', label: '全部' },
    { key: 'left', label: '左侧' },
    { key: 'middle', label: '中间' },
    { key: 'right', label: '右侧' },
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
              <div className="font-mono text-[8px] tracking-[0.2em] text-[#26382e]/36">
                CN / US · 08
              </div>
            </div>
          </div>

          <fieldset
            className="order-3 flex rounded-full border border-[#26382e]/12 bg-[#eee7d9]/70 p-1 sm:order-none"
            aria-label="市场选择"
          >
            {(Object.keys(marketData) as MarketKey[]).map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant="ghost"
                aria-pressed={market === key}
                onClick={() => setMarket(key)}
                className={
                  market === key
                    ? 'h-7 rounded-full bg-[#26382e] px-4 text-xs text-[#f4efe5] hover:bg-[#26382e]/90 hover:text-[#f4efe5]'
                    : 'h-7 rounded-full px-4 text-xs text-[#26382e]/45 hover:bg-[#26382e]/5 hover:text-[#26382e]'
                }
              >
                {marketData[key].label}
              </Button>
            ))}
          </fieldset>

          <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.08em] text-[#26382e]/50">
            <CalendarDays className="size-3" aria-hidden="true" />
            <span>2026.08.28</span>
            <span className="ml-1 size-1 rounded-full bg-[var(--signal)]" />
          </div>
        </div>
      </header>

      <section className="relative border-b border-[#26382e]/10">
        <div className="pointer-events-none absolute inset-y-0 left-[8%] w-px bg-[#26382e]/[0.035]" />
        <div className="pointer-events-none absolute inset-y-0 right-[8%] w-px bg-[#26382e]/[0.035]" />
        <div className="mx-auto grid max-w-[1380px] gap-12 px-5 py-12 lg:min-h-[580px] lg:grid-cols-[1.12fr_.88fr] lg:px-8 lg:py-16">
          <div className="flex min-w-0 flex-col justify-between">
            <div>
              <Badge className="mb-8 h-6 border border-[var(--signal)]/28 bg-[var(--signal)]/8 px-2.5 font-mono text-[9px] tracking-[0.16em] text-[var(--signal)] hover:bg-[var(--signal)]/8">
                {active.code} / {active.stage}
              </Badge>
              <h1 className="font-display max-w-4xl text-[clamp(3.7rem,7vw,7.8rem)] font-medium leading-[0.82] tracking-[-0.1em] text-[#26382e]">
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
                <p className="font-mono text-[9px] tracking-[0.18em] text-[#26382e]/40">
                  MARKET REGIME
                </p>
                <p className="font-display mt-1 text-2xl text-[#26382e]/84">
                  {active.regime}
                </p>
              </div>
              <Badge className="border border-[var(--signal)]/24 bg-[var(--signal)]/8 text-[10px] font-normal text-[var(--signal)] hover:bg-[var(--signal)]/8">
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
                <p className="text-[11px] leading-5 text-[#26382e]/52">
                  {active.cycleReason}
                </p>
                <div className="mt-3">
                  <SourceRefs ids={active.cycleRefs} sources={active.sources} />
                </div>
              </div>
              <div className="mt-5 rounded-[18px_5px_18px_5px] bg-[#f7f1e7]/58 px-4 py-4">
                <p className="font-mono text-[8px] tracking-[0.16em] text-[#26382e]/36">
                  HOWARD MARKS FRAME
                </p>
                <p className="mt-2 text-[10px] leading-5 text-[#26382e]/46">
                  先问共识，再问价格；把资本、心理与风险一起看。越靠周期后段，越应从进攻转向防守。0—100是本站的判断区间，不是书中公式。
                </p>
                <div className="mt-2">
                  <SourceRefs
                    ids={['HM-01', 'HM-04', 'HM-05', 'HM-06']}
                    sources={active.sources}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-[1380px] px-5 py-12 lg:px-8 lg:py-16">
        <div className="mb-7 flex items-end justify-between">
          <div>
            <SectionMark number="01" label="TEMPERATURE" />
            <h2 className="font-display mt-3 text-3xl tracking-[-0.05em] text-[#26382e]">
              四个温度计
            </h2>
            <p className="mt-2 text-[10px] text-[#26382e]/36">
              高分代表更热，不代表更好。
            </p>
          </div>
          <a
            href="#guide"
            className="hidden items-center gap-2 font-mono text-[9px] tracking-[0.12em] text-[#26382e]/40 transition-colors hover:text-[#26382e]/70 sm:flex"
          >
            20项扫描 <ArrowRight className="size-3" />
          </a>
        </div>

        <div className="grid border-l border-t border-[#26382e]/10 sm:grid-cols-2 xl:grid-cols-4">
          {active.signals.map((signal) => {
            const Icon = signal.icon;
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
                  <span className="font-mono text-[10px] text-[#26382e]/38">
                    {signal.value}
                  </span>
                </div>
                <div className="mt-7 flex items-end justify-between gap-4">
                  <strong className="font-display text-3xl font-normal text-[#26382e]/90">
                    {signal.label}
                  </strong>
                  <span className="mb-1 text-[11px] text-[#26382e]/40">
                    {signal.note}
                  </span>
                </div>
                <Progress
                  value={signal.value}
                  aria-label={`${signal.name} ${signal.value} 分`}
                  className="mt-5 gap-0 [&_[data-slot=progress-indicator]]:bg-[var(--signal)] [&_[data-slot=progress-track]]:h-px [&_[data-slot=progress-track]]:bg-[#26382e]/7"
                />
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
                <span className="text-[10px] text-[#26382e]/40">
                  {index.name}
                </span>
                <span className="font-mono text-[8px] text-[#26382e]/28">
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
                      ? 'text-[10px] text-[var(--signal)]'
                      : 'text-[10px] text-[#b8796f]'
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

      <section className="border-y border-[#26382e]/10 bg-[#f0eadf]/62">
        <div className="mx-auto max-w-[1380px] px-5 py-14 lg:px-8 lg:py-18">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <SectionMark number="02" label="WEEKLY SENTIMENT" />
              <h2 className="font-display mt-3 text-4xl tracking-[-0.06em] text-[#26382e]">
                情绪周线
              </h2>
            </div>
            <p className="max-w-lg text-xs leading-relaxed text-[#26382e]/42">
              0 是极度恐惧，50 是中性，100 是极度乐观。只量情绪，不预测涨跌。
            </p>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1.45fr_.55fr] lg:items-stretch">
            <Card className="rounded-[6px_28px_6px_28px] bg-[#f7f1e7]/70 py-0 ring-1 ring-[#26382e]/8">
              <CardContent className="px-3 py-6 sm:px-6">
                <ChartContainer
                  config={sentimentChartConfig}
                  className="h-[280px] w-full aspect-auto"
                  initialDimension={{ width: 760, height: 280 }}
                >
                  <RechartsLineChart
                    accessibilityLayer
                    data={marketHistory}
                    margin={{ left: 0, right: 12, top: 14, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 5" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                    />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      tickLine={false}
                      axisLine={false}
                      width={30}
                    />
                    <ReferenceLine
                      y={50}
                      stroke="rgba(38,56,46,.22)"
                      strokeDasharray="4 5"
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent indicator="line" />}
                    />
                    <Line
                      dataKey="cnSentiment"
                      type="monotone"
                      stroke="var(--color-cnSentiment)"
                      strokeWidth={2}
                      dot={{ r: 4, fill: 'var(--color-cnSentiment)' }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      dataKey="usSentiment"
                      type="monotone"
                      stroke="var(--color-usSentiment)"
                      strokeWidth={2}
                      dot={{ r: 4, fill: 'var(--color-usSentiment)' }}
                      activeDot={{ r: 5 }}
                    />
                  </RechartsLineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <div className="grid gap-px overflow-hidden border border-[#26382e]/10 bg-[#26382e]/8 sm:grid-cols-2 lg:grid-cols-1">
              {[
                ['A股', latestSnapshot.cnSentiment, '#718f72', '偏热'],
                ['美股', latestSnapshot.usSentiment, '#b98358', '偏热'],
              ].map(([label, score, color, state]) => (
                <div
                  key={String(label)}
                  className="flex items-center justify-between bg-[#eee7d9] px-6 py-6"
                >
                  <div>
                    <p className="text-[10px] text-[#26382e]/40">{label}</p>
                    <p className="font-display mt-2 text-2xl text-[#26382e]/82">
                      {state}
                    </p>
                    <p className="mt-2 font-mono text-[8px] text-[#26382e]/30">
                      首次记录 · {latestSnapshot.date}
                    </p>
                  </div>
                  <span
                    className="font-display text-5xl tracking-[-0.07em]"
                    style={{ color: String(color) }}
                  >
                    {score}
                  </span>
                </div>
              ))}
              <div className="bg-[#f4efe5] px-6 py-5 sm:col-span-2 lg:col-span-1">
                <p className="text-[10px] leading-5 text-[#26382e]/38">
                  从本周起只追加记录，不回改历史分数；若评分口径变化，单独留注。
                </p>
                <p className="mt-2 font-mono text-[8px] leading-4 text-[#26382e]/28">
                  价格广度 25 · 资金杠杆 25 · 波动利差 20 · 估值拥挤 15 ·
                  调查行为 15
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#26382e]/10 bg-[#eee7d9]/55">
        <div className="mx-auto max-w-[1380px] px-5 py-14 lg:px-8 lg:py-18">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <SectionMark number="03" label="SECOND-LEVEL" />
              <h2 className="font-display mt-3 text-4xl tracking-[-0.06em] text-[#26382e]">
                二层思维
              </h2>
            </div>
            <p className="max-w-lg text-xs leading-relaxed text-[#26382e]/42">
              事实不等于机会。先看共识，再看价格已经反映了多少。
            </p>
          </div>

          <div className="mt-8 grid gap-px overflow-hidden border border-[#26382e]/10 bg-[#26382e]/8 md:grid-cols-2 xl:grid-cols-4">
            {active.crossChecks.map((item) => (
              <article key={item.tag} className="bg-[#f4efe5] p-6 lg:p-7">
                <div className="flex items-center justify-between gap-4">
                  <span
                    className="font-mono text-[9px] tracking-[0.18em]"
                    style={{ color: item.tone }}
                  >
                    {item.tag}
                  </span>
                  <SourceRefs ids={item.refs} sources={active.sources} />
                </div>
                <h3 className="font-display mt-6 text-2xl tracking-[-0.04em] text-[#26382e]/88">
                  {item.title}
                </h3>
                <p className="mt-3 text-xs leading-6 text-[#26382e]/52">
                  {item.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="guide" className="scroll-mt-4 bg-[#e7decd] text-[#26382e]">
        <div className="mx-auto max-w-[1380px] px-5 py-16 lg:px-8 lg:py-20">
          <div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
            <div>
              <SectionMark number="04" label="MARKET PENDULUM" />
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
                        (item) => guideSide(item.position) === option.key,
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
                    <span className="font-mono text-[9px] opacity-45">
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
                  <TableHead className="w-[170px] px-2 font-mono text-[9px] tracking-[0.16em] text-[#26382e]/40">
                    指标
                  </TableHead>
                  <TableHead className="px-2 font-mono text-[9px] tracking-[0.16em] text-[#26382e]/40">
                    左极 · 当前位置 · 右极
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGuide.map((item) => {
                  const side = guideSide(item.position);
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
                        <p className="mt-2 font-mono text-[8px] text-[#26382e]/30">
                          信心 {item.confidence}
                        </p>
                      </TableCell>
                      <TableCell className="px-2 py-5">
                        <div className="grid grid-cols-2 gap-10 text-[11px] leading-relaxed text-[#26382e]/60">
                          <span className="max-w-[320px]">{item.leftPole}</span>
                          <span className="ml-auto max-w-[360px] text-right">
                            {item.rightPole}
                          </span>
                        </div>
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
                            className="absolute top-4 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-medium tracking-[0.04em] shadow-[0_1px_0_rgba(38,56,46,0.06)]"
                            style={{
                              left: `${item.position}%`,
                              color: meta.color,
                              backgroundColor: meta.wash,
                            }}
                          >
                            {item.current}
                          </span>
                        </div>
                        <div className="mt-9 flex items-start justify-between gap-5 border-t border-[#26382e]/7 pt-3">
                          <p className="max-w-3xl text-[10px] leading-5 text-[#26382e]/46">
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
            <SectionMark number="05" label="PRICE / VALUE" />
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
                    <div className="mb-2 flex justify-between text-[9px] text-[#26382e]/40">
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
                    <div className="mb-2 flex justify-between text-[9px] text-[#26382e]/40">
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
              <p className="font-mono text-[9px] tracking-[0.18em] text-[#26382e]/42">
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
                <div className="mt-4 flex justify-between font-mono text-[8px] text-[#26382e]/34">
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
                <p className="mt-4 text-[10px] leading-5 text-[#26382e]/44">
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
                  <span className="font-mono text-[10px] text-[#26382e]/48">
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
              <SectionMark number="06" label="EVIDENCE" />
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
                  <p className="text-[10px] text-[#26382e]/40">{item.label}</p>
                  <SourceRefs ids={item.refs} sources={active.sources} />
                </div>
                <p className="mt-3 font-display text-2xl tracking-[-0.04em] text-[var(--tone)]">
                  {item.value}
                </p>
                <p className="mt-1 font-mono text-[9px] text-[#26382e]/34">
                  {item.note}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[9px] tracking-[0.18em] text-[#26382e]/36">
                PREPARE, DON&apos;T PREDICT
              </p>
              <h3 className="font-display mt-2 text-2xl tracking-[-0.04em] text-[#26382e]/82">
                准备，不预测
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-[10px] text-[#26382e]/36">
                条件变，攻守才变。
              </p>
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
                    className="font-mono text-[9px] tracking-[0.16em]"
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
                信源台账 · {active.label}
              </p>
              <p className="mt-2 max-w-xl text-[10px] leading-5 text-[#26382e]/36">
                市场价截至
                2026.08.28；宏观采用当时最新公布值。官方口径定事实，独立口径专门找反证。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[10px] text-[#26382e]/34">
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
                <p className="font-mono text-[9px] tracking-[0.16em] text-[#26382e]/36">
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
                        className="inline-flex items-center gap-1 text-[10px] text-[#26382e]/42 transition-colors hover:text-[#26382e]/72"
                      >
                        <span className="font-mono text-[8px] text-[var(--signal)]/70">
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
