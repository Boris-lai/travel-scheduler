# 第 5 課：前端入門（Next.js）＋ 搜尋頁

> **狀態**：✅ 完成（上半 建立專案＋第一個畫面 ／ 中半 接上後端 ／ 下半 SSE 自動更新）
> **日期**：2026-10-28 ～ 2026-11-01
> **對照原專案**：`frontend/app/page.tsx`、`frontend/app/search/page.tsx`、`frontend/app/components/search/AttractionCard.tsx`、`frontend/next.config.ts`、`frontend/app/providers.tsx`、`frontend/app/lib/api.ts`、`frontend/app/context/TaskContext.tsx`

---

## 這一課在整個專案的位置

前 4 課做的都是**店裡面**：櫃檯（FastAPI）、倉庫（PostgreSQL）、製作區（Celery worker）。客人看不到這些。這一課開始做**前端**，也就是客人實際看到、會去點的畫面。

| 段落 | 做什麼 | 做完之後 |
|---|---|---|
| **上** | 建立 Next.js 專案，用**假資料**做出搜尋框和景點卡片 | 畫面出來了，但資料是假的 |
| 中 | 接上後端的 `/api/search`，用 **TanStack Query** 管資料和快取 | 搜京都，出現資料庫裡真的 26 個景點 |
| 下 | 搜新城市時用 SSE 等通知，做好了自動顯示 | 第 4 課的號碼牌、叫號，在瀏覽器裡跑起來 |

> 課程順序在 2026-10-28 調整過：原本的第 5 課「排行程（拖拉、地圖）」拆成第 5～7 課，前端先做。內容沒有減少。

---

## 上半：建立 Next.js 專案＋第一個畫面

### 開始前的測試結果（2026-10-28）

| 項目 | 結果 |
|---|---|
| 用 `create-next-app@16.4.3` 建立專案 | 大約 35 秒 |
| 型別檢查、lint（程式碼檢查） | 都通過 |
| 用 Chrome 自動測試：輸入「京都」、按搜尋 | 出現 2 張假卡片，上面寫「京都」的景點 |
| 搜尋後再打字、先不按搜尋 | 上面的「京都」不會跟著變，按了搜尋才變 |
| 拿掉 `"use client"` | 畫面變成錯誤頁，錯誤訊息放在踩雷表 |

### 1. 學到的觀念

#### 前端是店門口的點餐平板

延續手搖飲店的比喻：前端就是**店門口的點餐平板**。客人在上面點單、看結果。平板自己不做飲料，它只負責把點單送去櫃檯，再把櫃檯的回覆顯示出來。

所以資料都還是在後端，前端只負責**顯示**和**轉送**。

#### 前端的工具，對照你已經會的後端

| 後端（Python） | 前端（Node.js） | 說明 |
|---|---|---|
| Python | TypeScript | 程式語言。TypeScript 就是 JavaScript 加上型別 |
| FastAPI | Next.js（建立在 React 上） | 框架 |
| uv | npm | 套件管理 |
| `pyproject.toml` | `package.json` | 列出用了哪些套件 |
| `uv.lock` | `package-lock.json` | 鎖定確切的版本 |
| `.venv/` | `node_modules/` | 套件裝在這裡，不進 git |
| `uv sync` | `npm install` | 照著清單把套件裝回來 |
| `uv run uvicorn main:app --reload` | `npm run dev` | 開發用的伺服器，存檔就自動更新 |
| Pydantic 的 `DestinationOut` | TypeScript 的 `type Destination` | 描述一筆資料長什麼樣子 |

#### React 的三個基本東西

1. **元件（component）**：一個**回傳畫面的函式**，名字大寫開頭。頁面就是由很多元件拼起來的，像樂高積木。
2. **props**：從外面**傳進**元件的資料，就像函式的參數。例如 `<AttractionCard destination={d} />`，就是把 `d` 傳給卡片。
3. **state**：元件**自己記住**的值，用 `useState` 建立。**用它給的 set 函式去改，畫面就會自動重畫**。

元件裡回傳的那段長得像 HTML 的東西叫 **JSX**。在 JSX 裡用 `{ }` 可以放 JavaScript 的值，例如 `{destination.place_name}`。另外，HTML 的 `class` 在 JSX 裡要寫成 `className`。

#### `"use client"`：這個檔案要在瀏覽器裡跑

Next.js 的元件**預設在伺服器上**產生畫面。要在瀏覽器裡互動（打字、按按鈕、用 `useState`），檔案的**第一行**要寫 `"use client"`。

這一段只有 `page.tsx` 需要寫。`AttractionCard` 只負責顯示，不用寫；而且它是被 `page.tsx` 引用的，本來就會跟著在瀏覽器裡跑。

#### Tailwind：`className` 裡的小積木

`className="rounded-xl bg-white p-5 shadow"` 這種寫法是 **Tailwind**：每個詞是一個小樣式，例如 `rounded-xl` 是圓角、`bg-white` 是白底、`p-5` 是內距、`shadow` 是陰影、`sm:grid-cols-2` 是「螢幕夠寬時排成兩欄」。

不用另外寫 CSS 檔，**也不用背**，看得懂大概的意思就好。

### 2. 實作步驟

#### 步驟 1：建立 Next.js 專案

```bash
cd ~/Desktop/travel-scheduler
npx create-next-app@16.4.3 frontend --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --disable-git --no-react-compiler --no-cache-components --no-agents-md --no-agent-feedback --yes
```

如果出現 `Ok to proceed? (y)`，按 `y` 再按 Enter。大約 30 秒，最後看到 `Success! Created frontend at ...` 就好了。

| 參數 | 意思 |
|---|---|
| `@16.4.3` | 指定版本，跟教材一樣 |
| `frontend` | 建在第 1 課建好的空資料夾 `frontend` 裡 |
| `--ts --tailwind --eslint --app` | TypeScript、Tailwind、程式碼檢查、App Router，都跟原專案一樣 |
| `--no-src-dir` | 不要多一層 `src/` 資料夾，跟原專案一樣 |
| `--disable-git` | 不要另外建 git。整個 `travel-scheduler` 本來就是一個 git 了 |
| `--no-cache-components` 和後面幾個 `--no-...` | 關掉這一版預設會開的進階功能，原專案沒有用 |
| `--yes` | 其他問題都用預設值，不用一題一題回答 |

#### 步驟 2：啟動，看預設畫面

開一個**新的終端機分頁**：

```bash
cd ~/Desktop/travel-scheduler/frontend
npm run dev
```

看到 `Local: http://localhost:3000` 之後，用瀏覽器打開 http://localhost:3000 ，會看到 Next.js 的預設歡迎畫面。左下角的黑色「N」是開發工具，正式上線不會出現。

> 這一段只需要前端在跑。中半開始要接後端，到時候會同時有：Docker（資料庫、Redis）、uvicorn、worker、前端。

#### 步驟 3：認識資料夾

```
frontend/
├── app/                 ← 你的程式碼幾乎都在這裡
│   ├── layout.tsx       ← 每一頁共用的外框（<html>、<body>）
│   ├── page.tsx         ← 首頁，網址是 /
│   ├── globals.css      ← 全站共用的樣式
│   └── favicon.ico      ← 瀏覽器分頁上的小圖示
├── public/              ← 圖片之類的檔案
├── node_modules/        ← 套件（像 .venv，不進 git）
├── .gitignore           ← 已經寫好不要進 git 的東西：node_modules、.next、.env
├── next.config.ts       ← Next.js 的設定（中半會改）
├── package.json         ← 套件清單（像 pyproject.toml）
├── package-lock.json    ← 鎖定版本（像 uv.lock）
└── tsconfig.json        ← TypeScript 的設定
```

