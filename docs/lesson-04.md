# 第 4 課：背景任務（Celery）＋ 即時通知（SSE）＋ 快取（Redis）

> **狀態**：✅ 完成（上半 Celery worker ／ 中半 SSE ／ 下半 Redis 快取）
> **日期**：2026-10-25 ～ 2026-10-28
> **對照原專案**：`backend/worker/tasks.py`、`backend/router/search.py`、`backend/core/redis.py`

---

## 這一課在整個專案的位置

第 3 課的搜尋 API 能用了，但搜一個新城市要等 60 秒左右。這一課分三段解決：

| 段落 | 解決什麼 | 怎麼解決 |
|---|---|---|
| **上** | 使用者要乾等 60 秒 | API 馬上回一個**號碼牌**，AI 流程交給背景的 **Celery worker** 去做 |
| 中 | 前端要一直問「好了沒？」 | **SSE**：做好時由後端主動通知前端 |
| 下 | 同一個城市被搜很多次，每次都查資料庫；找不到更多景點的地點，每次搜都白跑一趟 AI | **Redis 快取**：把結果抄在小白板上；**冷卻便利貼**：1 天內不要再找 |

---

## 上半：用 Celery worker 在背景跑 AI 流程

### 開始前的測試結果（2026-10-25）

上課前我先在暫存區，用臨時的資料庫和 Redis 完整跑過一次：

| 測試 | 結果 |
|---|---|
| `POST /api/search` 搜「名古屋」 | **0.12 秒**就回應，拿到 `status: processing` 和 `task_id` |
| Worker 在背景做事 | 共 62 秒。**前兩篇文章都太短**（388 字、377 字）→ 自動換到第三篇；Gemini 503 → 自動換模型；最後新增 15 個景點 |
| 用 `task_id` 查進度 | 一開始 `processing`，做完變成 `completed`、`added: 15` |
| 第二次搜「名古屋」 | **0.007 秒**，`status: completed`，拿到 15 個景點 |
| 亂打一個 `task_id` 查進度 | 也回 `processing`（原因見「常見踩雷」） |

第 3 課準備 3 篇候選文章的設計，這次真的派上用場了：前兩篇都抓不到內容。

### 1. 學到的觀念

#### 餐廳裡多了一位廚師

| 角色 | 技術 | 做什麼 |
|---|---|---|
| 櫃檯 | FastAPI | 收單，馬上給客人一個號碼牌 |
| 號碼牌 | `task_id` | 客人拿著它回來問「我的好了沒？」 |
| 訂單夾 | Redis（**broker**） | 還沒做的訂單排在這裡 |
| 廚師 | **Celery worker** | 從訂單夾拿單、做菜（跑 AI 流程） |
| 出餐台 | Redis（**result backend**） | 做好的結果和狀態放在這裡 |

#### 整個流程

```
① 客人：POST /api/search {"location": "名古屋"}
② 櫃檯：資料庫夠 5 個嗎？
     夠 → 直接回傳 status: completed（跟第 3 課一樣）
     不夠 → ingest_location_task.delay("名古屋")
            把訂單放進訂單夾（Redis），馬上回 status: processing ＋ task_id

③ 廚師（另一個程式）：從訂單夾拿到訂單 → 跑 ingest_location() → 結果放上出餐台

④ 客人每隔幾秒：GET /api/search/status/{task_id}
     processing → 還在做
     completed  → 做好了
     failed     → 失敗了，附上原因

⑤ 客人看到 completed：再 POST /api/search 一次 → 這次資料庫夠了，拿到景點
```

第 ④ 步「每隔幾秒問一次」叫做 **polling（輪詢）**。這一段先用它，中半課會換成更好的 SSE。

#### 任務的狀態

| 狀態 | 意思 | 我們回給前端 |
|---|---|---|
| `PENDING` | 還在訂單夾裡排隊 | `processing` |
| `STARTED` | 廚師開始做了（要設定 `task_track_started=True` 才會有） | `processing` |
| `SUCCESS` | 做好了 | `completed` |
| `FAILURE` | 做的過程出錯了 | `failed` |

#### `.delay()`：丟進訂單夾就走，不等它做完

```python
ingest_location(db, "名古屋")              # 第 3 課：自己做，做完才往下走（60 秒）
ingest_location_task.delay("名古屋")       # 第 4 課：丟進訂單夾，馬上往下走（0.1 秒）
```

#### Worker 是另一個獨立的程式

uvicorn 和 Celery worker 是**兩個分開執行的程式**，各自在不同的終端機分頁裡跑。所以：

- Worker 裡**沒有 FastAPI**，也就沒有 `Depends(get_db)`，要自己用 `SessionLocal()` 開資料庫連線。
- 改了 worker 會用到的程式碼（例如 `services/ingest.py`），**worker 不會自動重新載入**，要手動停掉再重開。

第 3 課把流程獨立放在 `ingest_location()`，這時就看出好處了：worker 只要呼叫它，流程本身一行都沒改。

#### 常見疑問：Celery worker 是「另開一個後端，連 Redis 當快取」嗎？（2026-10-26 你的提問）

**一半對。**

✅ **「另開一個」是對的**：worker 用的是**同一份後端程式碼**（同樣的 `models.py`、`services/`、同一個 PostgreSQL），只是另外開一個程式來跑。

❌ **但它不是「後端」**：它不接 HTTP 請求、沒有網址、`/docs` 打不到它。它只做一件事：從訂單夾拿單、做完、放上出餐台。

| | uvicorn（櫃檯） | Celery worker（廚師） |
|---|---|---|
| 接收什麼 | 瀏覽器送來的 HTTP 請求 | Redis 裡的訂單 |
| 程式碼 | `backend/` | 同一份 `backend/` |
| 連 PostgreSQL 嗎 | 連 | 連，景點就是它存進去的 |
| 怎麼啟動 | `uv run uvicorn ...` | `uv run celery ... worker` |

❌ **Redis 在這裡不是「快取」，是「訂單夾」和「出餐台」**：

```
                ┌──────────── Redis ─────────────┐
uvicorn ───────▶│ 訂單夾（broker） 出餐台（backend） │◀─────── worker
（櫃檯）         └────────────────────────────────┘         （廚師）
    │                                                          │
    └───────────────────▶ PostgreSQL ◀─────────────────────────┘
                     （景點真正存在這裡）
```

Redis 裡只放「名古屋這張單」和「結果：新增 15 筆」，**景點資料本身存在 PostgreSQL**。

快取和訂單夾的差別：

| 用途 | 放什麼 | 不見了會怎樣 |
|---|---|---|
| 快取（下半課才做） | 資料庫資料的**影本**，為了拿得更快 | 沒關係，回資料庫拿一次就好 |
| 訂單夾（這一段） | **還沒做的工作** | 工作就消失了，沒有人會去做 |

Redis 是一個多用途的工具，在這個專案裡會身兼好幾個角色：

| 角色 | 第幾課 |
|---|---|
| 訂單夾（Celery broker） | 4 上 |
| 出餐台（Celery result backend） | 4 上 |
| 廣播站（Pub/Sub，通知「做好了」） | 4 中 |
| 小白板（快取） | 4 下 |
| 登入狀態（session） | 6 |

想親眼看看 Redis 裡放了什麼，做完步驟 7 之後可以執行：

```bash
cd ~/Desktop/travel-scheduler
docker compose exec redis redis-cli KEYS "*"
```

會看到像 `celery-task-meta-8eefc391-...` 這樣的鍵，那就是出餐台上的結果。

#### 為什麼訂單夾用 Redis，不用原專案的 AWS SQS？

兩者做的是同一件事。Redis 第 1 課就在跑了，不用另外申請 AWS 帳號、設定權限。Celery 換 broker 只要改一個網址，觀念完全一樣。

#### `--pool=solo`：Mac 上要加的參數

