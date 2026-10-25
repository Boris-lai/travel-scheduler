# 第 2 課：FastAPI 跑起來 ＋ 用 SQLAlchemy 建第一張表 ＋ 第一支 API

> **狀態**：✅ 完成（上半小測驗未作答）
> **日期**：2026-10-22
> **對照原專案**：`backend/main.py`、`backend/core/database.py`、`backend/db/schema.sql`

---

## 這一課在整個專案的位置

用餐廳來比喻：

- **第 1 課**：把倉庫（PostgreSQL）和櫃檯旁的小白板（Redis）搬進來。
- **第 2 課上半**：開櫃檯（FastAPI），請一位翻譯（SQLAlchemy），在倉庫裡放好第一個貨架（`destinations` 表）。
- **第 2 課下半**：讓櫃檯透過翻譯存取倉庫，客人就能「放景點進去」和「看有哪些景點」。

```
瀏覽器 ──→ FastAPI（櫃檯） ──→ SQLAlchemy（翻譯） ──→ PostgreSQL（倉庫）
```

---

## 上半：讓 FastAPI 跑起來，用 SQLAlchemy 建第一張表

### 1. 學到的觀念

#### 虛擬環境 ＝ 專案專用的工具箱

每個 Python 專案都有自己的工具箱，A 專案要新版套件、B 專案要舊版，彼此不會打架。

#### uv 一個工具全包

| 要做的事 | 傳統做法 | uv |
|---|---|---|
| 建虛擬環境 | `python3 -m venv .venv` | 自動建立 |
| 安裝套件 | `pip install ...` | `uv add ...` |
| 移除套件 | `pip uninstall ...` | `uv remove ...` |
| 記錄裝了什麼 | 手寫 `requirements.txt` | 自動寫進 `pyproject.toml` |
| 執行程式 | 先 `source .venv/bin/activate` | `uv run ...`，不用先啟動 |
| 換電腦裝回來 | `pip install -r requirements.txt` | `uv sync` |

| uv 產生的檔案 | 比喻 | 要不要放進 git |
|---|---|---|
| `pyproject.toml` | 購物清單：你要了哪些套件 | ✅ 要 |
| `uv.lock` | 收據：每個套件實際裝了哪個版本，連「套件需要的套件」都記下來 | ✅ 要 |
| `.venv/` | 工具箱本體：真正裝好的套件 | ❌ 不要，用 `uv sync` 就能照收據重建 |

#### 這一課裝的套件

| 套件 | 做什麼 |
|---|---|
| `fastapi` | 寫 API 的框架（櫃檯的規則） |
| `uvicorn` | 讓 FastAPI 真正跑起來、接收請求的伺服器（讓櫃檯開門營業） |
| `sqlalchemy` | ORM：讓你用 Python 操作資料庫（翻譯） |
| `psycopg` | SQLAlchemy 底層用來跟 PostgreSQL 溝通的驅動（翻譯拿來打電話的那支電話） |
| `python-dotenv` | 從 `.env` 讀取密碼等設定 |

#### API 的基本長相

```python
from fastapi import FastAPI

app = FastAPI()          # 開一間櫃檯


@app.get("/health")      # 開一個窗口：有人用 GET 敲 /health，就執行底下的函式
def health():
    return {"status": "ok"}   # 回傳 dict，FastAPI 自動轉成 JSON
```

- `@app.get(...)` 這種以 `@` 開頭、寫在函式上面的東西叫 **decorator（裝飾器）**，作用是把函式「掛」到某個網址上。
- `uvicorn main:app`：冒號左邊是**檔名**（不含 `.py`），右邊是檔案裡的**變數名**。
- `/docs`：FastAPI 自動產生的 API 測試頁，每寫一支 API 就會自動出現在這裡。

#### ORM 是什麼？

同一件事，「找出京都的所有景點」：

```python
# 直接寫 SQL（原專案的做法）
cur.execute("SELECT * FROM destinations WHERE city_name = %s", ("京都",))

# SQLAlchemy（我們的做法）：用 Python 寫，它幫你翻譯成 SQL
db.scalars(select(Destination).where(Destination.city_name == "京都")).all()
```

