import type { Metadata } from "next";
import { Barlow_Semi_Condensed, Noto_Sans_TC } from "next/font/google";

import NavBar from "@/app/components/NavBar";
import Providers from "@/app/providers";
import "./globals.css";

// 中文：Noto Sans TC。要用到最粗的 900（站名、標題），像車站站牌的粗黑體
const notoSansTC = Noto_Sans_TC({
  weight: ["400", "700", "900"],
  subsets: ["latin"],
  variable: "--font-noto-sans-tc", // globals.css 用這個名字接上
});

// 時間、數字：Barlow Semi Condensed，參考道路和交通號誌設計的字型
const barlow = Barlow_Semi_Condensed({
  weight: ["500", "700"],
  subsets: ["latin"],
  variable: "--font-barlow",
});

export const metadata: Metadata = {
  title: "Easy Travel Scheduler",
  description: "輸入城市，AI 幫你找景點",
};

// 每一頁的外框：<html>、<body> 只寫在這裡，children 就是各頁的內容
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="zh-Hant"
      className={`${notoSansTC.variable} ${barlow.variable}`}
    >
      <body className="min-h-screen bg-platform font-sans text-ink">
        <Providers>
          <NavBar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
