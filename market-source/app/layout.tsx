import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: '市场手记｜价格、价值与风险',
  description: '用估值、现金流与反证观察A股。',
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
