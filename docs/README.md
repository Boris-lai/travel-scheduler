# 教學日誌

重寫 Easy Travel Scheduler 的學習紀錄。每一課一份日誌，複習時從這裡進去。

每次開發要怎麼把專案開起來，看專案根目錄的 [README.md](../README.md)。

## 課程進度

| 課 | 主題 | 日誌 | 狀態 |
|---|---|---|---|
| 1 | 認識專案全貌 ＋ Docker 跑 PostgreSQL 和 Redis | [lesson-01.md](lesson-01.md) | ✅ 完成 |
| 2 | FastAPI ＋ SQLAlchemy 建第一張表 ＋ 第一支 API | [lesson-02.md](lesson-02.md) | ✅ 完成 |
| 3 | AI 找景點（同步版）＋ Alembic 加欄位 | [lesson-03.md](lesson-03.md) | ✅ 完成 |
| 4 | 背景任務（Celery）＋ SSE ＋ Redis 快取 | [lesson-04.md](lesson-04.md) | ✅ 完成 |
| 5 | 前端入門（Next.js）＋ 搜尋頁 | [lesson-05.md](lesson-05.md) | ✅ 完成 |
| 6 | 行程後端（行程、景點池、每日行程 API） | [lesson-06.md](lesson-06.md) | ✅ 完成 |
| 7 | 編輯頁（拖拉 ＋ 地圖） | [lesson-07.md](lesson-07.md) | ✅ 完成 |
| 8 | 登入、權限、分享 | [lesson-08.md](lesson-08.md) | 🚧 進行中（第 1 段 ✅） |
| 9 | 畫面美化（照片、動畫、通知、導覽、首頁大圖） | — | ⏳ |
| 10 | 部署 | — | ⏳ |

> 2026-10-28：原本的第 5 課「排行程（拖拉、地圖）」內容太多，又還沒有任何前端畫面，拆成第 5～7 課（內容沒有減少，只是分開做、前端先做）。登入和部署順延成第 8、9 課。
>
> 2026-10-29：決定功能全部做完之後，再用一課專門美化畫面（原專案的照片、動畫、通知、導覽、彩帶這些），所以新增第 9 課「畫面美化」，部署順延成第 10 課。第 5～8 課先維持乾淨的 Tailwind 樣式。

## 我們跟原專案不一樣的地方

| 項目 | 原專案 | 我們 | 決定於 |
|---|---|---|---|
| 資料庫 | MySQL | PostgreSQL | 第 1 課 |
| 開發時後端怎麼跑 | 包在 Docker 裡 | 直接在 Mac 上用 uv 跑（第 10 課才包進 Docker） | 第 1 課 |
| Python 套件管理 | pip ＋ `requirements.txt` | uv | 第 2 課 |
| 存取資料庫 | 直接寫 SQL（pymysql） | SQLAlchemy ORM | 第 2 課 |
| AI 讀文章 | Gemini 自己開網址（`url_context`），失敗才改用 Jina 抓文字 | Gemini，一律由我們先抓文字再交給 AI | 第 3 課 |
| Celery 的訂單夾 | AWS SQS | Redis | 第 4 課 |
| 搜尋畫面 | 首頁輸入，跳到 `/search` 頁顯示結果 | 先做在首頁同一頁，比較單純 | 第 5 課 |
| 搜尋 API 怎麼打 | 自己寫 `useState`，用 `sessionStorage` 防止重複派 worker | TanStack Query 的 `useQuery`，關掉自動重抓和重試，快取 5 分鐘順便防止重複派 worker | 第 5 課 |
| 每一天的資料 | `trip_days` 表，一天存一筆日期 | 不建表，日期用「出發日 ＋ 第幾天 − 1」算 | 第 6 課 |
| 每日行程的外鍵 | 分別指向行程和景點；從景點池移除時，排好的那一站還留著 | 兩個欄位一起指向景點池；從景點池移除，排好的那一站由資料庫自動刪掉 | 第 6 課 |
| 存檔一整天 | `PUT .../itinerary/save`，順序和時間分兩份送 | `PUT .../itinerary`，一份清單，每一站帶著自己的時間 | 第 6 課 |
| 我的行程、編輯頁的網址 | `/dashboard`、`/edit/[tripId]` | `/trips`、`/trips/[tripId]` | 第 7 課 |
| 編輯頁的草稿 | 每一天各一份；換天自動儲存；有草稿時也能新增、刪除 | 只有正在看的那一天一份；換天前問要不要放棄；有草稿時先鎖住新增、刪除 | 第 7 課 |
| 填時間 | 自己做的時、分選單（24 小時制） | 瀏覽器內建 `<input type="time">`（中文介面顯示上午／下午），第 9 課可以換掉 | 第 7 課 |
| 地圖 | `@googlemaps/js-api-loader`，自己操作 Google 地圖物件；正在看的那一天＋還沒排的景點都插針 | `@vis.gl/react-google-maps`，圖釘寫成 React 元件；只插正在看的那一天 | 第 7 課 |
| 用 Google 加景點 | 瀏覽器裡放 Google 的搜尋框元件，瀏覽器直接問 Google | 後端 `GET /api/places/autocomplete` 去問 Google，搜尋框自己寫 | 第 7 課 |
| 交通時間 | `itinerary_legs` 表存交通方式和 Google Routes 算好的時間 | `itinerary_items.travel_mode` 只存交通方式；時間由後端 `estimate_leg()` 現算（問 Google Routes API，找不到路線才用直線估算） | 第 7 課 |
| 密碼雜湊 | `passlib` ＋ Argon2 | `pwdlib` ＋ Argon2（跟 todo-app 一樣） | 第 8 課 |
| 註冊的 Email | 照原樣存，大小寫不同算兩個帳號 | 一律轉小寫 | 第 8 課 |
| 登入時 Email 不存在 | 馬上回 401，從時間差猜得出有沒有這個帳號 | 用假的雜湊照樣比對一次，時間差不多 | 第 8 課 |
| 雲端主機 | EC2 ＋ RDS | Lightsail 或 EC2，**第 10 課再決定** | 第 10 課 |