Celery 預設會**複製出好幾個分身**（fork）同時做事，但這在 Mac 上常常會讓程式當掉。`--pool=solo` 的意思是「只有一位廚師，一次做一張單」。開發時夠用了；部署到 Linux 主機時就不用加。

### 2. 實作步驟

#### 步驟 1：安裝 Celery

```bash
cd ~/Desktop/travel-scheduler/backend
uv add "celery[redis]"
```

`[redis]` 的意思是「順便裝好連 Redis 需要的套件」。

#### 步驟 2：`.env` 加上 Redis 的網址

**用編輯器**打開 `backend/.env`，在最後面**另起新的一行**加上：

```
REDIS_URL=redis://localhost:6379/0
```

最後的 `/0` 是 Redis 裡的第 0 號資料庫（Redis 預設有 16 個，編號 0 到 15）。

⚠️ 不要用 `echo ... >> .env` 這種指令來加，如果檔案最後沒有換行，新的一行會黏在金鑰那一行後面。

#### 步驟 3：新增 `backend/worker/tasks.py`

```python
import os

from celery import Celery
from dotenv import load_dotenv

from core.database import SessionLocal
from services.ingest import ingest_location

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL")

# broker：訂單夾（任務排隊的地方）；backend：結果放哪裡。兩個都用 Redis
celery_app = Celery("travel", broker=REDIS_URL, backend=REDIS_URL)
celery_app.conf.update(
    task_track_started=True,  # 廚師開始做時，把狀態標成 STARTED
    result_expires=3600,  # 結果在 Redis 留 1 小時就自動清掉
)


@celery_app.task
def ingest_location_task(location: str) -> int:
    # worker 是另一個獨立的程式，沒有 FastAPI 的 Depends(get_db)，要自己開 Session
    with SessionLocal() as db:
        return ingest_location(db, location)
```

| 寫法 | 意思 |
|---|---|
| `Celery("travel", broker=..., backend=...)` | 建立 Celery，告訴它訂單夾和出餐台在哪 |
| `@celery_app.task` | 把這個函式登記成「可以丟進訂單夾的任務」 |
| `with SessionLocal() as db:` | 開一個資料庫 Session，`with` 區塊結束時自動關掉，等於 `get_db` 裡的 `finally: db.close()` |
| `return ingest_location(...)` | 回傳新增了幾筆，這個數字會被放上出餐台 |

#### 步驟 4：修改 `backend/schemas/search.py`

整個檔案換成：

```python
from typing import Literal

from pydantic import BaseModel, Field

from schemas.destination import DestinationOut


class SearchIn(BaseModel):
    location: str = Field(min_length=1, max_length=50)


class SearchOut(BaseModel):
    location: str
    status: Literal["completed", "processing"]
    task_id: str | None = None  # 交給背景處理時才會有
    destinations: list[DestinationOut]


class TaskStatusOut(BaseModel):
    status: Literal["processing", "completed", "failed"]
    added: int | None = None  # 完成時：新增了幾個景點
    error: str | None = None  # 失敗時：原因
```

`Literal["completed", "processing"]`：這一欄**只能**是這幾個字其中一個，打錯字 Pydantic 會擋下來。

#### 步驟 5：修改 `backend/router/search.py`

整個檔案換成：

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from schemas.search import SearchIn, SearchOut, TaskStatusOut
from services.ingest import find_existing
from worker.tasks import celery_app, ingest_location_task

router = APIRouter()

ENOUGH = 5  # 資料庫已經有這麼多景點，就不用再上網找


@router.post("/api/search", response_model=SearchOut)
def search(payload: SearchIn, db: Session = Depends(get_db)):
    location = payload.location.strip()

    existing = find_existing(db, location)
    if len(existing) >= ENOUGH:
        return {"location": location, "status": "completed", "destinations": existing}

    # 不夠：把工作丟進訂單夾，馬上回一個號碼牌
    task = ingest_location_task.delay(location)
    return {
        "location": location,
        "status": "processing",
        "task_id": task.id,
        "destinations": existing,
    }


@router.get("/api/search/status/{task_id}", response_model=TaskStatusOut)
def get_search_status(task_id: str):
    result = celery_app.AsyncResult(task_id)

    if result.state in ("PENDING", "STARTED"):
        return {"status": "processing"}
    if result.state == "SUCCESS":
        return {"status": "completed", "added": result.result}
    return {"status": "failed", "error": str(result.info)}
```

跟第 3 課比，變了三件事：

| 地方 | 第 3 課 | 第 4 課 |
|---|---|---|
| 資料不夠時 | 自己呼叫 `ingest_location()`，等 60 秒 | `ingest_location_task.delay()`，馬上回號碼牌 |
| Gemini 都忙線時 | 接住 `RuntimeError`，回 503 | 錯誤發生在 worker 裡，任務狀態變成 `FAILURE`，查進度時回 `failed` 和原因 |
| 新增的 API | — | `GET /api/search/status/{task_id}`：查進度 |

| 寫法 | 意思 |
|---|---|
| `{task_id}` | 網址裡的這一段會被當成參數，傳進函式的 `task_id` |
| `celery_app.AsyncResult(task_id)` | 拿號碼牌去出餐台查這張單的狀態 |
| `result.result` | 任務的回傳值，這裡是新增了幾筆 |
| `result.info` | 任務失敗時的錯誤內容 |

#### 步驟 6：開第三個終端機分頁，啟動 worker

現在開發時要同時跑這些東西：

| 終端機分頁 | 跑什麼 | 指令 |
|---|---|---|
| 1 | Docker（資料庫＋Redis） | `docker compose up -d`（跑一次就好，它在背景） |
| 2 | API 伺服器 | `uv run uvicorn main:app --reload --port 8000` |
| 3 | **Celery worker**（新的） | 見下方 |

在新的分頁執行：

```bash
cd ~/Desktop/travel-scheduler/backend
uv run celery -A worker.tasks worker --loglevel=info --pool=solo
```

看到最後一行有 `ready.` 就代表廚師上班了。

| 參數 | 意思 |
|---|---|
| `-A worker.tasks` | Celery app 在 `worker/tasks.py` 裡 |
| `worker` | 啟動一位 worker |
| `--loglevel=info` | 印出比較詳細的紀錄，看得到每張單的進度 |
| `--pool=solo` | Mac 上要加，避免當掉 |

#### 步驟 7：測試

把**三個終端機分頁**都放在看得到的地方。

**① 搜尋一個新城市**：在 `/docs` 的 `POST /api/search` 送出：

```json
{"location": "名古屋"}
```

應該**一下子就回來**，內容像這樣：

```json
{"location": "名古屋", "status": "processing", "task_id": "8eefc391-...", "destinations": []}
```

同時看 worker 的分頁，會開始印出 `📄 試這篇…`。uvicorn 的分頁則只印出一行請求紀錄，因為它已經不用自己做事了。

**② 查進度**：複製 `task_id`，在 `/docs` 找到 `GET /api/search/status/{task_id}`，貼上後送出。做完之前是 `processing`，等 worker 印出 `💾 新增了…`、`succeeded` 之後再查一次，會變成：

```json
{"status": "completed", "added": 15, "error": null}
```

**③ 再搜一次名古屋**：這次直接拿到 `status: completed` 和景點。

#### 步驟 8：實驗，廚師不在時訂單會怎樣？

1. 到 worker 的分頁按 `Ctrl+C`，把 worker 停掉。
2. 在 `/docs` 搜尋另一個新城市，例如 `{"location": "福岡"}`，複製 `task_id`。
3. 查進度，會一直是 `processing`。
4. 回到 worker 的分頁，重新啟動 worker（按鍵盤的 ↑ 可以叫出上一個指令）。
5. 觀察 worker 一上班，做了什麼事。
6. 等它做完，再查一次進度。

### 3. 這一段結束後的資料夾

```
backend/
├── .env                       ← 多了 REDIS_URL
├── main.py
├── models.py
├── core/database.py
├── schemas/
│   ├── destination.py
│   └── search.py              ← 改：status、task_id、TaskStatusOut
├── router/
│   ├── destinations.py
│   └── search.py              ← 改：.delay()、新增查進度的 API
├── services/                  ← 沒變
└── worker/
    └── tasks.py               ← 新增：Celery app ＋ 任務