- 直接寫 SQL ＝ 你自己用倉庫的語言跟倉庫管理員講話。
- ORM ＝ 請一位翻譯，你講 Python，翻譯幫你轉成 SQL。
- 好處：不用到處寫 SQL 字串，欄位打錯字時編輯器會提醒你。
- 但翻譯出錯時，還是要看得懂 SQL 才查得出問題，所以我們開了 `echo=True`，讓翻譯把翻好的 SQL **念出來**給你看。

#### SQLAlchemy 的四個角色

| 角色 | 比喻 | 寫在哪 |
|---|---|---|
| **Engine** | 通往倉庫的專線，裡面自帶連線池 | `core/database.py` |
| **Session** | 一次對話／一台購物車：先 `add` 放進去，`commit` 才真的寫進倉庫 | `core/database.py`（下半課才用） |
| **Base** | 所有 Model 的祖先，負責記住「有哪些表」 | `core/database.py` |
| **Model** | 一個 class ＝ 一張表，一個屬性 ＝ 一個欄位 | `models.py` |

#### Model 寫法和 SQL 的對照

| Model 的寫法 | 翻譯成 SQL | 意思 |
|---|---|---|
| `__tablename__ = "destinations"` | `CREATE TABLE destinations` | 表名 |
| `mapped_column(primary_key=True)` | `SERIAL PRIMARY KEY` | 自動編號 1、2、3…，每一列的身分證號碼 |
| `Mapped[str]` | `NOT NULL` | 一定要有值 |
| `Mapped[str \| None]` | （可以是空的） | 可以不填 |
| `String(255)` | `VARCHAR(255)` | 最多 255 字的文字 |
| `Text` | `TEXT` | 不限長度的文字 |
| `unique=True` | `UNIQUE` | 不能重複 |
| `Numeric(10, 8)` | `NUMERIC(10, 8)` | 精確小數，總共 10 位數，其中 8 位在小數點後 |
| `DateTime(timezone=True)` | `TIMESTAMP WITH TIME ZONE` | 帶時區的時間 |
| `server_default=func.now()` | `DEFAULT now()` | 沒填就由資料庫自動填「現在」 |

#### `.env` 和 `DATABASE_URL`

密碼這種東西不寫死在程式裡，放在 `.env` 檔，而且 `.env` 不進 git。

```
postgresql+psycopg://travel:localdev@localhost:5433/travel_scheduler
└─ 資料庫 ┘└ 驅動 ┘  └帳號┘ └密碼─┘ └─主機──┘└port┘└─ 資料庫名稱 ─┘
```

帳號、密碼、資料庫名稱都是第 1 課在 `docker-compose.yml` 裡設定的；port 是 5433，因為第 1 課把 Mac 這邊的 port 設成 5433。

#### `create_all` 只會「建」，不會「改」

`Base.metadata.create_all(engine)` 會檢查每張表：**不存在就建，已經存在就跳過**。
所以之後如果在 Model 裡加了新欄位，再跑一次 `create_all`，資料庫裡的表**不會**多出那個欄位。
要修改已經存在的表，要用 **Alembic**（資料庫的版本控制工具），第 3 課加欄位時會學。

### 2. 實作步驟

#### 步驟 1–4 ✅ 已完成

```bash
cd ~/Desktop/travel-scheduler/backend
uv init --bare                                     # 步驟 1：建 uv 專案
uv add fastapi uvicorn "psycopg[binary]" python-dotenv   # 步驟 2：裝套件
# 步驟 3：在 travel-scheduler/ 最外層新增 .gitignore
# 步驟 4：新增 backend/main.py，啟動伺服器
uv run uvicorn main:app --reload --port 8000
#   → http://localhost:8000/health 和 http://localhost:8000/docs
```

`.gitignore`：

```
.venv/
__pycache__/
.env
```

#### 步驟 5：換套件，清掉舊檔案

原本是用 raw SQL 的計畫，現在改用 SQLAlchemy，所以：

```bash
cd ~/Desktop/travel-scheduler/backend
uv remove psycopg-pool          # SQLAlchemy 自帶連線池，不需要它了
uv add sqlalchemy
rm -r db                        # 刪掉 db/schema.sql，表改由 Python Model 來建
```

#### 步驟 6：新增 `backend/.env`

```
DATABASE_URL=postgresql+psycopg://travel:localdev@localhost:5433/travel_scheduler
```

