# 第 1 課：認識專案全貌 ＋ 用 Docker 跑 PostgreSQL 和 Redis

> **狀態**：✅ 完成
> **日期**：2026-10-19 ～ 2026-10-21
> **對照原專案**：`README.md`、`docker-compose.yml`、`docker-compose.dev.yml`

---

## 上半：認識專案全貌

### 1. 這個網站在做什麼？

一句話：**輸入城市 → AI 找推薦景點 → 把景點排進每天的行程 → 在地圖上看路線 → 分享給朋友。**

| 頁面 | 網址 | 做什麼 |
|---|---|---|
| 首頁 | `/` | 輸入城市搜尋 |
| 搜尋結果 | `/search` | 看 AI 找到的景點，加進行程 |
| 我的行程 | `/dashboard` | 列出你的行程 |
| 編輯行程 | `/edit/[tripId]` | 景點池、每日行程（可以拖拉排序）、地圖 |
| 分享頁 | `/share/[token]` | 朋友只能看，不能改 |

### 2. 整體架構：一間餐廳

```
瀏覽器（客人）
  │
Nginx（帶位員）
  ├── 一般頁面 ──→ Next.js 前端（菜單／外場）
  └── /api/... ──→ FastAPI 後端（櫃檯）──┬─→ PostgreSQL（倉庫）
                                         ├─→ Redis（櫃檯旁的小白板）
                                         └─→ 訂單夾 ──→ Celery Worker（後廚）
```

| 角色 | 負責什麼 |
|---|---|
| **Next.js** | 使用者看到的畫面 |
| **FastAPI** | 接收請求、回傳資料 |
| **PostgreSQL** | 永久保存：景點、行程、使用者（原專案用 MySQL） |
| **Redis** | 暫存：搜尋快取、登入狀態、「任務完成」的通知 |
| **訂單夾 ＋ Celery** | 把很慢的工作排隊，交給背景的「廚師」去做（原專案的訂單夾是 AWS SQS） |
| **Nginx** | 把請求分給前端或後端 |

**為什麼要有「後廚」？** 爬網頁加上問 AI 要 30 到 60 秒。如果讓櫃檯自己做，這段時間其他客人全部卡住。所以櫃檯只負責收單、發號碼牌（`task_id`），真正的工作交給後廚。

### 3. 最核心的流程：搜尋景點（第 3、4 課會細講）

1. **先看小白板（Redis）**：最近有人搜過，就直接回傳。
2. **再看倉庫（資料庫）**：已經有 5 個以上景點，就回傳。
3. **景點不夠，交給後廚**：馬上回給前端一個號碼牌。
4. **前端等通知（SSE）**：後端可以主動推訊息給前端的單向管道。
5. **後廚做事**：DuckDuckGo 找一篇旅遊部落格 → Gemini AI 讀文章列出景點 → Google Places 查正確名稱和座標 → 去掉重複的存進資料庫 → 喊「完成了！」
6. **前端收到通知**：重新搜尋一次，拿到新資料。

### 4. 資料庫：7 張表

| 表 | 存什麼 | 第幾課做 |
|---|---|---|
| `destinations` | 景點（名稱、城市、座標、Google ID） | 2 |
| `trips` | 行程（標題、天數、開始日期） | 5 |
| `trip_days` | 行程的每一天 | 5 |
| `trip_places` | 候選景點池：想去，但還沒排進哪一天 | 5 |
| `itinerary_items` | 正式排程：第幾天、第幾個去、幾點到 | 5 |
| `itinerary_legs` | 兩個景點之間的交通（要多久、多遠） | 5 |
| `users` | 使用者帳號 | 6 |

### 5. 誰可以改行程？三把鑰匙（第 6 課細講）

- **edit_token**：沒登入也能建立行程，後端給一把隨機鑰匙，前端存在瀏覽器裡，修改時要帶上。
- **登入 cookie（sid）**：登入後，Redis 記住「這個 sid 是哪位使用者」。
- **share_token**：分享連結用的鑰匙，只能看，不能改。

---

## 下半：用 Docker 跑 PostgreSQL 和 Redis

### 1. 學到的觀念

| 名詞 | 比喻 | 意思 |
|---|---|---|
| **image** | 冷凍料理包 | 打包好的軟體，例如 `postgres:17-alpine` |
| **container** | 加熱好、正在桌上的那一份 | 用 image 跑起來的程式 |
| **docker compose** | 點菜單 | 用一個檔案寫好要哪些 container，一個指令全部啟動 |
| **volume** | 放在 container 外面的保險箱 | container 刪掉，資料還在 |
| **ports `"左:右"`** | 門牌對照 | 左邊是 Mac 上的 port，右邊是 container 裡面的 port |

