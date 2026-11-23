# 第 9 課：畫面美化（路線圖風格）

> **狀態**：第 1 段（站牌和路線色）✅ ／ 第 2 段（首頁）✅ ／ 第 3 段（景點照片）✅ ／ 插曲（搜尋比對）✅ ／ 第 4 段（編輯頁）⏳
> **日期**：2026-11-21 ～
> **對照原專案**：`frontend/app/globals.css`、`frontend/app/layout.tsx`、`frontend/app/components/layout/`、`frontend/app/components/home/`、`frontend/app/components/ui/`

---

## 這一課在整個專案的位置

功能到第 8 課都做完了，但畫面還是 Tailwind 預設的灰底、藍按鈕。這一課把原專案的畫面美化（照片、動畫、通知、導覽、首頁大圖……）**全部都做**，但**不照原專案的樣子**，換一個自己的風格。

### 設計規劃：路線圖

原專案是淡紫白的底色、藍色按鈕、首頁好幾張風景照輪流淡入淡出、一張張圓角卡片，是很常見的網站樣板。我們從「排行程」這件事本身找風格：**一天就是一條路線，一個景點就是一個車站**，跟東京、台北捷運的路線圖一樣。

**顏色**

| 名字 | 色碼 | 用在哪 |
|---|---|---|
| 月台灰 | `#ECEFF3` | 整個網站的底色 |
| 站牌白 | `#FFFFFF` | 內容放在這上面 |
| 站名藍 | `#13294B` | 文字、導覽列、主要按鈕 |
| 次要字 | `#5B6B82` | 說明、日期 |
| 路線色 | 第 1 天紅 `#E5302F`、第 2 天藍 `#0072BC`、第 3 天綠 `#009B4E`、第 4 天橘 `#F08300`、第 5 天紫 `#8E4F9E`，超過就從頭輪 | **只用在「哪一天」** |

**字型**

- 站名、標題：Noto Sans TC **Black（900，最粗）**，像車站站牌的粗黑體。
- 內文：Noto Sans TC 一般粗細。
- 時間、數字：Barlow Semi Condensed，參考道路和交通號誌設計的字型。

**四個原則**

1. **路線就是資料**：每一天一條線、每一站一個圓點；兩站之間的線型代表交通方式。不加沒有意義的裝飾。
2. **站牌，不是卡片**：內容放在白色站牌上，用細框線；不是每一塊都加一樣的灰色陰影。
3. **只有一個地方會自己動**：首頁那條路線會畫出來。其他動畫都是回應你的動作（打開、存檔、刪除）。
4. **不用樣板上常見的小把戲**：不在標題上面加英文小標；「3 天・12/20 出發」這種用 `・` 串起來的寫法也會改掉。

### 7 段

| 段 | 做什麼 | 新東西 |
|---|---|---|
| **1** | 站牌和路線色：字型、顏色、導覽列改成站牌、手機版選單、每一天的路線分頁 | Tailwind 的 `@theme`、`next/font` |
| 2 | 首頁：會自己畫出來的路線圖（首頁大圖），熱門城市是線上的車站（熱門搜尋），搜尋結果卡片換新樣式 | SVG 動畫 |
| 3 | 景點照片：後端去 Google 拿照片網址（Google 不准存，所以不快取），搜尋結果的卡片顯示照片和拍照的人 | Google 照片 API、`IntersectionObserver` |
| 4 | 編輯頁變成路線圖：交通方式畫在線上、地圖圖釘換成路線色、自訂時間選單、景點池加照片 | — |
| 5 | 回饋：通知、存檔彩帶（用路線色）、動畫 | `react-hot-toast`、`canvas-confetti`、`framer-motion` |
| 6 | 導覽：第一次進編輯頁的「乘車指南」 | `driver.js` |
| 7 | 探索：「公開到探索」的開關（預設不公開），首頁顯示「其他人的路線」 | — |

每一段改完，那幾頁就換成新風格；還沒輪到的頁面會先維持原本的藍色按鈕，到它那一段再換。

---

## 第 1 段：站牌和路線色

### 開始前的測試結果（2026-11-21）

我先在另一份複製的前後端測過，用 Chrome 截圖看實際的樣子（桌機 1280 寬、手機 390 寬）：

| 測試 | 結果 |
|---|---|
| 整個網站的底色 | 月台灰 `rgb(236, 239, 243)` |
| 字型 | 內文是 Noto Sans TC；分頁上的數字、日期是 Barlow Semi Condensed |
| 導覽列 | 深藍色站牌：左邊三個車站連成一線的標誌 ＋ 粗黑體的網站名稱；右邊「哈囉，小明」和白框的「登出」 |
| 你在這裡 | 在「我的行程」或編輯頁（`/trips/1`），「我的行程」下面有白色粗底線；在首頁是「搜尋景點」 |
| 編輯頁的分頁 | 「① 第 1 天 12/20」紅圈、② 藍、③ 綠；選中的那一天外面有一圈它的路線色 |
| 分享頁 | 一樣的路線分頁 |
| 手機寬度 | 導覽列只剩標誌、名稱、「選單」按鈕；按下去展開，連結一行一個，最下面是登入；點連結換頁後選單自己收起來 |
| 手機寬度的橫向捲軸 | 沒有 |
| 主控台 | 沒有錯誤 |

畫面截下來之後我自己檢查過一次，發現手機選單裡「我的行程」的底線拉滿整行，加了 `w-fit` 修好了（步驟 7 會說明）。

### 1. 學到的觀念

#### Tailwind 的 `@theme`：自己的顏色名字

```css
@theme {
  --color-ink: #13294b;
}
```

在 `@theme` 裡寫 `--color-名字`，Tailwind 就會多出 `text-名字`、`bg-名字`、`border-名字` 這些 class。所以之後寫 `text-ink`、`bg-platform`，不用到處貼 `#13294b`；哪天要換顏色，只改這一個地方。字型一樣：`--font-num` 就有 `font-num`。

字型的變數是 `next/font` 給的，寫在 `@theme inline` 裡：`inline` 是「直接用那個變數」，不要先算出值，因為字型的變數是 `<html>` 上才有的。

#### `next/font`：字型跟著網站一起送

```ts
const notoSansTC = Noto_Sans_TC({ weight: ["400", "700", "900"], variable: "--font-noto-sans-tc", ... });
<html className={notoSansTC.variable}>
```

- `next/font/google` 在開發、建置時把 Google 的字型**下載下來，跟網站放在一起**。使用者的瀏覽器不用另外去連 Google，也不會出現「先用別的字型、過一下才換成正確的字型」那一下跳動。
- `variable`：把字型變成一個 CSS 變數，放在 `<html>` 上，`globals.css` 再接起來用。
- `weight`：只下載用得到的粗細。中文字型很大，不用的粗細不要載。

#### 算出來的顏色，用 `style`

```tsx
<span style={{ backgroundColor: lineColor(day) }} className="rounded-full ...">
```

Tailwind 是在**建置的時候**掃過你的程式，看到 `bg-red-500` 這種完整的字，才產生那個 class。寫成 `` `bg-[${color}]` `` 這種拼起來的字，它掃不到，就不會有效果。所以「第幾天是什麼顏色」這種執行時才算出來的值，直接用 `style`。

#### 你在這裡：`usePathname` ＋ `aria-current`

```tsx
const pathname = usePathname(); // 例如 "/trips/1"
<Link aria-current={isCurrent(link.href) ? "page" : undefined}>
```

- `usePathname()`：拿到現在的網址，判斷要在哪個連結下面畫底線。編輯頁 `/trips/1` 也算「我的行程」，所以用 `startsWith`。
- `aria-current="page"`：告訴螢幕閱讀器「這是目前這一頁」，看不到畫面的人也知道自己在哪。

#### 手機版選單

```tsx
<div className="hidden md:flex">...桌機的連結...</div>
<button className="md:hidden">選單</button>
```

- `md:` 是「畫面寬度 768px 以上才套用」。`hidden md:flex`：手機隱藏、桌機顯示；`md:hidden`：反過來。
- 選單有沒有打開，用一個 `useState` 記著；點了連結就關起來。
- `aria-expanded`：告訴螢幕閱讀器這個按鈕現在是打開還是關著。

#### 一樣的東西，做成一個元件

編輯頁和分享頁都有「第 1 天、第 2 天……」的分頁，程式碼幾乎一樣。第 8 課把 `dayDate` 搬到 `lib` 共用，這次把整個分頁做成 `DayTabs` 元件。改一次，兩頁一起變。

### 2. 實作步驟

這一段**只改前端**，不用裝套件（`next/font` 是 Next.js 內建的）。

#### 步驟 1：`app/globals.css` 整個換掉

```css
@import "tailwindcss";

/* 路線圖風格的顏色和字型。寫在 @theme 裡，Tailwind 就會多出對應的 class：
   --color-ink → text-ink、bg-ink、border-ink；--font-num → font-num */
@theme {
  --color-platform: #eceff3; /* 月台灰：整個網站的底色 */
  --color-board: #ffffff; /* 站牌白：內容放在這上面 */
  --color-ink: #13294b; /* 站名藍：文字、導覽列、主要按鈕 */
  --color-ink-2: #5b6b82; /* 次要的字：說明、日期 */
  --color-rule: #d5dbe3; /* 站牌的細框線 */
}

/* 字型是 layout.tsx 用 next/font 載入的，這裡接上它給的變數名稱 */
@theme inline {
  --font-sans: var(--font-noto-sans-tc), system-ui, sans-serif;
  --font-num: var(--font-barlow), var(--font-noto-sans-tc), sans-serif;
}

/* 用鍵盤（Tab）移動時，看得到現在在哪個按鈕上 */
:focus-visible {
  outline: 3px solid #0072bc;
  outline-offset: 2px;
}
```

`:focus-visible`：用鍵盤 Tab 移動時，現在在哪個按鈕上，會有一圈藍框。用滑鼠點的時候不會出現。

#### 步驟 2：新增 `app/lib/lineColors.ts`

```ts
// 每一天一個路線色，像捷運一樣：第 1 天紅線、第 2 天藍線……超過 5 天就從頭輪
const LINE_COLORS = ["#E5302F", "#0072BC", "#009B4E", "#F08300", "#8E4F9E"];

export function lineColor(day: number) {
  return LINE_COLORS[(day - 1) % LINE_COLORS.length];
}
```

`(day - 1) % LINE_COLORS.length`：`%` 是除完的餘數。第 6 天是 `5 % 5 = 0`，又回到第一個顏色。

#### 步驟 3：新增 `app/components/DayTabs.tsx`