#### 步驟 7：新增 `backend/core/database.py`

```python
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# echo=True：學習用，把 SQLAlchemy 翻譯出來的 SQL 印在終端機
engine = create_engine(DATABASE_URL, echo=True)
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass
```

#### 步驟 8：新增 `backend/models.py`

```python
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class Destination(Base):
    __tablename__ = "destinations"

    id: Mapped[int] = mapped_column(primary_key=True)
    place_name: Mapped[str] = mapped_column(String(255))
    city_name: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    address: Mapped[str | None] = mapped_column(String(255))
    google_place_id: Mapped[str | None] = mapped_column(String(255), unique=True)
    lat: Mapped[Decimal | None] = mapped_column(Numeric(10, 8))
    lng: Mapped[Decimal | None] = mapped_column(Numeric(11, 8))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

#### 步驟 9：新增 `backend/create_tables.py`，執行它

```python
import models  # noqa: F401  ← 一定要 import，Base 才會認識 Destination
from core.database import Base, engine

Base.metadata.create_all(engine)
print("✅ 資料表建立完成")
```

```bash
cd ~/Desktop/travel-scheduler/backend
uv run python create_tables.py
```

因為開了 `echo=True`，你會看到翻譯念出來的 SQL，其中一段長這樣：

```sql
CREATE TABLE destinations (
	id SERIAL NOT NULL,
	place_name VARCHAR(255) NOT NULL,
	city_name VARCHAR(100),
	description TEXT,
	address VARCHAR(255),
	google_place_id VARCHAR(255),
	lat NUMERIC(10, 8),
	lng NUMERIC(11, 8),
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (id),
	UNIQUE (google_place_id)
)
```

最後確認表真的建好了：

```bash
cd ~/Desktop/travel-scheduler
docker compose exec db psql -U travel -d travel_scheduler -c "\d destinations"
```

#### 拆解這個指令

把它想成：**走進倉庫 → 叫倉庫管理員 → 報上身分 → 指定哪間倉庫 → 交代一件事就離開。**

| 片段 | 意思 | 比喻 |
|---|---|---|
| `docker compose` | 用 `docker-compose.yml` 管理的那群 container | — |
| `exec` | 在**正在跑**的 container 裡執行指令 | 走進去 |
| `db` | 哪個 container，就是 `docker-compose.yml` 裡取的名字 | 走進倉庫 |
| `psql` | PostgreSQL 的指令列工具，裝在 container 裡，Mac 不用另外裝 | 叫倉庫管理員 |
| `-U travel` | 用哪個帳號登入（User） | 報上身分 |
| `-d travel_scheduler` | 連哪個資料庫（database） | 指定哪間倉庫 |
| `-c "..."` | 只執行這一個指令就離開（command）。不加 `-c` 會進入互動模式，可以一直打指令，打 `\q` 離開 | 交代一件事就走 |
| `\d destinations` | 顯示這張表的結構（describe） | 「把這個貨架的規格拿給我看」 |

**反斜線 `\` 開頭的是 psql 自己的快捷指令，不是 SQL。** 常用的幾個：

| 指令 | 做什麼 |
|---|---|
| `\dt` | 列出所有表 |
| `\d 表名` | 看某張表的欄位和索引 |
| `\q` | 離開互動模式 |

#### 看懂輸出

```
     Column      |           Type           | Nullable |                 Default
-----------------+--------------------------+----------+------------------------------------------
 id              | integer                  | not null | nextval('destinations_id_seq'::regclass)
 place_name      | character varying(255)   | not null |
 city_name       | character varying(100)   |          |
 ...
 created_at      | timestamp with time zone | not null | now()
Indexes:
    "destinations_pkey" PRIMARY KEY, btree (id)
    "destinations_google_place_id_key" UNIQUE CONSTRAINT, btree (google_place_id)
