import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: '市场手记｜周期、价格与风险',
  description: '记录A股周期、价格与价值，以及每周的攻守判断。',
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