```tsx
"use client";

import { dayDate } from "@/app/lib/dayDate";
import { lineColor } from "@/app/lib/lineColors";

type Props = {
  days: number; // 總共幾天
  startDate: string | null; // 出發日，用來算每一天的日期
  activeDay: number; // 現在看第幾天
  onChange: (day: number) => void;
};

// 每一天的分頁：像路線圖上的路線標誌，第幾天就是第幾號線，顏色就是那一天的路線色
export default function DayTabs({ days, startDate, activeDay, onChange }: Props) {
  const dayNumbers = Array.from({ length: days }, (_, i) => i + 1); // 例如 [1, 2, 3]

  return (
    <div className="flex flex-wrap gap-2">
      {dayNumbers.map((day) => {
        const active = day === activeDay;
        return (
          <button
            key={day}
            type="button"
            onClick={() => onChange(day)}
            aria-pressed={active}
            // 顏色是算出來的，Tailwind 的 class 要寫死的字串才有用，所以用 style
            style={{ borderColor: active ? lineColor(day) : "transparent" }}
            className={`flex items-center gap-2 rounded-full border-2 py-1 pr-4 pl-1 text-sm ${
              active
                ? "bg-board font-bold text-ink"
                : "text-ink-2 hover:bg-board"
            }`}
          >
            <span
              style={{ backgroundColor: lineColor(day) }}
              className="flex h-7 w-7 items-center justify-center rounded-full font-num text-base font-bold text-white"
            >
              {day}
            </span>
            第 {day} 天
            <span className="font-num text-ink-2">
              {dayDate(startDate, day)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

`aria-pressed`：告訴螢幕閱讀器「這個按鈕現在是按下去的」（選中的那一天）。

#### 步驟 4：編輯頁 `app/trips/[tripId]/page.tsx` 改四個地方

**① import**：刪掉 `import { dayDate } from "@/app/lib/dayDate";` 那一行（日期改在 `DayTabs` 裡算了），然後 `ShareBox` 那行的**上面**加：

```tsx
import DayTabs from "@/app/components/DayTabs";
```

**② 刪掉**這一行（天數的陣列也搬進 `DayTabs` 了）：

```tsx
  const dayNumbers = Array.from({ length: trip.days }, (_, i) => i + 1); // 例如 [1, 2, 3]
```

**③ 「右邊：每日行程」下面的分頁**：從 `<div className="mb-4 flex flex-wrap gap-2">` 到它的 `</div>` 為止，換成：

```tsx
          <div className="mb-4">
            <DayTabs
              days={trip.days}
              startDate={trip.start_date}
              activeDay={activeDay}
              onChange={changeDay}
            />
          </div>
```

`onChange={changeDay}`：換天時一樣走原本的 `changeDay`，有草稿就會先問你要不要放棄。

#### 步驟 5：分享頁 `app/share/[token]/page.tsx` 改三個地方

**① import**：`TripMap`、`getSharedTrip`、`dayDate` 這三行 import 換成：

```tsx
import DayTabs from "@/app/components/DayTabs";
import TripMap from "@/app/components/TripMap";
import { getSharedTrip } from "@/app/lib/api";
```

**② 刪掉** `const dayNumbers = ...` 那一行。

**③ 分頁**：從 `<div className="mb-4 flex flex-wrap gap-2">` 到它的 `</div>` 為止，換成：

```tsx
      <div className="mb-4">
        <DayTabs
          days={trip.days}
          startDate={trip.start_date}
          activeDay={activeDay}
          onChange={setActiveDay}
        />
      </div>
```

#### 步驟 6：`app/components/AuthCorner.tsx` 整個換掉

導覽列變成深藍色，登入、登出的字要改成白色：

```tsx
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { logout } from "@/app/lib/api";
import { useMe } from "@/app/lib/useMe";

// 導覽列右邊：沒登入顯示「登入／註冊」，登入了顯示名字和「登出」（放在深藍色的站牌上）
export default function AuthCorner() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me, isPending } = useMe();

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // 小白板上的資料可能是上一個人的（例如他的行程）：全部清回空白，畫面上正在用的會重新抓
      queryClient.resetQueries();
      router.push("/");
    },
  });

  // 還不知道有沒有登入：先什麼都不顯示，免得「登入」閃一下又變成名字
  if (isPending) return null;

  if (!me) {
    return (
      <Link
        href="/login"
        className="rounded-full border border-white/60 px-4 py-1 text-white hover:bg-white hover:text-ink"
      >
        登入／註冊
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-white/80">哈囉，{me.name}</span>
      <button
        type="button"
        onClick={() => logoutMutation.mutate()}
        disabled={logoutMutation.isPending}
        className="rounded-full border border-white/60 px-4 py-1 text-sm text-white hover:bg-white hover:text-ink disabled:opacity-50"
      >
        登出
      </button>
    </div>
  );
}
```

只改了樣式（`className`），邏輯跟第 8 課一樣。

#### 步驟 7：新增 `app/components/NavBar.tsx`

```tsx
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
      <circle cx="7" cy="7" r="5" fill="#E5302F" stroke="white" strokeWidth="2" />
      <circle cx="22" cy="7" r="5" fill="#0072BC" stroke="white" strokeWidth="2" />
      <circle cx="37" cy="7" r="5" fill="#009B4E" stroke="white" strokeWidth="2" />
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
```

- `RouteMark`：網站的標誌，用 SVG 畫三個車站連成一條線。`aria-hidden`：這只是裝飾，螢幕閱讀器跳過它，旁邊的網站名稱就夠了。
- `links` 先做好一份，桌機和手機版選單都用它。
- `w-fit`：手機版的連結是一行一個，不加的話，連結會撐滿整行，底線就拉得很長。
- 為什麼要獨立一個 `NavBar`？`usePathname`、`useState` 只能在 `"use client"` 的元件裡用，`layout.tsx` 不是。

#### 步驟 8：`app/layout.tsx` 整個換掉

```tsx
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
    <html lang="zh-Hant" className={`${notoSansTC.variable} ${barlow.variable}`}>
      <body className="min-h-screen bg-platform font-sans text-ink">
        <Providers>
          <NavBar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

- `<html className=...>`：把兩個字型的變數掛上去，`globals.css` 才接得到。
- `<body>`：`bg-platform`、`text-ink`、`font-sans` 都是步驟 1 自己定義的。
- 原本寫在這裡的 `<nav>` 搬進 `NavBar` 了，`Link`、`AuthCorner` 的 import 也跟著拿掉。

#### 步驟 9：測試

`npm run dev` 開著的話，存檔就會更新（第一次會花幾秒下載字型）。打開 http://localhost:3000 。

**① 字和顏色**

1. 底色變成淡淡的灰藍色，字是深藍色。
2. 最上面是深藍色的導覽列：左邊紅、藍、綠三個圓點連成一線，旁邊是粗黑體的「Easy Travel Scheduler」。
3. `Cmd + Option + I` → **Elements**，點 `<html>`：`class` 裡有兩個名字，一個 `noto_sans_tc_` 開頭、一個 `barlow_semi_condensed_` 開頭，就是兩個字型。點右邊的 **Computed**，搜尋 `font-family` → `"Noto Sans TC"`。

**② 你在這裡**

1. 首頁：「搜尋景點」下面有白色底線。
2. 點「我的行程」→ 底線移到「我的行程」。
3. 點進京都三日遊（`/trips/1`）→ 還是「我的行程」有底線。

**③ 路線分頁**

1. 編輯頁右邊上面：「① 第 1 天 12/20」紅色圓圈，外面一圈紅框。
2. 點第 2 天 → 藍色那顆有框；第 3 天 → 綠色。數字和日期是比較窄的 Barlow 字。
3. 有草稿（拖拉過、還沒儲存）的時候換天，一樣會先問你。

**④ 手機版**

1. 開發者工具開著，按 `Cmd + Shift + M`（切換裝置模式），上面選一支手機（例如 iPhone 12 Pro）。
2. 導覽列只剩標誌、名稱和「選單」。
3. 按「選單」→ 展開：搜尋景點、我的行程（目前這頁有底線，只在字下面）、哈囉小明和登出。按鈕變成「關閉」。
4. 點「搜尋景點」→ 換頁，選單自己收起來。
5. 再按一次 `Cmd + Shift + M` 回到桌機。

**⑤ 鍵盤**

在任何一頁按幾下 `Tab` → 目前所在的連結、按鈕外面有藍框。

還是藍色的按鈕、編號（例如「建立行程」、編輯頁的 ①②③④），是第 2、4 段要換的，這一段先不動。

### 3. 這一段結束後的資料夾

```
frontend/app/
├── components/
│   ├── AuthCorner.tsx     ← 改：白字，放在深藍色的導覽列上
│   ├── DayTabs.tsx        ← 新增：每一天的路線分頁
│   └── NavBar.tsx         ← 新增：站牌導覽列 ＋ 手機版選單
├── globals.css            ← 改：路線圖的顏色、字型
├── layout.tsx             ← 改：載入字型、換成 NavBar
├── lib/
│   └── lineColors.ts      ← 新增：第幾天是什麼顏色
├── share/[token]/
│   └── page.tsx           ← 改：分頁換成 DayTabs
└── trips/[tripId]/
    └── page.tsx           ← 改：分頁換成 DayTabs
```

### 4. 跟原專案對照

| 項目 | 原專案 | 我們 |
|---|---|---|
| 底色 | 淡紫白 `#f9f9ff` | 月台灰 `#ECEFF3` |
| 主要顏色 | 藍色（`blue-600`） | 站名藍 `#13294B`；鮮豔的顏色只用來代表「第幾天」 |
| 字型 | `next/font` 載了 Geist，`globals.css` 卻寫 Plus Jakarta Sans（這個字型其實沒有載入） | Noto Sans TC（標題用 900）＋ Barlow Semi Condensed（數字） |
| 導覽列 | 白底，手機版是漢堡按鈕 ＋ 下拉清單動畫 | 深藍站牌，手機版是「選單」按鈕，展開後一行一個 |
| 第幾天的分頁 | 一般的按鈕 | 路線徽章：圓圈裡是天數，顏色是那一天的路線色 |
| 顏色寫在哪 | 到處直接寫 Tailwind 的顏色 | `@theme` 定義自己的名字（`ink`、`platform`……） |

### 5. 常見踩雷

| 症狀 | 原因 | 解法 |
|---|---|---|
| 導覽列不是深藍色、整頁是白底，網站名稱看不見（白字在白底上）；分頁的紅藍圓圈卻正常（2026-11-22 你實際遇到的） | `globals.css` 沒寫錯，是開發伺服器的快取（`.next` 資料夾）還在用**舊版** `globals.css` 的編譯結果，新加的 `@theme` 沒進去。分頁的圓圈是用 `style` 寫的顏色，不經過 Tailwind，所以不受影響 | `npm run dev` 按 `Ctrl + C` 停掉，在 `frontend` 執行 `rm -rf .next`，再 `npm run dev`。`.next` 只有自動產生的暫存檔，刪掉會自己重建 |
| 字型沒變，還是系統的字 | `layout.tsx` 的 `<html>` 沒有掛 `className`，或 `globals.css` 的變數名稱跟 `variable` 對不起來 | `--font-noto-sans-tc`、`--font-barlow` 兩邊要一模一樣 |
| `npm run dev` 出現 `Failed to download ... from Google Fonts` | 第一次要連網路下載字型 | 確認有網路，重開 `npm run dev` |
| `text-ink`、`bg-platform` 沒效果 | `@theme` 裡的名字打錯，要是 `--color-ink`、`--color-platform` | 對照步驟 1 |
| 分頁的圓圈沒有顏色 | 用了 `` className={`bg-[${color}]`} `` 這種拼起來的 class | 用 `style={{ backgroundColor: ... }}`（觀念「算出來的顏色，用 style」） |
| lint 說 `'dayNumbers' is assigned a value but never used` | 編輯頁、分享頁的 `dayNumbers` 沒刪 | 步驟 4 ②、步驟 5 ② |
| 手機版選單的底線拉滿整行 | 連結少了 `w-fit` | 對照步驟 7 |
| 左下角有一個「N」的小圓圈、右下角一棵棕櫚樹 | Next.js 和 TanStack Query 的開發工具 | 只在 `npm run dev` 出現，上線不會有 |

