export type WeeklyMarketSnapshot = {
  date: string;
  label: string;
  cnSentiment: number;
  usSentiment: number;
  cnCycle: number;
  usCycle: number;
};

// 每周只追加，不回改历史分数。若评分口径变化，请在当周分析中单独说明。
export const marketHistory: WeeklyMarketSnapshot[] = [
  {
    date: '2026-08-28',
    label: '08.28',
    cnSentiment: 66,
    usSentiment: 73,
    cnCycle: 64,
    usCycle: 78,
  },
];