```

### 4. 跟原專案對照

| 項目 | 原專案 | 我們 |
|---|---|---|
| 訂單夾（broker） | AWS SQS | Redis |
| 出餐台（result backend） | Redis | Redis |
| 任務 | `scrape_and_save_destinations_task` | `ingest_location_task` |
| Worker 怎麼連資料庫 | `POOL.connection()` 自己拿連線 | `SessionLocal()` 自己開 Session |
| 查進度 | `GET /api/search/status/{task_id}`（後來改用 SSE，這支保留著） | 一樣，中半課也會改用 SSE |
| 失敗處理 | 永久性錯誤標成失敗；暫時性錯誤退回 SQS 重試，失敗太多次進「死信佇列」 | 先不做重試，任何錯誤都標成失敗 |
| 同一個城市被重複搜尋 | 前端傳 `allow_scrape`、Redis 冷卻鍵 `exhausted:location:...` | 還沒處理，下半課做 |
| 啟動 worker | `celery -A worker.tasks worker --loglevel=info` | 多加 `--pool=solo`（Mac） |

### 5. 常見踩雷

| 症狀 | 原因 | 解法 |
|---|---|---|
| 查進度永遠是 `processing` | Worker 沒開，或 worker 啟動時出錯 | 看 worker 分頁有沒有 `ready.` |
| `Error 61 connecting to localhost:6379. Connection refused` | Redis 沒在跑 | 在 `travel-scheduler/` 執行 `docker compose up -d` |
| `celery: command not found` | 沒透過 uv 執行 | 用 `uv run celery ...` |
| 改了 `ingest.py`，worker 的行為卻沒變 | Worker 不會自動重新載入程式碼 | 到 worker 分頁 `Ctrl+C`，再重新啟動 |
| Mac 上 worker 一接單就當掉，出現 `fork()` 相關的錯誤 | 沒加 `--pool=solo` | 加上 `--pool=solo` |
| 亂打的 `task_id` 也回 `processing` | Celery 分不出「這張單不存在」和「還在排隊」，兩種都是 `PENDING` | 正常現象，前端只會用 API 給的 `task_id` |
| 同一個新城市連按兩次搜尋，其中一個任務 `failed` | 兩張單都去找景點，後存的違反 `UNIQUE` | 下半課處理 |

### 6. 小測驗

1. `POST /api/search` 現在為什麼只要 0.1 秒？AI 流程跑到哪裡去了？
2. Worker 為什麼要自己開 `SessionLocal()`，不能用 `Depends(get_db)`？
3. 步驟 8 的實驗：worker 停掉時送出的搜尋，worker 重新啟動後發生了什麼事？為什麼會這樣？
4. 改了 `services/ingest.py` 之後，要做什麼，worker 才會用新的程式？

<details>
<summary>點開看解答</summary>

1. 因為 API 不再自己跑 AI 流程，只是用 `.delay()` 把一張訂單放進 Redis 就馬上回傳。AI 流程交給**另一個程式**（Celery worker）在背景跑。
2. `Depends(get_db)` 是 **FastAPI** 的功能，只有 FastAPI 處理請求時才會幫你準備 Session。Worker 是一個獨立的程式，裡面沒有 FastAPI，沒有人會幫它準備，所以要自己開。
3. Worker 一啟動，**馬上就接到福岡那張單開始做**，做完後查進度就變成 `completed`。因為訂單是存在 **Redis（訂單夾）** 裡，不是存在 worker 身上。廚師不在時，訂單在訂單夾裡排隊等著，廚師回來就接著做，不會遺失。
4. 到 worker 的分頁按 `Ctrl+C` 停掉，再重新啟動。Worker 不像 uvicorn 有 `--reload`，不會自動載入新的程式碼。

</details>

#### 你的實作紀錄（2026-10-26）

| 檢查 | 結果 |
|---|---|
| 步驟 7：名古屋 | 新增 12 個景點（我在暫存區測時是 15 個，每次搜尋到的文章不同，數量也會不同） |
| 步驟 8：福岡 | Worker 停掉時送出，重新啟動後接單完成，新增 14 個景點，`succeeded in 144.6s` |
| Redis 裡的出餐台 | 兩個 `celery-task-meta-...` 鍵，對應名古屋和福岡兩張單 |

福岡跑了 144 秒，比平常久，可能是前幾篇文章不能用，或 Gemini 比較忙。`succeeded in` 只算 worker **實際執行**的時間，訂單在訂單夾裡排隊等 worker 的時間不算在內。

#### 你的作答（2026-10-26）

**Q1. `POST /api/search` 為什麼只要 0.1 秒？**
- 你的答案：因為交給 Celery worker 了，才會變快。 ✅
- 補充：API 現在只做「把訂單放進 Redis」這件事，AI 流程由另一個程式在背景跑。

**Q2. Worker 為什麼要自己開 `SessionLocal()`？**
- 你的答案：不知。
- 正解：`Depends(get_db)` 是 **FastAPI** 的功能，只有 FastAPI 處理 HTTP 請求時才會幫你準備 Session。Worker 是獨立的程式，裡面沒有 FastAPI，要自己開。

**Q3. 步驟 8：worker 重啟後發生什麼事？為什麼？**
- 你的答案：他接收到任務，開始進行。 🔶 觀察正確，少了原因
- 正解：原因是**訂單存在 Redis（訂單夾）裡，不是存在 worker 身上**。廚師不在時訂單在訂單夾排隊，廚師回來就接著做，不會遺失。

**Q4. 改了 `ingest.py` 後，worker 要怎樣才會用新程式？**
- 你的答案：不知。
- 正解：到 worker 分頁 `Ctrl+C` 停掉再重開。Worker 沒有 `--reload`，會一直用啟動當下的程式碼。

💡 Q2、Q4 的答案都在觀念段落「Worker 是另一個獨立的程式」裡。之後每一段的小測驗前，會加上「📌 這一段的 3 個重點」幫你快速複習。

---

## 中半：SSE，做好時由後端主動通知

### 開始前的測試結果（2026-10-26）

| 測試 | 結果 |
|---|---|
| 搜尋「札幌」 | 拿到 `task_id` |
| 用 curl 連上 SSE | 每 **15 秒**收到一行 `: heartbeat`；大約 2 分鐘後收到 `data: {"status": "completed", "added": 21}`，連線自動結束 |
| 做完之後再連一次 | **0.011 秒**就收到 `completed`，錯過廣播也拿得到結果 |
| 用 `redis-cli` 偷聽廣播站 | 看到 worker 喊出的那一句 `{"status": "completed", "added": 21}` |

### 1. 學到的觀念

#### Polling 和 SSE

```
Polling（上半課）：前端每隔幾秒問一次
  前端：好了沒？  後端：還沒
  前端：好了沒？  後端：還沒
  前端：好了沒？  後端：好了！

SSE（這一段）：前端開一條線等著
  前端：我在這裡等，好了跟我說
  後端：（每 15 秒）我還在喔
  後端：（每 15 秒）我還在喔
  後端：好了！ → 連線結束
```

**SSE（Server-Sent Events）** 是一條**由後端往前端的單向管道**。連線一直開著，後端有消息就推過去，前端不用一直問。

SSE 送出的內容就是純文字，格式很簡單：

```
: heartbeat                                       ← 冒號開頭：註解，前端會忽略
data: {"status": "completed", "added": 21}        ← data: 開頭：真正的訊息
                                                  ← 每則訊息後面要空一行