### 📌 這一段的 3 個重點

1. **顏色、字型定義在一個地方**：`@theme` 裡寫 `--color-ink`，就能到處用 `text-ink`；要換顏色只改一行。
2. **算出來的值用 `style`**：Tailwind 只認得寫死的 class，「第幾天是什麼顏色」這種執行時才知道的，用 `style`。
3. **一樣的東西做成元件**：兩頁都有的分頁做成 `DayTabs`，導覽列做成 `NavBar`，改一次全部跟著變。

### 6. 小測驗

（提示：每題都可以用「如果不這樣做，會發生什麼壞事？」來想。）

1. 為什麼要在 `@theme` 定義 `--color-ink`，不直接在每個地方寫 `text-[#13294b]`？
2. `DayTabs` 的圓圈為什麼用 `style={{ backgroundColor: lineColor(day) }}`，不用 `` className={`bg-[${lineColor(day)}]`} ``？
3. 字型為什麼用 `next/font` 下載下來，不在 `globals.css` 寫 `@import url("https://fonts.googleapis.com/...")`？
4. 為什麼導覽列要獨立成 `NavBar`，不直接寫在 `layout.tsx` 裡？

<details>
<summary>點開看解答</summary>

1. 同一個顏色會用在幾十個地方。直接寫色碼的話，要換顏色就得一個一個找出來改，漏一個就顏色不一致；而且 `#13294b` 看不出是什麼意思。定義成 `ink`，名字就說明了用途，換顏色只改 `@theme` 一行。
2. Tailwind 是在建置的時候掃程式碼，看到完整的 class 名字才產生那個樣式。拼起來的字串它掃不到，就不會產生，圓圈就沒有顏色。執行時才算出來的值，用 `style` 直接給瀏覽器。
3. 用 `@import` 的話，使用者的瀏覽器要先去連 Google 才拿得到字型：多一次連線比較慢，字型到之前會先用別的字型顯示，到了再換，畫面會跳一下。`next/font` 在建置時就下載好，跟網站一起送出去。
4. 導覽列要知道「現在在哪一頁」（`usePathname`）和「手機選單有沒有打開」（`useState`），這兩個都只能在 `"use client"` 的元件裡用。`layout.tsx` 是每一頁的外框，不適合整個變成 client 元件，所以把需要的部分獨立出來。

</details>

#### 你的實作紀錄（2026-11-22）

- 打完之後畫面顏色怪怪的：導覽列不是深藍色、整頁白底，只看得到三個圓點和分頁的紅藍圓圈。查了你的 3000 實際送出來的 CSS，裡面那段 `globals.css` 是**舊版**的（只有 `@import "tailwindcss";`），沒有 `--color-ink`、`bg-platform`。程式碼是對的，是 `.next` 快取（從 10/29 開始累積了 215 MB）沒有更新到。`rm -rf .next` 再重開就好了，已經加進上面的常見踩雷，根目錄的 README 也加了一行。
- 清掉快取之後，前端 8 個檔案都正確：`globals.css`、`AuthCorner.tsx` 跟教材一模一樣；其他只差編輯器自動排版，`lineColors.ts` 多了你自己寫的 `%` 說明。型別檢查、lint 都通過。
- 用 Chrome 開一個沒有 cookie 的視窗看你的 3000（只看不改）：底色 `rgb(236, 239, 243)`（月台灰）、導覽列 `rgb(19, 41, 75)`（站名藍）、字型 Noto Sans TC，「我的行程」下面有白色底線。主控台沒有錯誤。

---

## 第 2 段：首頁（路線圖大圖 ＋ 熱門城市 ＋ 景點卡片）

### 開始前的測試結果（2026-11-22）

我先在另一份複製的前後端測過，用 Chrome 截圖（桌機 1280 寬、手機 390 寬）：

| 測試 | 結果 |
|---|---|
| 打開首頁 | 大字「想去哪裡？」、一行說明、深藍框的大搜尋框和深藍「搜尋」按鈕 |
| 下面的路線 | 一條紅線從左往右畫出來（1.4 秒），畫到哪一站，那一站的圓圈就冒出來：札幌、名古屋、京都、大阪、廣島、福岡 |
| 點「京都」那一站 | 輸入框變成「京都」，下面出現「京都 26 個景點」 |
| 結果的標題列 | 左邊「京都 26 個景點」，右邊「加入到 [選一個行程]」，下面一條深藍粗線 |
| 選「京都三日遊」 | 已經在景點池的卡片顯示「✓ 已加入」，其他是白底深藍框的「加入＋」 |
| 景點卡片 | 白底細框，站名用最粗的字，下面一行是地區，再下面是介紹 |
| 手機寬度 | 路線縮成一排六站，沒有橫向捲軸 |
| 開啟「減少動態效果」 | 一打開路線就是完整的，車站直接顯示，不播動畫 |
| 主控台 | 沒有錯誤 |

截圖之後我自己檢查過：一開始路線只佔畫面左邊 6 成，右邊空一大塊，當首頁大圖不夠有份量，所以改成撐滿整個寬度、線再粗一點、車站再大一點。

### 1. 學到的觀念

#### 首頁的大圖，就是一條路線

原專案的首頁是好幾張風景照輪流淡入淡出。我們的首頁大圖是**一條路線**：這個網站做的事就是把景點排成路線，打開網站第一眼就看到。

線上的車站就是**熱門城市**，點了直接搜尋。這 6 個城市是從你的資料庫裡挑的：都已經搜過、資料庫裡有景點，點了馬上出結果，不會再派 AI 去找，也不會花 Gemini 的額度。由北往南排（札幌 → 福岡），剛好像一條日本的縱貫線。

#### 線怎麼「畫」出來：虛線的偏移

```tsx
<line pathLength="1" className="route-draw" />
```

```css
.route-draw {
  stroke-dasharray: 1;   /* 虛線：畫 1、空 1、畫 1、空 1…… */
  stroke-dashoffset: 1;  /* 整個往後推 1 */
  animation: draw-line ...;  /* 偏移從 1 慢慢變成 0 */
}
```

- `pathLength="1"`：不管這條線實際多長，都把它的長度**當成 1**。
- `stroke-dasharray: 1`：把線變成虛線，每一段「畫的部分」長 1、「空的部分」也長 1。整條線長度是 1，所以剛好是「整條都畫」，後面接一段空的。
- `stroke-dashoffset: 1`：把虛線往後推 1，畫的那一段被推到線外面，看起來就是**一條線都沒有**。
- 動畫把偏移從 1 慢慢變成 0，畫的那一段就從左邊一點一點推進來，看起來像有人在畫線。

#### 線畫到哪，車站就冒到哪

```tsx
animationDelay: `${(DRAW_SECONDS * i) / (CITIES.length - 1)}s`
```

線花 1.4 秒畫完，第 `i` 站在整條線的 `i / 5` 的位置（0、1/5、2/5……），所以它的動畫延遲 `1.4 × i / 5` 秒才開始。`DRAW_SECONDS` 只寫在元件裡一個地方，線的時間（`animationDuration`）和車站的延遲都用它，改一個數字兩邊一起變。

#### 線放在哪裡：疊在車站下面

```
┌──────┬──────┬──────┬──────┬──────┬──────┐
│  ●   │  ●   │  ●   │  ●   │  ●   │  ●   │   ← 6 個車站，每個佔 1/6 寬
└──────┴──────┴──────┴──────┴──────┴──────┘
   ├────────────────────────────────┤          ← 線：從第一站的圓心到最後一站的圓心
```

每一站佔 1/6 寬，圓心在那一格的正中間，所以第一站的圓心離左邊 `1/12`（`50% / 6`），最後一站離右邊也是。線用 `absolute` 疊在車站後面，`left`、`right` 都設成這個距離。

#### 只有這一個地方會自己動

整個網站只有這條線會自己播動畫（設計規劃的原則 3）。而且有些人會在系統設定裡開「減少動態效果」（看到動畫會頭暈），`@media (prefers-reduced-motion: reduce)` 就是給他們的：不播動畫，直接顯示畫好的樣子。

#### 狀態放在誰那裡

`HomeHero` 只管「長什麼樣子」，搜尋的狀態（`keyword`、`searched`）還是放在首頁 `page.tsx`：

```tsx
<HomeHero
  keyword={keyword}
  onKeywordChange={setKeyword}
  onSearch={startSearch}
  searching={isFetching}
/>
```

因為搜尋結果、SSE 等待都在首頁，狀態放在用得到它的那一層，再把值和「改的方法」傳下去。點熱門城市時，`HomeHero` 呼叫 `onKeywordChange(city)` 把輸入框填上，再呼叫 `onSearch(city)`，跟按「搜尋」走同一條路（`startSearch`）。

#### Tailwind 的 `group`

```tsx
<button className="group ...">
  <span className="... group-hover:bg-[#E5302F]" />   ← 圓圈
  <span className="... group-hover:underline">京都</span>
</button>
```

在外層加 `group`，裡面就能用 `group-hover:`：**滑鼠移到整顆按鈕上**時，圓圈變實心、字加底線，不用一個一個移上去。

### 2. 實作步驟

這一段**只改前端**。

#### 步驟 10：`app/globals.css` 最下面加上

```css
/* 首頁的路線：從左畫到右。線加了 pathLength="1"，整條線的長度就當成 1 */
@keyframes draw-line {
  from {
    stroke-dashoffset: 1;
  }
  to {
    stroke-dashoffset: 0;
  }
}
.route-draw {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: draw-line linear forwards; /* 要畫多久，在元件裡用 style 給 */
}

/* 線畫到哪一站，那一站就冒出來 */
@keyframes station-in {
  from {
    opacity: 0;
    transform: scale(0.3);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
.station-in {
  animation: station-in 0.3s ease-out both;
}

/* 系統設定了「減少動態效果」的人：不播動畫，直接顯示畫好的樣子 */
@media (prefers-reduced-motion: reduce) {
  .route-draw,
  .station-in {
    animation: none;
    stroke-dashoffset: 0;
  }
}
```

#### 步驟 11：新增 `app/components/HomeHero.tsx`

