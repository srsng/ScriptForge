import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScriptForge 剧本工作台",
  description: "面向小说改编的剧本整理与导出工作区。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