```

#### Redis Pub/Sub：廣播站

Worker 做完時，要怎麼讓 SSE 那邊知道？用 Redis 的 **Pub/Sub（發布／訂閱）**：

| 動作 | 誰做 | 比喻 |
|---|---|---|
| `publish("task_done:abc", 訊息)` | Worker | 在 `task_done:abc` 這個頻道**廣播**一句話 |
| `subscribe("task_done:abc")` | SSE 端點 | 把收音機**轉到**這個頻道 |

每張單都有自己的頻道：`task_done:{task_id}`，所以不會聽到別人的消息。

**廣播站和訂單夾最大的不同：廣播不會被保存。**

| | 訂單夾（broker） | 廣播站（Pub/Sub） |
|---|---|---|
| 沒人在的時候 | 訂單會**存著**，等 worker 來拿 | 廣播就**消失**了，沒在聽的人永遠聽不到 |

#### 為什麼要「先打開收音機，再查一次出餐台」？

SSE 端點連上時，任務可能**已經做完了**，廣播早就錯過了。所以順序是：

```
① 先訂閱頻道（打開收音機）
② 再查一次出餐台（AsyncResult）：
     已經做完？ → 直接回傳結果，結束
     還沒做完？ → 開始聽廣播
```

**如果順序反過來（先查、再訂閱）**：查的時候還沒做完，但就在「查完」到「訂閱」的那一瞬間，worker 剛好廣播了。這句廣播就被錯過，SSE 會一直等到 10 分鐘逾時。先訂閱再查，兩種情況都接得住。

#### 為什麼 SSE 端點要用 `async def`？

一條 SSE 連線可能開好幾分鐘。

| 寫法 | 比喻 | 結果 |
|---|---|---|
| `def`（同步） | 每一桌都派一位服務生**站在旁邊等** | 很多人同時在等時，服務生（執行緒）很快就被佔光 |
| `async def`（非同步） | 一位服務生**巡很多桌**，誰叫了再過去 | 等待的時候不佔人手，一位就能顧很多條連線 |

| 寫法 | 意思 |
|---|---|
| `async def` | 這個函式可以在等待時把位子讓出來 |
| `await ...` | 「我要等這件事，等的時候先去忙別的」 |
| `yield ...` | 送一段內容給前端，函式**暫停**在這裡，下次從這裡繼續 |
| `StreamingResponse(...)` | 告訴 FastAPI：這個回應不是一次給完，而是一段一段串流出去 |

所以 SSE 端點要用 `redis.asyncio`（非同步版的 Redis），而 worker 用的是一般的 `redis`。

#### 為什麼要送心跳？

瀏覽器、Nginx 這些中間層看到一條連線**很久都沒有資料**，會以為它斷了，直接把它切掉。每 15 秒送一行 `: heartbeat`，就是在告訴它們「我還活著」。

### 2. 實作步驟

#### 步驟 9：修改 `backend/worker/tasks.py`，做完時廣播

整個檔案換成：

```python
import json
import os

import redis
from celery import Celery
from dotenv import load_dotenv

from core.database import SessionLocal
from services.ingest import ingest_location

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL")

# broker：訂單夾（任務排隊的地方）；backend：結果放哪裡。兩個都用 Redis
celery_app = Celery("travel", broker=REDIS_URL, backend=REDIS_URL)
celery_app.conf.update(
    task_track_started=True,  # 廚師開始做時，把狀態標成 STARTED
    result_expires=3600,  # 結果在 Redis 留 1 小時就自動清掉
)

redis_client = redis.Redis.from_url(REDIS_URL)


@celery_app.task(bind=True)
def ingest_location_task(self, location: str) -> int:
    channel = f"task_done:{self.request.id}"  # 每張單有自己的廣播頻道
    try:
        # worker 是另一個獨立的程式，沒有 FastAPI 的 Depends(get_db)，要自己開 Session
        with SessionLocal() as db:
            added = ingest_location(db, location)
    except Exception as e:
        redis_client.publish(channel, json.dumps({"status": "failed", "error": str(e)}, ensure_ascii=False))
        raise  # 繼續往外丟，讓 Celery 把這張單標成 FAILURE

    redis_client.publish(channel, json.dumps({"status": "completed", "added": added}, ensure_ascii=False))
    return added
```

| 寫法 | 意思 |
|---|---|
| `bind=True` ＋ `self` | 讓任務拿得到自己的資訊，例如 `self.request.id`（就是 `task_id`） |
| `redis_client.publish(頻道, 訊息)` | 在這個頻道廣播一句話 |
| `json.dumps(..., ensure_ascii=False)` | dict 轉成 JSON 文字；`ensure_ascii=False` 讓中文保持中文，不會變成 `京` 這種編碼 |
| `except Exception` ＋ `raise` | 失敗時也要廣播「失敗了」，然後把錯誤繼續往外丟，Celery 才知道這張單失敗 |

#### 步驟 10：修改 `backend/router/search.py`，加上 SSE 端點

整個檔案換成：

```python
import json
import time

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from core.database import get_db
from schemas.search import SearchIn, SearchOut, TaskStatusOut
from services.ingest import find_existing
from worker.tasks import REDIS_URL, celery_app, ingest_location_task

router = APIRouter()

ENOUGH = 5  # 資料庫已經有這麼多景點，就不用再上網找
HEARTBEAT_SECONDS = 15  # 沒消息時，每隔多久送一次心跳
MAX_WAIT_SECONDS = 600  # 最多等 10 分鐘


@router.post("/api/search", response_model=SearchOut)
def search(payload: SearchIn, db: Session = Depends(get_db)):
    location = payload.location.strip()

    existing = find_existing(db, location)
    if len(existing) >= ENOUGH:
        return {"location": location, "status": "completed", "destinations": existing}

    # 不夠：把工作丟進訂單夾，馬上回一個號碼牌
    task = ingest_location_task.delay(location)
    return {
        "location": location,
        "status": "processing",
        "task_id": task.id,
        "destinations": existing,
    }


@router.get("/api/search/status/{task_id}", response_model=TaskStatusOut)
def get_search_status(task_id: str):
    result = celery_app.AsyncResult(task_id)

    if result.state in ("PENDING", "STARTED"):
        return {"status": "processing"}
    if result.state == "SUCCESS":
        return {"status": "completed", "added": result.result}
    return {"status": "failed", "error": str(result.info)}


def sse_message(data: dict) -> str:
    # SSE 的格式：「data: 內容」後面接兩個換行
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.get("/api/search/stream/{task_id}")
async def stream_search_status(task_id: str, request: Request):
    async def event_stream():
        redis_conn = aioredis.from_url(REDIS_URL, decode_responses=True)
        pubsub = redis_conn.pubsub()
        await pubsub.subscribe(f"task_done:{task_id}")  # 先打開收音機
        try:
            # 打開收音機之前，任務可能已經做完、廣播已經錯過了，先查一次出餐台
            result = celery_app.AsyncResult(task_id)
            if result.state == "SUCCESS":
                yield sse_message({"status": "completed", "added": result.result})
                return
            if result.state == "FAILURE":
                yield sse_message({"status": "failed", "error": str(result.info)})
                return

            deadline = time.monotonic() + MAX_WAIT_SECONDS
            while time.monotonic() < deadline:
                if await request.is_disconnected():  # 使用者關掉頁面了
                    return
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=HEARTBEAT_SECONDS
                )
                if message:  # 收到 worker 的廣播
                    yield f"data: {message['data']}\n\n"
                    return
                yield ": heartbeat\n\n"  # 冒號開頭是註解，讓連線保持活著

            yield sse_message({"status": "timeout"})
        finally:
            # 不管怎麼結束，都要關掉收音機、還掉連線
            await pubsub.unsubscribe()
            await pubsub.aclose()
            await redis_conn.aclose()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

前兩支 API（`POST /api/search`、查進度）沒有變，新增的是 `sse_message` 和 `stream_search_status`。

