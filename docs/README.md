# 教學日誌

重寫 Easy Travel Scheduler 的學習紀錄。每一課一份日誌，複習時從這裡進去。

## 課程進度

| 課 | 主題 | 日誌 | 狀態 |
|---|---|---|---|
| 1 | 認識專案全貌 ＋ Docker 跑 PostgreSQL 和 Redis | [lesson-01.md](lesson-01.md) | ✅ 完成 |
| 2 | FastAPI ＋ SQLAlchemy 建第一張表 ＋ 第一支 API | [lesson-02.md](lesson-02.md) | ✅ 完成 |
| 3 | AI 找景點（同步版）＋ Alembic 加欄位 | [lesson-03.md](lesson-03.md) | ✅ 完成 |
| 4 | 快取、背景任務、SSE | — | ⏳ |
| 5 | 排行程（拖拉、地圖） | — | ⏳ |
| 6 | 登入、權限、分享 | — | ⏳ |
| 7 | 部署 | — | ⏳ |

## 我們跟原專案不一樣的地方

| 項目 | 原專案 | 我們 | 決定於 |
|---|---|---|---|
| 資料庫 | MySQL | PostgreSQL | 第 1 課 |
| 開發時後端怎麼跑 | 包在 Docker 裡 | 直接在 Mac 上用 uv 跑（第 7 課才包進 Docker） | 第 1 課 |
| Python 套件管理 | pip ＋ `requirements.txt` | uv | 第 2 課 |
| 存取資料庫 | 直接寫 SQL（pymysql） | SQLAlchemy ORM | 第 2 課 |
| AI 讀文章 | Gemini 自己開網址（`url_context`），失敗才改用 Jina 抓文字 | Gemini，一律由我們先抓文字再交給 AI | 第 3 課 |
| Celery 的訂單夾 | AWS SQS | Redis | 第 4 課 |
| 雲端主機 | EC2 ＋ RDS | Lightsail 或 EC2，**第 7 課再決定** | 第 7 課 |
