import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScriptForge Workbench",
  description: "AI-assisted novel-to-script adaptation workbench with M1 input persistence.",
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