| 寫法 | 意思 |
|---|---|
| `decode_responses=True` | Redis 回傳文字，而不是 bytes |
| `pubsub.get_message(..., timeout=15)` | 最多等 15 秒；有廣播就拿到訊息，沒有就回 `None` |
| `ignore_subscribe_messages=True` | 忽略「訂閱成功」這種系統訊息，只要真正的廣播 |
| `time.monotonic()` | 計時用的時鐘，只會往前走，不受電腦改時間影響 |
| `request.is_disconnected()` | 檢查前端是不是已經離開了，離開了就不用再等 |
| `finally:` | 不管是正常結束、逾時、還是使用者離開，都會執行，確保連線一定被還掉 |
| `media_type="text/event-stream"` | 告訴瀏覽器「這是 SSE」 |
| `"X-Accel-Buffering": "no"` | 告訴 Nginx 不要把內容存起來再一次送，要即時轉送（第 10 課部署時用得到） |

#### 步驟 11：重開 worker

改了 `worker/tasks.py`，**worker 不會自動載入新程式**（上半課的 Q4）。到 worker 分頁按 `Ctrl+C`，再按 ↑ 重新啟動。uvicorn 有 `--reload`，會自己重開。

#### 步驟 12：測試

這次需要再多開**一個終端機分頁**來當「前端」。

**① 選做：偷聽廣播站。** 再開一個分頁執行下面的指令，它會一直開著，印出所有 `task_done:` 開頭頻道的廣播：

```bash
cd ~/Desktop/travel-scheduler
docker compose exec redis redis-cli PSUBSCRIBE "task_done:*"
```

**② 搜尋一個新城市**：在 `/docs` 送出 `{"location": "札幌"}`，複製回傳的 `task_id`。

**③ 用 curl 當前端，連上 SSE**：把 `貼上task_id` 換成你剛剛複製的號碼：

```bash
curl -N http://localhost:8000/api/search/stream/貼上task_id
```

`-N` 的意思是「收到什麼就馬上印出來」，不加的話 curl 會先存起來，就看不出「串流」的效果。

你應該會看到每 15 秒出現一行 `: heartbeat`，worker 做完的那一刻出現 `data: {"status": "completed", ...}`，然後連線自動結束。

**④ 再執行一次同一個 curl 指令**：這次應該**馬上**就收到 `completed`。想想看，廣播早就結束了，它是從哪裡拿到結果的？

### 3. 這一段結束後的資料夾

```
backend/
├── router/
│   └── search.py          ← 改：新增 SSE 端點 /api/search/stream/{task_id}
└── worker/
    └── tasks.py           ← 改：做完時在 Redis 廣播
```

### 4. 跟原專案對照

| 項目 | 原專案 | 我們 |
|---|---|---|
| SSE 網址 | `/api/search/stream/{task_id}` | 一樣 |
| 頻道名稱 | `task_done:{task_id}` | 一樣 |
| Worker 廣播 | 做完 `publish completed`，永久失敗 `publish failed` | 一樣 |
| 等待寫法 | 兩個背景任務（聽廣播、送心跳）＋一個佇列互相溝通 | 一個迴圈：`get_message(timeout=15)`，沒消息就送心跳。比較短，好讀 |
| 心跳間隔 | 30 秒 | 15 秒 |
| 錯過廣播 | 沒有處理：訂閱前就做完的話，要等到逾時 | 訂閱後先查一次出餐台 |
| Nginx 設定 | 另外為 SSE 設定 `proxy_buffering off` | 第 10 課部署時再加 |

### 5. 常見踩雷

| 症狀 | 原因 | 解法 |
|---|---|---|
| curl 一直沒反應，最後才一次印出全部 | 沒加 `-N` | `curl -N ...` |
| 一直 heartbeat，worker 早就做完了卻收不到 `completed` | 改了 `tasks.py` 但**沒重開 worker**，舊的 worker 不會廣播 | 重開 worker。已經在等的那條連線，要等 10 分鐘逾時，或按 `Ctrl+C` 中斷後重連 |
| `task_id` 打錯，一直 heartbeat | 不存在的單永遠是 `PENDING`，也不會有人廣播 | 確認 `task_id` 有完整複製 |
| 用瀏覽器直接打開 SSE 網址，畫面空白或跳出下載 | 瀏覽器不會直接顯示 SSE | 用 curl 測。前端會用 `EventSource` 來接，第 5 課做畫面時用到 |

### 📌 這一段的 3 個重點

1. **SSE**：前端開一條連線等著，後端有消息就主動推過去，前端不用一直問。
2. **Redis Pub/Sub 像廣播**：worker 做完在 `task_done:{task_id}` 喊一聲。**沒在聽就錯過**，所以 SSE 端點要「先打開收音機，再查一次出餐台」。
3. **SSE 端點用 `async def`**：等待時不佔人手；每 15 秒送心跳，免得被中間層當成斷線切掉。

### 6. 小測驗

1. Polling 和 SSE 最大的差別是什麼？
2. 為什麼 SSE 端點要「先訂閱頻道，再查一次出餐台」？順序反過來會怎樣？
3. 為什麼沒有消息時，每 15 秒要送一次 heartbeat？
4. 改了 `worker/tasks.py` 卻忘了重開 worker，curl 連上 SSE 會看到什麼？

<details>
<summary>點開看解答</summary>

1. Polling 是**前端一直問**「好了沒？」，問太勤浪費資源，問太少又晚知道；SSE 是**後端主動通知**，前端開一條連線等著，做好的那一刻就收到。
2. 因為 Pub/Sub 的廣播**不會被保存**。如果先查（還沒好）、再訂閱，就在這兩步中間 worker 剛好廣播的話，這句就永遠錯過了，SSE 會一直等到逾時。先訂閱再查：查的時候已經好了 → 直接回傳；還沒好 → 收音機已經開著，之後的廣播一定聽得到。
3. 瀏覽器、Nginx 這些中間層看到一條連線太久沒有資料，會以為它斷了而把它切掉。心跳是在告訴它們「這條連線還活著」。
4. 會**一直看到 heartbeat**，等不到 `completed`，直到 10 分鐘逾時。因為舊的 worker 還在用沒有 `publish` 的舊程式碼，做完了也不會廣播。（如果在 worker 做完之後才連上，則會因為「先查出餐台」而馬上拿到結果。）

</details>

#### 你的實作紀錄（2026-10-27）

```
curl -N http://localhost:8000/api/search/stream/8f9795c5-30e2-4377-bfc9-cffba4995a96
data: {"status": "completed", "added": 20}
```

連上時任務已經做完了，所以沒有看到 heartbeat，直接從出餐台拿到結果（新增 20 個景點）。這剛好走到「先查一次出餐台」那條路。想看到 heartbeat 的話：先把 curl 指令打好，搜尋新城市後**馬上**貼上 `task_id` 送出。

#### 你的作答（2026-10-27）

這一段的小測驗你選擇直接看解答。我另外用手搖飲店的比喻重講了一次：

| 題目 | 手搖飲店版的答案 |
|---|---|
| Q1 Polling vs SSE | Polling 是一直走去櫃檯問「好了沒」；SSE 是坐著等叫號 |
| Q2 先訂閱再查 | 叫號只喊一次，所以要先坐下來開始聽，再看一眼取餐台。順序反了，就可能剛好在你走過去的路上喊完號 |
| Q3 heartbeat | 店員每隔一陣子說「還在做喔，別走」，免得你（或中間層）以為被忘記而離開 |
| Q4 沒重開 worker | 製作區的人還在用舊的工作手冊，手冊裡沒寫「做好要喊號」，你就一直等不到叫號 |

複習時可以先遮住解答，自己回答一次。

#### 白話總整理：用手搖飲店來想（2026-10-27 你的提問）

**整個流程就像在一間很忙的手搖飲店點飲料：**

