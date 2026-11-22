# 第 9 課：畫面美化（路線圖風格）

> **狀態**：第 1 段（站牌和路線色）✅
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
| 3 | 景點照片：後端去 Google 拿照片網址並快取，卡片和景點池顯示照片 | Google 照片 API、`next/image` |
| 4 | 編輯頁變成路線圖：交通方式畫在線上、地圖圖釘換成路線色、自訂時間選單 | — |
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