```

| 欄 | 意思 | 對回 Model |
|---|---|---|
| **Type** | 欄位型別，`character varying` 就是 `VARCHAR` 的全名 | `String(255)` |
| **Nullable** | `not null` ＝ 一定要有值；空白 ＝ 可以不填 | `Mapped[str]` 或 `Mapped[str \| None]` |
| **Default** | 沒填時自動填什麼 | `server_default=func.now()` |
| **Indexes** | 索引和限制 | `primary_key=True`、`unique=True` |

`id` 的預設值 `nextval('destinations_id_seq')` 就是 `SERIAL` 自動編號的真面目：PostgreSQL 另外建了一個**號碼機**（sequence），每新增一列就抽一張號碼牌。

### 3. 這半課結束後的資料夾

```
travel-scheduler/
├── .gitignore
├── docker-compose.yml        ← 第 1 課
├── docs/                     ← 教學日誌
└── backend/
    ├── .env                  ← 不進 git
    ├── .venv/                ← 不進 git
    ├── pyproject.toml
    ├── uv.lock
    ├── main.py
    ├── models.py
    ├── create_tables.py
    └── core/
        └── database.py
```

### 4. 跟原專案對照

| 項目 | 原專案 | 我們 |
|---|---|---|
| 套件管理 | `requirements.txt` ＋ pip | `pyproject.toml` ＋ `uv.lock` ＋ uv |
| 資料庫 | MySQL | PostgreSQL |
| 存取資料庫 | 直接寫 SQL（`pymysql`） | SQLAlchemy ORM |
| 連線池 | `DBUtils` 的 `PooledDB(...)` | `create_engine(...)` 自帶 |
| 建表 | 手寫 `db/schema.sql` | Python Model ＋ `create_all` |
| 連線設定 | `DB_HOST`、`DB_USER`… 分成好幾個環境變數 | 一條 `DATABASE_URL` |

原專案的 `requirements.txt` 其實有列 `sqlalchemy`，但程式裡沒用到。作者在 `docs/async_db_refactor_plan.md` 把「改用 SQLAlchemy」列為未來的重構計畫，我們等於直接從那一步開始。

原專案 `destinations` 還有 `input_region`、`geo_tags`、`source`、`updated_at`，**第 3 課**做 AI 爬蟲用到時再加。

### 5. 常見踩雷

| 症狀 | 原因 | 解法 |
|---|---|---|
| `Could not import module "main"`、`Failed to spawn: uvicorn`、`No module named 'core'` | 不是在 `backend/` 裡執行 | 先 `cd ~/Desktop/travel-scheduler/backend` |
| `[Errno 48] Address already in use` | 8000 port 被佔用，通常是上次的伺服器沒關 | 回到那個分頁按 `Ctrl+C`，再重新啟動 |
| `ArgumentError: Expected string or URL object, got None` | 讀不到 `DATABASE_URL`：`.env` 位置不對或變數名打錯 | 確認 `.env` 在 `backend/` 裡，名稱是 `DATABASE_URL` |
| `OperationalError ... port 5433 failed ... Connection refused` | 資料庫沒在跑 | 開 Docker Desktop，在 `travel-scheduler/` 執行 `docker compose up -d` |
| `create_tables.py` 執行成功，但 `\d destinations` 說找不到表 | 忘了 `import models`，Base 不知道有這張表 | 在 `create_tables.py` 最上面加 `import models` |
| 改了 Model 再跑 `create_tables.py`，表卻沒變 | `create_all` 只建不存在的表，不會改已存在的表 | 第 3 課用 Alembic 處理 |

### 6. 小測驗

1. 為什麼 `google_place_id` 要設 `unique=True`？如果不設，AI 爬蟲跑兩次同一個城市會發生什麼事？
2. `Mapped[str]` 和 `Mapped[str | None]` 建出來的欄位差在哪裡？
3. 如果把 `create_tables.py` 裡的 `import models` 拿掉，會發生什麼事？為什麼？
4. `pyproject.toml` 和 `uv.lock` 都在記錄套件，兩個差在哪裡？

<details>
<summary>點開看解答</summary>

1. `unique=True` 讓**資料庫自己幫你擋重複**：同一個 Google 景點只能存一次。不設的話，爬蟲每跑一次同一個城市，同一個景點（例如清水寺）就會多存一筆，搜尋結果會出現好幾個一模一樣的景點。
2. `Mapped[str]` 會變成 `NOT NULL`，一定要有值；`Mapped[str | None]` 允許空值，可以不填。
3. 程式會正常跑完、印出「✅ 資料表建立完成」，但**一張表都沒建**。因為 `Destination` 這個 class 要被 import 才會執行到，執行到了才會向 `Base` 登記「我是一張表」。沒 import，`Base` 的名單就是空的。
4. `pyproject.toml` 只記錄**你直接要的套件**和最低版本（例如 `fastapi>=0.159.1`）；`uv.lock` 記錄**實際安裝的精確版本**，還包括間接需要的套件（例如 fastapi 底下用到的 pydantic、starlette）。有 `uv.lock`，每台電腦裝出來才會一模一樣。

</details>

---

## 下半：連上資料庫，寫第一支 API

### 1. 學到的觀念

#### 一個請求的旅程

客人送出「新增景點」時，會依序經過這些關卡：

```
客人：POST /api/destinations，附上景點資料
  │
  ├─ ① FastAPI 用 DestinationCreate 檢查資料格式 ── 不合格 → 422
  ├─ ② get_db 借出一個 Session
  ├─ ③ db.add()：把景點放進購物車
  ├─ ④ db.commit()：真正寫進資料庫 ────────────── 重複 → 409
  ├─ ⑤ db.refresh()：拿回資料庫產生的 id、created_at
  ├─ ⑥ FastAPI 用 DestinationOut 整理成 JSON 回給客人 → 201
  └─ ⑦ get_db 歸還 Session