**為什麼用 Docker 跑資料庫，不直接裝在 Mac 上？** 不會弄亂你的電腦、版本可以跟正式主機一樣、不要了一個指令就能刪乾淨。

### 2. 實作步驟

```bash
# 建資料夾
mkdir -p ~/Desktop/travel-scheduler/backend ~/Desktop/travel-scheduler/frontend
cd ~/Desktop/travel-scheduler
git init

# 寫好 docker-compose.yml 後（內容見下方）
docker compose up -d      # -d：在背景跑
docker compose ps         # 應該看到 db 和 redis 都是 Up

# 確認它們活著
docker compose exec db psql -U travel -d travel_scheduler -c "SELECT 1;"   # 印出 1
docker compose exec redis redis-cli ping                                    # 回 PONG
```

`docker-compose.yml`：

```yaml
services:
  db:
    image: postgres:17-alpine          # 料理包：PostgreSQL 17 瘦身版
    environment:                       # 第一次啟動時自動建好帳號、密碼、資料庫
      POSTGRES_USER: travel
      POSTGRES_PASSWORD: localdev
      POSTGRES_DB: travel_scheduler
    ports:
      - "5433:5432"                    # Mac 用 5433，避免跟其他專案的 Postgres 撞到
    volumes:
      - pgdata:/var/lib/postgresql/data   # 資料存在 container 外面

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

密碼直接寫在檔案裡，只適合在自己電腦上開發。正式環境的做法第 7 課再講。

### 3. 常用指令

| 指令 | 做什麼 | container | volume（資料） |
|---|---|---|---|
| `docker compose up -d` | 背景啟動全部 | 建立／啟動 | 沒有就建，有就接回去 |
| `docker compose ps` | 看誰在跑 | — | — |
| `docker compose logs db` | 看 `db` 印了什麼（出錯時查原因） | — | — |
| `docker compose exec db ...` | 走進正在跑的 container 裡執行指令 | — | — |
| `docker compose stop` | 暫停 | 還在 | 還在 |
| `docker compose down` | 關掉並刪除 container | 刪掉 | **還在** |
| `docker compose down -v` | 連 volume 一起刪 | 刪掉 | **刪掉（資料清空）** |

`down -v` 很適合用來「把本機資料庫重置成全新的」，但在正式主機上絕對不要打。

### 4. 跟原專案對照

| 項目 | 原專案（`docker-compose.dev.yml`） | 我們 |
|---|---|---|
| 資料庫 | `mysql:8.0` | `postgres:17-alpine` |
| port | `3307:3306`（Mac 上已經有 MySQL 佔用 3306） | `5433:5432` |
| 建表 | 第一次啟動時自動執行 `schema.sql` | 第 2 課用 Python 建 |
| healthcheck | 有，讓後端等資料庫準備好才啟動 | 先不加，後端也包進 Docker 時（第 7 課）再加 |
| 誰跑在 Docker 裡 | 全部：資料庫、Redis、後端、worker、前端 | 只有資料庫和 Redis，後端直接在 Mac 上用 uv 跑，比較好除錯 |

### 5. 常見踩雷

| 症狀 | 原因 | 解法 |
|---|---|---|
| `Cannot connect to the Docker daemon` | Docker Desktop 沒開 | 先打開 Docker Desktop，等鯨魚圖示穩定 |
| `port is already allocated` | Mac 上已經有別的東西佔用那個 port | 改 `ports` 左邊的數字，或先關掉佔用的程式 |
| `no configuration file provided: not found` | 不是在 `docker-compose.yml` 所在的資料夾執行 | 先 `cd ~/Desktop/travel-scheduler` |
| 資料庫的資料不見了 | 跑了 `docker compose down -v` | 本機開發沒關係，重新建表就好 |

### 6. 小測驗（含你的作答）

**Q1. 如果把 ports 改成 `"5432:5432"`，可能會發生什麼事？**
- 你的答案：如果本機有其他佔用 5432 的 port，可能會無法連。 ✅
- 補充：`docker compose up` 會直接報錯 `port is already allocated`，container 啟動不了。

**Q2. 執行 `docker compose down` 再 `up -d`，資料庫裡的資料還在嗎？**
- 你的答案：還在，因為有 volumes。 ✅
- 補充：container 和 volume 是兩樣分開的東西。`down` 只刪 container，下次 `up` 做出新的 container，再接回同一個 volume。

**Q3. 那 `docker compose down -v` 呢？**
- 你的答案：會關閉 container，並且刪除？ 🔶 答對一半
- 正解：`-v` 多做的事是**連 volume 一起刪掉**，資料庫整個清空。下次 `up` 時，Postgres 會當作第一次啟動，依照 `environment` 重新建一個空的資料庫。