```tsx
"use client";

// 熱門城市：都是資料庫裡已經有景點的城市，點了馬上有結果。從北到南排，像一條縱貫線
const CITIES = ["札幌", "名古屋", "京都", "大阪", "廣島", "福岡"];
const LINE = "#E5302F"; // 第 1 號線的紅色
const DRAW_SECONDS = 1.4; // 路線從頭畫到尾要幾秒

type Props = {
  keyword: string;
  onKeywordChange: (value: string) => void;
  onSearch: (location: string) => void;
  searching: boolean;
};

// 首頁最上面：大標題、搜尋框、一條會自己畫出來的路線（熱門城市是線上的車站）
export default function HomeHero({
  keyword,
  onKeywordChange,
  onSearch,
  searching,
}: Props) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); // 表單送出時，瀏覽器預設會重新整理頁面，把它擋掉
    onSearch(keyword.trim());
  }

  function pickCity(city: string) {
    onKeywordChange(city); // 輸入框也填上這個城市
    onSearch(city);
  }

  // 第一站、最後一站的圓心，離左右兩邊多遠：每一站佔 1/6 寬，圓心在正中間
  const edge = `${50 / CITIES.length}%`;

  return (
    <section className="py-10 sm:py-16">
      <h1 className="text-4xl leading-tight font-black sm:text-6xl">
        想去哪裡？
      </h1>
      <p className="mt-3 max-w-xl text-ink-2">
        輸入城市，AI 幫你找景點；再把每一天排成一條路線。
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex max-w-2xl gap-2">
        <input
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder="例如：京都"
          aria-label="想去的城市"
          className="min-w-0 flex-1 rounded-md border-2 border-ink bg-board px-4 py-3 text-xl font-bold placeholder:font-normal placeholder:text-ink-2"
        />
        <button
          type="submit"
          disabled={searching}
          className="rounded-md bg-ink px-6 py-3 text-lg font-bold text-white hover:bg-ink/85 disabled:opacity-50"
        >
          {searching ? "搜尋中…" : "搜尋"}
        </button>
      </form>

      <div className="mt-12">
        <p className="mb-4 text-sm text-ink-2">或是從這條路線上挑一站：</p>
        <div className="relative">
          {/* 路線：從第一站的圓心，畫到最後一站的圓心 */}
          <div
            className="absolute top-[10px] h-2"
            style={{ left: edge, right: edge }}
            aria-hidden="true"
          >
            <svg
              className="block h-full w-full"
              viewBox="0 0 100 8"
              preserveAspectRatio="none"
            >
              <line
                x1="0"
                y1="4"
                x2="100"
                y2="4"
                stroke={LINE}
                strokeWidth="8"
                pathLength="1"
                className="route-draw"
                style={{ animationDuration: `${DRAW_SECONDS}s` }}
              />
            </svg>
          </div>

          {/* 車站：線畫到哪一站，那一站就冒出來 */}
          <ol className="relative flex">
            {CITIES.map((city, i) => (
              <li key={city} className="flex-1">
                <button
                  type="button"
                  onClick={() => pickCity(city)}
                  disabled={searching}
                  className="group flex w-full flex-col items-center gap-2"
                >
                  <span
                    className="station-in h-7 w-7 rounded-full border-[6px] border-[#E5302F] bg-board group-hover:bg-[#E5302F]"
                    style={{
                      animationDelay: `${(DRAW_SECONDS * i) / (CITIES.length - 1)}s`,
                    }}
                  />
                  <span className="text-sm font-bold group-hover:underline sm:text-lg">
                    {city}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
```

- `CITIES`：熱門城市。如果之後搜了別的城市，想放上來，直接改這個陣列就好（最好是資料庫已經有景點的）。
- `border-[#E5302F]`、`group-hover:bg-[#E5302F]`：顏色寫在 class 裡也可以，只要是**寫死的完整字串**，Tailwind 就掃得到（第 1 段說的是「拼起來的字串」不行）。
- `aria-hidden="true"`：路線只是裝飾，螢幕閱讀器跳過它；真正能按的是下面的車站按鈕。

#### 步驟 12：`app/components/AttractionCard.tsx` 整個換掉

```tsx
import type { Destination } from "@/app/lib/types";

type Props = {
  destination: Destination;
  children?: React.ReactNode; // 卡片最下面要放的東西（例如「加入＋」），可以不放
};

// 一個景點：像車站的站牌，白底細框，站名用最粗的字
export default function AttractionCard({ destination, children }: Props) {
  return (
    <article className="flex flex-col rounded-md border border-rule bg-board">
      <div className="flex-1 p-4">
        <h3 className="text-lg leading-snug font-black">
          {destination.place_name}
        </h3>
        <p className="mt-1 text-sm text-ink-2">
          {destination.geo_tags ?? destination.city_name}
        </p>
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed">
          {destination.description}
        </p>
      </div>
      {/* 有按鈕才多一條底下的區塊 */}
      {children && (
        <div className="flex justify-end border-t border-rule px-4 py-2">
          {children}
        </div>
      )}
    </article>
  );
}
```

`{children && (...)}`：沒選行程時，首頁傳進來的是 `null`（`addButton` 回 `null`），就不畫最下面那條，卡片比較乾淨。

#### 步驟 13：首頁 `app/page.tsx` 改四個地方

**① import** 多一行（`AttractionCard` 那行的下面）：

```tsx
import HomeHero from "@/app/components/HomeHero";
```

**② `addButton` 裡面的兩個 `return`**：從 `if (inPool.has(destinationId)) {` 到最後的 `);` 為止，換成（只換了樣式）：

```tsx
    if (inPool.has(destinationId)) {
      return <span className="text-sm font-bold text-ink-2">✓ 已加入</span>;
    }
    return (
      <button
        type="button"
        onClick={() => addPlace.mutate(destinationId)}
        disabled={addPlace.isPending}
        className="rounded-full border-2 border-ink px-4 py-1 text-sm font-bold hover:bg-ink hover:text-white disabled:opacity-50"
      >
        加入＋
      </button>
    );
```

**③ `handleSubmit`** 整個換成 `startSearch`（表單搬進 `HomeHero` 了，這裡只要「開始搜尋」這件事）：

```tsx
  // 開始搜尋：在輸入框按「搜尋」、或點了路線上的城市，都走這裡
  function startSearch(location: string) {
    if (!location) return; // 什麼都沒打，就不搜
    setSearched(location);
    setTaskFailed(false);
  }
```

**④ 最後的 `return (...)`** 整段換掉（從 `return (` 到函式最後的 `);`）：

```tsx
  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <HomeHero
        keyword={keyword}
        onKeywordChange={setKeyword}
        onSearch={startSearch}
        searching={isFetching}
      />

      {isError && (
        <p className="mb-4 rounded-md border-l-4 border-[#E5302F] bg-board p-3">
          搜尋失敗：請確認後端（uvicorn）有在跑
        </p>
      )}

      {taskFailed && (
        <p className="mb-4 rounded-md border-l-4 border-[#E5302F] bg-board p-3">
          AI 找景點失敗了，請重新整理頁面後再搜一次
        </p>
      )}

      {/* AI 在背景找的時候：像車站的電子看板，深藍底白字 */}
      {data?.status === "processing" && !taskFailed && (
        <p className="mb-4 rounded-md bg-ink p-4 text-white">
          資料庫裡「{data.location}」的景點還不夠，AI 正在背景幫你找，大約 1
          分鐘。找到會自動顯示，不用重新整理。
        </p>
      )}

      {data && (
        <section>
          {/* 結果的標題列：左邊是城市和景點數，右邊是「加入到」哪個行程 */}
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b-2 border-ink pb-3">
            <h2 className="text-2xl font-black">
              {data.location}
              <span className="ml-2 font-num text-lg font-bold text-ink-2">
                {data.destinations.length} 個景點
              </span>
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label htmlFor="trip-select" className="text-ink-2">
                加入到
              </label>
              <select
                id="trip-select"
                value={selectedTrip?.id ?? ""}
                onChange={(e) =>
                  setTripId(e.target.value ? Number(e.target.value) : null)
                }
                className="rounded-md border border-rule bg-board px-3 py-1.5 font-bold"
              >
                <option value="">選一個行程</option>
                {trips?.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.title}
                  </option>
                ))}
              </select>
              {trips?.length === 0 && (
                <Link href="/trips" className="font-bold underline">
                  先去建立一個行程
                </Link>
              )}
            </div>
          </div>

          {addPlace.isError && (
            <p className="mb-4 rounded-md border-l-4 border-[#E5302F] bg-board p-3 text-sm">
              {addPlace.error.message}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.destinations.map((d) => (
              <AttractionCard key={d.id} destination={d}>
                {addButton(d.id)}
              </AttractionCard>
            ))}
          </div>
        </section>
      )}
    </main>
  );
```

- 原本的 `<h1>`、`<form>` 都換成 `<HomeHero ... />`。
- 「加入到」的選單搬進結果的標題列：搜尋之前用不到，就不出現。
- AI 在背景找的時候，那段提示改成深藍底白字，像車站的電子看板。
- `<label htmlFor="trip-select">` 對上 `<select id="trip-select">`：點「加入到」這幾個字，選單也會被選到；螢幕閱讀器也知道這個選單是做什麼的。

#### 步驟 14：測試

確認前後端都在跑，打開 http://localhost:3000 。

**① 路線畫出來**

1. 一打開，紅線從札幌往福岡畫過去，每一站依序冒出來。
2. 按 `F5` 再看一次。
3. 滑鼠移到「京都」上 → 圓圈變實心紅色、字有底線。

**② 點城市搜尋**

1. 點「京都」→ 輸入框自己變成「京都」，下面出現「京都 26 個景點」和景點卡片。
2. 右邊「加入到」選「京都三日遊」→ 已經在景點池的顯示「✓ 已加入」，其他是「加入＋」。按一個「加入＋」→ 變成「✓ 已加入」。
3. 在輸入框打「大阪」按搜尋 → 一樣的流程。

**③ 手機寬度**

`Cmd + Option + I` → `Cmd + Shift + M` 選一支手機 → 路線縮成一排，六站都看得到，畫面不能左右捲。

**④ 減少動態效果**

1. 開發者工具開著，按 `Cmd + Shift + P`，打 `reduced`，選 **Emulate CSS prefers-reduced-motion: reduce**。
2. 按 `F5` → 路線一打開就是完整的，沒有畫的過程。
3. 再按一次 `Cmd + Shift + P`，打 `reduced`，選 **Do not emulate CSS prefers-reduced-motion** 恢復。

### 3. 這一段結束後的資料夾

```
frontend/app/
├── components/
│   ├── AttractionCard.tsx ← 改：站牌樣式
│   └── HomeHero.tsx       ← 新增：大標題、搜尋框、熱門城市的路線
├── globals.css            ← 改：路線畫出來、車站冒出來的動畫
└── page.tsx               ← 改：用 HomeHero、結果標題列、新樣式
```

### 4. 跟原專案對照

