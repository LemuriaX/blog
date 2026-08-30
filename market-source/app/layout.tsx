import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: '市场手记｜周期、价格与风险',
  description: '用周期、价格与价值、二层思维和攻守平衡观察A股与美股。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