```

#### Model 和 Schema：同一個景點的三種「單據」

| | 描述什麼 | 比喻 | 寫在哪 |
|---|---|---|---|
| **Model** | 資料庫裡的表長什麼樣 | 倉庫貨架的規格 | `models.py` 的 `Destination` |
| **輸入 Schema** | 客人送來的資料要長什麼樣 | 點餐單 | `DestinationCreate` |
| **輸出 Schema** | 回給客人的資料長什麼樣 | 出餐單 | `DestinationOut` |

**為什麼輸入和輸出要分開？**

- 客人不能自己決定 `id` 和 `created_at`，那是資料庫產生的，所以點餐單上**沒有**這兩欄。
- 出餐單可以把不想給人看的欄位藏起來。例如第 6 課的 `users` 表有密碼，就絕對不能放進出餐單。

Schema 用的是 **Pydantic**，FastAPI 會自動拿它檢查客人送來的資料：名字是空的、緯度超過 90，都會直接回 **422**，根本進不到你的函式裡。

#### `Depends(get_db)`：每個請求借一個 Session，用完歸還

```python
def get_db():
    db = SessionLocal()   # 借出
    try:
        yield db          # 交給 API 函式使用，等它做完
    finally:
        db.close()        # 不管成功還是出錯，都一定歸還
```

API 函式只要在參數寫 `db: Session = Depends(get_db)`，FastAPI 就會自動幫你借、用完自動還。這叫 **依賴注入（Dependency Injection）**。

#### Session 三步驟：`add` → `commit` → `refresh`

| 步驟 | 做什麼 | 比喻 |
|---|---|---|
| `db.add(destination)` | 放進 Session，**還沒**寫進資料庫 | 放進購物車 |
| `db.commit()` | 真正寫進資料庫 | 結帳 |
| `db.refresh(destination)` | 從資料庫讀回最新資料（拿到 `id`、`created_at`） | 拿收據 |

#### `**payload.model_dump()` 是什麼？

```python
payload.model_dump()
# → {"place_name": "清水寺", "city_name": "京都", ...}

Destination(**payload.model_dump())
# 等於 Destination(place_name="清水寺", city_name="京都", ...)
```

`model_dump()` 把 Schema 轉成 dict，`**` 再把 dict 拆開，變成一個一個 `名字=值` 傳進去。

#### HTTP 方法和狀態碼

| 方法 | 意思 |
|---|---|
| `GET` | 拿資料 |
| `POST` | 新增資料 |

| 狀態碼 | 意思 | 這一課什麼時候會看到 |
|---|---|---|
| **200** OK | 成功 | 列出景點 |
| **201** Created | 成功新增 | 新增景點 |
| **409** Conflict | 跟現有資料衝突 | `google_place_id` 重複 |
| **422** Unprocessable | 資料格式不對 | 名字是空的、緯度超過 90 |
| **500** Internal Server Error | 伺服器自己出錯（程式有 bug） | 不應該出現 |

#### router 和 `main.py`

- `main.py` 是**總機**。
- `router/` 裡每個檔案是一個**部門窗口**，例如 `router/destinations.py` 專門處理景點。
- `app.include_router(...)` 把部門接上總機。

專案越長越大時，API 不會全部擠在 `main.py` 裡。原專案也是這樣分。

### 2. 實作步驟

開始前，確認第 1 個終端機分頁的伺服器還開著（`uv run uvicorn main:app --reload --port 8000`）。有 `--reload`，存檔就會自動重啟。

#### 步驟 10：在 `backend/core/database.py` 最下面加上 `get_db`

```python
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

