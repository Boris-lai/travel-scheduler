# 第 7 課：編輯頁（拖拉 ＋ 地圖）

> **狀態**：第 1 段（列表頁 ＋ 編輯頁骨架）✅ ／ 第 2 段（把景點放進行程）✅ ／ 第 3 段（拖拉、時間、儲存）⏳ ／ 第 4 段（地圖）⏳ ／ 第 5 段（交通時間、Google 搜尋框）⏳
> **日期**：2026-11-05 ～
> **對照原專案**：`frontend/app/dashboard/`、`frontend/app/edit/[tripId]/`、`frontend/app/components/edit/`、`frontend/app/hooks/useEditData.ts`、`frontend/app/hooks/useItineraryQueries.ts`、`frontend/app/lib/api.ts`

---

## 這一課在整個專案的位置

第 6 課做好了行程的後端，資料庫裡的「京都三日遊」已經是一個完整的行程，但只能在 `/docs` 裡看到。這一課要把它**做成畫面**：可以建立行程、把景點放進去、拖拉排順序、在地圖上看路線。

這是整個專案程式量最大的一課，所以拆成 5 段，每一段做完都看得到畫面在動：

| 段 | 做什麼 | 新東西 |
|---|---|---|
| **1** | 「我的行程」列表頁（建立、刪除）＋ 編輯頁骨架：先把京都三日遊**顯示出來** | 多頁面、網址裡的參數、`useMutation` |
| 2 | 把景點放進行程：搜尋頁卡片加「加入行程」，編輯頁可以「排到第 N 天」、刪掉一站 | 按鈕改資料後，畫面自動更新 |
| 3 | 拖拉排序 ＋ 填時間 ＋ 儲存（打第 6 課收尾的 `PUT`） | dnd-kit、「草稿」的概念 |
| 4 | Google 地圖：每一天的景點插針、照順序連線 | 瀏覽器用的 Google 金鑰 |
| 5 | 交通時間 ＋ 用 Google 搜尋框加任意景點 | 後端再加一張表 |

---

## 第 1 段：列表頁 ＋ 編輯頁骨架

### 開始前的測試結果（2026-11-05）

我先在另一份複製的前後端和資料庫測過，用 Chrome 自動操作：

| 測試 | 結果 |
|---|---|
| 導覽列 → 我的行程 | 列出「京都三日遊」 |
| 點進去 | 網址變成 `/trips/1`。左邊景點池 4 個，右邊第 1 天：伏見稻荷 09:00～10:30 → 清水寺 11:00～12:00 → 花見小路 13:00 |
| 分頁 | 「第 1 天 12/20」「第 2 天 12/21」「第 3 天 12/22」，日期是前端自己算的 |
| 切到第 2 天、第 3 天 | 八坂神社；「這一天還沒有排景點」 |
| 打開 `/trips/999` | 「找不到這個行程」（後端的錯誤訊息直接顯示出來） |
| 建立「大阪兩日遊」，2 天，2027-01-05 出發 | 自動跳到它的編輯頁，分頁是「第 1 天 1/5」「第 2 天 1/6」 |
| 回列表，刪除大阪兩日遊 | 先跳確認框，按確定後從列表消失 |
| 搜尋頁 | 還是正常，京都 26 個 |

### 1. 學到的觀念

#### 資料夾就是網址，中括號是「變數」

第 5 課說過：`app/` 底下的資料夾就是網址。這一段要做兩頁：

| 檔案 | 網址 |
|---|---|
| `app/page.tsx` | `/`（搜尋頁，第 5 課做的） |
| `app/trips/page.tsx` | `/trips`（我的行程） |
| `app/trips/[tripId]/page.tsx` | `/trips/1`、`/trips/2`、`/trips/37`…… |

**資料夾名稱有中括號 `[tripId]`，代表網址的這一段是一個變數**。不管網址是 `/trips/1` 還是 `/trips/37`，都是同一個檔案，程式裡用 `useParams()` 拿到那個數字。這跟第 6 課後端的 `/api/trips/{trip_id}` 是同一個意思。

#### `Link`：換頁但不重新載入

導覽列和行程卡片用 Next.js 的 `<Link href="...">`，不用一般的 `<a>`。差別是：`Link` 換頁時**不會重新載入整個網站**，只換掉中間那一塊，所以比較快，前端小白板（TanStack Query 的快取）也還在。

#### `useQuery` 是讀，`useMutation` 是改

| | `useQuery` | `useMutation` |
|---|---|---|
| 用在 | **讀**資料：列出行程、看景點池 | **改**資料：建立、刪除行程 |
| 什麼時候執行 | 畫面一出現就自動去拿，也會自動重抓 | **只有呼叫 `mutate(...)` 時**才執行一次 |
| 拿到什麼 | `data`、`isPending`、`isError` | `mutate`、`isPending`、`isError`、`error` |

改完資料之後，用 `onSuccess` 做後續的事：`invalidateQueries(["trips"])` 讓前端小白板上的行程列表作廢、自動重抓；建立的話，再用 `router.push(...)` 跳到新行程的編輯頁。

#### `queryKey`：每一筆資料各有自己的名字

編輯頁要拿 3 種資料，各有自己的名字：

| `queryKey` | 拿什麼 |
|---|---|
| `["trip", 1]` | 行程 1 的封面資料 |
| `["tripPlaces", 1]` | 行程 1 的景點池 |
| `["itinerary", 1, 2]` | 行程 1 **第 2 天**的每一站 |

每一天各是一筆快取。從第 1 天切到第 2 天再切回來，第 1 天會**馬上**出現，因為它還在前端小白板上。

`enabled: tripQuery.isSuccess` 的意思是：確定有這個行程，才去拿景點池和每日行程。行程不存在的話，就不用多打兩支一定會失敗的 API。

#### `apiFetch`：所有 API 共用的小幫手

這一段多了 6 支 API。如果每一支都自己寫 `fetch`、檢查 `res.ok`、轉 JSON，會重複很多次。所以寫一個 `apiFetch` 大家共用，每一支 API 都變成一兩行。它還會把後端的錯誤訊息（`detail`，例如「找不到這個行程」）拿出來，畫面就能直接顯示。

`apiFetch<T>` 裡的 `<T>` 是 TypeScript 的「空格」，代表「這支 API 會回什麼」，呼叫時再填進去：`apiFetch<Trip[]>(...)` 回行程清單，`apiFetch<Trip>(...)` 回一個行程。

#### 日期在前端算

第 6 課說「能算出來的就不要存」，後端沒有存每一天的日期。現在要顯示「第 2 天 12/21」，就由前端用「出發日 ＋（第幾天 − 1）」算出來（`dayDate` 這個函式）。

### 2. 實作步驟

這一段只改前端。開始前確認後端都在跑（Docker、uvicorn、worker），前端 `npm run dev` 也開著。

#### 步驟 1：`app/lib/types.ts` 最下面加上 3 個型別

```ts
// 後端 TripOut 的樣子（schemas/trip.py）
export type Trip = {
  id: number;
  title: string;
  days: number;
  start_date: string | null; // 例如 "2026-12-20"，沒填就是 null
  created_at: string;
};

// 建立行程時要送的資料（schemas/trip.py 的 TripCreate）
export type TripCreate = {
  title: string;
  days: number;
  start_date: string | null;
};

// 後端 ItineraryItemOut 的樣子（schemas/itinerary.py）：某一天裡的其中一站
export type ItineraryItem = {
  id: number; // 這一站的 id（不是景點的 id）
  day_index: number;
  position: number;
  arrival_time: string | null; // 例如 "09:00:00"
  departure_time: string | null;
  destination: Destination; // 這一站是哪個景點
};
```

