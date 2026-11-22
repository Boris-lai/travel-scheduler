"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import AuthCorner from "@/app/components/AuthCorner";

const LINKS = [
  { href: "/", label: "搜尋景點" },
  { href: "/trips", label: "我的行程" },
];

// 網站的標誌：三個車站連成一條線，顏色是第 1、2、3 天的路線色
function RouteMark() {
  return (
    <svg width="44" height="14" viewBox="0 0 44 14" aria-hidden="true">
      <line x1="7" y1="7" x2="37" y2="7" stroke="white" strokeWidth="3" />
      <circle
        cx="7"
        cy="7"
        r="5"
        fill="#E5302F"
        stroke="white"
        strokeWidth="2"
      />
      <circle
        cx="22"
        cy="7"
        r="5"
        fill="#0072BC"
        stroke="white"
        strokeWidth="2"
      />
      <circle
        cx="37"
        cy="7"
        r="5"
        fill="#009B4E"
        stroke="white"
        strokeWidth="2"
      />
    </svg>
  );
}

// 每一頁最上面的導覽列：深藍色的站牌。畫面窄的時候（手機），連結收進「選單」
export default function NavBar() {
  const pathname = usePathname(); // 現在在哪一頁，用來標出「你在這裡」
  const [open, setOpen] = useState(false); // 手機版的選單有沒有打開

  // 「我的行程」底下的編輯頁（/trips/1）也算在「我的行程」
  function isCurrent(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  const links = LINKS.map((link) => (
    <Link
      key={link.href}
      href={link.href}
      onClick={() => setOpen(false)} // 點了就換頁，選單也收起來
      aria-current={isCurrent(link.href) ? "page" : undefined}
      // w-fit：寬度跟著字，手機版直排的時候，底線才不會拉滿整行
      className={`w-fit border-b-4 py-1 ${
        isCurrent(link.href)
          ? "border-white text-white"
          : "border-transparent text-white/70 hover:text-white"
      }`}
    >
      {link.label}
    </Link>
  ));

  return (
    <nav className="bg-ink text-white">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3 font-black">
          <RouteMark />
          Easy Travel Scheduler
        </Link>

        {/* 桌機：連結和登入都排在同一行 */}
        <div className="hidden flex-1 items-center gap-6 md:flex">
          {links}
          <div className="ml-auto">
            <AuthCorner />
          </div>
        </div>

        {/* 手機：只有一個「選單」按鈕 */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="ml-auto rounded-full border border-white/60 px-4 py-1 text-sm md:hidden"
        >
          {open ? "關閉" : "選單"}
        </button>
      </div>

      {/* 手機版打開的選單：連結一行一個，最下面是登入 */}
      {open && (
        <div
          id="mobile-menu"
          className="flex flex-col gap-3 border-t border-white/20 px-4 py-4 md:hidden"
        >
          {links}
          <div className="pt-2">
            <AuthCorner />
          </div>
        </div>
      )}
    </nav>
  );
}