1. **點單**：你跟店員說「一杯珍奶」（前端送出「搜尋札幌」）。
2. **拿號碼牌**：店員不會叫你站在櫃檯等，而是給你一張**號碼牌 28 號**，你就可以先去旁邊坐（API 馬上回 `task_id`，0.1 秒）。
3. **單子夾到出單區**：你的單被夾在後面的**訂單夾**上排隊（Redis 當 broker）。
4. **製作區的人做飲料**：後面專門做飲料的人，一張一張拿單來做（Celery worker 跑 AI 流程，大約 1 分鐘）。
5. **做好了**：飲料放上**取餐台**（Redis 當 result backend），然後店員**喊一聲「28 號好了！」**（Redis Pub/Sub 廣播）。
6. **你怎麼知道好了？** 兩種方式：
   - **一直走去櫃檯問**「28 號好了沒？」→ 這是 **polling**（上半課的 `/api/search/status/...`）
   - **坐在旁邊聽叫號** → 這是 **SSE**（這一段的 `/api/search/stream/...`）。店員每隔一陣子還會跟你說「還在做喔，別走」，這就是 **heartbeat**。
7. **叫號只喊一次**：你如果是在喊完之後才坐下來，就聽不到了。所以你**一坐下來，先看一眼取餐台**：「我的 28 號已經在上面了嗎？」有的話直接拿走；沒有的話才開始專心聽叫號。
8. **拿到飲料**：前端收到「好了」，再送一次搜尋，這次資料庫裡已經有景點，直接拿到結果。

**你剛剛的 curl 就是第 7 點**：你坐下來時，飲料早就做好放在取餐台上了，所以一連上就直接拿到。

| 手搖飲店 | 程式裡的東西 | 在哪個檔案 |
|---|---|---|
| 櫃檯店員 | FastAPI（uvicorn） | `router/search.py` |
| 號碼牌 | `task_id` | `POST /api/search` 回傳的 |
| 訂單夾 | Redis（broker） | `worker/tasks.py` 的 `broker=REDIS_URL` |
| 製作區的人 | Celery worker | `worker/tasks.py` 的 `ingest_location_task` |
| 取餐台 | Redis（result backend） | `backend=REDIS_URL`；用 `AsyncResult(task_id)` 查 |
| 喊「28 號好了！」 | Redis Pub/Sub 的 `publish` | `worker/tasks.py` 的 `redis_client.publish(...)` |
| 坐著聽叫號 | SSE 連線，`subscribe` 頻道 | `router/search.py` 的 `stream_search_status` |
| 「還在做喔，別走」 | heartbeat | `yield ": heartbeat\n\n"` |
| 一坐下先看取餐台 | 訂閱後先查 `AsyncResult` | `stream_search_status` 開頭那段 |

**為什麼要搞得這麼複雜？** 如果店員親自去做飲料（第 3 課的同步寫法），你就得站在櫃檯前等 1 分鐘，等太久還可能被趕走（連線逾時）；排隊的人一多，店員全被佔住，連「我只是要問一下菜單」的人都要等。分工之後，櫃檯永遠有空收單，做飲料的人專心做，大家用號碼牌和叫號溝通。

---

## 下半：Redis 快取＋冷卻便利貼

### 開始前的測試結果（2026-10-27）

我先在另一份複製出來的程式跑過一遍（用另一個資料庫和 Redis 的 1 號資料庫，你的資料都沒動到）：

| 測試 | 結果 |
|---|---|
| 搜「京都」第 1 次（查資料庫，抄上白板） | 0.005 秒 |
| 搜「京都」第 2 次（直接看白板） | 0.002 秒，內容跟第 1 次一模一樣 |
| 手動新增一個京都景點，再搜 | **看不到**（白板上還是舊的）→ 擦掉白板再搜 → 看到了 |
| 幫「宮島」貼冷卻便利貼，再搜 | 馬上回 `completed`，**沒有派 worker** |
| worker 只新增 1 個景點 | 自動貼上便利貼，1 天（86400 秒）後自動撕掉 |
| 關掉 Redis | 京都照常回（只是印警告）；宮島回 500；Redis 開回來後全部自動恢復 |

老實說：在我們的電腦上資料庫本來就很快，快取只快了 0.003 秒。快取真正的價值在**資料多、使用者多**的時候：資料庫是大家共用、最容易塞車的地方，能少查一次，它的負擔就少一點。

### 1. 學到的觀念

#### 回到手搖飲店：櫃檯旁邊的小白板

客人常問：「京都有哪些景點？」以前店員每次都要走去後面的**倉庫**（資料庫）翻資料夾。現在店員第一次翻完，就把答案**抄在櫃檯的小白板上**（Redis 快取），旁邊寫「1 小時後擦掉」。下一個客人再問，看一眼白板就能回答。

搜尋 API 現在變成三步，這種做法叫 **Cache-Aside（旁路快取）**：

```
搜尋「京都」
  │
  ├─ 1. 先看小白板（Redis 的 search:京都）
  │     有 → 🚀 直接回答，不用進倉庫
  │
  ├─ 2. 白板上沒有 → 進倉庫查（資料庫）
  │     夠 5 個 → 📝 抄上白板（1 小時後自動擦掉）→ 回答
  │
  └─ 3. 不夠 → 拿號碼牌，交給製作區（Celery worker）
```

#### TTL：白板上的字會自己消失

`redis_client.set(key, 內容, ex=3600)` 的 `ex=3600` 就是 **TTL（存活時間）**：3600 秒後，Redis 會自動把它刪掉。

為什麼要自動擦掉？因為**倉庫裡的資料變了，白板不會知道**。例如有人手動新增了一個京都景點，白板上還是舊的那份，要等擦掉之後才看得到新的。這叫**快取過期（stale）**。設 TTL 1 小時，等於是在說：「資料最多舊 1 小時，我們可以接受。」步驟 17 會讓你親眼看到這件事。

#### 冷卻便利貼：這個地點今天別再找了

第 3 課的規則是「資料庫裡不到 5 個，就上網找」。那如果某個小地方（例如宮島）網路上本來就沒幾篇文章，AI 怎麼找都只找到 1、2 個呢？

那**每次有人搜宮島，都會派 worker 跑一趟 60 秒的 AI 流程**，每次都花掉 Gemini 和 Google 的額度，結果每次都一樣少。

解法：worker 做完時，如果**新增不到 3 個**，就在 Redis 貼一張便利貼 `exhausted:宮島`，1 天後自動撕掉。搜尋 API 看到這張便利貼，就直接回現有的資料，不再派人去找。

注意：**失敗不貼便利貼**。Gemini 忙線導致任務失敗，跟「找過了，真的沒有更多」是兩回事，下次搜還是要重試。

#### 白板壞了，店員還是答得出來

快取只是**讓它更快**，不是**沒有它就不行**。所以讀寫快取都包在 `try/except` 裡：Redis 連不上，就當作白板上沒寫，照樣去倉庫查。

但是**要排隊的單**一定要有 Redis，因為訂單夾就在 Redis 裡。所以 Redis 掛掉時，資料不夠的城市會回 500，這是合理的。

#### 整個第 4 課，Redis 做了這些事

| 手搖飲店 | Redis 裡的東西 | 哪一段 |
|---|---|---|
| 訂單夾 | Celery 的 broker | 上半 |
| 取餐台 | Celery 的 result backend（`celery-task-meta-...`） | 上半 |
| 喊號碼 | Pub/Sub 頻道 `task_done:{task_id}` | 中半 |
| 櫃檯小白板 | 快取 `search:{地點}`，1 小時 | 下半 |
| 冷卻便利貼 | `exhausted:{地點}`，1 天 | 下半 |

### 2. 實作步驟

#### 步驟 13：新增 `backend/core/redis.py`

現在 router 和 worker 都要用 Redis，把連線放在 `core/` 裡大家共用，跟 `core/database.py` 是一樣的道理：

```python
import os

import redis
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL")

# decode_responses=True：從 Redis 拿回來的是字串，不是 bytes
redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
```

#### 步驟 14：修改 `backend/worker/tasks.py`，新增太少就貼便利貼

整個檔案換成：