| 項目 | 原專案 | 我們 |
|---|---|---|
| 首頁大圖 | 11 張風景照，一張一張淡入淡出 | 一條會自己畫出來的路線 |
| 熱門搜尋 | 一排按鈕 | 路線上的車站，從北到南排 |
| 搜尋結果在哪 | 另一頁 `/search` | 同一頁，搜尋框下面 |
| 景點卡片 | 圓角、陰影、照片 | 站牌：白底細框、粗黑體站名（照片第 3 段加） |
| 動畫 | `framer-motion`，很多地方都有 | 這一段只有首頁的路線；其他動畫第 5 段才加，而且只回應你的動作 |

### 5. 常見踩雷

| 症狀 | 原因 | 解法 |
|---|---|---|
| 路線沒有動畫，或一條線都沒有 | `globals.css` 改了卻沒生效（第 1 段遇過的 `.next` 快取） | 停掉 `npm run dev`，`rm -rf .next`，再開 |
| 線沒有對準車站的圓心 | 線的 `top` 和車站大小對不上：圓圈 28px（`h-7`），圓心在 14px；線 8px（`h-2`），所以 `top` 是 14 − 4 = 10px | 對照步驟 11 |
| 車站一開始就全部出現，沒有跟著線 | `station-in` 的動畫少了 `both`，延遲的時間裡沒有先藏起來 | 對照步驟 10 |
| 點熱門城市沒反應 | 首頁沒有把 `startSearch` 傳進 `onSearch` | 對照步驟 13 ④ |
| lint 說 `'handleSubmit' is assigned a value but never used` | 步驟 13 ③ 新增了 `startSearch`，但舊的 `handleSubmit` 沒刪 | 刪掉 `handleSubmit` |

### 📌 這一段的 3 個重點

1. **首頁大圖說明這個網站在做什麼**：一條路線，車站就是熱門城市，點了就搜尋。
2. **線是用虛線的偏移「推」出來的**：`pathLength="1"` 讓長度變成 1，`stroke-dashoffset` 從 1 動到 0；車站的延遲跟著線的時間算。
3. **只有一個地方自己動，而且尊重「減少動態效果」**：`prefers-reduced-motion` 的人直接看到畫好的路線。

### 6. 小測驗

（提示：每題都可以用「如果不這樣做，會發生什麼壞事？」來想。）

1. 為什麼熱門城市只挑資料庫裡已經有景點的城市？
2. 如果拿掉 `pathLength="1"`，`stroke-dasharray: 1` 會變成什麼樣子？
3. 為什麼要寫 `@media (prefers-reduced-motion: reduce)`？
4. 搜尋的狀態（`keyword`、`searched`）為什麼放在首頁，不放在 `HomeHero` 裡？

<details>
<summary>點開看解答</summary>

1. 點了就要馬上有結果。如果放一個沒搜過的城市，點下去就會派 worker、叫 AI 去找，要等一分鐘，還會花 Gemini 的額度；而且 worker 沒開的話就一直等不到。挑資料庫已經有的，點了直接從資料庫拿。
2. 沒有 `pathLength` 的話，`1` 就是真的 1 個單位（大約 1 像素），整條線會變成「畫 1 點、空 1 點」的細點點虛線，偏移從 1 動到 0 也只是點點挪動一下，看不到「畫出來」的效果。`pathLength="1"` 讓「1」等於整條線的長度。
3. 有些人看到大範圍的動畫會頭暈、不舒服，所以在系統設定裡開了「減少動態效果」。網站應該照著這個設定，不要硬播動畫；我們就直接顯示畫好的路線，資訊一樣完整。
4. 搜尋的結果、等 AI 的 SSE、「加入到」的選單都在首頁，它們都要用到「現在搜的是哪個城市」。狀態放在 `HomeHero` 裡的話，首頁拿不到；放在首頁，再把值和改的方法（`onKeywordChange`、`onSearch`）傳給 `HomeHero`，兩邊都用得到。

</details>

#### 你的實作紀錄（2026-11-22）

- 4 個檔案都正確：`globals.css`、`HomeHero.tsx`、`AttractionCard.tsx` 跟教材一模一樣。`page.tsx` 只差一個地方：`import HomeHero from "./components/HomeHero";` 用的是相對路徑，教材是 `"@/app/components/HomeHero"`。兩種都找得到同一個檔案，功能一樣；只是同一個檔案裡其他 import 都用 `@/`，統一比較好讀，要不要改都可以。
- 型別檢查、lint 都通過。3000 送出來的 CSS 裡有 `route-draw`、`station-in`、`border-[#E5302F]`，這次沒有遇到 `.next` 快取的問題。
- 用 Chrome 開一個沒有 cookie 的視窗看你的 3000（只看不改），步驟 14 的四項都對：
  - ① 線畫到一半時，札幌到大阪已經冒出來，廣島、福岡還沒；畫完之後，線的兩端剛好在札幌和福岡的圓心上（差不到 0.1 像素），上下也對準圓心。
  - ② 點「京都」→ 輸入框變成「京都」，出現「京都 26 個景點」和 26 張卡片。
  - ③ 手機寬度（390）六站排成一排，畫面沒有左右捲。
  - ④ 開「減少動態效果」→ 線一打開就是畫好的，沒有動畫。
  - 主控台沒有錯誤。

---

## 第 3 段：景點照片

### 開始前的測試結果（2026-11-22）

在 scratchpad 複製了一份你的專案，後端開在 8100、前端開在 3100。資料庫用的是同一個，但這一段只讀資料庫，不會寫入。照片是用你後端的 key 實際去拿的：

- **金閣寺**：
  - 第 1 步問「有哪些照片」花 0.35 秒，回來 10 張。
  - 第 2 步拿網址花 0.15 秒，拿到 `lh3.googleusercontent.com` 的網址和拍照的人。
  - 同一個金閣寺問兩次，兩次拿到的**照片名字不一樣**。所以 Google 才說名字不能存。
- **出錯的情況**：
  - 不存在的景點 `999999`：回 404「找不到這個景點」。
  - key 打錯：Google 回 400，我們回 502。
- **搜「京都」**：
  - 26 張卡片裡，一打開只拿了畫面附近的 9 張。
  - 直接跳到最下面時，中間沒經過的卡片都沒有拿。
  - 「花見小路」Google 沒有照片，卡片上顯示「沒有照片」。
- **搜「大阪」再點回「京都」**：京都的照片沒有再拿一次。
- 手機寬度不會左右捲，主控台沒有錯誤。
- 測試總共用掉大約 90 次照片額度（每月 1,000 次免費）。
- **測試時抓到一個問題**：前端剛開、還在編譯的那一次，第三排的照片一直出不來。原因和改法寫在下面「瀏覽器有時一次通知好幾筆」。

> **跟原本的計畫不一樣的地方**
> 1. 原本要把照片網址存進 Redis。查了 Google 的規定，照片不准存，所以拿掉了。
> 2. 原本要用 `next/image`，也因為同一個原因改用一般的 `<img>`。
> 3. 景點池的照片延到第 4 段。景點池一列很窄，放不下照片下面規定要標的「拍照的人」。第 4 段重做編輯頁時再一起放。

### 1. 學到的觀念

#### 拿一張照片要兩步

Google 的照片沒辦法用地點 id 直接拿，要分兩步：

1. 先問「這個地點有哪些照片」。Google 會回一串照片，每張都有一個很長的名字（`places/…/photos/…`）。
2. 再拿其中一張的名字，去換「照片網址」。

| 步驟 | 問 Google 什麼 | 收費 |
|---|---|---|
| 1 | 這個地點有哪些照片（Place Details，只要 `photos` 一個欄位） | **不限次數免費** |
| 2 | 這張照片的網址（Place Photos） | 每月前 1,000 次免費，之後每 1,000 次 7 美元 |

第 1 步只要 `photos` 一個欄位，Google 把它算在最便宜的一級（IDs Only），不收錢。這就是第 3 課說的 Field Mask：要的欄位越少越便宜。

要錢的是第 2 步。一張 0.007 美元聽起來很少，但搜一次京都就有 26 張卡片。每月免費的 1,000 次，大約夠你把 38 個城市的結果從頭捲到尾。

#### Google 不准存照片

原本打算把照片網址存進 Redis（第 4 課的小白板），同一個景點就不用一直去問 Google。查了 Google 的規定以後，發現不能這樣做：

- **照片的名字不能存**，而且會過期。每次都要用第 1 步重新拿。上面測到的「同一個金閣寺，兩次名字不一樣」就是這個原因。
- **照片網址只是暫時的**，過一陣子就失效。
- Google 的內容只能照它允許的方式存。地點 id 可以一直存（我們的 `google_place_id` 就是），照片不在允許的名單裡。

所以後端每次都重新問 Google，資料庫和 Redis 都不放照片。

前端的 TanStack Query 會把網址記在記憶體裡。這是頁面開著時「正在用」，重新整理就沒了，不算存起來。

> 用餐廳來比喻：Google 的照片就像向別家借來的菜單照片。可以拿給客人看，但不能影印一份收進自己的檔案櫃。每次要給客人看，都要再借一次。

#### 看到才拿：`IntersectionObserver`

既然每張照片都要算錢，就不要一搜尋就把 26 張全部拿下來。捲到附近才拿，沒看到的就不拿。Google 的說明文件也建議這樣做。

`IntersectionObserver` 是瀏覽器內建的「盯梢員」。你告訴它要盯哪個東西，那個東西一進到畫面，它就會通知你：

```tsx
const observer = new IntersectionObserver(
  (entries) => { ... }, // 有變化時，瀏覽器會呼叫這個函式
  { rootMargin: "200px" }, // 把畫面往外多算 200px：快捲到了就先開始拿
);
observer.observe(box); // 開始盯這個框
observer.disconnect(); // 不盯了
```

看到之後，把 `nearScreen` 改成 `true`。`useQuery` 寫了 `enabled: nearScreen`，這時就會開始拿照片。`enabled` 在第 7 課的編輯頁用過。

**為什麼不直接用 `<img loading="lazy">`？** 它只是讓「圖片」晚一點下載。但我們得先打後端拿網址，錢在拿網址的時候就已經花掉了。要省錢，就要在拿網址之前先判斷卡片有沒有被看到。

#### 瀏覽器有時一次通知好幾筆

`entries` 是一個陣列。平常每次只有一筆，但瀏覽器很忙的時候（例如前端剛開、還在編譯），可能會把「還沒進畫面」和「進畫面了」兩筆一起送來。

這時如果只看第一筆，就會以為還沒進畫面，而且之後不會再通知。所以要用 `entries.some(...)`，只要其中有一筆說「進來了」就算。

這是測試時真的遇到的。一開始寫的是 `([entry]) => ...`，只看第一筆。結果前端剛開的那一次，第三排的照片一直出不來。

#### 先佔好位置

照片的框用 `aspect-[16/10]`：寬度跟著卡片，高度固定是寬度的 10/16。

照片還沒到的時候，灰色的框已經在那裡了。照片到了就直接填進框裡，卡片不會突然變高，也不會把下面的東西往下推。