**App Router 的規則：`app/` 底下的資料夾就是網址。** `app/page.tsx` 是 `/`；如果建一個 `app/search/page.tsx`，它就是 `/search`。原專案的編輯頁網址 `/edit/123`，檔案就是 `app/edit/[tripId]/page.tsx`。

#### 步驟 4：清掉預設的樣式

`app/globals.css` 整個檔案換成這一行：

```css
@import "tailwindcss";
```

`app/layout.tsx` 整個檔案換成：

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Easy Travel Scheduler",
  description: "輸入城市，AI 幫你找景點",
};

// 每一頁的外框：<html>、<body> 只寫在這裡，children 就是各頁的內容
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body className="min-h-screen bg-gray-50 text-gray-800">{children}</body>
    </html>
  );
}
```

`metadata` 的 `title` 就是瀏覽器分頁上顯示的標題。

#### 步驟 5：新增 `app/lib/types.ts`，描述一筆景點長什麼樣子

```ts
// 後端 DestinationOut 的樣子（先列出畫面會用到的欄位）
export type Destination = {
  id: number;
  place_name: string;
  city_name: string | null;
  description: string | null;
  geo_tags: string | null;
};
```

對照第 2 課的 `schemas/destination.py`：`string | null` 就是 Python 的 `str | None`。

#### 步驟 6：新增 `app/components/AttractionCard.tsx`，一張景點卡片

```tsx
import type { Destination } from "@/app/lib/types";

type Props = {
  destination: Destination;
};

export default function AttractionCard({ destination }: Props) {
  return (
    <div className="rounded-xl bg-white p-5 shadow">
      <h3 className="mb-2 text-xl font-bold">{destination.place_name}</h3>
      <p className="mb-4 line-clamp-3 text-sm text-gray-600">{destination.description}</p>
      <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-600">
        📍 {destination.geo_tags ?? destination.city_name}
      </span>
    </div>
  );
}
```

| 寫法 | 意思 |
|---|---|
| `@/app/lib/types` | `@/` 代表 `frontend/` 資料夾，不用寫一堆 `../../` |
| `type Props = { ... }` | 這個元件要收哪些 props |
| `function AttractionCard({ destination }: Props)` | 從 props 裡把 `destination` 拿出來用 |
| `export default` | 讓別的檔案可以 `import` 這個元件 |
| `{destination.place_name}` | 在 JSX 裡用 `{ }` 放值 |
| `a ?? b` | `a` 是 `null` 就用 `b`：沒有 `geo_tags` 就顯示 `city_name` |
| `line-clamp-3` | 介紹太長時，最多顯示 3 行 |

#### 步驟 7：`app/page.tsx` 整個換成搜尋頁

```tsx
"use client";

import { useState } from "react";

import AttractionCard from "@/app/components/AttractionCard";
import type { Destination } from "@/app/lib/types";

// 先用假資料把畫面做出來，中半再換成後端的真資料
const FAKE_RESULTS: Destination[] = [
  {
    id: 1,
    place_name: "清水寺",
    city_name: "京都",
    description: "京都最古老的寺院，春天的櫻花和秋天的楓葉都很美。",
    geo_tags: "京都,東山",
  },
  {
    id: 2,
    place_name: "伏見稻荷大社",
    city_name: "京都",
    description: "千本鳥居，一路紅到山頂。",
    geo_tags: "京都,伏見",
  },
];