對照第 6 課後端的 `TripOut`、`TripCreate`、`ItineraryItemOut`。日期和時間從後端傳過來都是**文字**（`"2026-12-20"`、`"09:00:00"`），所以型別是 `string`。

#### 步驟 2：`app/lib/api.ts` 整個換掉

```ts
import type {
  Destination,
  ItineraryItem,
  SearchResponse,
  Trip,
  TripCreate,
} from "@/app/lib/types";

// 所有 API 共用的小幫手：送出請求 → 檢查有沒有成功 → 把回應變成物件
// <T> 是「這支 API 會回什麼」的空格，呼叫時再填，例如 apiFetch<Trip[]>(...)
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    // 後端的錯誤訊息放在 detail 裡，例如「找不到這個行程」
    const body = await res.json().catch(() => null);
    throw new Error(
      typeof body?.detail === "string" ? body.detail : `後端回應 ${res.status}`,
    );
  }
  if (res.status === 204) {
    return undefined as T; // 刪除成功，後端沒有回任何內容
  }
  return res.json();
}

// ---------- 搜尋 ----------

// 網址只寫 /api/...：先送到前端自己，再由 next.config.ts 轉給後端
export function searchDestinations(location: string) {
  return apiFetch<SearchResponse>("/api/search", {
    method: "POST",
    body: JSON.stringify({ location }),
  });
}

// ---------- 行程 ----------

export function listTrips() {
  return apiFetch<Trip[]>("/api/trips");
}

export function getTrip(tripId: number) {
  return apiFetch<Trip>(`/api/trips/${tripId}`);
}

export function createTrip(input: TripCreate) {
  return apiFetch<Trip>("/api/trips", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteTrip(tripId: number) {
  return apiFetch<void>(`/api/trips/${tripId}`, { method: "DELETE" });
}

// ---------- 景點池、每日行程 ----------

export function listTripPlaces(tripId: number) {
  return apiFetch<Destination[]>(`/api/trips/${tripId}/places`);
}

export function listDayItinerary(tripId: number, day: number) {
  return apiFetch<ItineraryItem[]>(`/api/trips/${tripId}/days/${day}/itinerary`);
}
```

| 寫法 | 意思 |
|---|---|
| `async function apiFetch<T>(...)` | 共用的小幫手。`<T>` 是「會回什麼」的空格 |
| `init?: RequestInit` | 第二個參數可以不給（`?`），給的話就是 `fetch` 的設定，例如 `method`、`body` |
| `...init` | 把傳進來的設定原封不動放進去 |
| `body?.detail` | 後端錯誤時會回 `{"detail": "找不到這個行程"}`，拿出這句話當錯誤訊息 |
| `res.status === 204` | 刪除成功時後端沒有回內容，不能 `res.json()` |
| `searchDestinations` | 第 5 課那支，改成用 `apiFetch`，用法完全一樣，搜尋頁不用改 |

#### 步驟 3：`app/layout.tsx` 整個換掉（加上導覽列）

```tsx
import type { Metadata } from "next";
import Link from "next/link";

import Providers from "@/app/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Easy Travel Scheduler",
  description: "輸入城市，AI 幫你找景點",
};

// 每一頁的外框：<html>、<body> 只寫在這裡，children 就是各頁的內容
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body className="min-h-screen bg-gray-50 text-gray-800">
        <Providers>
          {/* 每一頁最上面都有的導覽列 */}
          <nav className="border-b border-gray-200 bg-white">
            <div className="mx-auto flex max-w-5xl gap-6 px-6 py-3 font-semibold">
              <Link href="/" className="hover:text-blue-600">
                搜尋景點
              </Link>
              <Link href="/trips" className="hover:text-blue-600">
                我的行程
              </Link>
            </div>
          </nav>
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

導覽列放在 `layout.tsx`，**每一頁**最上面都會有。

#### 步驟 4：新增 `app/trips/page.tsx`（我的行程）

在 `app` 底下新增 `trips` 資料夾，裡面新增 `page.tsx`：

```tsx
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createTrip, deleteTrip, listTrips } from "@/app/lib/api";