#### 步驟 11：新增 `backend/schemas/destination.py`

```python
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# 點餐單：客人新增景點時要送來的資料
class DestinationCreate(BaseModel):
    place_name: str = Field(min_length=1, max_length=255)
    city_name: str | None = None
    description: str | None = None
    address: str | None = None
    google_place_id: str | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)


# 出餐單：回給客人的景點資料
class DestinationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    place_name: str
    city_name: str | None
    description: str | None
    address: str | None
    google_place_id: str | None
    lat: float | None
    lng: float | None
    created_at: datetime
```

| 寫法 | 意思 |
|---|---|
| `Field(min_length=1, max_length=255)` | 文字長度 1 到 255 |
| `= None` | 可以不填，沒填就是 `None` |
| `Field(ge=-90, le=90)` | 數字要 ≥ -90 且 ≤ 90（ge = greater or equal，le = less or equal） |
| `from_attributes=True` | 讓 Pydantic 可以直接讀 SQLAlchemy 物件的屬性（`destination.id`），而不只讀 dict |

#### 步驟 12：新增 `backend/router/destinations.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.database import get_db
from models import Destination
from schemas.destination import DestinationCreate, DestinationOut

router = APIRouter()


@router.post("/api/destinations", response_model=DestinationOut, status_code=201)
def create_destination(payload: DestinationCreate, db: Session = Depends(get_db)):
    destination = Destination(**payload.model_dump())
    db.add(destination)
    try:
        db.commit()
    except IntegrityError:
        # 違反資料庫的限制（這裡是 google_place_id 重複）
        db.rollback()
        raise HTTPException(status_code=409, detail="這個景點已經存在")
    db.refresh(destination)
    return destination


@router.get("/api/destinations", response_model=list[DestinationOut])
def list_destinations(db: Session = Depends(get_db)):
    return db.scalars(select(Destination).order_by(Destination.id)).all()
```

| 寫法 | 意思 |
|---|---|
| `payload: DestinationCreate` | 客人送來的 JSON，FastAPI 會先用點餐單檢查 |
| `response_model=DestinationOut` | 回傳前用出餐單整理 |
| `status_code=201` | 成功時回 201，不是預設的 200 |
| `IntegrityError` | 資料庫說「這違反了我的規定」，例如 `UNIQUE` |
| `db.rollback()` | 結帳失敗，把購物車清空，Session 才能繼續用 |
| `select(Destination).order_by(Destination.id)` | 翻成 SQL：`SELECT * FROM destinations ORDER BY id` |
| `db.scalars(...).all()` | 執行查詢，拿回一串 `Destination` 物件 |

#### 步驟 13：在 `backend/main.py` 接上 router

```python
from fastapi import FastAPI

from router import destinations

app = FastAPI()