#### 為什麼不用 `next/image`

Next.js 的 `<Image>` 會先把照片抓到我們的伺服器，縮成適合的大小、存起來，再送給瀏覽器。一般的照片這樣做很好，但這裡有兩個問題：

- Google 不准存照片。
- 第 2 步已經用 `maxWidthPx` 請 Google 縮好大小了，不需要再縮。

所以這裡用一般的 `<img>`。

ESLint 看到 `<img>` 會提醒「建議用 `<Image>`」。所以在它上面加一行 `eslint-disable-next-line`，意思是「下一行我知道，是故意的」。

#### 一定要標出處

Google 規定了三件事：

- 照片有拍照的人（`authorAttributions`）時，顯示照片的地方就要寫出來，而且最好連到他的頁面。
- 在 Google 地圖以外的地方顯示 Google 的內容，要標「Google Maps」，這幾個字不能改。
- 使用者要能點進 Google 地圖，看到那張照片（`googleMapsUri`）。

所以照片下面有一行「照片：作者」和「Google Maps」，點照片會打開 Google 地圖。

#### 沒有照片時，回 `null` 不回 404

有些景點 Google 就是沒有照片，例如測試時的「花見小路」。這不是錯誤，所以後端回 `200` 和 `null`，前端顯示「沒有照片」。

如果回 404，每張沒有照片的卡片都會在瀏覽器的主控台印一行紅字，看起來像壞掉了。錯誤碼只留給真的出錯的情況：景點不存在回 404，Google 出問題回 502。

`response_model=PhotoOut | None` 的意思是告訴 FastAPI：這支 API 可能回照片，也可能回 `null`。

### 2. 實作步驟

這一段**前後端都要改**。

#### 步驟 15：後端 `services/places.py` 加上 `place_photo`

加在檔案最下面 `if __name__ == "__main__":` 的**上面**，前後各空兩行：

```python
# 只要 photos 一個欄位：屬於 Place Details Essentials (IDs Only)，不限次數免費
PHOTOS_FIELD_MASK = "photos"
PHOTO_WIDTH = 640  # 照片要多寬（像素）。卡片大約 320 寬，手機和 Mac 的螢幕要兩倍才清楚


def place_photo(google_place_id: str) -> dict | None:
    """一個地點的第一張照片。Google 不准存照片，所以每次都重新問"""
    # 第 1 步：問這個地點有哪些照片（免費）
    resp = requests.get(
        DETAILS_URL + google_place_id,
        headers={"X-Goog-Api-Key": MAPS_API_KEY,
                 "X-Goog-FieldMask": PHOTOS_FIELD_MASK},
        timeout=10,
    )
    resp.raise_for_status()
    photos = resp.json().get("photos", [])
    if not photos:
        return None  # 這個地點沒有照片

    photo = photos[0]  # 只拿第一張
    # 第 2 步：拿這張照片的網址（要錢：每月前 1,000 次免費，之後每 1,000 次 7 美元）
    media = requests.get(
        f"https://places.googleapis.com/v1/{photo['name']}/media",
        headers={"X-Goog-Api-Key": MAPS_API_KEY},
        # skipHttpRedirect：回給我們網址就好，不要直接回整張圖片
        params={"maxWidthPx": PHOTO_WIDTH, "skipHttpRedirect": "true"},
        timeout=10,
    )
    media.raise_for_status()

    # 拍照的人：Google 規定一定要標出來。通常只有一位，就拿第一位
    authors = photo.get("authorAttributions", [])
    author = authors[0] if authors else {}
    return {
        "url": media.json()["photoUri"],
        "author_name": author.get("displayName"),
        "author_uri": author.get("uri"),
        "maps_uri": photo.get("googleMapsUri"),
    }
```

- `DETAILS_URL` 是第 7 課就有的 `https://places.googleapis.com/v1/places/`，這裡直接拿來用。
- `photos[0]`：Google 最多回 10 張，第一張通常最有代表性，我們只拿這一張。
- `skipHttpRedirect`：如果不加，Google 會直接把整張圖片傳回來。加了，只回一小段 JSON，裡面有照片網址 `photoUri`，我們把這個網址交給瀏覽器去下載。
- `.get("photos", [])`、`.get("displayName")`：Google 沒給這個欄位的時候不會出錯，會拿到空的陣列或 `None`。

#### 步驟 16：`schemas/destination.py` 最下面加上

```python
# 景點的照片。Google 給的網址過一陣子就會失效，所以不存，每次都重新拿
class PhotoOut(BaseModel):
    url: str  # 照片網址
    author_name: str | None  # 拍照的人
    author_uri: str | None  # 拍照的人在 Google 地圖上的頁面
    maps_uri: str | None  # 這張照片在 Google 地圖上的頁面
```

#### 步驟 17：`router/destinations.py` 改三個地方

**① 最上面**多一行（`from fastapi ...` 那行的上面）：

```python
import requests
```

**② import** 那兩行改成：

```python
from schemas.destination import DestinationCreate, DestinationOut, PhotoOut
from services.places import place_photo
```

（第一行只是在最後多了 `PhotoOut`，第二行是新加的。）

**③ 檔案最下面**加上：

```python
@router.get(
    "/api/destinations/{destination_id}/photo", response_model=PhotoOut | None
)
def destination_photo(destination_id: int, db: Session = Depends(get_db)):
    destination = db.get(Destination, destination_id)
    if destination is None:
        raise HTTPException(status_code=404, detail="找不到這個景點")
    if not destination.google_place_id:
        return None  # 沒有 Google 的地點 id，就沒辦法問照片
    try:
        return place_photo(destination.google_place_id)
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Google 照片拿不到，請稍後再試")
```

- 寫法跟第 7 課的 `/api/places/autocomplete` 一樣：Google 出錯就回 502，表示「是我們後面的服務壞了，不是你的請求有問題」。
- 這支 API 沒有檢查登入。景點本來就是大家都能搜尋的，照片也一樣。

#### 步驟 18：先測後端

uvicorn 有開 `--reload`，存檔之後會自己重開。在另一個終端機輸入：

```bash
curl -s http://127.0.0.1:8000/api/destinations/7/photo
```

7 號是金閣寺。會看到類似這樣的結果：

```
{"url":"https://lh3.googleusercontent.com/...","author_name":"...","author_uri":"https://maps.google.com/maps/contrib/...","maps_uri":"https://www.google.com/maps/place/..."}
```

把 `url` 引號裡的網址貼到瀏覽器，可以看到照片。

再試一個不存在的景點：

```bash
curl -s http://127.0.0.1:8000/api/destinations/999999/photo
```

會看到 `{"detail":"找不到這個景點"}`。

每打一次 7 號都會用掉一次照片額度，測一兩次就好。

#### 步驟 19：`app/lib/types.ts` 加上（放在 `Destination` 的下面）

```ts
// 後端 GET /api/destinations/{id}/photo 回傳的樣子（沒有照片時，後端回 null）
export type DestinationPhoto = {
  url: string; // 照片網址
  author_name: string | null; // 拍照的人
  author_uri: string | null; // 拍照的人在 Google 地圖上的頁面
  maps_uri: string | null; // 這張照片在 Google 地圖上的頁面
};
```

#### 步驟 20：`app/lib/api.ts` 改兩個地方

**① 最上面的 import** 在 `Destination,` 下面多一行：

```ts
  DestinationPhoto,
```

**② 在 `searchGooglePlaces` 的下面、`// ---------- 行程 ----------` 的上面**加上：

```ts
// 景點的照片：後端再去問 Google。這個景點沒有照片，會拿到 null
export function getDestinationPhoto(destinationId: number) {
  return apiFetch<DestinationPhoto | null>(
    `/api/destinations/${destinationId}/photo`,
  );
}
```

#### 步驟 21：新增 `app/components/PlacePhoto.tsx`

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { getDestinationPhoto } from "@/app/lib/api";

type Props = {
  destinationId: number;
  name: string; // 景點名稱：圖片載不出來、或用螢幕閱讀器的人，會看到（聽到）這個
};