export default function TripsPage() {
  const router = useRouter(); // 用程式換頁
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [days, setDays] = useState(3);
  const [startDate, setStartDate] = useState(""); // 沒選就是空字串

  const { data: trips, isPending, isError } = useQuery({
    queryKey: ["trips"],
    queryFn: listTrips,
  });

  // useMutation：會「改資料」的動作（新增、刪除）。呼叫 mutate(...) 才真的送出
  const create = useMutation({
    mutationFn: createTrip,
    onSuccess: (trip) => {
      queryClient.invalidateQueries({ queryKey: ["trips"] }); // 行程列表舊了
      router.push(`/trips/${trip.id}`); // 建好直接進編輯頁
    },
  });

  const remove = useMutation({
    mutationFn: deleteTrip,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trips"] }),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    create.mutate({ title: title.trim(), days, start_date: startDate || null });
  }

  function handleDelete(tripId: number, tripTitle: string) {
    if (confirm(`確定要刪除「${tripTitle}」嗎？景點池和每日行程會一起刪掉。`)) {
      remove.mutate(tripId);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-3xl font-bold">我的行程</h1>

      <form
        onSubmit={handleSubmit}
        className="mb-8 flex flex-wrap items-end gap-3 rounded-xl bg-white p-5 shadow"
      >
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
          行程名稱
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="例如：京都三日遊"
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex w-24 flex-col gap-1 text-sm">
          天數
          <input
            type="number"
            min={1}
            max={60}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          出發日（可以不填）
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400"
        >
          {create.isPending ? "建立中…" : "建立行程"}
        </button>
        {create.isError && (
          <p className="w-full text-sm text-red-600">建立失敗：{create.error.message}</p>
        )}
      </form>

      {isPending && <p className="text-gray-500">載入中…</p>}
      {isError && (
        <p className="text-red-600">讀取行程失敗：請確認後端（uvicorn）有在跑</p>
      )}
      {trips?.length === 0 && <p className="text-gray-500">還沒有行程，先建立一個吧！</p>}

      <ul className="grid gap-4 sm:grid-cols-2">
        {trips?.map((trip) => (
          <li
            key={trip.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-white p-5 shadow"
          >
            <Link href={`/trips/${trip.id}`} className="flex-1">
              <h2 className="text-xl font-bold hover:text-blue-600">{trip.title}</h2>
              <p className="text-sm text-gray-500">
                {trip.days} 天{trip.start_date && `・${trip.start_date} 出發`}
              </p>
            </Link>
            <button
              type="button"
              onClick={() => handleDelete(trip.id, trip.title)}
              className="rounded-lg px-3 py-1 text-sm text-red-600 hover:bg-red-50"
            >
              刪除
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

| 寫法 | 意思 |
|---|---|
| `const { data: trips, ... } = useQuery(...)` | `data: trips` 是把 `data` 改名叫 `trips`，比較好讀 |
| `useMutation({ mutationFn: createTrip, onSuccess })` | 建立行程的動作。`onSuccess` 拿到的 `trip` 就是後端回傳的新行程 |
| `create.mutate({ ... })` | 按下「建立行程」時，真的送出去 |
| `startDate \|\| null` | 出發日沒選（空字串）就送 `null` |
| `router.push(...)` | 用程式換頁，跳到新行程的編輯頁 |
| `confirm(...)` | 瀏覽器內建的確認框，按「確定」才會回 `true` |
| `type="number"`、`type="date"` | 數字輸入框、日期選擇器，瀏覽器內建的 |

#### 步驟 5：新增 `app/trips/[tripId]/page.tsx`（編輯頁）

在 `trips` 資料夾裡，新增一個資料夾，名字就叫 **`[tripId]`**（中括號也要打），裡面新增 `page.tsx`：

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { getTrip, listDayItinerary, listTripPlaces } from "@/app/lib/api";

// 第 N 天的日期 ＝ 出發日 ＋（N − 1）天。後端沒有存，前端自己算
function dayDate(startDate: string | null, day: number) {
  if (!startDate) return "";
  const date = new Date(`${startDate}T00:00:00`);
  date.setDate(date.getDate() + day - 1);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function TripEditPage() {
  // 網址 /trips/1 裡的「1」。資料夾叫 [tripId]，所以這裡就叫 tripId
  const params = useParams<{ tripId: string }>();
  const tripId = Number(params.tripId);
  const [activeDay, setActiveDay] = useState(1); // 現在看第幾天

  const tripQuery = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => getTrip(tripId),
    retry: false, // 找不到行程（404）就直接顯示，不要重試
  });
  const placesQuery = useQuery({
    queryKey: ["tripPlaces", tripId],
    queryFn: () => listTripPlaces(tripId),
    enabled: tripQuery.isSuccess, // 確定有這個行程，才去拿景點池
  });
  const dayQuery = useQuery({
    queryKey: ["itinerary", tripId, activeDay], // 每一天各是一筆快取
    queryFn: () => listDayItinerary(tripId, activeDay),
    enabled: tripQuery.isSuccess,
  });

  if (tripQuery.isError) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <p className="mb-4 text-red-600">{tripQuery.error.message}</p>
        <Link href="/trips" className="text-blue-600 hover:underline">
          ← 回我的行程
        </Link>
      </main>
    );
  }

  const trip = tripQuery.data;
  if (!trip) {
    return <main className="mx-auto max-w-5xl p-6 text-gray-500">載入中…</main>;
  }

  const dayNumbers = Array.from({ length: trip.days }, (_, i) => i + 1); // 例如 [1, 2, 3]

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-3xl font-bold">{trip.title}</h1>
      <p className="mb-6 text-gray-500">
        {trip.days} 天{trip.start_date && `・${trip.start_date} 出發`}
      </p>

      <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
        {/* 左邊：景點池 */}
        <section className="rounded-xl bg-white p-5 shadow">
          <h2 className="mb-3 text-lg font-bold">景點池</h2>
          {placesQuery.data?.length === 0 && (
            <p className="text-sm text-gray-500">還沒有景點，到搜尋頁加入吧</p>
          )}
          <ul className="flex flex-col gap-2">
            {placesQuery.data?.map((place) => (
              <li key={place.id} className="rounded-lg border border-gray-200 px-3 py-2">
                <p className="font-semibold">{place.place_name}</p>
                <p className="text-xs text-gray-500">{place.city_name}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* 右邊：每日行程 */}
        <section className="rounded-xl bg-white p-5 shadow">
          <div className="mb-4 flex flex-wrap gap-2">
            {dayNumbers.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => setActiveDay(day)}
                className={`rounded-full px-4 py-1 text-sm font-semibold ${
                  day === activeDay
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                第 {day} 天 {dayDate(trip.start_date, day)}
              </button>
            ))}
          </div>

          {dayQuery.isPending && <p className="text-sm text-gray-500">載入中…</p>}
          {dayQuery.data?.length === 0 && (
            <p className="text-sm text-gray-500">這一天還沒有排景點</p>
          )}
          <ol className="flex flex-col gap-2">
            {dayQuery.data?.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                  {item.position + 1}
                </span>
                <span className="flex-1 font-semibold">{item.destination.place_name}</span>
                <span className="text-sm text-gray-500">
                  {item.arrival_time?.slice(0, 5)}
                  {item.departure_time && `～${item.departure_time.slice(0, 5)}`}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
```

| 寫法 | 意思 |
|---|---|
| `useParams<{ tripId: string }>()` | 拿到網址裡 `[tripId]` 那一段。網址都是文字，所以用 `Number(...)` 轉成數字 |
| `retry: false` | 行程不存在（404）時，直接顯示錯誤，不要自動重試 3 次 |
| `enabled: tripQuery.isSuccess` | 拿到行程之後，才去拿景點池和每日行程 |
| `if (tripQuery.isError) return (...)` | 提早 `return`：出錯就只畫錯誤訊息 |
| `Array.from({ length: trip.days }, (_, i) => i + 1)` | 做出 `[1, 2, 3]`，一天一個分頁按鈕 |
| `` className={`... ${day === activeDay ? "..." : "..."}`} `` | 現在這一天的按鈕是藍色，其他是灰色 |
| `item.position + 1` | `position` 從 0 開始，畫面上顯示「第 1 站」比較自然 |
| `item.arrival_time?.slice(0, 5)` | `"09:00:00"` 只取前 5 個字，變成 `"09:00"` |

#### 步驟 6：測試

打開 http://localhost:3000 。

1. 上面多了導覽列。點「我的行程」→ 看到「京都三日遊」。
2. 點它 → 網址變成 `/trips/1`。左邊景點池有清水寺、花見小路、伏見稻荷、八坂神社；右邊第 1 天是伏見稻荷 09:00～10:30 → 清水寺 11:00～12:00 → 花見小路 13:00。分頁上有日期：12/20、12/21、12/22。
3. 切到第 2 天（八坂神社）、第 3 天（還沒有排景點），再切回第 1 天：**馬上**就出現。打開右下角的 TanStack 小工具，可以看到 `["itinerary",1,1]`、`["itinerary",1,2]`、`["itinerary",1,3]` 三筆。
4. 網址直接打 `/trips/999` → 「找不到這個行程」。
5. 回「我的行程」，建立「大阪兩日遊」，天數 2，出發日選 2027/1/5 → 自動跳到它的編輯頁（網址應該是 `/trips/4`），分頁是 1/5、1/6。
6. 回「我的行程」→ 兩個行程，大阪在前面。刪除大阪兩日遊 → 先跳確認框，按確定後消失。
7. 點導覽列的「搜尋景點」，搜京都 → 還是 26 個，搜尋頁沒有被改壞。

### 3. 這一段結束後的資料夾

```
frontend/app/
├── lib/
│   ├── api.ts             ← 改：apiFetch ＋ 6 支行程的 API
│   └── types.ts           ← 改：加上 Trip、TripCreate、ItineraryItem
├── trips/
│   ├── page.tsx           ← 新增：/trips（我的行程）
│   └── [tripId]/
│       └── page.tsx       ← 新增：/trips/1、/trips/2……（編輯頁）
└── layout.tsx             ← 改：加上導覽列
```

### 4. 跟原專案對照

| 項目 | 原專案 | 我們 |
|---|---|---|
| 網址 | 我的行程 `/dashboard`（要登入）、編輯頁 `/edit/[tripId]` | `/trips`、`/trips/[tripId]` |
| 編輯頁怎麼拿到 `tripId` | `page.tsx` 在伺服器拿 `params`，再傳給 `edit-workspace.tsx` | 整頁 `"use client"`，用 `useParams()` |
| 建立行程 | 跳出一個視窗（`CreateTripModal`） | 列表頁上方的表單 |
| 共用的 API 小幫手 | `apiFetch`：還會用 zod 檢查回應、自動帶編輯權限的 token | `apiFetch`：先不檢查格式（token 第 8 課再加） |
| 編輯頁的資料 | 包成好幾支自訂 hook（`useEditData`、`useItineraryQueries`） | 先直接在頁面裡寫 3 個 `useQuery` |
| 刪除前確認 | 自己做的確認視窗 | 瀏覽器內建的 `confirm()`（自訂視窗第 9 課美化時再做） |

### 5. 常見踩雷

| 症狀 | 原因 | 解法 |
|---|---|---|
| `/trips` 是 404 頁面 | 資料夾或檔名不對 | 要是 `app/trips/page.tsx` |
| `/trips/1` 是 404 頁面 | 資料夾忘了打中括號，打成 `tripId` | 資料夾名稱是 `[tripId]` |
| 編輯頁一直「載入中…」，網址是 `/trips/1` | `useParams` 的名字跟資料夾不一樣（例如寫成 `id`），拿到 `undefined` | `useParams<{ tripId: string }>()`，跟資料夾 `[tripId]` 同名 |
| 編輯頁顯示「後端回應 500」或「讀取行程失敗」 | 後端（uvicorn）沒開 | 開 uvicorn |
| 建立時出現「建立失敗：後端回應 422」 | 天數不在 1～60 之間 | 改天數 |
| 刪除後列表沒變 | 確認框按了「取消」；或 `remove` 的 `onSuccess` 沒寫 `invalidateQueries` | 對照步驟 4 |
| 換頁時整個畫面閃一下、TanStack 小工具裡的快取都不見 | 用了 `<a href>`，不是 `<Link href>` | 改用 `Link` |

### 📌 這一段的 3 個重點

1. **資料夾就是網址**，`[tripId]` 這種中括號資料夾代表網址裡的變數，用 `useParams()` 拿。
2. **`useQuery` 讀、`useMutation` 改**：改完用 `onSuccess` 讓相關的快取作廢（`invalidateQueries`），畫面就會更新。
3. **每一筆資料一個 `queryKey`**：`["itinerary", 1, 2]` 是行程 1 第 2 天，每一天各自快取。

### 6. 小測驗

（提示：每題都可以用「如果不這樣做，會發生什麼壞事？」來想。）

1. `app/trips/[tripId]/page.tsx` 的中括號是什麼意思？如果不用中括號，要怎麼做出 `/trips/1`、`/trips/2`……？
2. 建立行程為什麼用 `useMutation`，不用 `useQuery`？
3. 刪除行程後，如果 `onSuccess` 沒有 `invalidateQueries({ queryKey: ["trips"] })`，畫面會怎樣？
4. 從第 1 天切到第 2 天，再切回第 1 天，為什麼第 1 天是**馬上**出現的？

<details>
<summary>點開看解答</summary>

1. 中括號代表網址的這一段是**變數**：`/trips/1`、`/trips/37` 都會用這一個檔案，`useParams()` 拿到的 `tripId` 分別是 `"1"`、`"37"`。不用中括號的話，就得建 `app/trips/1/page.tsx`、`app/trips/2/page.tsx`……每多一個行程就要多一個資料夾，根本做不完。
2. `useQuery` 是「讀」，畫面一出現就會**自動執行**，還會在各種時機自動重抓。用它來建立行程的話，每次打開這一頁就會建立一個新行程。`useMutation` 只有在呼叫 `mutate(...)`，也就是按下按鈕時才執行一次。
3. 資料庫裡已經刪掉了，但前端小白板上的行程列表還是舊的，**那個行程還留在畫面上**，要重新整理頁面才會消失。使用者會以為沒刪成功，可能再按一次，結果得到「找不到這個行程」。
4. `["itinerary", 1, 1]` 這一筆還在前端小白板上，TanStack Query 會**先拿它出來顯示**，同時在背景向後端再確認一次（這幾頁沒有設 `staleTime`，預設是馬上就算舊，所以會在背景重抓）。使用者不用等。

</details>

#### 你的實作紀錄（2026-11-07）

- 5 個檔案都正確，差異都是編輯器自動折行。型別檢查、lint 都通過。
- 用 Chrome 對你的畫面測：我的行程列出大阪兩日遊、京都三日遊；京都三日遊的景點池、分頁日期、第 1、2 天都正確；`/trips/999` 顯示「找不到這個行程」。
- 測試第 5 點有做：建立了「大阪兩日遊」（id 4，1/5、1/6），沒有刪掉，留著第 2 段可以用。

---

## 第 2 段：把景點放進行程

### 開始前的測試結果（2026-11-07）

我先在另一份複製的前後端和資料庫測過，用 Chrome 自動操作：

| 測試 | 結果 |
|---|---|
| 搜尋頁搜京都，還沒選行程 | 26 張卡片都沒有按鈕 |
| 「加入到」選京都三日遊 | 清水寺、花見小路、伏見稻荷、八坂神社顯示「✓ 已加入」，其他 22 個是「加入＋」 |
| 按二年坂的「加入＋」 | 馬上變成「✓ 已加入」 |
| 改選大阪兩日遊 | 26 個全部變回「加入＋」 |
| 編輯頁的景點池 | 排好的顯示「第 1 天」「第 2 天」，還沒排的二年坂顯示「排到第 1 天」 |
| 切到第 3 天，按二年坂的「排到第 3 天」 | 第 3 天出現二年坂，景點池那邊變成「第 3 天」 |
| 刪掉第 3 天那一站 | 消失，景點池的按鈕回來 |
| 從景點池移除排在第 1 天的花見小路 | 先跳確認框，按確定後，景點池和第 1 天**都**少了花見小路 |
| 從景點池移除還沒排的二年坂 | 不跳確認框，直接移除 |
| 從景點池移除第 1 天**中間**那一站 | 畫面編號是 1、2，不會跳號（原本的寫法會變成 1、3，下面會說明） |

### 1. 學到的觀念

#### 畫面需要什麼，API 就跟著調整

景點池要顯示「這個景點排在第幾天」，所以前端得知道**整個行程每一天**排了什麼。第 1 段是一天拿一次，只拿得到正在看的那一天，還沒切過去的天根本沒拿。

所以這一段在後端加一支 `GET /api/trips/{trip_id}/itinerary`，**一次拿回整個行程的每一站**。編輯頁改成只打這一支，再用 `filter` 挑出正在看的那一天：

```ts
const dayItems = allItems.filter((item) => item.day_index === activeDay);
```

順便做一個「景點 id → 第幾天」的對照表（`Map`），景點池每一列都可以馬上查到「排在第幾天」：

```ts
const scheduledDay = new Map(allItems.map((item) => [item.destination.id, item.day_index]));
scheduledDay.get(2); // 清水寺排在第幾天？→ 1
```

原專案也有類似的 API（`/itinerary/summary`），原因一樣。

#### `children`：卡片留一個空位，放什麼由外面決定

`AttractionCard` 多了一個 `children`。在 `<AttractionCard>` 和 `</AttractionCard>` 中間放的東西，就會出現在卡片右下角：

```tsx
<AttractionCard destination={d}>
  {addButton(d.id)}
</AttractionCard>
```

卡片只負責「把景點畫出來」。按鈕要知道選了哪個行程、在不在景點池、怎麼加入，這些都是**搜尋頁**的事，所以由搜尋頁決定要放什麼。之後別的頁面用同一張卡片，可以放別的按鈕，或什麼都不放。第 5 課 `layout.tsx` 的 `{children}` 也是同一個概念。

#### 改完資料，所有被影響的都要重抓

編輯頁有 3 個會改資料的按鈕，每一個做完都呼叫 `refresh()`，讓**景點池和每日行程兩份都作廢**：

| 按鈕 | 改了什麼 | 為什麼兩份都要重抓 |
|---|---|---|
| 排到第 N 天 | 每日行程多一站 | 景點池那一列要從按鈕變成「第 N 天」 |
| 刪掉一站（每日行程的 ✕） | 每日行程少一站 | 景點池那一列要從「第 N 天」變回按鈕 |
| 從景點池移除（景點池的 ✕） | 景點池少一個 | 第 6 課的 `ON DELETE CASCADE`：**資料庫會連帶刪掉排好的那一站**，每日行程也變了 |

第三種最容易漏：前端只呼叫了「移除景點池」，但資料庫多做了一件事。只重抓景點池的話，畫面上的每日行程還會留著那一站。

#### 每一站的編號，用畫面上的順序

第 1 段每一站的編號是 `position + 1`。但這一段實際測的時候發現一個問題：

1. 第 1 天：伏見稻荷（`position` 0）→ 清水寺（1）→ 花見小路（2）
2. 從景點池移除清水寺 → 資料庫自己把那一站刪掉（CASCADE）
3. 第 6 課寫的「補位」只在 `DELETE /itinerary/{item_id}` 裡，**資料庫自己刪的那一站，補位的程式根本沒機會執行**
4. 花見小路的 `position` 還是 2，畫面顯示成「第 1 站、第 3 站」

所以改成用**畫面上的順序**編號：`map((item, index) => ...)` 的 `index` 是 0、1、2……，顯示 `index + 1`。列表本來就是照 `position` 排好的，順序不會錯，只是編號不再跳號。第 3 段儲存時，`position` 也會被重新整理成 0、1、2。

#### 兩個小語法

| 寫法 | 意思 |
|---|---|
| `tripId!` | 告訴 TypeScript「這裡一定不是 `null`」。`tripId` 的型別是 `number \| null`，但 `enabled: tripId !== null` 保證了沒選行程時不會執行 |
| `new Set(...)`、`set.has(x)` | 集合：查「某個 id 在不在裡面」很快，跟第 4 課 Python 的 `set` 一樣 |

### 2. 實作步驟

這一段**前後端都要改**。

#### 步驟 7：後端 `router/itinerary.py` 加一支 API

在 `list_day_itinerary` 那支的**後面**加上：

```python
@router.get("/api/trips/{trip_id}/itinerary", response_model=list[ItineraryItemOut])
def list_trip_itinerary(trip_id: int, db: Session = Depends(get_db)):
    """整個行程每一天的每一站，照第幾天、第幾站排好"""
    get_trip_or_404(db, trip_id)
    stmt = (
        select(ItineraryItem)
        .where(ItineraryItem.trip_id == trip_id)
        .order_by(ItineraryItem.day_index, ItineraryItem.position)
    )
    return db.scalars(stmt).all()
```

不用改資料表，也不用跑 Alembic。uvicorn 會自己重開，`/docs` 裡會多一支 `GET /api/trips/{trip_id}/itinerary`。

#### 步驟 8：`app/lib/api.ts` 整個換掉

```ts
import type {
  Destination,
  ItineraryItem,
  SearchResponse,
  Trip,
  TripCreate,
} from "@/app/lib/types";

// 所有 API 共用的小幫手：送出請求 → 檢查有沒有成功 → 把回應變成物件
// <T> 是「這支 API 會回什麼」的空格，呼叫時再填，例如 apiFetch<Trip[]>(...)
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    // 後端的錯誤訊息放在 detail 裡，例如「找不到這個行程」
    const body = await res.json().catch(() => null);
    throw new Error(
      typeof body?.detail === "string" ? body.detail : `後端回應 ${res.status}`,
    );
  }
  if (res.status === 204) {
    return undefined as T; // 刪除成功，後端沒有回任何內容
  }
  return res.json();
}

// ---------- 搜尋 ----------

// 網址只寫 /api/...：先送到前端自己，再由 next.config.ts 轉給後端
export function searchDestinations(location: string) {
  return apiFetch<SearchResponse>("/api/search", {
    method: "POST",
    body: JSON.stringify({ location }),
  });
}

// ---------- 行程 ----------

export function listTrips() {
  return apiFetch<Trip[]>("/api/trips");
}

export function getTrip(tripId: number) {
  return apiFetch<Trip>(`/api/trips/${tripId}`);
}

export function createTrip(input: TripCreate) {
  return apiFetch<Trip>("/api/trips", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteTrip(tripId: number) {
  return apiFetch<void>(`/api/trips/${tripId}`, { method: "DELETE" });
}

// ---------- 景點池 ----------

export function listTripPlaces(tripId: number) {
  return apiFetch<Destination[]>(`/api/trips/${tripId}/places`);
}

export function addTripPlace(tripId: number, destinationId: number) {
  return apiFetch<Destination>(`/api/trips/${tripId}/places`, {
    method: "POST",
    body: JSON.stringify({ destination_id: destinationId }),
  });
}

export function removeTripPlace(tripId: number, destinationId: number) {
  return apiFetch<void>(`/api/trips/${tripId}/places/${destinationId}`, {
    method: "DELETE",
  });
}

// ---------- 每日行程 ----------

// 整個行程每一天的每一站，一次拿回來
export function listTripItinerary(tripId: number) {
  return apiFetch<ItineraryItem[]>(`/api/trips/${tripId}/itinerary`);
}

export function addToDay(tripId: number, day: number, destinationId: number) {
  return apiFetch<ItineraryItem>(`/api/trips/${tripId}/days/${day}/itinerary`, {
    method: "POST",
    body: JSON.stringify({ destination_id: destinationId }),
  });
}

export function removeItineraryItem(tripId: number, itemId: number) {
  return apiFetch<void>(`/api/trips/${tripId}/itinerary/${itemId}`, {
    method: "DELETE",
  });
}
```

跟第 1 段比：多了 `addTripPlace`、`removeTripPlace`、`listTripItinerary`、`addToDay`、`removeItineraryItem`；`listDayItinerary`（一天拿一次）拿掉了，換成 `listTripItinerary`。

#### 步驟 9：`app/components/AttractionCard.tsx` 整個換掉

```tsx
import type { Destination } from "@/app/lib/types";

type Props = {
  destination: Destination;
  children?: React.ReactNode; // 卡片右下角要放的東西（例如按鈕），可以不放
};

export default function AttractionCard({ destination, children }: Props) {
  return (
    <div className="flex flex-col rounded-xl bg-white p-5 shadow">
      <h3 className="mb-2 text-xl font-bold">{destination.place_name}</h3>
      <p className="mb-4 line-clamp-3 flex-1 text-sm text-gray-600">
        {destination.description}
      </p>
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-600">
          📍 {destination.geo_tags ?? destination.city_name}
        </span>
        {children}
      </div>
    </div>
  );
}
```

多了 `children`，放在卡片右下角；`flex-1` 讓介紹文字撐開，按鈕永遠在卡片最下面。

#### 步驟 10：`app/page.tsx`（搜尋頁）整個換掉

這是你第 5 課的搜尋頁，**SSE 那些都沒有動**，只多了「加入到哪個行程」：

```tsx
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";

import AttractionCard from "@/app/components/AttractionCard";
import {
  addTripPlace,
  listTripPlaces,
  listTrips,
  searchDestinations,
} from "@/app/lib/api";

export default function Home() {
  const queryClient = useQueryClient(); // 拿到前端的小白板，等一下要讓某一筆作廢
  const [keyword, setKeyword] = useState(""); // 輸入框裡現在打的字
  const [searched, setSearched] = useState(""); // 按下搜尋那一刻的關鍵字
  const [taskFailed, setTaskFailed] = useState(false); // AI 在背景找景點失敗了
  const [tripId, setTripId] = useState<number | null>(null); // 要加進哪個行程

  // 拿 searched 去後端搜尋。等待中、出錯、快取，都交給 TanStack Query 管
  const { data, isFetching, isError } = useQuery({
    queryKey: ["search", searched], // 快取的名字，就像第 4 課 Redis 的 search:京都
    queryFn: () => searchDestinations(searched),
    enabled: searched !== "", // 還沒搜尋過，就先不要打 API
    staleTime: 5 * 60 * 1000, // 5 分鐘內再搜同一個地點，直接用快取，不再問後端
    refetchOnWindowFocus: false, // 切回這個分頁時不要自動重抓：重抓可能又派一次 worker
    retry: false, // 失敗就直接顯示錯誤，不要自動重試
  });

  // 後端說「AI 在找」時，會給一張號碼牌（task_id）
  const taskId = data?.status === "processing" ? data.task_id : null;

  // 有號碼牌，就用 SSE 坐著等叫號
  useEffect(() => {
    if (!taskId) return; // 沒有號碼牌就不用等

    const es = new EventSource(`/api/search/stream/${taskId}`);

    es.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.status === "completed") {
        // 叫號了：讓小白板上這個地點作廢，useQuery 會自己再搜一次，拿到新景點
        queryClient.invalidateQueries({ queryKey: ["search", searched] });
      } else {
        setTaskFailed(true); // failed 或 timeout
      }
      es.close(); // 拿到結果就掛斷，不然 EventSource 會自動重新連線
    };

    es.onerror = () => {
      // 連線斷掉時（例如後端重開），EventSource 會自己重新連線，不用管它。
      // 只有連不上後端（回應錯誤）時它才會放棄，這時才算失敗
      if (es.readyState === EventSource.CLOSED) {
        setTaskFailed(true);
      }
    };

    // 收拾：換搜別的城市、或離開這一頁時，掛斷這條連線
    return () => es.close();
  }, [taskId, searched, queryClient]);

  // 「加入到哪個行程」的選單要用的行程清單
  const tripsQuery = useQuery({ queryKey: ["trips"], queryFn: listTrips });

  // 選好的行程，景點池裡已經有哪些景點
  const poolQuery = useQuery({
    queryKey: ["tripPlaces", tripId],
    queryFn: () => listTripPlaces(tripId!), // ! 的意思是「這裡一定不是 null」，下一行保證了
    enabled: tripId !== null, // 還沒選行程，就不用拿
  });
  const inPool = new Set(poolQuery.data?.map((place) => place.id)); // 已經加入的景點 id

  const addPlace = useMutation({
    mutationFn: (destinationId: number) => addTripPlace(tripId!, destinationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tripPlaces", tripId] }),
  });

  // 每張卡片右下角的按鈕
  function addButton(destinationId: number) {
    if (tripId === null) return null; // 還沒選行程，就不顯示
    if (inPool.has(destinationId)) {
      return <span className="text-xs font-semibold text-gray-400">✓ 已加入</span>;
    }
    return (
      <button
        type="button"
        onClick={() => addPlace.mutate(destinationId)}
        disabled={addPlace.isPending}
        className="shrink-0 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400"
      >
        加入＋
      </button>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); // 表單送出時，瀏覽器預設會重新整理頁面，把它擋掉
    setSearched(keyword.trim());
    setTaskFailed(false);
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="mb-6 text-3xl font-bold">Easy Travel Scheduler</h1>

      <form onSubmit={handleSubmit} className="mb-8 flex gap-2">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="想去哪裡？例如：京都"
          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2"
        />
        <button
          type="submit"
          disabled={isFetching}
          className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isFetching ? "搜尋中…" : "搜尋"}
        </button>
      </form>

      <div className="mb-6 flex items-center gap-2 text-sm">
        <span className="text-gray-600">加入到：</span>
        <select
          value={tripId ?? ""}
          onChange={(e) => setTripId(e.target.value ? Number(e.target.value) : null)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1"
        >
          <option value="">選一個行程</option>
          {tripsQuery.data?.map((trip) => (
            <option key={trip.id} value={trip.id}>
              {trip.title}
            </option>
          ))}
        </select>
        {tripsQuery.data?.length === 0 && (
          <Link href="/trips" className="text-blue-600 hover:underline">
            先去建立一個行程
          </Link>
        )}
        {addPlace.isError && <span className="text-red-600">{addPlace.error.message}</span>}
      </div>

      {isError && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-red-600">
          搜尋失敗：請確認後端（uvicorn）有在跑
        </p>
      )}

      {taskFailed && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-red-600">
          AI 找景點失敗了，請重新整理頁面後再搜一次
        </p>
      )}

      {data?.status === "processing" && !taskFailed && (
        <p className="mb-4 rounded-lg bg-yellow-50 p-3 text-yellow-700">
          🤖 資料庫裡「{data.location}」的景點還不夠，AI 正在背景幫你找，大約 1
          分鐘。找到會自動顯示，不用重新整理。
        </p>
      )}

      {data && (
        <>
          <p className="mb-4 text-gray-600">
            「{data.location}」的景點：{data.destinations.length} 個
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.destinations.map((d) => (
              <AttractionCard key={d.id} destination={d}>
                {addButton(d.id)}
              </AttractionCard>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
```

| 新增的部分 | 意思 |
|---|---|
| `tripId` 這個 state | 「加入到」選了哪個行程，沒選是 `null` |
| `tripsQuery` | 下拉選單要列出的行程。`queryKey` 跟「我的行程」頁一樣是 `["trips"]`，所以是**同一筆快取** |
| `poolQuery` | 選好的行程，景點池裡有哪些景點 |
| `inPool` | 把景點池變成 `Set`，用來判斷每張卡片顯示「加入＋」還是「✓ 已加入」 |
| `addPlace` | 按「加入＋」時加進景點池；成功後讓 `["tripPlaces", tripId]` 作廢，卡片就會變成「✓ 已加入」 |
| `addButton(...)` | 決定每張卡片右下角放什麼：沒選行程就不放 |
| `<select>`、`<option>` | 下拉選單。`e.target.value` 一定是文字，所以要 `Number(...)` |

#### 步驟 11：`app/trips/[tripId]/page.tsx`（編輯頁）整個換掉

```tsx
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import {
  addToDay,
  getTrip,
  listTripItinerary,
  listTripPlaces,
  removeItineraryItem,
  removeTripPlace,
} from "@/app/lib/api";

// 第 N 天的日期 ＝ 出發日 ＋（N − 1）天。後端沒有存，前端自己算
function dayDate(startDate: string | null, day: number) {
  if (!startDate) return "";
  const date = new Date(`${startDate}T00:00:00`);
  date.setDate(date.getDate() + day - 1);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function TripEditPage() {
  // 網址 /trips/1 裡的「1」。資料夾叫 [tripId]，所以這裡就叫 tripId
  const params = useParams<{ tripId: string }>();
  const tripId = Number(params.tripId);
  const queryClient = useQueryClient();
  const [activeDay, setActiveDay] = useState(1); // 現在看第幾天

  const tripQuery = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => getTrip(tripId),
    retry: false, // 找不到行程（404）就直接顯示，不要重試
  });
  const placesQuery = useQuery({
    queryKey: ["tripPlaces", tripId],
    queryFn: () => listTripPlaces(tripId),
    enabled: tripQuery.isSuccess, // 確定有這個行程，才去拿景點池
  });
  // 整個行程每一天的每一站，一次拿回來（才知道每個景點排在第幾天）
  const itineraryQuery = useQuery({
    queryKey: ["itinerary", tripId],
    queryFn: () => listTripItinerary(tripId),
    enabled: tripQuery.isSuccess,
  });

  // 改完資料後，景點池和每日行程都作廢重抓，最不容易漏
  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["tripPlaces", tripId] });
    queryClient.invalidateQueries({ queryKey: ["itinerary", tripId] });
  }

  const addItem = useMutation({
    mutationFn: (destinationId: number) => addToDay(tripId, activeDay, destinationId),
    onSuccess: refresh,
  });
  const removeItem = useMutation({
    mutationFn: (itemId: number) => removeItineraryItem(tripId, itemId),
    onSuccess: refresh,
  });
  const removePlace = useMutation({
    mutationFn: (destinationId: number) => removeTripPlace(tripId, destinationId),
    onSuccess: refresh, // 資料庫會連帶刪掉排好的那一站（CASCADE），所以每日行程也要重抓
  });

  if (tripQuery.isError) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <p className="mb-4 text-red-600">{tripQuery.error.message}</p>
        <Link href="/trips" className="text-blue-600 hover:underline">
          ← 回我的行程
        </Link>
      </main>
    );
  }

  const trip = tripQuery.data;
  if (!trip) {
    return <main className="mx-auto max-w-5xl p-6 text-gray-500">載入中…</main>;
  }

  const dayNumbers = Array.from({ length: trip.days }, (_, i) => i + 1); // 例如 [1, 2, 3]
  const allItems = itineraryQuery.data ?? [];
  const dayItems = allItems.filter((item) => item.day_index === activeDay); // 這一天的每一站
  // 每個景點排在第幾天：景點 id → 第幾天
  const scheduledDay = new Map(allItems.map((item) => [item.destination.id, item.day_index]));
  const error = addItem.error ?? removeItem.error ?? removePlace.error;

  function handleRemovePlace(destinationId: number, name: string) {
    const day = scheduledDay.get(destinationId);
    if (day && !confirm(`「${name}」已經排在第 ${day} 天，移除後那一站也會一起刪掉。確定嗎？`)) {
      return;
    }
    removePlace.mutate(destinationId);
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-3xl font-bold">{trip.title}</h1>
      <p className="mb-6 text-gray-500">
        {trip.days} 天{trip.start_date && `・${trip.start_date} 出發`}
      </p>

      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-red-600">{error.message}</p>}

      <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
        {/* 左邊：景點池 */}
        <section className="rounded-xl bg-white p-5 shadow">
          <h2 className="mb-3 text-lg font-bold">景點池</h2>
          {placesQuery.isError && (
            <p className="text-sm text-red-600">{placesQuery.error.message}</p>
          )}
          {placesQuery.data?.length === 0 && (
            <p className="text-sm text-gray-500">
              還沒有景點，到
              <Link href="/" className="text-blue-600 hover:underline">
                搜尋頁
              </Link>
              加入吧
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {placesQuery.data?.map((place) => (
              <li
                key={place.id}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2"
              >
                <div className="flex-1">
                  <p className="font-semibold">{place.place_name}</p>
                  <p className="text-xs text-gray-500">{place.city_name}</p>
                </div>
                {scheduledDay.has(place.id) ? (
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500">
                    第 {scheduledDay.get(place.id)} 天
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => addItem.mutate(place.id)}
                    disabled={addItem.isPending}
                    className="shrink-0 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    排到第 {activeDay} 天
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleRemovePlace(place.id, place.place_name)}
                  title="從景點池移除"
                  className="px-1 text-gray-400 hover:text-red-600"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* 右邊：每日行程 */}
        <section className="rounded-xl bg-white p-5 shadow">
          <div className="mb-4 flex flex-wrap gap-2">
            {dayNumbers.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => setActiveDay(day)}
                className={`rounded-full px-4 py-1 text-sm font-semibold ${
                  day === activeDay
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                第 {day} 天 {dayDate(trip.start_date, day)}
              </button>
            ))}
          </div>

          {itineraryQuery.isPending && <p className="text-sm text-gray-500">載入中…</p>}
          {itineraryQuery.isError && (
            <p className="text-sm text-red-600">{itineraryQuery.error.message}</p>
          )}
          {itineraryQuery.isSuccess && dayItems.length === 0 && (
            <p className="text-sm text-gray-500">這一天還沒有排景點，從左邊的景點池排進來吧</p>
          )}
          <ol className="flex flex-col gap-2">
            {dayItems.map((item, index) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2"
              >
                {/* 用畫面上的順序編號，不直接用 position：從景點池移除時，
                    那一站是資料庫自己刪的，不會補位，position 可能跳號 */}
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                  {index + 1}
                </span>
                <span className="flex-1 font-semibold">{item.destination.place_name}</span>
                <span className="text-sm text-gray-500">
                  {item.arrival_time?.slice(0, 5)}
                  {item.departure_time && `～${item.departure_time.slice(0, 5)}`}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem.mutate(item.id)}
                  title="刪掉這一站"
                  className="px-1 text-gray-400 hover:text-red-600"
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
```

| 跟第 1 段比 | 意思 |
|---|---|
| `dayQuery` 換成 `itineraryQuery` | 一次拿整個行程，`queryKey` 是 `["itinerary", tripId]` |
| `dayItems`、`scheduledDay` | 從整個行程裡挑出這一天；做「景點 id → 第幾天」的對照表 |
| `refresh()` | 改完資料後，景點池和每日行程都作廢重抓 |
| `addItem`、`removeItem`、`removePlace` | 3 個按鈕各自的 `useMutation` |
| `error` | 3 個動作任一個失敗，就在最上面顯示錯誤訊息。`a ?? b ?? c` 是「拿第一個不是空的」 |
| `handleRemovePlace` | 景點已經排進某一天的話，先跳確認框，提醒那一站也會被刪 |
| `placesQuery.isError`、`itineraryQuery.isError` | 拿資料失敗時，顯示錯誤訊息，不會一片空白 |
| `index + 1` | 每一站的編號用畫面上的順序 |

#### 步驟 12：測試

確認 uvicorn、前端都在跑。

1. **搜尋頁**：搜「京都」→ 卡片都沒有按鈕（還沒選行程）。
2. 「加入到」選**京都三日遊** → 清水寺、花見小路、伏見稻荷、八坂神社是「✓ 已加入」，其他是「加入＋」。
3. 按**二年坂及三年坂**的「加入＋」→ 馬上變成「✓ 已加入」。
4. 改選**大阪兩日遊** → 全部變回「加入＋」。（想試的話，可以挑幾個加進大阪的行程。）
5. **我的行程 → 京都三日遊**：景點池有 5 個，排好的顯示「第 1 天」「第 2 天」，二年坂顯示「排到第 1 天」。
6. 切到**第 3 天** → 二年坂的按鈕變成「排到第 3 天」，按下去 → 第 3 天出現二年坂，景點池那邊變成「第 3 天」。
7. 按第 3 天那一站的 **✕** → 消失，景點池的按鈕回來。
8. **實驗：從景點池移除排好的景點**。切回第 1 天，按景點池裡**清水寺**的 ✕ → 跳出確認框，說它排在第 1 天 → 按確定。景點池少了清水寺，第 1 天也只剩伏見稻荷和花見小路，**編號是 1、2**，不是 1、3。

   > 清水寺的時間（11:00～12:00）會跟著那一站一起刪掉。想加回來：搜尋頁「加入＋」→ 編輯頁「排到第 1 天」，它會排在最後面。第 3 段做好拖拉之後，就能把它拖回中間、重新填時間。

9. 按景點池裡**二年坂**的 ✕（它現在沒排在任何一天）→ 不跳確認框，直接移除。

### 3. 這一段結束後的資料夾

```
backend/router/
└── itinerary.py           ← 改：加上 GET /api/trips/{trip_id}/itinerary

frontend/app/
├── components/
│   └── AttractionCard.tsx ← 改：加上 children
├── lib/
│   └── api.ts             ← 改：景點池、每日行程的 5 支 API
├── trips/[tripId]/
│   └── page.tsx           ← 改：排到第 N 天、刪一站、移除景點池
└── page.tsx               ← 改：加入到哪個行程、加入＋
```

### 4. 跟原專案對照

| 項目 | 原專案 | 我們 |
|---|---|---|
| 搜尋頁加入行程 | `AddPlacesToTripBtn`：先選「現在要編輯的行程」，卡片按鈕有三種狀態：加入＋／已加入／已在行程中 | 下拉選單選行程，卡片按鈕兩種狀態：加入＋／✓ 已加入 |
| 「景點排在第幾天」 | `GET /api/trips/{id}/itinerary/summary`，只回 id 和第幾天 | `GET /api/trips/{id}/itinerary`，回完整的每一站，編輯頁也直接拿來顯示 |
| 編輯頁的每日行程 | 一天拿一次 | 整個行程一次拿，前端用 `filter` 分天 |
| 從景點池移除排好的景點 | 排好的那一站還留著 | 先跳確認框，資料庫一起刪掉 |
| 每一站的編號 | 用 `position` | 用畫面上的順序（`index + 1`） |
| 改完資料重抓 | 各自 `invalidateQueries` 幾個 key | 一個 `refresh()`，兩份都重抓 |

### 5. 常見踩雷

| 症狀 | 原因 | 解法 |
|---|---|---|
| 搜尋頁的卡片都沒有按鈕 | 還沒在「加入到」選行程 | 先選一個行程 |
| 編輯頁的每日行程顯示「載入中…」大約 7 秒，然後變成 `Not Found` | 後端沒加 `GET /api/trips/{trip_id}/itinerary`，或沒存檔（失敗時會自動重試 3 次，所以要等一下） | 對照步驟 7 |
| `Module '"@/app/lib/api"' has no exported member 'addTripPlace'` | `api.ts` 沒換 | 對照步驟 8 |
| 從景點池移除後，每日行程裡那一站還在畫面上 | `removePlace` 的 `onSuccess` 只讓景點池作廢 | 用 `refresh()`，兩份都作廢 |
| 按了「加入＋」，卡片沒變成「✓ 已加入」 | `addPlace` 的 `onSuccess` 沒有 `invalidateQueries` | 對照步驟 10 |
| 每一站的編號跳號（1、3） | 還在用 `position + 1` | 改成 `index + 1` |

### 📌 這一段的 3 個重點

1. **畫面需要什麼，API 就跟著調整**：要顯示「排在第幾天」，就加一支一次拿整個行程的 API，前端再用 `filter`、`Map` 整理。
2. **改完資料，所有被影響的都要重抓**：資料庫的 CASCADE 會多刪東西，前端也要跟著重抓每日行程。
3. **`children` 讓元件留空位**：卡片只管畫景點，按鈕由使用它的頁面決定。

### 6. 小測驗

（提示：每題都可以用「如果不這樣做，會發生什麼壞事？」來想。）

1. 為什麼這一段要在後端多加一支「一次拿整個行程」的 API？繼續一天一天拿不行嗎？
2. 從景點池移除景點後，為什麼 `refresh()` 連每日行程也要重抓？
3. 每一站的編號為什麼要用 `index + 1`，不用 `position + 1`？
4. 為什麼「加入＋」按鈕用 `children` 放進卡片，不直接寫在 `AttractionCard` 裡面？

<details>
<summary>點開看解答</summary>

1. 景點池要顯示每個景點「排在第幾天」，就要知道**每一天**的資料。一天一天拿的話，只有點過的那幾天有資料，沒點過的天，景點池就會以為「還沒排」，顯示錯的按鈕；要全部拿到，3 天的行程就得打 3 次 API。一次拿整個行程，一次就有全部。
2. 第 6 課每日行程的外鍵指向景點池，而且是 `ON DELETE CASCADE`。從景點池移除一個排好的景點，**資料庫會自己把那一站也刪掉**。前端只知道自己刪了景點池，如果只重抓景點池，畫面上的每日行程還會留著那一站，跟資料庫對不起來。
3. 從景點池移除景點時，那一站是資料庫自己刪的，第 6 課寫的「補位」只在刪一站的 API 裡，**沒有機會執行**，剩下的 `position` 就可能跳號（0、2）。用 `position + 1` 會顯示成「第 1 站、第 3 站」。用畫面上的順序 `index + 1`，永遠是 1、2、3。
4. 按鈕要知道「選了哪個行程」「這個景點在不在景點池」「按下去要做什麼」，這些都是搜尋頁的事，卡片不應該知道。寫死在卡片裡的話，之後別的頁面要用這張卡片、卻不需要「加入＋」（或要放別的按鈕）時，就得再複製一張卡片。用 `children`，卡片只管畫景點，誰用它，誰決定放什麼。

</details>

#### 你的實作紀錄（2026-11-08）

- 後端那支 `GET /api/trips/{trip_id}/itinerary` 跟教材一字不差，位置也對（放在 `list_day_itinerary` 後面）。不存在的行程回 404。
- 前端 4 個檔案的內容都正確，差異只有編輯器自動折行、多加的括號。型別檢查、lint 都通過。
- 用 Chrome 對你的畫面測（只看、沒有點）：
  - 京都三日遊：景點池 3 個都顯示「第 N 天」；第 1 天是 1 花見小路、2 伏見稻荷大社，第 2 天是八坂神社，第 3 天顯示「這一天還沒有排景點」。
  - 大阪兩日遊：景點池有金閣寺、平安神宮，按鈕跟著分頁變成「排到第 1 天」「排到第 2 天」。
  - 主控台沒有錯誤。
- 實驗 8、9 有做：清水寺、二年坂已經從京都三日遊移除。花見小路、伏見稻荷大社的 id 變成 13、14，代表移除過又加回來；之前填的時間都跟著刪掉了，第 3 段會重新填。
