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
  stage: '订单回暖 / 热点降温',
  regime: '结构性牛市',
  cycleStage: '牛市中段偏后',
  cycleRange: [54, 70],
  cyclePhase: '第二阶段，仍有分歧',
  cyclePhaseNote:
    '少数人先看到转机的阶段已过；制造业改善成为共识，内需尚未跟上，离普遍笃信仍有距离。',
  cycleReason:
    '推断：利润增长、低融资成本仍支持牛市；本周科技回撤、消费偏弱，说明上涨基础不够宽。位置可回摆，不是走过的日历比例。',
  cycleRefs: ['CN-01', 'CN-02', 'CN-03', 'CN-06', 'CN-07'],
  hero: '订单回暖',
  heroAccent: '价格仍需挑选',
  summary:
    '制造业订单转扩张，服务业却未跟上。指数退了一步，热门资产的价格要求仍高。',
  posture: '核心仓留住 · 新钱慢一点',
  treatment:
    '持有能兑现现金流的核心仓；新增资金分批，只在估值或盈利兑现提供余地时加仓。',
  score: 62,
  accent: '#718f72',
  panel: '#e4ead8',
  signals: [
    {
      name: '基本面',
      value: 58,
      label: '边际改善',
      note: '服务仍弱',
      icon: Activity,
    },
    {
      name: '资本供给',
      value: 80,
      label: '融资不贵',
      note: '传导分层',
      icon: CircleDollarSign,
    },
    {
      name: '心理钟摆',
      value: 64,
      label: '乐观降温',
      note: '热点回撤',
      icon: Sparkles,
    },
    {
      name: '价格压力',
      value: 68,
      label: '分化仍大',
      note: '科技偏贵',
      icon: Landmark,
    },
  ],
  indices: [
    {
      name: '上证',
      value: '3,930.12',
      change: '-0.30%',
      note: '09.04收盘 / 日变动',
      up: false,
    },
    {
      name: '深证',
      value: '13,516.97',
      change: '-0.79%',
      note: '09.04收盘 / 日变动',
      up: false,
    },
    {
      name: '创业板',
      value: '3,286.55',
      change: '-0.78%',
      note: '09.04收盘 / 日变动',
      up: false,
    },
    {
      name: '沪深成交',
      value: '2.03 万亿',
      change: '仍活跃',
      note: '09.04 / 不含北交所',
      up: true,
    },
  ],
  crossChecks: [
    {
      tag: '市场共识 · 推断',
      title: '制造业改善，政策托底',
      text: '订单转扩张、工业利润增长，构成结构牛市的支持；但服务业PMI仍低于50，不能外推成全面复苏。',
      refs: ['CN-01', 'CN-03'],
      tone: '#718f72',
    },
    {
      tag: '价格已计入 · 推断',
      title: '好行业已经有好价格',
      text: '科创50周跌5.10%后，按上年利润计算的PE仍98.4倍；上证180为12.7倍。高增长已被索价，便宜也可能反映弱增长。',
      refs: ['CN-07', 'HM-04'],
      tone: '#b98358',
    },
    {
      tag: '二层判断 · 行动',
      title: '订单不是到账的现金',
      text: 'PMI新订单50.6是调查改善；7月零售仅增0.6%，工业应收回收期延长。只有订单转为回款，才值得提高估值容忍度。',
      refs: ['CN-01', 'CN-02', 'CN-03'],
      tone: '#7e8fa1',
    },
    {
      tag: '仍不知道',
      title: '改善会扩散多远',
      text: '8月消费、利润与信贷硬数据尚未齐备；全市场基金净申购和周五完整两融未核验，不据此判定全面追涨或去杠杆。',
      refs: ['CN-02', 'CN-03', 'CN-09', 'CN-10'],
      tone: '#b8796f',
    },
  ],
  guide: [
    {
      category: '经济现状',
      current: '制造改善，服务偏弱',
      leftPole: '生机勃勃',
      rightPole: '停滞不前',
      position: 59,
      basis:
        '事实：8月制造业PMI49.8、新订单50.6；非制造业49.0。调查回暖与总量偏弱同时存在。',
      confidence: '高',
      refs: ['CN-01'],
    },
    {
      category: '经济展望',
      current: '转机尚待兑现',
      leftPole: '正面有利',
      rightPole: '负面不利',
      position: 52,
      basis:
        '推断：订单改善支持后续生产；7月零售仅增0.6%，尚无8月消费硬数据确认。',
      confidence: '中',
      refs: ['CN-01', 'CN-02'],
    },
    {
      category: '贷款机构',
      current: '价格优惠，择客放贷',
      leftPole: '急于放贷',
      rightPole: '缄默谨慎',
      position: 38,
      basis:
        '事实：7月企业新贷利率略低于3%，贷款余额增5.1%；银行普遍惜贷的证据不足，也不能据此断言抢贷。',
      confidence: '中',
      refs: ['CN-04'],
    },
    {
      category: '资本市场',
      current: '交易活跃，情绪回落',
      leftPole: '宽松',
      rightPole: '紧缩',
      position: 28,
      basis:
        '事实：9月4日沪深成交2.03万亿元；科创50全周跌5.10%。可交易性尚好不代表人人赚钱。',
      confidence: '高',
      refs: ['CN-07', 'CN-11'],
    },
    {
      category: '资本供给',
      current: '总量宽裕',
      leftPole: '充足',
      rightPole: '短缺',
      position: 20,
      basis: '事实：7月末M2增7.7%、社融存量增7.4%；9月4日十年国债仍不足1.7%。',
      confidence: '高',
      refs: ['CN-04', 'CN-06'],
    },
    {
      category: '融资条款',
      current: '低成本，条件分层',
      leftPole: '宽松',
      rightPole: '严格',
      position: 33,
      basis:
        '推断：低LPR支持优质主体融资，不能代表弱企业的抵押与契约也宽松；缺少本周条款统计。',
      confidence: '中',
      refs: ['CN-04', 'CN-05'],
    },
    {
      category: '利率水平',
      current: '低位',
      leftPole: '低',
      rightPole: '高',
      position: 12,
      basis: '事实：8月20日1年/5年以上LPR为3.0%/3.5%；9月4日十年国债1.6804%。',
      confidence: '高',
      refs: ['CN-05', 'CN-06'],
    },
    {
      category: '利差水平',
      current: '优质信用补偿薄',
      leftPole: '窄',
      rightPole: '宽',
      position: 17,
      basis:
        '计算：9月4日十年AAA中票2.0578%减同期限国债1.6804%，为37.74bp；只代表AAA，不代表弱信用。',
      confidence: '高',
      refs: ['CN-06'],
    },
    {
      category: '投资者',
      current: '仍参与，开始挑选',
      leftPole: '乐观／自信／渴望买进',
      rightPole: '悲观／忧虑／无心买进',
      position: 37,
      basis:
        '推断：9月3日两融2.6567万亿元，但单日减少42.88亿元；ETF涨跌也不齐，尚未全面恐惧。',
      confidence: '中',
      refs: ['CN-10', 'CN-08'],
    },
    {
      category: '资产持有人',
      current: '持有与减仓并存',
      leftPole: '乐于持有',
      rightPole: '急于卖出离场',
      position: 40,
      basis:
        '推断：上证周跌0.56%、成交仍高，支持有换手而非一致离场；价格不能直接识别持有人的意愿。',
      confidence: '中',
      refs: ['CN-07', 'CN-11'],
    },
    {
      category: '卖家',
      current: '热门方向卖压增多',
      leftPole: '稀少',
      rightPole: '众多',
      position: 54,
      basis:
        '事实：科创50周跌5.10%，上证180跌0.80%；推断卖压分层，未取得完整个股周广度。',
      confidence: '中',
      refs: ['CN-07'],
    },
    {
      category: '市场',
      current: '热度仍有集中',
      leftPole: '人群拥挤',
      rightPole: '乏人问津',
      position: 33,
      basis:
        '推断：9月4日仅44%非货ETF上涨，热门科技估值仍高；ETF广度含跨境与债券，不能替代A股个股广度。',
      confidence: '中',
      refs: ['CN-08', 'CN-07'],
    },
    {
      category: '基金',
      current: '不足以判定抢购',
      leftPole: '申购门槛高／每天都发新基金／基金管理人说了算',
      rightPole: '向所有人开放申购／只有最好的基金才能募资／基金投资人有话语权',
      position: 50,
      basis:
        '资料不足：协会最新月度发布为7月；未核验本周新基金认购与净申购。暂置中间，不把规模增长当净流入。',
      confidence: '中',
      refs: ['CN-09'],
    },
    {
      category: '近期业绩',
      current: '本周回撤，分化明显',
      leftPole: '强劲',
      rightPole: '萎靡',
      position: 58,
      basis:
        '事实：上证周跌0.56%，科创50周跌5.10%；此项衡量投资近期表现，工业利润另列基本面。',
      confidence: '高',
      refs: ['CN-07'],
    },
    {
      category: '资产价格',
      current: '价值分层',
      leftPole: '高',
      rightPole: '低',
      position: 35,
      basis:
        '事实：9月4日上证综指PE17.3倍、科创50为98.4倍；均以上年年报利润并剔除亏损公司，非TTM。',
      confidence: '高',
      refs: ['CN-07'],
    },
    {
      category: '预期收益',
      current: '热门回报余地有限',
      leftPole: '低',
      rightPole: '高',
      position: 34,
      basis:
        '推断：即使景气改善，高价仍可能先消耗未来回报；大盘低倍数也需要排除利润下滑。',
      confidence: '中',
      refs: ['CN-07', 'CN-01', 'HM-04'],
    },
    {
      category: '风险',
      current: '定价与杠杆风险',
      leftPole: '高',
      rightPole: '低',
      position: 33,
      basis:
        '推断：高估值叠加借钱持仓会放大永久损失和被迫卖出；当前低融资成本是系统压力较小的反证。',
      confidence: '中',
      refs: ['CN-07', 'CN-10', 'CN-06'],
    },
    {
      category: '流行风格',
      current: '主题仍热，轮动加快',
      leftPole: '激进／四处投资',
      rightPole: '审慎且自律／精挑细选',
      position: 39,
      basis:
        '推断：科技回撤、航海装备与养殖走强，资金在换方向；不能把一天的行业轮动说成长期风格切换。',
      confidence: '中',
      refs: ['CN-08'],
    },
    {
      category: '正确风格',
      current: '现金流与价格优先',
      leftPole: '审慎且自律／精挑细选',
      rightPole: '激进／四处投资',
      position: 26,
      basis:
        '行动：保留核心仓，先看回款、负债、估值；逆向买入须有错误定价证据，而非只因别人卖。',
      confidence: '中',
      refs: ['CN-03', 'CN-07', 'HM-05'],
    },
    {
      category: '易犯错误',
      current: '把回撤误认成便宜',
      leftPole: '买进太多／高价追涨／承受太多风险',
      rightPole: '买进太少／离开市场／承受太少风险',
      position: 28,
      basis:
        '行动：防范追涨后补仓加杠杆；同样避免在信用尚稳时因短期波动清空长期资产。',
      confidence: '中',
      refs: ['CN-07', 'CN-06', 'HM-01'],
    },
  ],
  styleMap: [
    {
      name: '科技 / 高端制造',
      certainty: 73,
      cushion: 27,
      posture: '精选',
      tone: '#b98358',
    },
    {
      name: '制造 / 出口现金流',
      certainty: 69,
      cushion: 52,
      posture: '持有',
      tone: '#6f9584',
    },
    {
      name: '大盘价值 / 红利',
      certainty: 66,
      cushion: 62,
      posture: '平衡',
      tone: '#718f72',
    },
    {
      name: '内需 / 地产链',
      certainty: 34,
      cushion: 44,
      posture: '等回款',
      tone: '#b8796f',
    },
  ],
  actions: [
    ['核心仓', '持有盈利与回款稳定的资产，复核负债和分红来源'],
    ['新增资金', '分批投入，优先价格有余地的现金流，留足现金'],
    ['等待条件', '订单连续改善并传到零售、回款；或价格先给安全边际'],
    ['避免', '跌过就当便宜、追主题加杠杆、因一周回撤全盘离场'],
  ],
  defenseScore: 66,
  defenseLabel: '适度偏防守',
  defenseReason:
    '行动判断：低利率支持留在场内，但永久损失常来自高价买弱现金流；避免杠杆把正常波动变成被迫卖出。',
  evidence: [
    {
      label: '制造业PMI',
      value: '49.8',
      note: '8月 / 08.31发布',
      tone: '#718f72',
      refs: ['CN-01'],
    },
    {
      label: '新订单',
      value: '50.6',
      note: '8月 / 调查值',
      tone: '#718f72',
      refs: ['CN-01'],
    },
    {
      label: '非制造业PMI',
      value: '49.0',
      note: '8月 / 反证',
      tone: '#b8796f',
      refs: ['CN-01'],
    },
    {
      label: '社会零售',
      value: '+0.6%',
      note: '7月同比 / 08.17发布',
      tone: '#b8796f',
      refs: ['CN-02'],
    },
    {
      label: '工业利润',
      value: '+17.6%',
      note: '1—7月同比 / 08.27发布',
      tone: '#718f72',
      refs: ['CN-03'],
    },
    {
      label: '十年国债',
      value: '1.6804%',
      note: '09.04中债估值',
      tone: '#7e8fa1',
      refs: ['CN-06'],
    },
  ],
  triggers: [
    ['更进攻', '订单扩张延续，零售与回款跟上，估值仍有余地', '#718f72'],
    ['维持', '信用平稳、利润仍增，回撤没有演变成资金链问题', '#7e8fa1'],
    ['更防守', '盈利预期下修、信用利差持续走阔、杠杆被动退出', '#b8796f'],
  ],
  sources: [
    ...frameworkSources,
    {
      id: 'CN-01',
      label: '国家统计局｜8月PMI · 08.31发布',
      url: 'https://www.stats.gov.cn/sj/zxfbhjd/202608/t20260831_1965154.html',
      tier: '一手数据',
    },
    {
      id: 'CN-02',
      label: '国家统计局｜7月零售 · 08.17发布',
      url: 'https://www.stats.gov.cn/sj/zxfbhjd/202608/t20260817_1965052.html',
      tier: '一手数据',
    },
    {
      id: 'CN-03',
      label: '国家统计局｜1—7月工业利润 · 08.27发布',
      url: 'https://www.stats.gov.cn/sj/zxfb/202608/t20260827_1965126.html',
      tier: '一手数据',
    },
    {
      id: 'CN-04',
      label: '新华社转引央行｜7月金融数据 · 08.14发布',
      url: 'https://www.news.cn/20260814/6fa0381f296748b9b4cd6fb392dc3a70/c.html',
      tier: '交叉验证',
    },
    {
      id: 'CN-05',
      label: '中国货币网｜8月LPR · 08.20发布',
      url: 'https://www.chinamoney.com.cn/chinese/rdgz/20260820/3399885.html',
      tier: '一手数据',
    },
    {
      id: 'CN-06',
      label: '中债｜09.04国债与AAA中票曲线',
      url: 'https://yield.chinabond.com.cn/cbweb-pbc-web/pbc/more?locale=cn_ZH',
      tier: '一手数据',
    },
    {
      id: 'CN-07',
      label: '上交所发布（新浪转载）｜08.31—09.04周报',
      url: 'https://finance.sina.com.cn/wm/2026-09-04/doc-iniqsenq4140368.shtml',
      tier: '交叉验证',
    },
    {
      id: 'CN-08',
      label: '界面新闻（新浪转载）｜09.04收盘与ETF广度',
      url: 'https://finance.sina.com.cn/jjxw/2026-09-04/doc-iniqsenq4068862.shtml',
      tier: '交叉验证',
    },
    {
      id: 'CN-09',
      label: '基金业协会｜统计发布（最新月度为7月）',
      url: 'https://www.amac.org.cn/sjtj/',
      tier: '一手数据',
    },
    {
      id: 'CN-10',
      label: '上海证券报（经观转载）｜09.03两融 · 09.04发布',
      url: 'https://www.eeo.com.cn/2026/0904/1023108.shtml',
      tier: '交叉验证',
    },
    {
      id: 'CN-11',
      label: '新京报｜09.04沪深成交',
      url: 'https://www.bjnews.com.cn/detail/1788505514129203.html',
      tier: '交叉验证',
    },
    {
      id: 'CN-12',
      label: '新华财经｜09.04债市与流动性',
      url: 'https://www.cnfin.com/yw-lb/detail/20260904/4465250_1.html',
      tier: '交叉验证',
    },
  ],
};