app.include_router(destinations.router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

#### 步驟 14：在 `/docs` 親手測試

打開 http://localhost:8000/docs，應該會看到兩支新的 API。
測試方法：點開 API → 按 **Try it out** → 填資料 → 按 **Execute** → 往下看 **Response**。

依照順序做這 6 個測試：

| # | API | 送出的資料 | 預期結果 |
|---|---|---|---|
| 1 | `POST` | 下方的清水寺 JSON | **201**，回傳裡有 `id` 和 `created_at` |
| 2 | `GET` | （不用填） | **200**，列表裡有清水寺 |
| 3 | `POST` | 再送一次清水寺（完全一樣） | **409**，`這個景點已經存在` |
| 4 | `POST` | `{"place_name": ""}` | **422**，名字太短 |
| 5 | `POST` | `{"place_name": "測試", "lat": 999}` | **422**，緯度超過 90 |
| 6 | `POST` | `{"place_name": "伏見稻荷大社", "city_name": "京都"}` | **201**，只填名字也可以。注意看它的 `id` 是多少 |

清水寺 JSON：

```json
{
  "place_name": "清水寺",
  "city_name": "京都",
  "description": "京都最有名的寺廟之一",
  "google_place_id": "test-kiyomizu",
  "lat": 34.9948561,
  "lng": 135.7850463
}
```

測試時順便看一下跑伺服器的那個終端機分頁，`echo=True` 會讓你看到每個請求被翻譯成的 `INSERT`、`SELECT`。

#### 步驟 15：直接去資料庫確認

```bash
cd ~/Desktop/travel-scheduler
docker compose exec db psql -U travel -d travel_scheduler -c "SELECT id, place_name, city_name FROM destinations;"
```

### 3. 這一課結束後的資料夾

```
backend/
├── .env
├── pyproject.toml
├── uv.lock
├── main.py                  ← 總機，接上 router
├── models.py                ← 貨架規格（Model）
├── create_tables.py
├── core/
│   └── database.py          ← Engine、Base、get_db
├── schemas/
│   └── destination.py       ← 點餐單、出餐單（Schema）
└── router/
    └── destinations.py      ← 景點部門的窗口（API）
```

### 4. 跟原專案對照

| 項目 | 原專案 | 我們 |
|---|---|---|
| 借資料庫連線 | `get_conn` ／ `get_cur`（`core/database.py`） | `get_db`（`core/database.py`） |
| 什麼時候 commit | 在 `get_conn` 裡，API 正常結束就自動 commit | 在 API 函式裡自己 `db.commit()` |
| 新增一筆 | `cur.execute("INSERT INTO ...")` | `db.add(Destination(...))` ＋ `db.commit()` |
| 拿到新的 id | `cur.lastrowid` | `db.refresh(destination)` 後讀 `destination.id` |
| 輸入輸出格式 | `schemas/*.py`（Pydantic） | 一樣 |
| API 分檔 | `router/*.py` ＋ `main.py` 的 `include_router` | 一樣 |

原專案**沒有**「手動新增景點」的 API，景點都是 AI 背景任務透過 `repositories/destination_repo.py` 的 `save_spot_data` 寫進去的。我們先做手動版，是為了學會「怎麼把資料寫進資料庫」。第 3 課換成 AI 來寫，用的是同一套 `add` → `commit`。

### 5. 常見踩雷

| 症狀 | 原因 | 解法 |
|---|---|---|
| `/docs` 沒看到新的 API | 忘了在 `main.py` 寫 `include_router` | 加上步驟 13 的程式碼 |
| `No module named 'router'` 或 `'schemas'` | 資料夾名稱打錯，或不是在 `backend/` 裡啟動伺服器 | 檢查資料夾名稱，在 `backend/` 裡啟動 |
| 重複新增時拿到 **500** 而不是 409 | 沒有 `try/except IntegrityError` | 照步驟 12 加上 |
| 422 的訊息看不懂 | — | 看 `detail` 裡的 `loc`（哪個欄位出錯）和 `msg`（錯在哪） |
| 新增後 `id` 跳號，例如 1 之後直接是 3 | 失敗的新增也抽走了號碼牌，號碼機不會收回 | 正常現象，不用修 |
| 伺服器終端機一直印出 SQL | `echo=True` | 正常，學習用。正式環境會關掉 |

### 6. 小測驗

1. 為什麼要分 `DestinationCreate` 和 `DestinationOut`，不能共用一個？
2. `db.commit()` 之後為什麼還要 `db.refresh(destination)`？
3. 如果把 `try/except IntegrityError` 拿掉，重複新增時客人會收到什麼？
4. 觀察題：照步驟 14 的順序測試，第 6 個測試的伏見稻荷大社 `id` 是多少？為什麼不是 2？

<details>
<summary>點開看解答</summary>

1. 客人不該自己決定 `id` 和 `created_at`，這兩個由資料庫產生，所以點餐單沒有這兩欄，出餐單才有。分開也讓你能控制「哪些欄位可以給人看」，例如之後的密碼欄位絕對不能出現在出餐單上。
2. `id` 和 `created_at` 是資料庫在寫入當下才產生的，Python 這邊的 `destination` 物件原本不知道它們的值。另外，`commit` 之後 SQLAlchemy 會把物件上的資料標成「過期」。`refresh` 就是立刻回資料庫把這筆資料重新讀一次，確保回傳時出餐單上的每一欄都是齊的。
3. 會收到 **500 Internal Server Error**。資料庫拒絕寫入、丟出 `IntegrityError`，沒人接住，FastAPI 只好回「伺服器出錯」。但這其實不是伺服器的 bug，是客人送了重複的資料，所以應該接住它、回 **409**，告訴客人「這個已經存在」。
4. **不會是 2**。照步驟 14 的順序是 3；如果中間也做了下方的加碼實驗，又多抽走一張，就是 4。原因是每次新增失敗時，在資料庫發現重複之前，號碼機就已經發出號碼牌了。**號碼機發出去的號碼不會收回**，所以那些號碼就這樣空著。這是 PostgreSQL 刻意的設計：收回號碼需要讓所有人排隊等，會拖慢速度。

</details>

#### 你的作答（2026-10-23）

**Q1. 為什麼要分 `DestinationCreate` 和 `DestinationOut`？**
- 你的答案：因為訪客無法自訂 id 跟 created_at。 ✅
- 補充：另一個原因是出餐單可以藏起不想給人看的欄位，例如第 6 課的密碼。

**Q2. `commit` 之後為什麼還要 `refresh`？**
- 你的答案：不知，類似重新整理的概念？ 🔶 方向對了
- 正解：就是「重新整理」。`id` 和 `created_at` 是資料庫寫入時才產生的，`refresh` 回資料庫把這筆資料重讀一次，物件上才有這兩個值。

**Q3. 拿掉 `try/except IntegrityError`，重複新增時客人會收到什麼？**
- 你的答案：會有兩筆重複資料。 ❌
- 正解：**不會有兩筆**，客人會收到 **500**。這題的關鍵是分清楚兩件事由誰負責：

| 工作 | 誰負責 | 寫在哪 |
|---|---|---|
| 擋下重複的資料 | **資料庫**的 `UNIQUE` 限制 | `models.py` 的 `unique=True` |
| 告訴客人「為什麼失敗」 | **API 程式**的 `try/except` | `router/destinations.py` |

用餐廳比喻：倉庫管理員看到重複的貨就拒收，這件事**不管櫃檯有沒有準備都會發生**。`try/except` 只是櫃檯有沒有準備好跟客人解釋的話。沒準備的話，櫃檯只能回「我們這邊出錯了」（500），客人不知道其實是自己送了重複的資料。

**Q4. 伏見稻荷大社的 `id` 是多少？為什麼不是 2？**
- 你的觀察：`id` 是 4。 ✅（也做完了加碼實驗）
- 解釋：兩次失敗的新增各抽走了一張號碼牌。

| 號碼牌 | 發生什麼事 | 結果 |
|---|---|---|
| 1 | 測試 1：新增清水寺 | ✅ 寫入 |
| 2 | 測試 3：重複的清水寺 | ❌ 409，號碼牌作廢 |
| 3 | 加碼實驗：拿掉 `try/except` 再送一次 | ❌ 500，號碼牌作廢 |
| 4 | 測試 6：新增伏見稻荷大社 | ✅ 寫入 |

加碼實驗也證實了 Q3 的正解：拿到 500 之後，資料庫裡還是只有一筆清水寺。

#### 加碼實驗：親眼看 Q3 的答案

1. 先照步驟 14 做**測試 3**（送重複的清水寺），應該拿到 409。
2. 把 `router/destinations.py` 的 `try/except` 暫時改成這樣，存檔：

   ```python
   db.add(destination)
   db.commit()
   db.refresh(destination)
   return destination
   ```

3. 再送一次清水寺，這次會拿到 **500**；伺服器終端機會印出一大段紅字，最後一行是 `IntegrityError ... duplicate key value violates unique constraint`。
4. 用步驟 15 的指令查資料庫：**還是只有一筆清水寺**。資料庫照樣擋下來了。
5. 把 `try/except` 改回原本的樣子，存檔。
6. 做**測試 6**（伏見稻荷大社），看它的 `id`，回答 Q4。