```python
import json

from celery import Celery

from core.database import SessionLocal
from core.redis import REDIS_URL, redis_client
from services.ingest import ingest_location

FEW_NEW = 3  # 新增的景點少於這個數量，就當作這個地點被挖光了
COOLDOWN_SECONDS = 86400  # 挖光的地點，1 天內不要再派人去找

# broker：訂單夾（任務排隊的地方）；backend：結果放哪裡。兩個都用 Redis
celery_app = Celery("travel", broker=REDIS_URL, backend=REDIS_URL)
celery_app.conf.update(
    task_track_started=True,  # 廚師開始做時，把狀態標成 STARTED
    result_expires=3600,  # 結果在 Redis 留 1 小時就自動清掉
)


@celery_app.task(bind=True)
def ingest_location_task(self, location: str) -> int:
    channel = f"task_done:{self.request.id}"  # 每張單有自己的廣播頻道
    try:
        # worker 是另一個獨立的程式，沒有 FastAPI 的 Depends(get_db)，要自己開 Session
        # with SessionLocal() as db: 會在區塊結束時自動關掉 Session，等於 get_db 裡的 finally: db.close()。
        with SessionLocal() as db:
            added = ingest_location(db, location)
    except Exception as e:
        redis_client.publish(channel, json.dumps(
            {"status": "failed", "error": str(e)}, ensure_ascii=False))
        raise  # 繼續往外丟，讓 Celery 把這張單標成 FAILURE

    if added < FEW_NEW:
        # 貼一張便利貼：這個地點 1 天內不要再找了，時間到 Redis 會自動撕掉
        redis_client.set(f"exhausted:{location}", "1", ex=COOLDOWN_SECONDS)
        print(f"❄️ 只新增 {added} 個，「{location}」冷卻 1 天")

    redis_client.publish(channel, json.dumps(
        {"status": "completed", "added": added}, ensure_ascii=False))
    return added
```

| 改了什麼 | 說明 |
|---|---|
| `REDIS_URL`、`redis_client` 改從 `core.redis` 拿 | 不用自己 `load_dotenv()`、自己建連線了 |
| `if added < FEW_NEW:` 那段 | 新增不到 3 個 → 貼 1 天的便利貼 |
| `set(key, "1", ex=86400)` | 內容寫什麼不重要，**有沒有這張便利貼**才重要 |
| 便利貼寫在 `except` 的**後面** | 失敗的話，`raise` 已經離開函式了，走不到這裡，所以失敗不會貼 |

#### 步驟 15：修改 `backend/router/search.py`，先看白板

從檔案**第一行**，到 `search` 函式結束（也就是 `@router.get("/api/search/status/{task_id}", ...)` 這行**之前**），整段換成下面的內容。後面的查進度、SSE 都不用動。

```python
import json
import time

import redis
import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from core.database import get_db
from core.redis import REDIS_URL, redis_client
from schemas.destination import DestinationOut
from schemas.search import SearchIn, SearchOut, TaskStatusOut
from services.ingest import find_existing
from worker.tasks import celery_app, ingest_location_task

router = APIRouter()

ENOUGH = 5  # 資料庫已經有這麼多景點，就不用再上網找
HEARTBEAT_SECONDS = 15  # 沒消息時，每隔多久送一次心跳
MAX_WAIT_SECONDS = 600  # 最多等 10 分鐘
CACHE_SECONDS = 3600  # 小白板上的結果，1 小時後自動擦掉


def read_cache(key: str) -> list | None:
    try:
        raw = redis_client.get(key)
    except redis.RedisError as e:
        print(f"⚠️ 讀快取失敗，改查資料庫：{e}")
        return None
    return None if raw is None else json.loads(raw)


def write_cache(key: str, data: list) -> None:
    try:
        redis_client.set(key, json.dumps(data, ensure_ascii=False), ex=CACHE_SECONDS)
        print(f"📝 寫入快取：{key}（{len(data)} 筆）")
    except redis.RedisError as e:
        print(f"⚠️ 寫快取失敗：{e}")  # 寫不進去也沒關係，下次再查資料庫就好


@router.post("/api/search", response_model=SearchOut)
def search(payload: SearchIn, db: Session = Depends(get_db)):
    location = payload.location.strip()
    cache_key = f"search:{location}"

    # 1. 先看小白板
    cached = read_cache(cache_key)
    if cached is not None:
        print(f"🚀 命中快取：{location}")
        return {"location": location, "status": "completed", "destinations": cached}

    # 2. 小白板沒有，查資料庫
    existing = find_existing(db, location)
    # 不夠的話，再看有沒有「冷卻中」的便利貼（or 前面成立就不會看後面）
    if len(existing) >= ENOUGH or redis_client.exists(f"exhausted:{location}"):
        # 資料庫的物件不能直接存進 Redis，先轉成 dict（日期轉成字串）
        destinations = [
            DestinationOut.model_validate(d).model_dump(mode="json") for d in existing
        ]
        write_cache(cache_key, destinations)
        return {"location": location, "status": "completed", "destinations": destinations}

    # 3. 不夠又沒在冷卻：把工作丟進訂單夾，馬上回一個號碼牌
    task = ingest_location_task.delay(location)
    return {
        "location": location,
        "status": "processing",
        "task_id": task.id,
        "destinations": existing,
    }
```

| 寫法 | 意思 |
|---|---|
| `redis_client.get(key)` | 看白板；沒寫過或已經擦掉 → `None` |
| `set(key, 內容, ex=3600)` | 抄上白板，3600 秒後自動擦掉 |
| `redis_client.exists(key)` | 有沒有這張便利貼（有 → 1，沒有 → 0） |
| `DestinationOut.model_validate(d).model_dump(mode="json")` | 資料庫物件 → Pydantic → 普通的 dict。`mode="json"` 會把日期轉成文字，`json.dumps` 才吃得下 |
| `json.dumps` ／ `json.loads` | list 轉成文字存進去 ／ 拿出來的文字轉回 list。Redis 只能存文字 |
| `except redis.RedisError` | 只接住 Redis 的錯誤；其他錯誤（例如程式寫錯）還是要讓它爆出來，才看得到 |
| `A or B` | A 成立就不會去看 B：資料夠的話，連便利貼都不用查 |

#### 步驟 16：重開 worker

改了 `worker/tasks.py`，到 worker 分頁按 `Ctrl+C`，再按 ↑ 重新啟動。uvicorn 會自己重開。

#### 步驟 17：測試

下面的指令都在 `~/Desktop/travel-scheduler` 執行。

**① 白板生效了嗎？** 搜兩次京都，量時間（第 3 課用過的指令）：

```bash
curl -s -o /dev/null -w "花了 %{time_total} 秒\n" -X POST localhost:8000/api/search -H "Content-Type: application/json" -d '{"location": "京都"}'
```

按 ↑ 再執行一次。看 uvicorn 的分頁：第 1 次印 `📝 寫入快取：search:京都（26 筆）`，第 2 次印 `🚀 命中快取：京都`。

再看看白板上的字還有幾秒會被擦掉：

```bash
docker compose exec redis redis-cli TTL "search:京都"
```

會看到比 3600 小一點的數字，每執行一次就變小一點。

**② 親眼看到「快取過期」**

1. 到 `/docs` 用 `POST /api/destinations` 新增 `{"place_name": "快取測試亭", "city_name": "京都"}`
2. 搜京都，看結果裡有沒有它：

   ```bash
   curl -s -X POST localhost:8000/api/search -H "Content-Type: application/json" -d '{"location": "京都"}' | grep -o "快取測試亭"
   ```

   **什麼都沒印**：資料庫裡已經有它了，但白板上還是舊的那份。
3. 擦掉白板：

   ```bash
   docker compose exec redis redis-cli DEL "search:京都"
   ```

