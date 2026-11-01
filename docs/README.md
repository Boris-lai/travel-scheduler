# 教學日誌

重寫 Easy Travel Scheduler 的學習紀錄。每一課一份日誌，複習時從這裡進去。

## 課程進度

| 課 | 主題 | 日誌 | 狀態 |
|---|---|---|---|
| 1 | 認識專案全貌 ＋ Docker 跑 PostgreSQL 和 Redis | [lesson-01.md](lesson-01.md) | ✅ 完成 |
| 2 | FastAPI ＋ SQLAlchemy 建第一張表 ＋ 第一支 API | [lesson-02.md](lesson-02.md) | ✅ 完成 |
| 3 | AI 找景點（同步版）＋ Alembic 加欄位 | [lesson-03.md](lesson-03.md) | ✅ 完成 |
| 4 | 背景任務（Celery）＋ SSE ＋ Redis 快取 | [lesson-04.md](lesson-04.md) | ✅ 完成 |
| 5 | 前端入門（Next.js）＋ 搜尋頁 | [lesson-05.md](lesson-05.md) | ✅ 完成 |
| 6 | 行程後端（行程、景點池、每日行程 API） | — | ⏳ |
| 7 | 編輯頁（拖拉 ＋ 地圖） | — | ⏳ |
| 8 | 登入、權限、分享 | — | ⏳ |
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
| 雲端主機 | EC2 ＋ RDS | Lightsail 或 EC2，**第 10 課再決定** | 第 10 課 |