const usData: MarketData = {
  label: '美股',
  code: 'U · S · MARKET',
  stage: '盈利仍强 / 利率掣肘',
  regime: '盈利支撑的牛市',
  cycleStage: '牛市成熟段',
  cycleRange: [69, 85],
  cyclePhase: '第二阶段后半，局部第三阶段',
  cyclePhaseNote:
    '盈利改善已是共识，部分成长叙事接近“乐观是常识”；调查仍有不少看空者，全市场尚非一致亢奋。',
  cycleReason:
    '推断：盈利预测上修、年内上涨和窄利差支持牛市；高价格要求、基金流出与利率压力令周期偏成熟。新高或一周下跌都不足以独自定牛熊。',
  cycleRefs: ['US-11', 'US-13', 'US-07', 'US-09', 'US-10'],
  hero: '盈利撑住',
  heroAccent: '利率抬高门槛',
  summary:
    '就业反弹，盈利预测仍在上修。好消息能延长增长，也会让高估值面对更高贴现率。',
  posture: '守住质量 · 降低价格容忍度',
  treatment:
    '核心仓保留有现金流的企业；新增资金放慢，先分散集中风险，等待经营兑现或价格让步。',
  score: 77,
  accent: '#8b7d63',
  panel: '#ece2cf',
  signals: [
    {
      name: '基本面',
      value: 68,
      label: '增长仍在',
      note: '通胀未消',
      icon: Activity,
    },
    {
      name: '资本供给',
      value: 71,
      label: '信用可得',
      note: '银行分层',
      icon: CircleDollarSign,
    },
    {
      name: '心理钟摆',
      value: 67,
      label: '乐观有分歧',
      note: '问卷回暖',
      icon: Sparkles,
    },
    {
      name: '价格压力',
      value: 79,
      label: '兑现要求高',
      note: '利率掣肘',
      icon: Landmark,
    },
  ],
  indices: [
    {
      name: '标普500',
      value: '7,718.60',
      change: '-0.38%',
      note: '09.04收盘 / 日变动',
      up: false,
    },
    {
      name: '纳斯达克',
      value: '26,506.99',
      change: '-0.29%',
      note: '09.04收盘 / 日变动',
      up: false,
    },
    {
      name: '道琼斯',
      value: '53,414.25',
      change: '-0.51%',
      note: '09.04收盘 / 日变动',
      up: false,
    },
    {
      name: 'VIX',
      value: '14.32',
      change: '偏低',
      note: '09.03收盘 / 滞后一日',
      up: false,
    },
  ],
  crossChecks: [
    {
      tag: '市场共识 · 推断',
      title: '增长有韧性，盈利能撑住',
      text: '8月非农增16.2万，Q3盈利预测上修；但7月实际消费环比近乎停滞，调查强劲尚待更多支出数据确认。',
      refs: ['US-01', 'US-11', 'US-03', 'US-15'],
      tone: '#718f72',
    },
    {
      tag: '价格已计入 · 计算',
      title: '利润兑现与利率都要过关',
      text: '9月4日标普除以8月31日的2026全年预期EPS361.38，约21.36倍。这是当年预期PE，不是未来12个月PE；计入利润的投资重估收益也会美化盈利。',
      refs: ['US-13', 'US-11', 'US-12'],
      tone: '#b98358',
    },
    {
      tag: '二层判断 · 推断',
      title: '增长好，持有回报未必同步好',
      text: '就业好让加息压力更难消退；Q3总EPS上修1.2%，却有7/11行业下修。强总量不等于普遍经营加速。',
      refs: ['US-01', 'US-04', 'US-11'],
      tone: '#7e8fa1',
    },
    {
      tag: '仍不知道',
      title: '通胀与AI投入的回报',
      text: '能源价格会否再传导、AI投入多久变成自由现金流，都没有可靠答案。VIX与利差最新核验到9月3日，不能冒充周五值。',
      refs: ['US-03', 'US-12', 'US-06', 'US-07'],
      tone: '#b8796f',
    },
  ],
  guide: [
    {
      category: '经济现状',
      current: '增长韧性仍在',
      leftPole: '生机勃勃',
      rightPole: '停滞不前',
      position: 34,
      basis:
        '事实：8月非农增16.2万、失业4.1%；Q2实际GDP年化增1.5%，私人内需增4.2%。',
      confidence: '高',
      refs: ['US-01', 'US-02'],
    },
    {
      category: '经济展望',
      current: '增长与通胀拉扯',
      leftPole: '正面有利',
      rightPole: '负面不利',
      position: 43,
      basis:
        '事实：ISM制造业54.6指向扩张；7月实际消费月增不足0.1%、核心PCE同比3.3%，展望不能只看调查。',
      confidence: '中',
      refs: ['US-15', 'US-03'],
    },
    {
      category: '贷款机构',
      current: '企业可借，弱端谨慎',
      leftPole: '急于放贷',
      rightPole: '缄默谨慎',
      position: 47,
      basis:
        '事实：7月SLOOS显示多类工商贷款标准较历史中点宽；消费、地产与非银贷款仍偏严。不是全面紧贷。',
      confidence: '高',
      refs: ['US-05'],
    },
    {
      category: '资本市场',
      current: '公开信用仍通畅',
      leftPole: '宽松',
      rightPole: '紧缩',
      position: 29,
      basis:
        '事实：9月3日高收益债OAS为2.65%，较8月28日仅宽5bp；这是市场信用价格，不能代表银行所有借款人。',
      confidence: '高',
      refs: ['US-07', 'US-05'],
    },
    {
      category: '资本供给',
      current: '有资金，配置在移动',
      leftPole: '充足',
      rightPole: '短缺',
      position: 35,
      basis:
        '事实：8月26日当周债券基金净流入134.62亿美元，美国本土股票基金净流出183.44亿美元；含共同基金与ETF。',
      confidence: '高',
      refs: ['US-09'],
    },
    {
      category: '融资条款',
      current: '信用条款分层',
      leftPole: '宽松',
      rightPole: '严格',
      position: 43,
      basis:
        '事实：SLOOS显示优质工商贷款较宽，地产、消费和非银较紧；未取得本周新债契约保护的完整统计。',
      confidence: '中',
      refs: ['US-05'],
    },
    {
      category: '利率水平',
      current: '长期资金不便宜',
      leftPole: '低',
      rightPole: '高',
      position: 69,
      basis:
        '事实：联邦基金目标3.50%—3.75%（07.29）；十年美债4.77%（09.03）。决议未变不代表长期贴现率低。',
      confidence: '高',
      refs: ['US-04', 'US-08'],
    },
    {
      category: '利差水平',
      current: '风险补偿仍薄',
      leftPole: '窄',
      rightPole: '宽',
      position: 20,
      basis:
        '事实：高收益债OAS2.65%（09.03），比08.28的2.60%略宽；小幅走阔尚非信用危机。',
      confidence: '高',
      refs: ['US-07'],
    },
    {
      category: '投资者',
      current: '问卷回暖但有分歧',
      leftPole: '乐观／自信／渴望买进',
      rightPole: '悲观／忧虑／无心买进',
      position: 42,
      basis:
        '事实：截至9月2日AAII看多39.7%、看空37.6%；看空比例仍高于其长期均值，不能称全民亢奋。',
      confidence: '高',
      refs: ['US-10'],
    },
    {
      category: '资产持有人',
      current: '持有意愿仍占优',
      leftPole: '乐于持有',
      rightPole: '急于卖出离场',
      position: 35,
      basis:
        '推断：标普年内上涨、VIX偏低支持多数资产仍被持有；美国股票基金流出构成反证，不能用指数代替实际持仓。',
      confidence: '中',
      refs: ['US-13', 'US-06', 'US-09'],
    },
    {
      category: '卖家',
      current: '买卖接近平衡',
      leftPole: '稀少',
      rightPole: '众多',
      position: 49,
      basis:
        '事实：9月4日NYSE跌涨家数比1.04；纳斯达克上涨2478家、下跌2256家。广度分化，不是全面抛售。',
      confidence: '中',
      refs: ['US-14'],
    },
    {
      category: '市场',
      current: '预期集中，价格偏热',
      leftPole: '人群拥挤',
      rightPole: '乏人问津',
      position: 29,
      basis:
        '推断：低波动率与盈利高预期共存；七巨头以外493家Q2盈利也增长31.8%，反驳只剩少数公司盈利的说法。',
      confidence: '中',
      refs: ['US-06', 'US-12'],
    },
    {
      category: '基金',
      current: 'ETF与共同基金分流',
      leftPole: '申购门槛高／每天都发新基金／基金管理人说了算',
      rightPole: '向所有人开放申购／只有最好的基金才能募资／基金投资人有话语权',
      position: 51,
      basis:
        '事实：8月26日当周共同基金流出337.8亿美元、ETF净发行320.4亿美元；不把单一渠道赎回误作全市场撤资。',
      confidence: '高',
      refs: ['US-09'],
    },
    {
      category: '近期业绩',
      current: '年内强，本周横盘',
      leftPole: '强劲',
      rightPole: '萎靡',
      position: 27,
      basis:
        '事实：截至9月4日标普年内涨12.8%，本周约涨0.09%；近期投资表现强于单日下跌所传达的情绪。',
      confidence: '高',
      refs: ['US-13'],
    },
    {
      category: '资产价格',
      current: '需要盈利持续兑现',
      leftPole: '高',
      rightPole: '低',
      position: 26,
      basis:
        '计算：7718.60÷2026全年预期EPS361.38≈21.36倍；估计日期08.31。混合盈利口径及投资收益使便宜程度难定。',
      confidence: '中',
      refs: ['US-13', 'US-11', 'US-12'],
    },
    {
      category: '预期收益',
      current: '高价格压缩回报余地',
      leftPole: '低',
      rightPole: '高',
      position: 27,
      basis:
        '推断：高预期必须兑现，同时承受较高贴现率；EPS收益率不能直接当作预期收益或股权风险溢价。',
      confidence: '中',
      refs: ['US-11', 'US-08', 'HM-04'],
    },
    {
      category: '风险',
      current: '高价与现金流错配',
      leftPole: '高',
      rightPole: '低',
      position: 23,
      basis:
        '推断：估值依赖未来增长，利率与经营兑现任一落空都会损伤价值；低VIX不等于低永久损失风险。',
      confidence: '中',
      refs: ['US-12', 'US-08', 'US-06'],
    },
    {
      category: '流行风格',
      current: '追成长与分散并存',
      leftPole: '激进／四处投资',
      rightPole: '审慎且自律／精挑细选',
      position: 34,
      basis:
        '推断：AI和盈利叙事仍强，股票基金却有流出；风险偏好不整齐，不把调查反弹解释成盲目加仓。',
      confidence: '中',
      refs: ['US-12', 'US-09', 'US-10'],
    },
    {
      category: '正确风格',
      current: '质量、限价、留余地',
      leftPole: '审慎且自律／精挑细选',
      rightPole: '激进／四处投资',
      position: 20,
      basis:
        '行动：持有核心质量，新增资金要求安全边际；耐心可以是分批，也可以是暂时持有短久期现金工具。',
      confidence: '中',
      refs: ['US-08', 'US-12', 'HM-06'],
    },
    {
      category: '易犯错误',
      current: '把高增长永久化',
      leftPole: '买进太多／高价追涨／承受太多风险',
      rightPole: '买进太少／离开市场／承受太少风险',
      position: 23,
      basis:
        '行动：不把GAAP投资重估收益当持续经营收入，也不借钱押注利率转向；反过来，不能因贵就断言牛市结束。',
      confidence: '中',
      refs: ['US-12', 'US-04', 'HM-01'],
    },
  ],
  styleMap: [
    {
      name: '高质量核心企业',
      certainty: 76,
      cushion: 39,
      posture: '持有',
      tone: '#718f72',
    },
    {
      name: 'AI / 高预期成长',
      certainty: 65,
      cushion: 22,
      posture: '限价',
      tone: '#b98358',
    },
    {
      name: '盈利扩散 / 中小盘',
      certainty: 58,
      cushion: 52,
      posture: '精选',
      tone: '#7e8fa1',
    },
    {
      name: '弱现金流 / 高负债',
      certainty: 29,
      cushion: 25,
      posture: '回避',
      tone: '#b8796f',
    },
  ],
  actions: [
    ['核心仓', '保留可持续现金流，分散行业与单一叙事的集中风险'],
    ['新增资金', '分批买，保留短久期现金工具的等待价值'],
    ['等待条件', '盈利改善扩散、经营现金流跟上，或价格回到合理价值'],
    ['避免', '把投资重估收益当经常性利润、追涨加杠杆、押注加息日期'],
  ],
  defenseScore: 76,
  defenseLabel: '明确偏防守',
  defenseReason:
    '行动判断：高质量不等于任何价格都合适。让组合能承受利率再上行、盈利落空与流动性需求，避免被迫在低价卖出。',
  evidence: [
    {
      label: '非农就业',
      value: '+16.2万',
      note: '8月 / 09.04发布',
      tone: '#718f72',
      refs: ['US-01'],
    },
    {
      label: '失业率',
      value: '4.1%',
      note: '8月 / 与上月持平',
      tone: '#718f72',
      refs: ['US-01'],
    },
    {
      label: '核心PCE',
      value: '+3.3%',
      note: '7月同比 / 08.26发布',
      tone: '#b8796f',
      refs: ['US-03'],
    },
    {
      label: 'Q3 EPS上修',
      value: '+1.2%',
      note: '06.30→08.31 / 预期',
      tone: '#718f72',
      refs: ['US-11'],
    },
    {
      label: '高收益债利差',
      value: '2.65%',
      note: '09.03 / 较08.28宽5bp',
      tone: '#b98358',
      refs: ['US-07'],
    },
    {
      label: '十年美债',
      value: '4.77%',
      note: '09.03 / FRED最新值',
      tone: '#7e8fa1',
      refs: ['US-08'],
    },
  ],
  triggers: [
    ['更进攻', '盈利上修扩散，通胀缓和，价格留出安全边际', '#718f72'],
    ['维持', '就业与现金流稳，信用利差没有持续扩大', '#7e8fa1'],
    ['更防守', '通胀再升、盈利预期反转，信用与资金流同时转弱', '#b8796f'],
  ],
  sources: [
    ...frameworkSources,
    {
      id: 'US-01',
      label: 'BLS｜8月就业 · 09.04 08:30 ET发布',
      url: 'https://www.bls.gov/news.release/archives/empsit_09042026.htm',
      tier: '一手数据',
    },
    {
      id: 'US-02',
      label: 'BEA｜Q2 GDP二次估计 · 08.26发布',
      url: 'https://www.bea.gov/news/2026/gdp-second-estimate-and-corporate-profits-2nd-quarter-2026',
      tier: '一手数据',
    },
    {
      id: 'US-03',
      label: 'BEA｜7月PCE · 08.26发布',
      url: 'https://www.bea.gov/news/2026/personal-income-and-outlays-july-2026',
      tier: '一手数据',
    },
    {
      id: 'US-04',
      label: 'Federal Reserve｜07.29利率决议',
      url: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20260729a.htm',
      tier: '一手数据',
    },
    {
      id: 'US-05',
      label: 'Federal Reserve｜7月银行贷款调查（Q2）',
      url: 'https://www.federalreserve.gov/data/sloos/sloos-202607.htm',
      tier: '一手数据',
    },
    {
      id: 'US-06',
      label: 'FRED / Cboe｜VIX · 最新09.03收盘',
      url: 'https://fred.stlouisfed.org/series/VIXCLS',
      tier: '一手数据',
    },
    {
      id: 'US-07',
      label: 'FRED / ICE｜高收益债利差 · 最新09.03',
      url: 'https://fred.stlouisfed.org/series/BAMLH0A0HYM2',
      tier: '一手数据',
    },
    {
      id: 'US-08',
      label: 'FRED / Fed｜十年美债 · 最新09.03',
      url: 'https://fred.stlouisfed.org/series/DGS10',
      tier: '一手数据',
    },
    {
      id: 'US-09',
      label: 'ICI｜合并基金流量 · 08.26当周，09.02发布',
      url: 'https://www.ici.org/research/stats/combined_flows',
      tier: '一手数据',
    },
    {
      id: 'US-10',
      label: 'AAII｜09.02当周情绪 · 09.03发布',
      url: 'https://www.aaii.com/latest/article/538876-aaii-sentiment-survey-pessimism-sinks',
      tier: '一手数据',
    },
    {
      id: 'US-11',
      label: 'FactSet｜截至08.31盈利预测 · 09.04发布',
      url: 'https://insight.factset.com/analysts-increasing-eps-estimates-for-sp-500-companies-for-2nd-straight-quarter',
      tier: '交叉验证',
    },
    {
      id: 'US-12',
      label: 'FactSet｜Q2盈利与投资收益 · 08.28发布',
      url: 'https://insight.factset.com/mag-7-companies-reported-earnings-growth-above-100-boosted-by-investment-gains',
      tier: '交叉验证',
    },
    {
      id: 'US-13',
      label: 'AP｜09.04最终收盘 · 16:30 ET发布',
      url: 'https://apnews.com/article/ebc11cfa2cf8baf4491bf3d4199c1d74',
      tier: '交叉验证',
    },
    {
      id: 'US-14',
      label: 'Reuters（转载）｜09.04收盘广度与成交',
      url: 'https://www.marketscreener.com/news/wall-street-ends-lower-as-solid-jobs-data-fuels-hawkish-fed-bets-ce785bdbd889f126',
      tier: '交叉验证',
    },
    {
      id: 'US-15',
      label: 'ISM原始发布｜8月制造业调查 · 09.01发布',
      url: 'https://www.prnewswire.com/news-releases/manufacturing-pmi-at-54-6-august-2026-ism-manufacturing-pmi-report-302865127.html',
      tier: '一手数据',
    },
  ],
};