export default function Home() {
  const [keyword, setKeyword] = useState(""); // 輸入框裡現在打的字
  const [searched, setSearched] = useState(""); // 按下搜尋那一刻的關鍵字

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); // 表單送出時，瀏覽器預設會重新整理頁面，把它擋掉
    setSearched(keyword.trim());
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
          className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700"
        >
          搜尋
        </button>
      </form>

      {searched && (
        <>
          <p className="mb-4 text-gray-600">「{searched}」的景點：</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {FAKE_RESULTS.map((d) => (
              <AttractionCard key={d.id} destination={d} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
```

| 寫法 | 意思 |
|---|---|
| `"use client"` | 這個檔案要在瀏覽器裡跑（因為用了 `useState`、要打字、要按按鈕） |
| `const [keyword, setKeyword] = useState("")` | 建一個 state：`keyword` 是現在的值，`setKeyword` 用來改它，`""` 是一開始的值 |
| `value={keyword}` ＋ `onChange={...setKeyword(...)}` | 輸入框顯示 `keyword`；每打一個字，就把新的字存回 `keyword` |
| `onSubmit={handleSubmit}` | 按「搜尋」或在輸入框按 Enter 時，執行 `handleSubmit` |
| `e.preventDefault()` | 擋掉瀏覽器「送出表單就重新整理頁面」的老規矩 |
| `{searched && (...)}` | `searched` 有值才顯示後面那段。還沒搜尋時是空字串，就什麼都不顯示 |
| `<> ... </>` | 空的外包裝。JSX 一次只能回傳一個東西，用它把好幾個包在一起 |
| `FAKE_RESULTS.map((d) => <AttractionCard ... />)` | 一筆資料變成一張卡片，就像 Python 的 `[card(d) for d in results]` |
| `key={d.id}` | 每張卡片的身分證，React 靠它分辨誰是誰 |

#### 步驟 8：測試

存檔之後，瀏覽器會自己更新，不用按重新整理。

1. 在輸入框打「京都」，按搜尋 → 出現「京都」的景點和 2 張卡片。
2. 再打「大阪」，**先不要按搜尋** → 上面還是寫「京都」。按下搜尋 → 才變成「大阪」。（卡片還是清水寺，因為還是假資料。）
3. **實驗**：把 `page.tsx` 第一行的 `"use client";` 刪掉存檔，看看畫面出現什麼錯誤，再加回來。

### 3. 這一段結束後的資料夾

```
frontend/app/
├── components/
│   └── AttractionCard.tsx   ← 新增：一張景點卡片
├── lib/
│   └── types.ts             ← 新增：Destination 的型別
├── globals.css              ← 改：只留 Tailwind
├── layout.tsx               ← 改：標題、中文、背景色
└── page.tsx                 ← 改：搜尋框＋假資料卡片
```

### 4. 跟原專案對照

| 項目 | 原專案 | 我們 |
|---|---|---|
| Next.js 版本 | 16.1.6 | 16.4.3（同一個大版本） |
| 搜尋畫面 | 首頁輸入，跳到 `/search` 頁顯示結果 | 先做在首頁同一頁，比較單純 |
| 資料型別 | `lib/schemas.ts` 用 zod 定義，執行時還會再檢查一次 | `lib/types.ts` 用 TypeScript 的 `type`，只在寫程式時檢查 |
| 景點卡片 | 有圖片、進場動畫（framer-motion）、「加入行程」按鈕 | 只有名稱、介紹、地區。「加入行程」等第 6、7 課；照片和動畫等第 9 課美化 |
| 卡片放哪裡 | `components/search/AttractionCard.tsx` | `components/AttractionCard.tsx`，元件還少，先不分資料夾 |

### 5. 常見踩雷

| 症狀 | 原因 | 解法 |
|---|---|---|
| 停在 `Ok to proceed? (y)` 不動 | npx 在問要不要先下載 create-next-app | 按 `y` 再按 Enter |
| `You're importing a module that depends on useState into a React Server Component module` | 少了 `"use client"` | 檔案第一行加上 `"use client";` |
| 打開 http://localhost:3000 ，看到的卻是**別的專案的畫面**（`npm run dev` 也沒有任何警告） | **你 todo-app 的前端也設定用 3000**。兩個同時開時，Next.js 照樣說自己開在 3000，但瀏覽器會連到 todo-app（2026-10-28 測試時實際重現過，跟第 4 課 8000 被 todo-app 佔走是同一類問題） | 先到 todo-app 前端的分頁按 `Ctrl+C` 關掉，再重開 `npm run dev`。不確定是誰在用 3000，可以執行 `lsof -iTCP:3000 -sTCP:LISTEN` 看看 |
| 在 `travel-scheduler` 執行 `npm run dev`，出現 `Could not read package.json` | 位置錯了，`package.json` 在 `frontend` 裡面 | 先 `cd frontend` |
| 輸入框打不進字 | 寫了 `value={keyword}`，卻沒寫 `onChange` | 補上 `onChange` |
| `Cannot find module '@/app/components/AttractionCard'` | 檔名或資料夾打錯，或大小寫不一樣 | 檢查是不是 `app/components/AttractionCard.tsx` |

### 📌 這一段的 3 個重點

1. **前端是店門口的點餐平板**：只負責顯示和把點單送去櫃檯，資料都在後端。
2. **React 三件事**：元件（回傳畫面的函式）、props（從外面傳進來）、state（自己記住；用 set 函式改，畫面就自動重畫）。
3. **要互動的檔案，第一行寫 `"use client"`**：用了 `useState`、`onClick`、`onChange` 這些，就要寫。

### 6. 小測驗

（提示：每題都可以用「如果不這樣做，會發生什麼壞事？」來想。）

1. `keyword` 和 `searched` 都是 state，為什麼要兩個？只用一個 `keyword` 會怎樣？
2. 如果不用 `setKeyword`，而是想辦法直接把變數改成 `"京都"`，畫面會更新嗎？為什麼？
3. 為什麼 `page.tsx` 要寫 `"use client"`，`AttractionCard.tsx` 卻不用？
4. `.map()` 的時候沒寫 `key` 會怎樣？

<details>
<summary>點開看解答</summary>

1. `keyword` 跟著打字一直變；`searched` 只在按下搜尋時才變。只用 `keyword` 的話，每打一個字，結果就跟著變。中半接上後端之後，就等於**每打一個字就打一次 API**，打「京都」兩個字就搜了兩次，而且中間還會搜到「京」。
2. 不會。React 只有在你呼叫 set 函式時，才知道「值變了，要重畫」。直接改變數，React 不知道，畫面就停在舊的樣子。（而且 `const` 宣告的變數本來就不能重新指定，TypeScript 會直接報錯。）
3. `page.tsx` 用了 `useState`，也要處理打字和按按鈕，這些都只能在瀏覽器裡發生。`AttractionCard` 只是把收到的資料顯示出來，沒有 state、也沒有事件；而且它是被 `page.tsx` 引用的，本來就會跟著在瀏覽器裡跑。
4. 畫面還是出得來，但瀏覽器的 console 會跳警告。React 靠 `key` 分辨每一張卡片；沒有 `key`，資料新增、刪除、換順序的時候，React 可能會更新到錯的卡片。第 7 課做拖拉排序時，這點特別重要。

</details>

#### 你的實作紀錄（2026-10-29）

- 6 個檔案都正確（`layout.tsx`、`AttractionCard.tsx` 有幾行被編輯器自動折行，意思一樣）。
- 型別檢查（`npx tsc --noEmit`）、lint（`npm run lint`）都通過。
- 用 Chrome 自動測試你正在跑的畫面：搜「京都」出現 2 張卡片；搜尋後再打字，上面的「京都」不會變；沒有任何錯誤。
- 這次 3000 是 travel-scheduler 的前端，沒有撞到 todo-app。

---

## 中半：接上後端（用 TanStack Query）

### 開始前的測試結果（2026-10-30）

我先用另一份後端（另一個資料庫、Redis 的 1 號資料庫）測過，你的資料都沒動到：

| 測試 | 結果 |
|---|---|
| 搜「京都」 | 出現資料庫裡真的 26 個景點，送出 1 次請求 |
| 搜「宮島」（資料庫裡 0 個） | 黃色提示「AI 正在背景幫你找」，送出 1 次請求，Redis 裡排了 1 個任務 |
| 再搜一次京都、再搜一次宮島 | **0 次請求**，直接用前端的快取。宮島也沒有再派一次 worker |
| 後端關掉再搜 | 1 次請求，馬上出現紅色錯誤訊息 |
| 拿掉 `retry: false` 再試一次 | 自動重試，**送出 4 次請求，7 秒後**才出現錯誤訊息 |
| 不經過轉送，直接打後端 | 被瀏覽器擋下來（CORS 錯誤） |
| `npm run build`（正式版建置） | 通過 |

### 1. 學到的觀念

#### 為什麼不能直接打 8000？CORS

瀏覽器打開的是 `localhost:3000`（前端），後端在 `localhost:8000`。**對瀏覽器來說，port 不一樣就是不同的網站。**

瀏覽器有一條安全規則：網頁不能隨便呼叫**別的網站**的 API，除非那個網站明確說「我允許」。這叫 **CORS**。如果沒有這條規則，你逛到壞網站時，它就能偷偷用你的身分去呼叫你登入中的網站（例如網路銀行）。

所以有兩種解法：

| 解法 | 怎麼做 |
|---|---|
| 後端說「我允許 3000 來呼叫」 | FastAPI 加上 `CORSMiddleware` |
| **前端幫忙轉送**（我們用這個，跟原專案一樣） | 瀏覽器只打 `localhost:3000/api/...`，Next.js 收到後再轉給 8000。瀏覽器從頭到尾都以為自己只在跟同一個網站講話 |

```
瀏覽器 ──POST /api/search──→ Next.js（3000）──轉送──→ FastAPI（8000）
       ←────── 回覆 ──────────               ←── 回覆 ──
```

用手搖飲店來說：客人只跟**店門口的點餐平板**講話，平板再把單子傳進櫃檯。客人不用、也不能自己走進櫃檯。

轉送是在 `next.config.ts` 用 **`rewrites`** 設定的。正式上線時（第 10 課），這件事改由 Nginx 負責，原專案也是這樣。

#### fetch：瀏覽器版的 curl

第 3 課你用 curl 打過搜尋 API。`fetch` 做的是一模一樣的事，只是寫在程式裡：

| curl | fetch |
|---|---|
| `-X POST` | `method: "POST"` |
| `-H "Content-Type: application/json"` | `headers: { "Content-Type": "application/json" }` |
| `-d '{"location": "京都"}'` | `body: JSON.stringify({ location })` |
| 印出回應 | `res.json()` 把回應變成 JavaScript 的物件 |

`await` 的意思是「等它回來再往下走」，跟第 4 課 `async def` 裡的 `await` 是同一個概念。

#### TanStack Query：前端版的小白板

第 4 課在後端放了一塊小白板（Redis 快取）。TanStack Query 就是**放在瀏覽器裡的小白板**：

| | 第 4 課的 Redis 快取 | TanStack Query |
|---|---|---|
| 放在哪裡 | 後端的 Redis，所有使用者共用 | 這個瀏覽器分頁的記憶體，只有你自己看得到 |
| 每一筆的名字 | `search:京都` | `queryKey: ["search", "京都"]` |
| 先看白板，沒有才去拿 | 沒有才查資料庫 | 沒有才打 API（`queryFn`） |
| 多久算舊 | TTL 1 小時，時間到就擦掉 | `staleTime` 5 分鐘，舊了就重新打 API |
| 手動作廢 | `DEL search:京都` | `invalidateQueries`（下半會用到） |
| 按 F5 重新整理頁面 | 還在 | 不見了，從頭開始 |

除了快取，它還幫你管**等待中**（`isFetching`）、**出錯了**（`isError`）、**拿到的資料**（`data`）。這些本來都要自己用 `useState` 一個一個寫。

按下搜尋之後發生的事：

```
按下搜尋 → setSearched("京都") → queryKey 變成 ["search", "京都"]
  │
  ├─ 前端小白板上有，而且還新鮮（5 分鐘內）→ 直接顯示，不打 API
  │
  └─ 沒有，或已經舊了 → 呼叫 queryFn 打 /api/search
                          → 抄到前端小白板 → 顯示
```

#### 為什麼要關掉「自動重抓」？

TanStack Query 預設很積極：**失敗會自動重試 3 次**，**切回這個分頁時會自動重抓**。如果只是單純讀資料，這樣很方便。

但我們的 `POST /api/search` 不只是讀資料：景點不夠時，它會**派 worker 去找**。自動重抓就可能在你不知道的時候，又派一次 worker。所以在搜尋這裡：

- `retry: false`：失敗就直接顯示錯誤，不要自動重試。
- `refetchOnWindowFocus: false`：切回分頁時不要自動重抓。
- `staleTime: 5 分鐘`：5 分鐘內再搜同一個地點，直接用快取。**AI 還在找的時候你又按了搜尋，也不會再派一次 worker。**

原專案的搜尋就是因為這個原因，沒有用 TanStack Query，而是自己手寫，再用 `sessionStorage` 記住「這個城市正在找」。我們用上面三個設定達到一樣的效果。

#### providers.tsx：為什麼要多一個檔案？

TanStack Query 需要在網站最外層放一個 `QueryClientProvider`，把小白板提供給所有頁面。最外層是 `layout.tsx`，但它不能直接放：

- `layout.tsx` 要匯出 `metadata`（網頁標題），只能在**伺服器**上跑。
- `QueryClientProvider` 要在**瀏覽器**裡跑，需要 `"use client"`。

所以把它拆到 `providers.tsx`（第一行寫 `"use client"`），`layout.tsx` 再把它包在外面。原專案也是這樣做。

### 2. 實作步驟

#### 步驟 9：安裝 TanStack Query

開一個新的終端機分頁（`npm run dev` 不用關）：

```bash
cd ~/Desktop/travel-scheduler/frontend
npm install @tanstack/react-query@5.104.3 @tanstack/react-query-devtools@5.104.3
```

| 套件 | 用途 |
|---|---|
| `@tanstack/react-query` | TanStack Query 本體 |
| `@tanstack/react-query-devtools` | 開發用的小工具，可以看到前端小白板上有什麼（像第 4 課用 `redis-cli` 看 Redis）。正式上線時會自動拿掉 |

裝完後，`package.json` 的 `dependencies` 會多這兩行。

#### 步驟 10：修改 `next.config.ts`，加上轉送

整個檔案換成：

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 瀏覽器打 /api/... 到前端（3000），由前端轉給後端（8000）
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
```

| 寫法 | 意思 |
|---|---|
| `source: "/api/:path*"` | 只要網址是 `/api/` 開頭…… |
| `destination: "http://localhost:8000/api/:path*"` | ……就轉給 8000，後面的部分原封不動接上。`:path*` 就是「後面剩下的那一串」 |
| `turbopack: { ... }` | 建立專案時本來就有的設定（讓 Tailwind 能用），保留不動 |

存檔後，前端的終端機會出現 `Found a change in next.config.ts. Restarting the server`，它會自己重開。

#### 步驟 11：`app/lib/types.ts` 最下面加上搜尋回應的型別

```ts

// 後端 POST /api/search 回傳的樣子（schemas/search.py 的 SearchOut）
export type SearchResponse = {
  location: string;
  status: "completed" | "processing";
  task_id: string | null;
  destinations: Destination[];
};
```

對照第 4 課的 `SearchOut`：`"completed" | "processing"` 就是 Python 的 `Literal["completed", "processing"]`；`Destination[]` 就是 `list[DestinationOut]`。

#### 步驟 12：新增 `app/lib/api.ts`，打 API 的函式

```ts
import type { SearchResponse } from "@/app/lib/types";

// 搜尋景點。網址只寫 /api/search：先送到前端自己，再由 next.config.ts 轉給後端
export async function searchDestinations(location: string): Promise<SearchResponse> {
  const res = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location }),
  });
  if (!res.ok) {
    throw new Error(`後端回應 ${res.status}`);
  }
  return res.json();
}
```

| 寫法 | 意思 |
|---|---|
| `async function` | 裡面要 `await`，函式前面就要加 `async` |
| `Promise<SearchResponse>` | 這個函式「之後」會給你一個 `SearchResponse`（要 `await` 才拿得到） |
| `if (!res.ok) throw ...` | 後端回 4xx、5xx 時，`fetch` 不會自己出錯，要自己檢查。丟出錯誤，TanStack Query 才知道失敗了 |

#### 步驟 13：新增 `app/providers.tsx`

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

// 把 TanStack Query 的快取（QueryClient）提供給整個網站
export default function Providers({ children }: { children: React.ReactNode }) {
  // 用 useState 建立：畫面重畫時才不會又建一個新的，把快取弄丟
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools />
    </QueryClientProvider>
  );
}
```

| 寫法 | 意思 |
|---|---|
| `QueryClient` | 小白板本身 |
| `QueryClientProvider` | 把小白板提供給包在裡面的所有元件 |
| `useState(() => new QueryClient())` | 只在第一次建立。如果直接寫 `new QueryClient()`，每次畫面重畫都會換一塊新白板，快取就全丟了 |
| `<ReactQueryDevtools />` | 畫面右下角的小工具按鈕 |

#### 步驟 14：修改 `app/layout.tsx`，包上 Providers

整個檔案換成：

```tsx
import type { Metadata } from "next";

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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

跟上半比，只多了 `import Providers` 和 `<Providers>{children}</Providers>` 這兩處。

#### 步驟 15：`app/page.tsx` 整個換成用 TanStack Query 搜尋

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import AttractionCard from "@/app/components/AttractionCard";
import { searchDestinations } from "@/app/lib/api";

export default function Home() {
  const [keyword, setKeyword] = useState(""); // 輸入框裡現在打的字
  const [searched, setSearched] = useState(""); // 按下搜尋那一刻的關鍵字

  // 拿 searched 去後端搜尋。等待中、出錯、快取，都交給 TanStack Query 管
  const { data, isFetching, isError } = useQuery({
    queryKey: ["search", searched], // 快取的名字，就像第 4 課 Redis 的 search:京都
    queryFn: () => searchDestinations(searched),
    enabled: searched !== "", // 還沒搜尋過，就先不要打 API
    staleTime: 5 * 60 * 1000, // 5 分鐘內再搜同一個地點，直接用快取，不再問後端
    refetchOnWindowFocus: false, // 切回這個分頁時不要自動重抓：重抓可能又派一次 worker
    retry: false, // 失敗就直接顯示錯誤，不要自動重試
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); // 表單送出時，瀏覽器預設會重新整理頁面，把它擋掉
    setSearched(keyword.trim());
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

      {isError && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-red-600">
          搜尋失敗：請確認後端（uvicorn）有在跑
        </p>
      )}

      {data?.status === "processing" && (
        <p className="mb-4 rounded-lg bg-yellow-50 p-3 text-yellow-700">
          🤖 資料庫裡「{data.location}」的景點還不夠，AI 正在背景幫你找，大約 1 分鐘。
        </p>
      )}

      {data && (
        <>
          <p className="mb-4 text-gray-600">
            「{data.location}」的景點：{data.destinations.length} 個
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.destinations.map((d) => (
              <AttractionCard key={d.id} destination={d} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
```

| 寫法 | 意思 |
|---|---|
| `useQuery({ ... })` | 跟 TanStack Query 說：「我要這筆資料」。它會先看小白板，沒有才去拿 |
| `queryKey: ["search", searched]` | 這筆資料的名字。`searched` 一變，名字就變，它就知道要拿另一筆 |
| `queryFn: () => searchDestinations(searched)` | 小白板上沒有時，要怎麼去拿 |
| `enabled: searched !== ""` | 還沒搜尋時（`searched` 是空字串），先不要打 API |
| `const { data, isFetching, isError }` | 它還給你的三樣東西：拿到的資料、是不是正在打 API、是不是出錯了 |
| `data?.status` | `data` 可能還是空的（還沒拿到），`?.` 的意思是「空的話就不要往下看」，不會出錯 |
| `{data && (...)}` | 有資料才顯示結果 |
| `disabled={isFetching}` | 打 API 的時候，按鈕按不下去 |

跟上半比，**拿掉了**假資料 `FAKE_RESULTS`。原本要自己寫的「搜尋中」「出錯了」，現在都由 `useQuery` 給你。

#### 步驟 16：確認後端都在跑

這一段開始，前端要跟後端講話，所以要同時開著：

| 要開的東西 | 指令 | 在哪裡 |
|---|---|---|
| 資料庫、Redis | `docker compose up -d` | `travel-scheduler` |
| 後端 | `uv run uvicorn main:app --reload --port 8000` | `travel-scheduler/backend` |
| worker | `uv run celery -A worker.tasks worker --loglevel=info --pool=solo` | `travel-scheduler/backend` |
| 前端 | `npm run dev` | `travel-scheduler/frontend` |

#### 步驟 17：測試

**① 搜京都兩次，看兩層小白板**

1. 按 `Cmd + Option + I` 打開開發者工具，點 **Network（網路）** 分頁。
2. 搜「京都」→ 出現 26 個景點。Network 多了一行 `search`，點它看 **Request URL**：是 `localhost:3000/api/search`，**不是 8000**。瀏覽器只跟前端講話，轉給 8000 是 Next.js 在背後做的。
3. 再搜一次京都 → 馬上出現，**Network 沒有多出新的一行**：前端的小白板直接回答，連後端都沒問。uvicorn 的分頁也沒有新的紀錄。
4. 按 `F5` 重新整理頁面（前端小白板清空），再搜京都 → 這次有打 API，uvicorn 的分頁印出 `🚀 命中快取：京都`：前端沒有，就換後端的小白板（Redis）回答。

**② 打開 TanStack 的小工具**

點畫面**右下角**的 TanStack 小圖示，下方會打開一個面板。搜幾個不同的城市，面板裡會一行一行出現 `["search","京都"]`、`["search","大阪"]`……這就是前端小白板上的東西，跟用 `redis-cli` 看 Redis 是一樣的感覺。

- **Fresh**：還新鮮（5 分鐘內），再搜一次會直接用
- **Inactive**：現在畫面沒在用，但還留在小白板上
- 還會有一行 `["search",""]` 標著 `disabled`：這是還沒搜尋前的那一筆，`enabled: false` 所以沒有打 API

**③ 搜一個新城市「神戶」**（你的資料庫裡還沒有）

1. 出現黃色提示「AI 正在背景幫你找」，景點 0 個。看 worker 的分頁，它開始跑了。
2. **趁 worker 還在跑，再按一次搜尋** → 什麼都沒發生，worker 的分頁也只有一個任務。因為 5 分鐘內，前端小白板直接回答，根本沒去問後端，也就不會重複派 worker。
3. 等 worker 印出 `succeeded` 之後，按 `F5` 重新整理，再搜一次神戶 → 景點出來了。

要自己記得「等一下、重新整理、再搜一次」很不方便吧？這就是下半要解決的事：收到 SSE 的「做好了」，用 `invalidateQueries` 讓小白板上的神戶作廢，畫面就會自己更新。

**④ 實驗：後端沒開會怎樣？** 到 uvicorn 的分頁按 `Ctrl+C` 關掉，按 `F5` 後再搜京都 → 馬上出現紅色的「搜尋失敗」。前端的終端機會出現 `Failed to proxy http://localhost:8000/api/search` 和 `ECONNREFUSED`（連不上）。看完把 uvicorn 開回來。

**⑤ 實驗（選做）：拿掉 `retry: false`** 把 `page.tsx` 裡 `retry: false,` 那一行刪掉存檔。uvicorn 還關著的話，按 `F5` 再搜 → 按鈕會「搜尋中…」**大約 7 秒**才出現紅字，Network 裡有 **4 行** `search`：TanStack Query 自己重試了 3 次。看完把那一行加回來。

**⑥ 實驗（選做）：不經過轉送會怎樣？** 把 `api.ts` 裡的 `fetch("/api/search"` 改成 `fetch("http://localhost:8000/api/search"`，存檔，`F5` 後再搜 → 紅色的「搜尋失敗」。打開開發者工具的 **Console（主控台）** 分頁，會看到：

```
Access to fetch at 'http://localhost:8000/api/search' from origin 'http://localhost:3000' has been blocked by CORS policy
```

uvicorn 的分頁則會看到一行 `OPTIONS /api/search 405`：瀏覽器真正送出 POST 之前，會先送一個 `OPTIONS` 去問後端「我可以從 3000 打你嗎？」，後端沒有回答「可以」，瀏覽器就把請求擋下來了。看完記得**改回** `fetch("/api/search"`。

### 3. 這一段結束後的資料夾

```
frontend/
├── app/
│   ├── lib/
│   │   ├── api.ts         ← 新增：打 API 的函式
│   │   └── types.ts       ← 改：加上 SearchResponse
│   ├── layout.tsx         ← 改：包上 Providers
│   ├── page.tsx           ← 改：用 useQuery 搜尋真的後端
│   └── providers.tsx      ← 新增：提供 TanStack Query 的小白板
├── next.config.ts         ← 改：/api/... 轉給 8000
└── package.json           ← 改：多了兩個 @tanstack 套件
```

### 4. 跟原專案對照

| 項目 | 原專案 | 我們 |
|---|---|---|
| 搜尋 API 怎麼打 | 自己寫 `useState` ＋ `apiPost`，用 `sessionStorage` 記住「這個城市正在找」，防止重複派 worker | `useQuery`，關掉自動重抓和重試；快取 5 分鐘內不會再打，順便防止重複派 worker |
| 其他資料（行程列表等） | TanStack Query | 一樣，第 6、7 課會大量用到 |
| `QueryClient` 的設定 | 快取存進 `sessionStorage`（重新整理也還在）、預設重試 1 次 | 最基本的 `new QueryClient()`，搜尋要的設定直接寫在搜尋那裡 |
| 開發小工具 | 沒有裝 | 有裝 `ReactQueryDevtools`，只在開發時出現 |
| 打 API 的函式 | `lib/api.ts` 包成 `apiFetch`：自動帶編輯權限的 token、用 zod 檢查回應 | `lib/api.ts` 先只有一個 `searchDestinations`。第 6 課 API 變多時再整理 |
| 轉送的目的地 | 讀環境變數 `API_BASE_URL`，沒設的話用 `http://backend:8000`（Docker 裡後端的名字） | 先直接寫 `http://localhost:8000`，第 10 課部署時再改 |

### 5. 常見踩雷

| 症狀 | 原因 | 解法 |
|---|---|---|
| 畫面變錯誤頁：`No QueryClient set, use QueryClientProvider to set one` | `layout.tsx` 沒有包上 `<Providers>` | 對照步驟 14 |
| 錯誤：`You are attempting to export "metadata" from a component marked with "use client"` | 在 `layout.tsx` 寫了 `"use client"` | 拿掉。`"use client"` 只寫在 `providers.tsx` |
| 紅字「搜尋失敗」，前端終端機有 `Failed to proxy ...` 和 `ECONNREFUSED` | 後端（uvicorn）沒開，或開在別的 port | 開 uvicorn，port 要是 8000 |
| 紅字「搜尋失敗」，前端終端機有 `POST /api/search 404` | 轉送沒設好：`next.config.ts` 沒存檔，或 `source` 打錯 | 對照步驟 10 |
| Console 出現 `blocked by CORS policy` | `api.ts` 的 `fetch` 寫了完整網址 `http://localhost:8000/...`，沒經過轉送 | 只寫 `/api/search` |
| AI 做完了，再按搜尋還是 0 個 | 前端小白板 5 分鐘內不會再問後端 | 按 `F5` 再搜。下半會讓它自動更新 |
| 要等 7 秒左右才出現紅字 | 沒寫 `retry: false`，失敗時自動重試了 3 次 | 加上 `retry: false` |
| 右下角沒有 TanStack 小圖示 | `providers.tsx` 裡沒放 `<ReactQueryDevtools />`，或沒裝 devtools 套件 | 對照步驟 9、13 |

### 📌 這一段的 3 個重點

1. **瀏覽器只跟前端（3000）講話**，`/api/...` 由 Next.js 的 `rewrites` 轉給後端（8000）。直接打 8000 會被 CORS 擋。
2. **TanStack Query 是前端版的小白板**：`queryKey` 是名字、`staleTime` 是多久算舊；等待中、出錯、資料，它都幫你管。
3. **我們的搜尋會派 worker**，所以關掉自動重抓和重試。快取 5 分鐘內不再打 API，順便防止重複派 worker。

### 6. 小測驗

（提示：每題都可以用「如果不這樣做，會發生什麼壞事？」來想。）

1. 為什麼不直接 `fetch("http://localhost:8000/api/search")`，要繞一圈讓 Next.js 轉送？
2. 搜「京都」→ 搜「大阪」→ 再搜「京都」，第三次會打幾次 API？為什麼？
3. 為什麼要寫 `retry: false`？拿掉會怎樣？
4. 搜神戶之後，AI 還在找，你又按了一次搜尋。會再派一次 worker 嗎？為什麼？

<details>
<summary>點開看解答</summary>

1. 因為 3000 和 8000 對瀏覽器來說是不同的網站，直接打會被 CORS 擋下來（實驗 ⑥）。轉送之後，瀏覽器只跟 3000 講話，就沒有這個問題。另一個好處：正式上線時，前端和後端會在同一個網址底下，程式裡的 `/api/search` 不用改。
2. **0 次**。`["search", "京都"]` 還在前端的小白板上，而且在 5 分鐘內（`staleTime`）算新鮮，TanStack Query 直接拿來顯示，不打 API。
3. 失敗時，TanStack Query 預設會自動重試 3 次（中間各等 1、2、4 秒），所以要**等大約 7 秒**才出現錯誤訊息，使用者會以為卡住了（實驗 ⑤）。而且我們的搜尋可能會派 worker，自動重試就可能在你不知道的時候多打好幾次。
4. **不會**。`["search", "神戶"]` 已經在前端小白板上，5 分鐘內算新鮮，TanStack Query 根本不會再打 API，後端完全不知道你又按了一次。如果是自己用 `fetch` 寫、每按一次就打一次，資料庫還不夠，後端就會**再派一次 worker**，同一個城市被找兩次。

</details>

#### 你的實作紀錄（2026-10-31）

- 7 個檔案都正確。`api.ts` 的 `import` 寫成 `"./types"`（同一個資料夾的相對路徑），跟 `"@/app/lib/types"` 指的是同一個檔案；其他差異都是編輯器自動折行。
- 兩個 TanStack 套件裝的都是 5.104.3；型別檢查、lint 都通過。
- 用 Chrome 對你正在跑的畫面測：搜京都 26 個；再搜一次送出 0 次請求（前端小白板直接回答）；右下角有 TanStack 小工具；沒有錯誤。
- 測試 ③ 有做：資料庫多了「神戶」13 個景點。

---

## 下半：SSE，AI 找完自動顯示

### 開始前的測試結果（2026-10-31）

我先用另一份後端和另一個 worker（另一個資料庫、Redis 的 1 號資料庫）測過，你的資料都沒動到：

| 測試 | 結果 |
|---|---|
| 搜「宮島」（0 個），**什麼都不按** | 1.9 秒出現黃色提示、連上 SSE。38 秒時 worker 做完（新增 11 個），收到 `completed`，自動再搜一次，**11 張卡片自己出現** |
| 搜「奈良」→ 馬上改搜京都 → 70 秒後再搜奈良 | 改搜京都時，奈良的 SSE 自動掛斷。搜回奈良時重新連上，**馬上**收到 `completed`（第 4 課「先看取餐台」的功勞），16 張卡片出現 |
| 等待中，worker 廣播「失敗」 | 紅字「AI 找景點失敗了」，連線不會再重連 |
| 等待中存檔後端的程式（uvicorn 自動重開），**有加** `--timeout-graceful-shutdown 3` | 3 秒後 SSE 被切斷，瀏覽器自己重新連上，最後照樣收到 `completed`，19 張卡片出現 |
| 同上，但**沒加**那個參數 | uvicorn 卡在 `Waiting for connections to close`，**整個後端沒有回應**，按兩次 `Ctrl+C` 也沒用 |
| 等待中把後端關掉不再開 | 重連一次失敗，出現紅字 |
| SSE 經過 Next.js 轉送，瀏覽器要求壓縮（第 5 課開始前測的） | 沒加 `compress: false`：心跳全部卡到最後才一起到。加了：每 15 秒一則，正常 |

### 1. 學到的觀念

#### 在瀏覽器裡坐著等叫號：EventSource

中半拿到號碼牌（`task_id`）就結束了，你得自己等一下、重新整理、再搜一次。下半要讓瀏覽器**坐下來聽叫號**。瀏覽器內建的 **`EventSource`** 就是做這件事的，第 4 課你用 `curl -N` 做的事，它在瀏覽器裡幫你做：

```ts
const es = new EventSource("/api/search/stream/號碼牌");
es.onmessage = (event) => {
  // event.data 就是 worker 喊的那一句，例如 {"status": "completed", "added": 11}
};
```

- 心跳 `: heartbeat` 是冒號開頭的註解，`EventSource` 會自己吃掉，不會觸發 `onmessage`。
- 連線斷掉時，它會**自己重新連線**（過幾秒）。

整個流程：

```
按下搜尋「宮島」
  → POST /api/search → 回 processing ＋ 號碼牌
  → 畫面：黃色提示
  → 打開 EventSource，坐著聽叫號（每 15 秒一次心跳）
  → worker 做完，喊「completed」
  → invalidateQueries(["search", "宮島"])：前端小白板上的宮島作廢
  → 宮島正顯示在畫面上，useQuery 馬上自動再搜一次 → completed ＋ 11 個景點
  → 畫面：卡片出現
```

#### invalidateQueries：擦掉前端白板上的一筆

就是第 4 課 `DEL search:京都` 的前端版本。作廢之後，**如果這一筆正顯示在畫面上**，TanStack Query 會馬上用原本的 `queryFn` 自動重抓。所以收到 `completed` 之後，我們不用自己再呼叫一次搜尋。

#### useEffect：畫面以外的事，以及收拾

React 元件的主要工作是「依照 state 畫出畫面」。像「打開一條連線」這種**跟畫面無關、之後還要關掉**的事，就放在 `useEffect` 裡：

```tsx
useEffect(() => {
  // 1. 要做的事：打開連線
  return () => {
    // 2. 收拾：關掉連線
  };
}, [taskId]); // 3. 這裡面的值變了，就先收拾舊的，再重新做一次
```

用手搖飲店來想：你換了一張號碼牌（`taskId` 變了），就不用再聽舊號碼了，先離開舊位子（收拾），再坐到新位子聽新號碼。離開這間店（離開頁面）時，也會先收拾。

#### 為什麼 `next.config.ts` 要加 `compress: false`？

瀏覽器每次都會告訴伺服器「我看得懂壓縮過的資料」，Next.js 轉送時就會幫你壓縮。但壓縮要**湊滿一批才送出去**，SSE 的訊息就被卡住了，最後才一次到。就像叫號的店員說「我湊滿 10 個號碼再一起喊」。

原專案沒有加這行，所以開發時心跳其實都被卡住了。只是 `completed` 剛好是最後一句，所以看起來還是正常。正式上線時，Nginx 那一層也要設定不要卡住（第 4 課的 `X-Accel-Buffering`，第 10 課會用到）。

#### uvicorn 要多加一個參數：`--timeout-graceful-shutdown 3`

uvicorn 要關掉或重開時（例如你存檔，`--reload` 自動重開），會**先等所有連線結束**才真的關。一般的請求一下就結束了，但 **SSE 連線會一直開著**（最久 10 分鐘）。

這時 uvicorn 就會卡在 `Waiting for connections to close`，這段時間**整個後端都沒回應**。我實際測過：按兩次 `Ctrl+C` 也沒用。

加上這個參數，意思是「最多等 3 秒，時間到就把還開著的連線切掉」。被切掉的 SSE，`EventSource` 會自己重新連線，而第 4 課「先訂閱、再看取餐台」的設計，保證重連之後不會漏掉結果。

第 4 課時你是用 curl 測 SSE，測完馬上就關了，所以沒遇到。現在瀏覽器會一直開著連線等 1～2 分鐘，下一課改後端程式時就很容易撞到。

### 2. 實作步驟

#### 步驟 18：`next.config.ts` 加上 `compress: false`

整個檔案換成：

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SSE 經過轉送時，壓縮會讓訊息被存起來、最後才一次送出，所以關掉
  compress: false,
  // 瀏覽器打 /api/... 到前端（3000），由前端轉給後端（8000）
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
```

只多了 `compress: false` 和它上面那行註解。存檔後前端會自己重開。

#### 步驟 19：`app/page.tsx` 整個換成會自動更新的版本

```tsx
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import AttractionCard from "@/app/components/AttractionCard";
import { searchDestinations } from "@/app/lib/api";

export default function Home() {
  const queryClient = useQueryClient(); // 拿到前端的小白板，等一下要讓某一筆作廢
  const [keyword, setKeyword] = useState(""); // 輸入框裡現在打的字
  const [searched, setSearched] = useState(""); // 按下搜尋那一刻的關鍵字
  const [taskFailed, setTaskFailed] = useState(false); // AI 在背景找景點失敗了

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
          🤖 資料庫裡「{data.location}」的景點還不夠，AI 正在背景幫你找，大約 1 分鐘。找到會自動顯示，不用重新整理。
        </p>
      )}

      {data && (
        <>
          <p className="mb-4 text-gray-600">
            「{data.location}」的景點：{data.destinations.length} 個
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.destinations.map((d) => (
              <AttractionCard key={d.id} destination={d} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
```

跟中半比，多了這些：

| 寫法 | 意思 |
|---|---|
| `const queryClient = useQueryClient()` | 拿到前端小白板本身，才能叫它作廢某一筆 |
| `taskFailed` 這個 state | 記住「AI 在背景找失敗了」 |
| `const taskId = data?.status === "processing" ? data.task_id : null` | 後端說「處理中」時才有號碼牌，其他時候是 `null` |
| `useEffect(() => { ... }, [taskId, searched, queryClient])` | 有號碼牌就打開 SSE。這三個值變了，就先收拾、再重來 |
| `new EventSource(...)` | 坐下來聽叫號 |
| `JSON.parse(event.data)` | 收到的是文字，變回物件才能看 `status` |
| `queryClient.invalidateQueries({ queryKey: ["search", searched] })` | 擦掉前端白板上這個地點。它正顯示在畫面上，所以會馬上自動再搜一次 |
| `onmessage` 最後的 `es.close()` | 拿到結果就掛斷。不掛斷的話，後端結束連線後，`EventSource` 會以為斷線而自己重連 |
| `es.onerror` ＋ `es.readyState === EventSource.CLOSED` | 斷線時（例如後端重開）讓它自己重連；只有連不上、它放棄了（`CLOSED`），才顯示失敗 |
| `return () => es.close()` | 收拾：換搜別的城市、或離開頁面時，掛斷這條連線 |
| `handleSubmit` 裡的 `setTaskFailed(false)` | 新的搜尋，先把上一次的失敗訊息清掉 |

#### 步驟 20：uvicorn 改用新的指令重開

到 uvicorn 的分頁按 `Ctrl+C` 關掉（如果卡在 `Waiting for connections to close`，先把瀏覽器裡這個網站的分頁關掉，連線一斷它就會結束），再用新的指令啟動：

```bash
uv run uvicorn main:app --reload --port 8000 --timeout-graceful-shutdown 3
```

**從現在開始，uvicorn 都用這個指令。** worker 和前端不用重開。

#### 步驟 21：測試

**① 搜「廣島」，什麼都不要按**（你的資料庫裡還沒有廣島）

出現黃色提示「找到會自動顯示，不用重新整理」。接下來**什麼都不要按**，大約 1～2 分鐘後，卡片會自己出現。

等的時候可以看看這些地方：

- **開發者工具的 Network**：多了一行 `stream/...`，Type 是 `eventsource`。點它，再點上面的 **EventStream** 分頁，worker 做完時，這裡會出現一行 `{"status": "completed", ...}`（心跳是註解，不會顯示在這裡）。
- **TanStack 小工具**：`["search","廣島"]` 在收到叫號時會短暫變成 fetching，接著帶著新的景點變回 fresh。
- **worker 的分頁**：印出 `succeeded`。
- **uvicorn 的分頁**：在 `succeeded` 之後，多了一次 `POST /api/search`，這就是 `invalidateQueries` 觸發的自動重抓。

**② 實驗：換個城市再回來**

1. 搜「仙台」，黃色提示出現後，**馬上**改搜「京都」。
2. 等 worker 的分頁印出 `succeeded`（1～2 分鐘）。
3. 再搜「仙台」→ 景點**馬上**出現。

想想看為什麼？（小測驗第 3 題）

**③ 實驗（選做）：等待中改後端程式**

1. 搜「金澤」，出現黃色提示。
2. 趁 AI 還在找，打開 `backend/router/search.py`，隨便加一個空行，存檔。
3. uvicorn 的分頁會印出 `Reloading...`，3 秒後出現 `Cancel 1 running task(s), timeout graceful shutdown exceeded`，接著重新啟動。
4. 畫面一直維持黃色提示，Network 多了一行 `stream/...`（重新連線）。最後卡片照樣出現。
5. 把剛剛加的空行刪掉存檔。

### 3. 這一段結束後的資料夾

```
frontend/
├── app/
│   └── page.tsx           ← 改：SSE 等叫號、收到後 invalidateQueries
└── next.config.ts         ← 改：compress: false
```

後端程式沒有改，只是 uvicorn 的啟動指令多了 `--timeout-graceful-shutdown 3`。

### 4. 跟原專案對照

| 項目 | 原專案 | 我們 |
|---|---|---|
| SSE 寫在哪裡 | `TaskContext.tsx`，放在整個網站最外層：換頁也會繼續等；用 `sessionStorage` 記住號碼牌，按 F5 也能接回去 | 寫在 `page.tsx` 的 `useEffect`，離開頁面就掛斷，比較好懂 |
| 收到「做好了」之後 | `TaskContext` 通知搜尋頁再搜一次 | `invalidateQueries`，TanStack Query 自動重抓 |
| 斷線時 | `onerror`：用 `beforeunload` 旗標分辨「重新整理造成的斷線」和「真的斷線」 | 讓 `EventSource` 自己重連；它放棄了（`CLOSED`）才算失敗 |
| Next.js 轉送的壓縮 | 沒有關，開發時心跳會被卡住（`completed` 是最後一句，所以看起來正常） | `compress: false` |
| uvicorn 關閉時 | 沒有設定，SSE 開著時重開會卡住（正式環境在 Docker 裡，10 秒後會被強制關掉） | `--timeout-graceful-shutdown 3` |

### 5. 常見踩雷

| 症狀 | 原因 | 解法 |
|---|---|---|
| 黃色提示一直在，卡片一直不出現 | worker 沒開；或改過 `tasks.py` 沒重開 worker，做完了卻沒廣播 | 看 worker 的分頁有沒有在跑、有沒有 `succeeded` |
| uvicorn 卡在 `Waiting for connections to close`，後端沒回應，按 `Ctrl+C` 也沒用 | 有 SSE 連線開著，uvicorn 在等它結束 | 用步驟 20 的指令啟動。已經卡住的話，關掉瀏覽器裡這個網站的分頁 |
| Console 出現 `ERR_INCOMPLETE_CHUNKED_ENCODING` | 後端重開時，把 SSE 連線切斷了 | 正常，`EventSource` 會自己重連 |
| 紅字「AI 找景點失敗了」 | worker 廣播了失敗（例如 Gemini 全部忙線），或後端關掉連不上 | 看 worker 和 uvicorn 分頁的錯誤，修好後按 F5 再搜 |
| 失敗之後再按搜尋，沒有反應 | 前端小白板 5 分鐘內還記著「處理中」那一筆 | 照紅字說的，按 F5 重新整理再搜 |
| 失敗之後，Network 裡的 `stream/...` 每隔幾秒就多一行 | `onmessage` 裡忘了 `es.close()`：後端說完「失敗」就結束連線，`EventSource` 以為斷線，一直重連 | 補上 `es.close()` |

### 📌 這一段的 3 個重點

1. **`EventSource` 是瀏覽器在坐著等叫號**：拿到號碼牌就打開，收到結果就掛斷（`es.close()`）；斷線時它會自己重連。
2. **收到 `completed` → `invalidateQueries`** 擦掉前端白板上那一筆。它正顯示在畫面上，TanStack Query 就會自動重抓。
3. **`useEffect` 做畫面以外的事，也負責收拾**：換城市、離開頁面時，把連線掛斷。

### 6. 小測驗

（提示：每題都可以用「如果不這樣做，會發生什麼壞事？」來想。）

1. 收到 `completed` 時，為什麼用 `invalidateQueries`，而不是自己再 `fetch` 一次 `/api/search`？
2. 如果 `useEffect` 裡沒寫 `return () => es.close()`，搜宮島（還在等）時改搜京都，會發生什麼事？
3. 實驗 ②：「搜仙台 → 馬上改搜京都 → 等 worker 做完 → 再搜仙台」，為什麼仙台的景點會**馬上**出現？
4. 為什麼 uvicorn 要加 `--timeout-graceful-shutdown 3`？

<details>
<summary>點開看解答</summary>

1. 結果要放進前端小白板，畫面才會更新。自己 `fetch` 的話，還要自己把結果塞進快取、自己處理等待和錯誤。`invalidateQueries` 只要說「這一筆舊了」，TanStack Query 就會用原本的 `queryFn` 重抓、更新快取、重畫畫面。而且 5 分鐘內再搜宮島，拿到的也是新的結果，而不是舊的「處理中」。
2. 宮島的連線不會被掛斷，會一直在背景開著。每一條 SSE 連線，後端都要佔著一個 Redis 訂閱；uvicorn 重開時也要等它。搜越多個還在找的城市，背景開著的連線就越多。
3. 再搜仙台時，前端小白板還記著「仙台：處理中＋號碼牌」（5 分鐘內）→ `taskId` 又有值 → `useEffect` 又打開 SSE → 後端是第 4 課寫的「**訂閱之後，先看一眼取餐台**」→ 任務早就做完了 → 馬上回 `completed` → `invalidateQueries` → 重抓 → 景點出現。如果第 4 課沒有「先看取餐台」，這裡就要一直等到 10 分鐘逾時。
4. SSE 連線會一直開著（最久 10 分鐘）。uvicorn 關掉或重開（存檔觸發 `--reload`）時，會等所有連線結束才真的關，就會卡住，這段時間整個後端都沒回應，按 `Ctrl+C` 也沒用。加了之後最多等 3 秒，就把連線切掉；被切掉的 SSE，`EventSource` 會自己重新連線。

</details>

#### 你的實作紀錄（2026-11-01）

- `next.config.ts`、`page.tsx` 都正確（`page.tsx` 的黃色提示被編輯器折成兩行，畫面上一樣）。型別檢查、lint 都通過。
- uvicorn 已經改用新指令，有 `--timeout-graceful-shutdown 3`。
- 測試 ① 有做：資料庫多了「廣島」9 個景點（2026-10-31 晚上）。選做的 ②、③ 沒做，之後想複習可以用仙台、金澤試。
- 用 Chrome 對你正在跑的畫面測：廣島 9 個、京都 26 個；再搜一次廣島送出 0 次請求；沒有任何錯誤。
- 你說這一段比較難。這是整個專案觀念最抽象的地方：瀏覽器、後端、worker 三個程式加上 Redis 一起合作。複習時可以先看下面這張表：

| 手搖飲店 | 程式裡 |
|---|---|
| 拿到號碼牌後，坐下來聽叫號，不用一直跑去櫃檯問 | `new EventSource(...)` |
| 聽到叫號，就把桌上「還在做」那張紙條丟掉，店員自動把飲料送過來 | `invalidateQueries` → 自動重抓 |
| 換了號碼牌、或離開店，就不再聽舊號碼 | `useEffect` 的 `return () => es.close()` |

小測驗這一段還沒作答，複習時可以先遮住解答自己試一次。
