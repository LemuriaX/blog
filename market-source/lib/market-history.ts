// Generated from data/reports and immutable legacy history.
export type WeeklyMarketSnapshot = {
  date: string;
  label: string;
  cnSentiment: number | null;
  usSentiment: number | null;
  cnCycle: number;
  usCycle: number;
  methodVersion: string;
  comparable: boolean;
};
export const marketHistory: WeeklyMarketSnapshot[] = [
  {
    date: '2026-08-28',
    label: '08.28',
    cnSentiment: 66,
    usSentiment: 73,
    cnCycle: 64,
    usCycle: 78,
    methodVersion: 'legacy-unrecorded',
    comparable: false,
  },
  {
    date: '2026-09-04',
    label: '09.04',
    cnSentiment: 64,
    usSentiment: 67,
    cnCycle: 62,
    usCycle: 77,
    methodVersion: 'legacy-v1',
    comparable: false,
  },
];