const sentimentBreakdown: Record<
  MarketKey,
  Array<[string, number, number, string, string[]]>
> = {
  cn: [
    [
      '价格趋势与市场广度',
      25,
      53,
      '上证周跌0.56%、科创50跌5.10%；缺完整个股周广度，以指数分化和ETF广度辅助，中信心。',
      ['CN-07', 'CN-08'],
    ],
    [
      '资金流、成交与杠杆',
      25,
      67,
      '沪深成交2.03万亿元，两融2.6567万亿元但单日下降；两融观测09.03，中信心。',
      ['CN-10', 'CN-11'],
    ],
    [
      '波动率与信用利差',
      20,
      78,
      '09.04十年AAA中票对国债37.74bp；未核验A股期权波动率，使用信用代理，中信心。',
      ['CN-06'],
    ],
    [
      '估值与拥挤度',
      15,
      70,
      '科创50上年利润PE98.4倍，对照上证180的12.7倍；为结构热度判断，中信心。',
      ['CN-07'],
    ],
    [
      '调查、基金发行与行为',
      15,
      50,
      '缺少可比周度新发认购与全市场投资者调查，保守置中；不是观测到中性，中信心。',
      ['CN-09'],
    ],
  ],
  us: [
    [
      '价格趋势与市场广度',
      25,
      76,
      '标普年内涨12.8%、本周约涨0.09%；NYSE与纳斯达克广度分化，中信心。',
      ['US-13', 'US-14'],
    ],
    [
      '资金流、成交与杠杆',
      25,
      50,
      '美国股票基金净流出183.44亿美元（08.26当周），09.04成交低于20日均值；周度杠杆未核验，中信心。',
      ['US-09', 'US-14'],
    ],
    [
      '波动率与信用利差',
      20,
      82,
      '09.03 VIX14.32、HY OAS2.65%，均偏平静；未取得09.04同口径值，中信心。',
      ['US-06', 'US-07'],
    ],
    [
      '估值与拥挤度',
      15,
      76,
      '当年预期PE约21.36倍，利润含投资收益，价格仍要求兑现；不是NTM估值分位，中信心。',
      ['US-11', 'US-12', 'US-13'],
    ],
    [
      '调查、基金发行与行为',
      15,
      54,
      'AAII看多39.7%、看空37.6%，问卷回暖但分歧仍大；基金流与问卷并列，中信心。',
      ['US-10', 'US-09'],
    ],
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

function sentimentLabel(value: number) {
  if (value <= 20) return '极度恐惧';
  if (value <= 40) return '谨慎';
  if (value <= 60) return '中性';
  if (value <= 80) return '乐观';
  return '亢奋';
}

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
  const previousSnapshot = marketHistory[marketHistory.length - 2];
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
                CN / US · 09
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
            <span>2026.09.04</span>
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
                [
                  'A股',
                  latestSnapshot.cnSentiment,
                  '#718f72',
                  sentimentLabel(latestSnapshot.cnSentiment),
                  latestSnapshot.cnSentiment -
                    (previousSnapshot?.cnSentiment ??
                      latestSnapshot.cnSentiment),
                ],
                [
                  '美股',
                  latestSnapshot.usSentiment,
                  '#b98358',
                  sentimentLabel(latestSnapshot.usSentiment),
                  latestSnapshot.usSentiment -
                    (previousSnapshot?.usSentiment ??
                      latestSnapshot.usSentiment),
                ],
              ].map(([label, score, color, state, delta]) => (
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
                      {latestSnapshot.date} · 较上周{' '}
                      {Number(delta) > 0 ? '+' : ''}
                      {delta} 分
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
                  0—20 极度恐惧 · 21—40 谨慎 · 41—60 中性 · 61—80 乐观 · 81—100
                  亢奋。历史分数只追加。
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

      <section className="border-b border-[#26382e]/10 bg-[#f4efe5]">
        <div className="mx-auto max-w-[1380px] px-5 py-8 lg:px-8">
          <details className="text-sm leading-7 text-[#26382e]/80">
            <summary className="cursor-pointer font-display text-lg">
              本周评分依据 · {active.label}
            </summary>
            <p className="mt-4 max-w-4xl">
              五项权重沿用上期，分项为证据支持的主观温度判断，不是自动计算的市场统计或收益预测。本期首次公开分项台账；上期未留分项，历史总分保持原样。缺项不伪造观测，不重新分配权重；明确采用代理或保守置中。所有分项为中信心。
            </p>
            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>维度</TableHead>
                    <TableHead>权重</TableHead>
                    <TableHead>分项</TableHead>
                    <TableHead>证据与边界</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sentimentBreakdown[market].map(
                    ([label, weight, value, note, refs]) => (
                      <TableRow key={label}>
                        <TableCell>{label}</TableCell>
                        <TableCell>{weight}%</TableCell>
                        <TableCell>{value}</TableCell>
                        <TableCell className="min-w-72 whitespace-normal">
                          {note}
                          <SourceRefs ids={refs} sources={active.sources} />
                        </TableCell>
                      </TableRow>
                    ),
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="mt-4 font-mono">
              {sentimentBreakdown[market]
                .map(([, weight, value]) => value + '×' + weight + '%')
                .join(' + ')}{' '}
              ={' '}
              {sentimentBreakdown[market]
                .reduce(
                  (sum, [, weight, value]) => sum + (weight * value) / 100,
                  0,
                )
                .toFixed(1)}{' '}
              →{' '}
              {market === 'cn'
                ? latestSnapshot.cnSentiment
                : latestSnapshot.usSentiment}
            </p>
            <p className="mt-3">
              周期位置、四个温度计、攻守分与风格坐标也都是判断值。周期区间表达不确定性，0为本轮起步、100为接近末期；攻守分不是仓位比例。钟摆位置是推断，信心标签表示证据强弱。
            </p>
            <p className="mt-3">
              核验限制：A股完整个股周广度、周度基金认购与期权波动率，美国周度杠杆与09.04同口径VIX/利差未取得。标普采用AP最终收盘7718.60；Reuters早版7718.41有小幅差异，只用其成交与广度。A股估值为上年利润口径，美国为当年预期口径，不直接跨市场比较。
            </p>
          </details>
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
                2026.09.04各地收盘；VIX、美债及美国信用利差只核验到09.03，两融为09.03，ICI流量为08.26当周。宏观使用截止日前已发布数据，具体观测与发布日期见各条信源。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[10px] text-[#26382e]/34">
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