4. 再執行一次第 2 點的 curl → 這次印出 `快取測試亭`。
5. 收拾：刪掉測試景點，白板再擦一次：

   ```bash
   docker compose exec db psql -U travel -d travel_scheduler -c "DELETE FROM destinations WHERE place_name = '快取測試亭';"
   docker compose exec redis redis-cli DEL "search:京都"
   ```

**③ 冷卻便利貼**：要等 worker 真的找出不到 3 個太久了，這裡直接幫「宮島」手動貼一張 120 秒的便利貼：

```bash
docker compose exec redis redis-cli SET "exhausted:宮島" 1 EX 120
```

到 `/docs` 搜 `{"location": "宮島"}`，應該**馬上**回：

```json
{"location": "宮島", "status": "completed", "task_id": null, "destinations": []}
```

`task_id` 是 `null`，worker 的分頁也沒動靜 → 沒有派人去找。

收拾（不然宮島的空白結果會在白板上留 1 小時）：

```bash
docker compose exec redis redis-cli DEL "exhausted:宮島" "search:宮島"
```

**④ 選做：把 Redis 關掉看看**

```bash
docker compose stop redis
```

- 搜京都 → 照樣有結果，uvicorn 印 `⚠️ 讀快取失敗，改查資料庫`
- 搜宮島 → 500（要排隊一定要 Redis）
- worker 的分頁會印一大段紅字，這是正常的

```bash
docker compose start redis
```

幾秒後 worker 會印 `Connected to redis://localhost:6379/0`，全部自動恢復，什麼都不用重開。

### 3. 這一段結束後的資料夾

```
backend/
├── core/
│   ├── database.py
│   └── redis.py           ← 新增：大家共用的 Redis 連線
├── router/
│   └── search.py          ← 改：先看快取、看冷卻便利貼
└── worker/
    └── tasks.py           ← 改：新增太少就貼便利貼
```

### 4. 跟原專案對照

| 項目 | 原專案 | 我們 |
|---|---|---|
| 快取名稱 | `search:location:{地點}` | `search:{地點}` |
| 快取多久 | 1 天 | 1 小時（舊資料最多留 1 小時） |
| 便利貼 | `exhausted:location:{地點}`，新增不到 3 個時貼 1 天 | `exhausted:{地點}`，其他一樣 |
| 新增 0 個時 | **有 bug**：`redis_client` 只有在「有新增」時才建立，新增 0 個會出現 `UnboundLocalError`，便利貼沒貼成，還被當成暫時失敗、整個 AI 流程重跑 | 共用 `core/redis.py` 的連線，沒有這個問題 |
| worker 做完刪快取 | 有。原專案有「再找更多」按鈕，白板上有資料時也可能派 worker | 不需要：我們只在白板上沒有時才派 worker；萬一有舊的，1 小時後也會自動擦掉 |
| 包裝方式 | 另外寫了一個 `@redis_cache` decorator（給熱門搜尋用） | 兩個小函式 `read_cache`、`write_cache`，比較好讀 |
| Redis 連線設定 | `REDIS_HOST`、`REDIS_PORT`、`REDIS_PASSWORD` 三個變數 | 一個 `REDIS_URL` |

### 5. 常見踩雷

| 症狀 | 原因 | 解法 |
|---|---|---|
| `TypeError: Object of type datetime is not JSON serializable` | 直接 `json.dumps` 資料庫物件，或 `model_dump()` 沒加 `mode="json"` | 用 `model_dump(mode="json")` |
| 新增的景點搜不到 | 白板上是舊的（快取過期） | 等 1 小時，或 `DEL "search:地點"` |
| 搜「宮島」一直拿到空的 | 測試時的便利貼和空白結果還在 | `DEL "exhausted:宮島" "search:宮島"` |
| 便利貼沒作用，還是一直派 worker | 改了 `tasks.py` 沒重開 worker | 重開 worker |
| curl 回 `403`，uvicorn 的分頁寫的是別的資料夾（例如 `todo-app/backend`） | 8000 port 被**別的專案**佔走了，curl 打到的不是我們的後端（2026-10-27 你實際遇到） | 到那個專案的分頁 `Ctrl+C` 關掉，再到 `travel-scheduler/backend` 執行 `uv run uvicorn main:app --reload --port 8000`。啟動後先看第一行的資料夾對不對 |
| 啟動 uvicorn 時出現 `Address already in use` | 同上，8000 已經有人在用 | 同上 |
| `redis-cli GET` 看到 `\xe4\xba\xac` 這種東西 | redis-cli 預設把中文顯示成編碼 | 加 `--raw`：`redis-cli --raw GET "search:京都"` |
| 寫成 `if cached:` | 空的 list `[]` 會被當成「白板上沒寫」，空白結果永遠快取不到 | 用 `if cached is not None:` |

### 📌 這一段的 3 個重點

1. **Cache-Aside**：先看白板 → 沒有才查資料庫 → 抄上白板。白板只是加速用的，壞了照樣去倉庫查。
2. **TTL**：白板上的字會自動擦掉。資料庫變了白板不會知道，「最多舊 1 小時」是我們接受的代價。
3. **冷卻便利貼**：新增不到 3 個，就貼 `exhausted:{地點}` 1 天，免得每次搜都白跑一趟 AI。**失敗不貼**。

### 6. 小測驗

（提示：每題都可以用「如果不這樣做，會發生什麼壞事？」來想。）

1. 為什麼快取要設 TTL？不設會怎樣？
2. 如果沒有冷卻便利貼，一個網路上只有 1 篇文章的小鎮，每次被搜尋會發生什麼事？
3. Gemini 忙線、任務失敗了，要不要貼便利貼？為什麼？
4. Redis 掛掉時，搜「京都」和搜「宮島」各會怎樣？為什麼不一樣？

<details>
<summary>點開看解答</summary>

1. 不設的話，白板上的字永遠不會消失。資料庫之後新增了景點，白板永遠是舊的，使用者就永遠看不到新景點（步驟 17 ② 就是這個情況，只是我們手動擦掉了）。Redis 的記憶體也會越塞越滿。
2. 每次有人搜，資料庫都不到 5 個 → 每次都派 worker 跑 60 秒的 AI 流程 → 每次都只找到同樣那 1、2 個（甚至全部重複、新增 0 個）。白白花掉 Gemini 和 Google 的額度，使用者每次也都要等。
3. 不要。失敗是「這次沒做成」，是暫時的；便利貼的意思是「找過了，真的沒有更多」。失敗也貼的話，1 天內都不會再試，可是明明下一次可能就成功了。
4. 京都：照樣有結果。資料庫有 26 個（夠 5 個），讀寫快取失敗都被 `try/except` 接住，只是印警告。宮島：500。資料不夠，要查便利貼、要把單丟進訂單夾，這兩件事都需要 Redis。**快取是「有的話更好」，訂單夾是「沒有不行」。**

</details>

#### 你的實作紀錄（2026-10-27～28）

- 步驟 13～15 的三個檔案都正確（`search.py` 裡有一行被編輯器自動折成兩行，意思一樣）。
- **實際踩到的雷**：第一次跑步驟 17 ① 的 curl 回 `403`。原因是 8000 port 被另一個專案 `todo-app` 佔走了，travel-scheduler 的 uvicorn 根本沒開，curl 打到的是 todo-app。關掉之後，又在 todo-app 的分頁按 ↑ 把它開了回來（↑ 叫出的是**這個分頁**上一次的指令）。最後先 `cd` 到 `travel-scheduler/backend` 再啟動，就好了。
  - 怎麼看出來的：uvicorn 第一行 `Will watch for changes in these directories: [...]` 寫的是哪個資料夾；log 開頭是 `▕`（`fastapi dev` 的格式）而不是 `INFO:`。
- 快取測試亭有新增（編號 104），也刪乾淨了；宮島的便利貼和空白結果都清掉了。
- 檢查時打了你的伺服器兩次：0.013 秒 → 0.002 秒，`TTL search:京都` 是 3600。

小測驗這一段還沒作答，複習時可以先遮住解答自己試一次。
