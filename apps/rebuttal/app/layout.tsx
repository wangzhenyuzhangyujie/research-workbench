import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Research · Rebuttal 工作台", description: "中英文审稿回复的编辑、核对与版本管理" };
export default function RootLayout({children}: {children: React.ReactNode}) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