// 景點照片：捲到畫面附近才去拿（每拿一張都算 Google 的額度），下面標出拍照的人
export default function PlacePhoto({ destinationId, name }: Props) {
  const boxRef = useRef<HTMLDivElement>(null); // 照片的框，等一下請瀏覽器盯著它
  const [nearScreen, setNearScreen] = useState(false); // 框有沒有捲到畫面附近過

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    // 請瀏覽器幫忙盯著這個框：進到畫面、或離畫面不到 200px，就通知我們
    const observer = new IntersectionObserver(
      // 瀏覽器有時會一次送好幾筆（例如很快就捲過去），只要有一筆說「進來了」就算
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNearScreen(true);
          observer.disconnect(); // 看到一次就夠了，不用再盯
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(box);
    // 收拾：卡片不見了（例如換搜別的城市），也不用再盯
    return () => observer.disconnect();
  }, []);

  const { data: photo, isError } = useQuery({
    queryKey: ["photo", destinationId],
    queryFn: () => getDestinationPhoto(destinationId),
    enabled: nearScreen, // 還沒捲到附近，就先不要拿
    staleTime: Infinity, // 這一頁開著的時候，同一個景點不要拿第二次（又算一次額度）
    retry: false,
  });

  return (
    <figure>
      {/* 框的比例先固定好：照片還沒到也先佔好位置，卡片才不會突然變高 */}
      <div ref={boxRef} className="aspect-[16/10] bg-platform">
        {photo && (
          // 點照片：到 Google 地圖看這張照片的大圖
          <a href={photo.maps_uri ?? undefined} target="_blank" rel="noreferrer">
            {/* 不用 next/image：它會把照片抓到我們的伺服器、縮小後存起來，Google 不准存照片 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={name}
              className="h-full w-full object-cover"
            />
          </a>
        )}
        {(photo === null || isError) && (
          <p className="flex h-full items-center justify-center text-sm text-ink-2">
            {isError ? "照片載入失敗" : "沒有照片"}
          </p>
        )}
      </div>

      {/* Google 規定：照片要標出拍照的人，在地圖以外的地方還要寫 Google Maps */}
      {photo && (
        <figcaption className="flex justify-between gap-3 px-4 pt-2 text-xs text-ink-2">
          {photo.author_name && (
            <span className="truncate">
              照片：
              <a
                href={photo.author_uri ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="font-bold hover:underline"
              >
                {photo.author_name}
              </a>
            </span>
          )}
          <span className="ml-auto shrink-0">Google Maps</span>
        </figcaption>
      )}
    </figure>
  );
}
```

- `useRef` 第 7 課用過。這裡拿來指著照片的框，`IntersectionObserver` 才知道要盯哪一個。
- `useEffect(..., [])`：最後的 `[]` 表示只在卡片第一次出現時開始盯。`return () => observer.disconnect()` 是收拾，跟第 5 課 SSE 的 `es.close()` 一樣。
- `staleTime: Infinity`：只要頁面開著，同一個景點的照片就不會再拿第二次。搜大阪再回到京都，京都的照片直接從記憶體拿。
- `photo` 有三種情況：
  - `undefined`：還沒拿，或正在拿。只顯示灰色的框。
  - `null`：後端說這個景點沒有照片。顯示「沒有照片」。
  - 有值：顯示照片。

  所以這裡要寫 `photo === null`，不能寫 `!photo`。寫 `!photo` 的話，還在拿的時候也會跳出「沒有照片」。
- `href={photo.maps_uri ?? undefined}`：萬一 Google 沒給連結，`href` 就是空的，連結點了也不會跑到奇怪的地方。
- `target="_blank" rel="noreferrer"`：在新分頁打開，而且不告訴新分頁是從哪裡點過來的。
- `truncate`：作者名字太長的時候，切掉並加「…」，不會擠到「Google Maps」。

#### 步驟 22：`app/components/AttractionCard.tsx` 改兩個地方

**① 最上面**多一行（`import type { Destination } ...` 的上面）：

```tsx
import PlacePhoto from "@/app/components/PlacePhoto";
```

**② `<article ...>` 那一行**換成下面這段（`className` 多了 `overflow-hidden`，下面多了 `<PlacePhoto />`）：

```tsx
    <article className="flex flex-col overflow-hidden rounded-md border border-rule bg-board">
      <PlacePhoto
        destinationId={destination.id}
        name={destination.place_name}
      />
```

`overflow-hidden`：照片是方角的。卡片有圓角，超出圓角的部分要切掉，照片的角才會跟著卡片變圓。

只換 `<article ...>` 這**一行**；下面的 `<div className="flex-1 p-4">`（站名、地區、介紹）**不要動**。改完的 `return` 長這樣，可以對照：

```tsx
  return (
    <article className="flex flex-col overflow-hidden rounded-md border border-rule bg-board">
      <PlacePhoto
        destinationId={destination.id}
        name={destination.place_name}
      />
      <div className="flex-1 p-4">
        <h3 className="text-lg leading-snug font-black">
          {destination.place_name}
        </h3>
        <p className="mt-1 text-sm text-ink-2">
          {destination.geo_tags ?? destination.city_name}
        </p>
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed">
          {destination.description}
        </p>
      </div>
      {/* 有按鈕才多一條底下的區塊 */}
      {children && (
        <div className="flex justify-end border-t border-rule px-4 py-2">
          {children}
        </div>
      )}
    </article>
  );
```

#### 步驟 23：測試

確認前後端都在跑，打開 http://localhost:3000 。

**① 照片出現**

1. 點路線上的「京都」→ 卡片最上面出現照片，照片下面有「照片：（作者）」和「Google Maps」。
2. 找到「花見小路」→ 顯示「沒有照片」。

**② 看到才拿**

1. `Cmd + Option + I` 打開開發者工具 → **Network** → 上面的篩選框打 `photo`。
2. 按 `F5`，再點「京都」→ 只出現畫面附近那幾張卡片的請求（大約 6～9 筆，看你的螢幕多大）。
3. 慢慢往下捲 → 每捲到新的一排，就多出幾筆（一排有幾張卡片，就多幾筆）。

**③ 不會重拿**

1. 篩選框保持 `photo`，在 Network 按左上角的 🚫 把清單清空。
2. 點「大阪」→ 出現大阪的請求。
3. 再點「京都」→ 剛才看過的那幾張不會再出現在清單上。

**④ 出處的連結**

1. 點一張照片 → 新分頁打開 Google 地圖上的那張照片。
2. 點作者的名字 → 新分頁打開作者在 Google 地圖上的頁面。

**⑤ 手機寬度**

`Cmd + Shift + M` 選一支手機 → 卡片排成一欄，照片佔滿卡片的寬度，畫面不能左右捲。

### 3. 這一段結束後的資料夾

```
backend/
├── router/destinations.py   ← 改：GET /api/destinations/{id}/photo
├── schemas/destination.py   ← 改：PhotoOut
└── services/places.py       ← 改：place_photo（問 Google 拿照片）

frontend/app/
├── components/
│   ├── AttractionCard.tsx   ← 改：最上面放照片
│   └── PlacePhoto.tsx       ← 新增：捲到附近才拿照片、標出拍照的人
└── lib/
    ├── api.ts               ← 改：getDestinationPhoto
    └── types.ts             ← 改：DestinationPhoto
```

### 4. 跟原專案對照

| 項目 | 原專案 | 我們 |
|---|---|---|
| 誰去問 Google | 瀏覽器用 Maps JS 的 `Place`（瀏覽器的 key） | 後端（後端的 key，瀏覽器看不到） |
| 什麼時候拿 | 卡片一出現就拿 | 捲到畫面附近才拿 |
| 拿到的網址 | 存進瀏覽器的 `sessionStorage`，重新整理也還在，關掉分頁才清掉 | 不存，只在頁面開著的時候記在記憶體，重新整理就沒了 |
| 拍照的人 | 有拿到，但沒有顯示 | 照片下面顯示，可以點 |
| 沒有照片 | 換成一張預設圖 | 灰色的框寫「沒有照片」 |
| 其他地方的照片 | 「我的行程」的卡片、首頁的「探索」、編輯頁地圖點開的小視窗也有 | 這一段只有搜尋結果；景點池第 4 段再加 |

### 5. 常見踩雷

| 症狀 | 原因 | 解法 |
|---|---|---|
| 每張都是「照片載入失敗」 | 後端回 502：Google 拒絕了（key 打錯、Places API 沒開） | 看 uvicorn 的終端機有沒有錯誤；用步驟 18 的 `curl` 單獨測後端 |
| 照片都沒出來，Network 也沒有任何 `photo` 請求 | `nearScreen` 一直是 `false`：`ref={boxRef}` 沒有放到框的 `<div>` 上 | 對照步驟 21 |
| 一打開 Network 就出現 26 筆 `photo` | 少了 `enabled: nearScreen`，每張卡片一出現就拿 | 對照步驟 21 |
| 前端剛開的第一次，有一排照片一直出不來 | 用 `([entry]) => ...` 只看第一筆通知 | 改用 `entries.some(...)` |
| 還在拿的時候就閃過「沒有照片」 | 寫成 `!photo`，把「還沒拿到」也當成「沒有照片」 | 寫 `photo === null` |
| 後端回 500，終端機出現 `ResponseValidationError` | `place_photo` 回傳的名字跟 `PhotoOut` 的欄位對不上（例如打成 `author`） | 對照步驟 15、16 |
| 卡片只剩照片和按鈕，沒有站名和介紹 | 步驟 22 ② 換 `<article>` 那一行時，連下面的 `<div className="flex-1 p-4">…</div>` 一起刪掉了 | 把那一塊放回 `<PlacePhoto />` 下面，對照步驟 22 改完的樣子 |
| 照片的上面兩個角是方的，跟卡片的圓角對不上 | `<article>` 少了 `overflow-hidden` | 對照步驟 22 |
| lint 說 `Using <img> could result in slower LCP` | 少了 `eslint-disable-next-line` 那一行 | 對照步驟 21 |

### 📌 這一段的 3 個重點

1. **拿照片分兩步**：先問「有哪些照片」（免費），再拿網址（每月 1,000 次免費）。Google 不准存照片，所以每次都重新問。
2. **看到才拿**：`IntersectionObserver` 盯著照片的框，捲到附近才把 `enabled` 打開；同一頁不重拿。
3. **一定要標出處**：拍照的人加上「Google Maps」，點照片可以到 Google 地圖。

### 6. 小測驗

（提示：每題都可以用「如果不這樣做，會發生什麼壞事？」來想。）

1. 第 1 步的 Field Mask 只寫了 `photos`。如果順手多加一個 `displayName`，會發生什麼事？
2. 為什麼不把照片網址存進 Redis？存了明明比較省錢。
3. 如果拿掉 `enabled: nearScreen`，搜一次京都會怎樣？
4. 照片的框為什麼要先用 `aspect-[16/10]` 固定比例？

<details>
<summary>點開看解答</summary>

1. Google 會照「要的欄位裡最貴的那一級」收錢。`displayName` 屬於 Place Details Pro，每月只免費 5,000 次，超過就要收錢。本來免費的第 1 步會變成要錢，而且每張照片都要多付這一次。
2. Google 規定照片的名字不能存，網址也只是暫時的。存起來一來違反規定，二來網址過一陣子就失效，卡片上會變成破圖。地點 id 可以存，所以我們存 `google_place_id`，照片每次都用它重新問。
3. 26 張卡片一出現就同時拿 26 張照片，連沒捲到、根本沒看到的也算錢。每月免費的 1,000 次會用得快很多。
4. 照片是後來才到的。框的高度沒有先定好的話，照片一到，卡片會突然變高，把下面的卡片往下推。使用者正在讀的字會跳走，正要按的按鈕也可能移開。

</details>

#### 你的實作紀錄（2026-11-23）

- 後端 3 個檔都正確：`schemas/destination.py` 跟教材一模一樣；`services/places.py` 的空行比教材更標準（`if __name__` 上面空兩行）；`router/destinations.py` 只多了一個空行。用 `curl` 打 7 號拿到照片和作者，打 999999 回 404。
- 前端 `types.ts`、`api.ts`、`PlacePhoto.tsx` 正確，`PlacePhoto.tsx` 只差編輯器自動換行。
- **真的遇到的問題**：`AttractionCard.tsx` 換 `<article>` 那一行時，連下面的 `<div className="flex-1 p-4">`（站名、地區、介紹）一起刪掉了，卡片上只剩照片。型別檢查和 lint 都抓不到，因為少一塊畫面在語法上還是對的，要用眼睛看才發現。放回去之後跟教材一模一樣。步驟 22 已經補上改完的完整樣子，常見踩雷也加了這一條。
- 用 Chrome 開一個沒有 cookie 的視窗看你的 3000（只看不改）：照片、「照片：作者」、「Google Maps」都有；花見小路顯示「沒有照片」；一打開只拿了畫面附近的 9 張，直接跳到最下面時中間的不拿；搜大阪再回京都，京都的照片不重拿；手機寬度不會左右捲；主控台沒有錯誤。
- **順便發現的舊問題**（跟這一段無關）：11/22 晚上搜了東京之後，搜「京都」會跑出 37 個景點，混進 11 個東京的。原因是 `services/ingest.py` 的 `find_existing` 用 `geo_tags.contains("京都")`，「日本,東京都,台東區」裡的「東京都」剛好包含「京都」兩個字。第 3 課就有的寫法，之後再單獨修。

---

## 插曲：搜「京都」跑出東京的景點

第 3 段檢查的時候發現的舊問題。這是第 3 課就留下來的寫法，跟畫面美化無關，在第 4 段之前先修掉。

### 發生了什麼

1. 11/22 晚上你搜了「東京」，AI 找到 11 個東京的景點，存進資料庫。它們的 `geo_tags` 像這樣：`日本,東京都,台東區,淺草`。
2. 之後再搜「京都」，原本是 26 個景點，變成 **37 個**，多出來的 11 個是淺草寺、東京晴空塔、澀谷十字路口這些東京的景點。
3. 原因在 `services/ingest.py` 的 `find_existing`。它用 `.contains("京都")` 來比對，翻成 SQL 就是 `LIKE '%京都%'`，意思是「字串裡**任何地方**有『京都』就算」。
4. 「東京都」這三個字拆開是「東」加上「京都」，所以東京的景點也被抓了進來。

原專案也有一樣的問題，它寫的是 `geo_tags LIKE '%京都%'`。

### 開始前的測試結果（2026-11-23）

把新、舊兩種比對方法拿到你的資料庫跑了 20 個地名（只讀，不寫入）：

| 搜尋 | 舊的 | 新的 |
|---|---|---|
| 京都 | 37（多了 11 個東京的） | **26** |
| 東京、大阪、札幌、名古屋、廣島、福岡、神戶 | 11、30、20、12、9、15、13 | 一樣 |
| 九州、北九州、北海道 | 24、1、20 | 一樣 |
| 京都府、京都市、東京都、日本 | 26、26、11、159 | 一樣 |
| 新宿、淺草、台東、中區、宮島 | 2、1、2、6、2 | 一樣 |

**只有「京都」變了，其他都跟以前一樣。**

另外，Redis 小白板上的 `search:京都` 存的還是舊的 37 筆，還要大約 1 小時才會自動擦掉。所以改完程式之後，要手動把它擦掉（步驟 25）。

### 1. 學到的觀念

#### `contains` 和 `startswith`

| SQLAlchemy | 翻成 SQL | 意思 | 搜「京都」時，「東京都」算不算 |
|---|---|---|---|
| `.contains("京都")` | `LIKE '%京都%'` | 任何地方有就算 | 算（錯了） |
| `.startswith("京都")` | `LIKE '京都%'` | **開頭**是才算 | 不算 |

`%` 在 `LIKE` 裡代表「這裡可以是任何字，幾個字都可以，也可以沒有」。

- 前後都有 `%`：前面、後面都可以有別的字，所以中間出現就算。
- 只有後面有 `%`：前面不能有別的字，所以開頭一定要是「京都」。

#### `geo_tags` 要看「每一段的開頭」

`geo_tags` 是好幾個地名用逗號串起來的，例如 `日本,京都府,京都市`。

我們要的是：**其中有一段的開頭是「京都」**。「京都府」「京都市」都是以「京都」開頭，算；「東京都」的開頭是「東」，不算。

一段的開頭只有兩種位置：

1. 整串的最前面：第一段 → 用 `.startswith("京都")`
2. 逗號的後面：第二段以後 → 找有沒有 `",京都"`，用 `.contains("," + "京都")`

| `geo_tags` | 開頭是「京都」嗎 | 有 `,京都` 嗎 | 結果 |
|---|---|---|---|
| `日本,京都府,京都市` | 不是（開頭是日本） | 有（`,京都府`） | ✅ 找到 |
| `日本,東京都,台東區,淺草` | 不是 | 沒有（只有 `,東京都`，逗號後面是「東」） | ❌ 不算 |

**為什麼不用「完全一樣」？** 你搜的是「京都」，但 `geo_tags` 裡寫的是「京都府」「京都市」，沒有剛好叫「京都」的那一段。要求完全一樣的話，一個都找不到。

`city_name` 也一起改成 `startswith`。`city_name` 是「京都」「大阪市」這種單一個名字，看開頭就夠了。

#### 改了規則，小白板上的舊答案還在

第 4 課的 Cache-Aside：先看小白板，沒有才去查資料庫，查完寫回小白板，1 小時後自動擦掉。

程式改了，小白板上 `search:京都` 存的還是**舊規則算出來的 37 筆**。小白板不知道規則改了，會繼續把這 37 筆交出去，直到 1 小時後過期。所以要自己擦掉。

規則是：**資料或規則改了，存著舊答案的地方要自己清掉**。前端的 TanStack Query 也一樣，它會記 5 分鐘，所以測試前要重新整理頁面。

#### 改查詢規則之前，先把新、舊的結果拿來比

查詢規則一改，影響的不只是你正在修的「京都」，**每一個地名**都會跟著變。

所以這次改之前，先拿 20 個地名把新、舊兩種寫法都跑一遍，確認只有京都變了，其他都一樣（上面的表）。如果只測京都，改壞了別的城市也不會知道。

### 2. 實作步驟

#### 步驟 24：`services/ingest.py` 的 `find_existing`

`or_(...)` 裡面的三行，換成下面這樣（`input_region` 那行不變）：

```python
            or_(
                Destination.input_region == location,
                # 「開頭是」，不是「包含」：不然搜「京都」會找到「東京都」
                Destination.city_name.startswith(location),
                # geo_tags 像「日本,京都府,京都市」，用逗號分成好幾段，要其中一段的開頭是 location。
                # 第一段：看整串的開頭；後面幾段：每一段前面都有逗號，所以找「,京都」
                Destination.geo_tags.startswith(location),
                Destination.geo_tags.contains("," + location),
            )
```

uvicorn 有 `--reload`，存檔後會自己重開。這裡**不用重開 worker**：worker 存景點的時候不會用到 `find_existing`。

#### 步驟 25：擦掉小白板上的舊答案

在 `travel-scheduler` 資料夾（`docker-compose.yml` 所在的地方）輸入：

```bash
docker compose exec redis redis-cli DEL "search:京都"
```

- 看到 `(integer) 1`：擦掉了。
- 看到 `(integer) 0`：本來就沒有了，可能已經過了 1 小時自動擦掉，也沒關係。

#### 步驟 26：測試

**① 先直接問 `find_existing`（不會派 worker）**

在 `backend` 資料夾輸入：

```bash
uv run python -c "from core.database import SessionLocal; from services.ingest import find_existing; db = SessionLocal(); print('京都', len(find_existing(db, '京都')), '京都府', len(find_existing(db, '京都府')), '東京', len(find_existing(db, '東京')))"
```

前面會印出很多行 SQL，這是 `core/database.py` 的 `echo=True`，第 2 課開的。看最後一行：

```
京都 26 京都府 26 東京 11
```

- **京都 26**：東京的景點不見了。
- **京都府 26**：這一個只能靠 `geo_tags` 的那兩行才找得到。如果是 0，就是那兩行寫錯了。
  - 京都的景點 `input_region` 本來就是「京都」，所以光測「京都」看不出 `geo_tags` 有沒有寫錯。
- **東京 11**：東京自己的景點還找得到。

往上捲一點，可以看到 SQLAlchemy 翻出來的 SQL：`city_name LIKE ... || '%%'`（開頭是）和 `geo_tags LIKE '%%' || ... || '%%'`（包含 `,東京`）。`%%` 就是 `%`：資料庫套件用 `%(名字)s` 當「這裡填值」的記號，所以真正的 `%` 要寫兩個。

**為什麼不直接在網頁搜「京都府」？** 萬一程式寫錯，資料庫一筆都找不到，就會派 worker 去叫 AI 找「京都府」，既花錢，又會多存一批重複的京都景點。直接問 `find_existing` 只查資料庫，比較安全。

**② 網頁上**

1. 打開 http://localhost:3000 ，按 `F5` 重新整理（把前端記的 5 分鐘清掉）。
2. 點路線上的「京都」→ 標題寫「京都 26 個景點」，往下捲不會看到淺草寺、東京晴空塔。
3. uvicorn 的終端機會出現 `📝 寫入快取：search:京都（26 筆）`：小白板換成新答案了。

### 3. 跟原專案對照

| 項目 | 原專案 | 我們 |
|---|---|---|
| `geo_tags`、`city_name` 怎麼比 | `LIKE '%京都%'`：任何地方有就算，搜「京都」也會找到「東京都」 | `geo_tags` 要其中一段的開頭是；`city_name` 要開頭是 |

### 4. 常見踩雷

| 症狀 | 原因 | 解法 |
|---|---|---|
| 程式改了，網頁上還是 37 個 | 小白板上的 `search:京都` 還是舊的；或前端記的 5 分鐘還沒過 | 步驟 25 擦掉；網頁按 `F5` |
| 京都 26，但「京都府」是 0 | `geo_tags` 那兩行寫錯，例如寫成 `startswith("," + location)` | 對照步驟 24 |
| 京都還是 37 | `geo_tags` 還留著舊的 `.contains(location)`（沒有 `"," +`） | 對照步驟 24 |
| 終端機只看到一堆 SQL，找不到數字 | 數字在最後一行 | 往下捲到底 |

### 📌 這一段的 3 個重點

1. **`contains` 是「任何地方有」，`startswith` 是「開頭是」**：搜「京都」不能找到「東京都」，所以要看開頭。
2. **用逗號串起來的欄位，要看「每一段的開頭」**：第一段看 `startswith`，其他段找 `"," + 地名`。
3. **規則改了，舊答案要自己擦**：Redis 小白板的 `search:京都` 要 `DEL`，前端要重新整理。

### 5. 小測驗

1. 如果把 `geo_tags` 改成 `geo_tags == location`（完全一樣才算），搜「京都」會怎樣？
2. 如果只寫 `Destination.geo_tags.contains("," + location)`，沒有 `startswith` 那一行，會漏掉什麼？
3. 為什麼改完程式還要 `DEL "search:京都"`？不擦會怎樣？
4. 為什麼這次要把 20 個地名都跑一遍，不是只測京都？

<details>
<summary>點開看解答</summary>

1. `geo_tags` 是一整串 `日本,京都府,京都市`，不會剛好等於「京都」，所以靠 `geo_tags` 一個都找不到。京都的景點還是會因為 `input_region == "京都"` 被找到，但搜「京都府」「北海道」這種不是 `input_region` 的地名，就全部找不到了。
2. 漏掉第一段剛好是這個地名的景點。例如有一筆 `geo_tags` 是 `京都府,京都市`（前面沒有「日本」），第一段「京都府」前面沒有逗號，找 `,京都` 找不到。我們現在的資料第一段都是「日本」，所以暫時看不出來，但 AI 不保證每次都這樣寫。
3. 小白板不知道規則改了，會繼續把舊規則算出來的 37 筆交出去，最多 1 小時。這段時間搜京都還是會看到東京的景點，你會以為程式沒改好。
4. 查詢規則一改，每一個地名的結果都可能跟著變。只測京都，就算把大阪、九州改壞了也不會發現。新、舊兩種一起跑，才能確定「只有該變的變了」。

</details>

#### 你的實作紀錄（2026-11-23）

- `services/ingest.py` 跟教材一模一樣。
- `find_existing` 直接問：`京都 26 京都府 26 東京 11`，三個都對。「京都府」是 26，表示 `geo_tags` 那兩行寫對了。
- 小白板：舊的 37 筆已經擦掉，22:41 重新寫進去的 `search:京都` 是 26 筆，裡面沒有東京的景點。
- 搜尋 API：京都 26（沒有淺草寺）、東京 11（淺草寺在這裡）、大阪 30，都是 `completed`，沒有派 worker。
