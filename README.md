# Travel Scheduler

重寫 Easy Travel Scheduler 的學習專案。教學日誌在 [docs/README.md](docs/README.md)。

這份文件只記「怎麼把專案開起來」。

## 每次開發要開的 4 個東西

| 順序 | 要開的東西 | 在哪個資料夾 | 指令 |
|---|---|---|---|
| 1 | 資料庫（PostgreSQL）＋ Redis | `travel-scheduler` | `docker compose up -d` |
| 2 | 後端（uvicorn） | `travel-scheduler/backend` | `uv run uvicorn main:app --reload --port 8000 --timeout-graceful-shutdown 3` |
| 3 | worker（AI 找景點） | `travel-scheduler/backend` | `uv run celery -A worker.tasks worker --loglevel=info --pool=solo` |
| 4 | 前端（Next.js） | `travel-scheduler/frontend` | `npm run dev` |

開始之前，先確認 **Docker Desktop 已經打開**（上方選單列有鯨魚圖示）。

## 開啟步驟

終端機開 4 個分頁，照順序一個分頁貼一段。

**分頁 1：資料庫、Redis**

```bash
cd ~/Desktop/travel-scheduler
docker compose up -d
```

`-d` 是在背景跑，指令跑完這個分頁就能拿來做別的事。

**分頁 2：後端**

```bash
cd ~/Desktop/travel-scheduler/backend
uv run uvicorn main:app --reload --port 8000 --timeout-graceful-shutdown 3
```

**分頁 3：worker**

```bash
cd ~/Desktop/travel-scheduler/backend
uv run celery -A worker.tasks worker --loglevel=info --pool=solo
```

**分頁 4：前端**

```bash
cd ~/Desktop/travel-scheduler/frontend
npm run dev
```

都開好之後：

| 網址 | 是什麼 |
|---|---|
| http://localhost:3000 | 網站畫面 |
| http://localhost:8000/docs | 後端 API 文件，可以直接在上面測 API |

## 確認有沒有開好

資料庫和 Redis 有沒有在跑（在 `travel-scheduler` 執行）：

```bash
docker compose ps
```

看到 `db` 和 `redis` 兩行，狀態是 `Up` 就對了。

其他三個看各自的分頁：

- 後端：出現 `Application startup complete.`
- worker：出現 `celery@... ready.`
- 前端：出現 `Ready in ...`

## 關掉

1. 分頁 2、3、4：各按一次 `Ctrl + C`。
2. 資料庫、Redis（在 `travel-scheduler` 執行）：

```bash
docker compose stop
```

> ⚠️ **不要用** `docker compose down -v`。`-v` 會把資料庫的資料一起刪掉，所有景點和行程都會不見。

## 改了程式之後，要不要重開？

| 改了什麼 | 要做什麼 |
|---|---|
| 後端的 `.py`（`router`、`services`、`schemas`、`models.py`…） | 不用，uvicorn 有 `--reload`，會自己重開 |
| `worker/tasks.py`，或 worker 會用到的 `services` | **worker 不會自己重開**。到分頁 3 按 `Ctrl + C`，再按 ↑、Enter |
| 前端的檔案（`app` 裡面的東西） | 不用，畫面會自己更新 |
| `backend/.env` | uvicorn 和 worker 都要 `Ctrl + C` 再重開（`--reload` 只看 `.py` 檔） |
| `frontend/.env.local` | 前端終端機沒出現 `Reload env` 的話，`Ctrl + C` 再重開 `npm run dev` |
| 新增了 Alembic 遷移檔 | 在 `backend` 執行 `uv run alembic upgrade head` |

## 第一次在新電腦上開（或刪掉 `.venv`、`node_modules` 之後）

**1. 裝套件**

```bash
cd ~/Desktop/travel-scheduler/backend
uv sync
```

```bash
cd ~/Desktop/travel-scheduler/frontend
npm install
```

**2. 準備兩個金鑰檔**

這兩個檔案都在 `.gitignore` 裡，不會進 git，換電腦要自己重建。

`backend/.env` 需要這 4 個變數：

| 變數 | 是什麼 |
|---|---|
| `DATABASE_URL` | PostgreSQL 的連線網址（Docker 開在 `5433`，不是預設的 5432） |
| `REDIS_URL` | Redis 的連線網址（`6379`） |
| `GEMINI_API_KEY` | AI 讀文章找景點用 |
| `MAPS_API_KEY` | 後端問 Google（Places、Routes）用的伺服器金鑰 |

另外有 1 個**可以不設**的變數：

| 變數 | 是什麼 |
|---|---|
| `COOKIE_SECURE` | 登入的 cookie 是不是只在 https 才送。沒設就是 `false`，本機（http）就要這樣；第 10 課上線改成 https 後，再設成 `true` |

`frontend/.env.local` 需要這 1 個變數：

| 變數 | 是什麼 |
|---|---|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | 瀏覽器顯示 Google 地圖用的金鑰（跟後端那把分開） |

**3. 開資料庫、建資料表**

```bash
cd ~/Desktop/travel-scheduler
docker compose up -d
```

```bash
cd ~/Desktop/travel-scheduler/backend
uv run alembic upgrade head
```

做完之後，照上面的「開啟步驟」開就可以了。

## 常見問題

| 狀況 | 原因 | 怎麼辦 |
|---|---|---|
| `Cannot connect to the Docker daemon` | Docker Desktop 沒開 | 打開 Docker Desktop，等鯨魚圖示不再跳動，再跑一次 `docker compose up -d` |
| 後端出現 `Address already in use`，或打 API 回奇怪的 403 | 8000 被別的專案（例如 todo-app 的後端）佔走 | 執行 `lsof -iTCP:8000 -sTCP:LISTEN` 看是誰，到那個專案的分頁按 `Ctrl + C` |
| 打開 3000 看到的是別的專案的畫面 | 3000 被別的專案（例如 todo-app 的前端）佔走 | 執行 `lsof -iTCP:3000 -sTCP:LISTEN` 看是誰，關掉它再重開 `npm run dev` |
| `docker compose up -d` 出現 `port is already allocated` | 5433 或 6379 被別的 Docker 容器佔走 | 打開 Docker Desktop，把別的專案的容器停掉 |
| 編輯頁顯示「後端回應 500」或「讀取行程失敗」 | 後端沒開 | 開分頁 2 |
| 搜尋景點一直轉圈，沒有新景點進來 | worker 沒開，或改了程式沒重開 | 開分頁 3，或 `Ctrl + C` 再重開 |
| 後端錯誤寫 `column ... does not exist` 或 `relation ... does not exist` | 有遷移檔還沒套用到資料庫 | 在 `backend` 執行 `uv run alembic upgrade head` |
| 改了 `globals.css`（顏色、字型設定），畫面卻沒變 | 開發伺服器的快取（`.next` 資料夾）還在用舊版 | 停掉 `npm run dev`，在 `frontend` 執行 `rm -rf .next`，再 `npm run dev`（`.next` 會自己重建） |
| `npm run dev` 出現 `Could not read package.json` | 不在 `frontend` 資料夾裡 | 先 `cd ~/Desktop/travel-scheduler/frontend` |
