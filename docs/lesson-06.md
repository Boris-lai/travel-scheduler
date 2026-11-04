# 第 6 課：行程後端（行程、景點池、每日行程 API）

> **狀態**：✅ 完成（上半 行程 ／ 中半 景點池 ／ 下半 每日行程 ／ 收尾 存檔順序和時間）
> **日期**：2026-11-01 ～ 2026-11-04
> **對照原專案**：`backend/db/schema.sql`（`trips`、`trip_places`、`itinerary_items`）、`backend/router/trips.py`、`backend/router/itinerary.py`、`backend/schemas/trip.py`、`backend/schemas/itinerary.py`

---

## 這一課在整個專案的位置

第 5 課做出了搜尋頁，可以找到景點了。這一課要讓使用者把景點**排成行程**。這一課只做後端的資料表和 API，第 7 課再做可以拖拉的畫面。

又回到 Python 了，寫法跟第 2、3 課很像。

把一個行程想成一本**旅遊手帳**：

| 旅遊手帳 | 資料表 | 哪一段 |
|---|---|---|
| 封面：標題、玩幾天、哪天出發 | `trips`（行程） | **上** |
| 最後一頁的「想去清單」：還沒決定哪一天去 | `trip_places`（景點池） | 中 |
| 每一天那一頁：依照順序寫要去的景點、幾點到 | `itinerary_items`（每日行程） | 下 |

```
trips（行程）
 ├── trip_places（景點池）─────────┐
 └── itinerary_items（每日行程）───┤
                                   ↓
                     destinations（景點，第 2、3 課做的）
```

原專案還有兩張表：`trip_days`（每一天的日期）我們不做，原因在下面；`itinerary_legs`（兩個景點之間的交通時間）等第 7 課做地圖時再加。

---

## 上半：行程（trips）

### 開始前的測試結果（2026-11-01）

我先在另一份複製的後端和資料庫測過，你的資料都沒動到：

| 測試 | 結果 |
|---|---|
| 建立行程（有出發日、沒有出發日） | 都是 `201` |
| `days` 填 0、標題空白、日期寫成 `12/20` | 都是 `422`，被 Pydantic 擋下 |
| 列出全部、查一筆 | `200`，列表新的排在前面 |
| 查不存在的行程、同一筆刪兩次 | `404` |
| 刪除 | `204` |
| Alembic 自動產生的施工單 | 只偵測到「新增 `trips` 表」，內容正確 |
| 實驗：`downgrade -1` 再 `upgrade head` | 表整個不見、資料也一起不見；升回來是一張空表 |

### 1. 學到的觀念

#### 能算出來的，就不要另外存

原專案有一張 `trip_days` 表，建立行程時，每一天存一筆日期。但是：

```
第幾天的日期 ＝ 出發日 ＋（第幾天 − 1）
```

隨時都算得出來。如果另外存一份，之後改出發日時，就要記得兩邊一起改；忘了改，兩邊就對不起來了。所以我們不做 `trip_days`，只存「出發日」和「玩幾天」。

#### 狀態碼：複習，加一個新的

| 狀態碼 | 意思 | 這一段哪裡用到 |
|---|---|---|
| `201 Created` | 新增成功（第 2 課用過） | 建立行程 |
| **`204 No Content`** | **成功了，但沒有內容要回** | 刪除行程 |
| `404 Not Found` | 找不到 | 查、刪不存在的行程 |
| `422` | 送來的資料不合格 | Pydantic 擋下的時候 |

#### 共用的小函式：`get_trip_or_404`

「用 id 找行程，找不到就回 404」這件事，查一筆要做、刪除要做；中半、下半的景點池和每日行程，每一支 API 也都要先確認行程存在。所以寫成一個函式，大家共用。

函式裡用 `raise HTTPException(...)`：一 `raise`，整支 API 就直接中斷、回 404，後面的程式都不會執行。

#### Alembic 第三次：這次是建一張新表

第 3 課的兩張施工單，一張**建** `destinations` 表，一張**加欄位**。這次是第三張：**建** `trips` 表。Alembic 不是只會加欄位，建表、刪表也都是它在做。選做實驗會讓你看到：退回施工單時，它會把整張表刪掉。

### 2. 實作步驟

這一課的指令都在 `backend` 資料夾執行：

```bash
cd ~/Desktop/travel-scheduler/backend
```

#### 步驟 1：`models.py` 加上 `Trip`

最上面的兩行 `import` 改成：

```python
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Integer, Numeric, String, Text, func
```

檔案最下面（`Destination` 的後面）加上：

```python
class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(100))
    days: Mapped[int] = mapped_column(Integer)  # 總共幾天
    start_date: Mapped[date | None] = mapped_column(Date)  # 出發日，可以不填
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

| 寫法 | 意思 |
|---|---|
| `Mapped[date \| None]` ＋ `Date` | 只有日期（年月日），沒有時間。`None` 代表可以不填 |
| `Integer` | 整數 |
| 沒有寫 `\| None` 的欄位 | 一定要有值（資料庫裡是 `NOT NULL`） |

#### 步驟 2：產生施工單，然後執行

```bash
uv run alembic revision --autogenerate -m "create trips table"
```

輸出裡要看到 `Detected added table 'trips'`。打開 `alembic/versions/` 裡新出現的 `xxxx_create_trips_table.py`（`xxxx` 是亂數，每個人都不一樣），`upgrade()` 裡應該是：

```python
    op.create_table('trips',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=100), nullable=False),
    sa.Column('days', sa.Integer(), nullable=False),
    sa.Column('start_date', sa.Date(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
```

確認沒問題，就執行施工單，再看看資料庫裡的表：

```bash
uv run alembic upgrade head
docker compose exec db psql -U travel -d travel_scheduler -c "\d trips"
```

`docker compose` 會自己往上層資料夾找設定檔，所以在 `backend` 裡執行也可以。

#### 步驟 3：新增 `schemas/trip.py`

```python
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


# 點餐單：建立行程時要送來的資料
class TripCreate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    days: int = Field(ge=1, le=60)
    start_date: date | None = None


# 出餐單：回給客人的行程資料
class TripOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    days: int
    start_date: date | None
    created_at: datetime
```

`start_date: date | None = None`：前端送 `"2026-12-20"` 這種文字，Pydantic 會幫你轉成日期；不送就是 `None`。

#### 步驟 4：新增 `router/trips.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from core.database import get_db
from models import Trip
from schemas.trip import TripCreate, TripOut

router = APIRouter()


def get_trip_or_404(db: Session, trip_id: int) -> Trip:
    """用 id 找行程，找不到就直接回 404。之後景點池、每日行程也會用到"""
    trip = db.get(Trip, trip_id)
    if trip is None:
        raise HTTPException(status_code=404, detail="找不到這個行程")
    return trip


@router.post("/api/trips", response_model=TripOut, status_code=201)
def create_trip(payload: TripCreate, db: Session = Depends(get_db)):
    trip = Trip(**payload.model_dump())
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


@router.get("/api/trips", response_model=list[TripOut])
def list_trips(db: Session = Depends(get_db)):
    # 還沒有登入功能，先列出全部的行程（第 8 課改成只列自己的）
    return db.scalars(select(Trip).order_by(Trip.id.desc())).all()


@router.get("/api/trips/{trip_id}", response_model=TripOut)
def get_trip(trip_id: int, db: Session = Depends(get_db)):
    return get_trip_or_404(db, trip_id)


@router.delete("/api/trips/{trip_id}", status_code=204)
def delete_trip(trip_id: int, db: Session = Depends(get_db)):
    trip = get_trip_or_404(db, trip_id)
    db.delete(trip)
    db.commit()
```

| 寫法 | 意思 |
|---|---|
| `db.get(Trip, trip_id)` | 用主鍵（id）找一筆，找不到回 `None`。只用 id 找的時候，比 `select(...).where(...)` 短 |
| `-> Trip` | 這個函式會回傳一個 `Trip`。寫給人和編輯器看的提示 |
| `order_by(Trip.id.desc())` | `desc` 是由大到小，新的行程排在前面 |
| `status_code=204` ＋ 沒有 `return` | 刪除成功，不回任何內容 |
| `db.delete(trip)` | 刪掉這一筆，`commit` 之後才真的寫進資料庫 |

#### 步驟 5：`main.py` 掛上新的 router

整個檔案換成：

```python
from fastapi import FastAPI
from router import destinations, search, trips

app = FastAPI()

app.include_router(destinations.router)
app.include_router(search.router)
app.include_router(trips.router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

#### 步驟 6：測試

uvicorn 會自己重開。打開 http://localhost:8000/docs ，會多出 4 支 `/api/trips` 的 API。

1. `POST /api/trips` 送 `{"title": "京都三日遊", "days": 3, "start_date": "2026-12-20"}` → `201`。**記下回傳的 `id`**，中半會用到。
2. 再送 `{"title": "大阪隨便走", "days": 2}`（不填出發日）→ `201`，`start_date` 是 `null`。
3. 故意送錯：`days` 填 `0`、`title` 填 `""`、`start_date` 填 `"12/20"` → 都是 `422`，看看錯誤訊息怎麼說。
4. `GET /api/trips` → 兩筆，大阪排在前面。`GET /api/trips/{京都的 id}` → 一筆。`GET /api/trips/999` → `404`。
5. `DELETE /api/trips/{大阪的 id}` → `204`。同一個 id 再刪一次 → `404`。
6. **實驗（選做）：Alembic 退回去會怎樣？**

   ```bash
   uv run alembic downgrade -1
   docker compose exec db psql -U travel -d travel_scheduler -c "\dt"
   ```

   `trips` 表不見了。再升回來，看看裡面還剩幾筆：

   ```bash
   uv run alembic upgrade head
   docker compose exec db psql -U travel -d travel_scheduler -c "SELECT count(*) FROM trips;"
   ```

   是 `0`：退回時，連資料一起刪掉了。做完這個實驗，記得用第 1 點**重新建一次「京都三日遊」**。

### 3. 這一段結束後的資料夾

```
backend/
├── alembic/versions/
│   └── xxxx_create_trips_table.py   ← 新增（Alembic 產生的）
├── models.py                        ← 改：加上 Trip
├── main.py                          ← 改：掛上 trips 的 router
├── router/
│   └── trips.py                     ← 新增
└── schemas/
    └── trip.py                      ← 新增
```

### 4. 跟原專案對照

| 項目 | 原專案 | 我們 |
|---|---|---|
| `trips` 的欄位 | 還有 `user_id`、`edit_token`、`share_token`、`cover_url`、`is_public` | 先只有標題、天數、出發日、建立時間。登入和分享要用的欄位，第 8 課再用 Alembic 加 |
| 每一天的資料 | `trip_days` 表，建立行程時一天存一筆 | 不建，日期用算的 |
| 回傳的 id 叫什麼 | `trip_id` | `id`，跟 `destinations` 一致 |
| 列出行程 | 只列出登入者自己的 | 還沒有登入，先列全部（第 8 課再改） |
| 刪除成功時 | 回 `200` 和 `{"ok": true}` | 回 `204`，沒有內容 |
| 寫法 | 直接寫 SQL | SQLAlchemy ORM |

### 5. 常見踩雷

| 症狀 | 原因 | 解法 |
|---|---|---|
| `autogenerate` 沒偵測到 `trips`（`No changes in schema detected`） | `models.py` 沒存檔，或 `Trip` 忘了寫 `(Base)` | 存檔、檢查 `class Trip(Base):` |
| `error: Failed to spawn: alembic` | 不在 `backend` 資料夾 | `cd ~/Desktop/travel-scheduler/backend` |
| `/docs` 裡沒有 `/api/trips` | `main.py` 沒有 `include_router(trips.router)` | 對照步驟 5 |
| `relation "trips" does not exist` | 產生了施工單，但沒有 `upgrade` | `uv run alembic upgrade head` |
| `422`，訊息是 `date_from_datetime_parsing` | 日期格式不對 | 寫成 `"2026-12-20"` |
| 刪除回 `204`，但 `/docs` 裡看不到 Response body | 正常，`204` 本來就沒有內容 | — |

### 📌 這一段的 3 個重點

1. **這一課三張表**：`trips`（手帳封面）、`trip_places`（想去清單）、`itinerary_items`（每天那一頁）。上半先做 `trips`。
2. **能算出來的就不要存**：日期 ＝ 出發日 ＋ 第幾天 − 1，所以不做 `trip_days`。
3. **`get_trip_or_404` 共用**：找不到就 `raise HTTPException(404)`，整支 API 直接中斷。

### 6. 小測驗

（提示：每題都可以用「如果不這樣做，會發生什麼壞事？」來想。）

1. 為什麼不像原專案一樣做 `trip_days` 表，把每一天的日期存起來？
2. `get_trip(...)` 和 `delete_trip(...)` 呼叫 `get_trip_or_404` 之後，為什麼不用再寫 `if trip is None`？
3. 實驗 6 裡，`downgrade` 之後再 `upgrade`，為什麼資料不見了？
4. `days` 為什麼要用 `Field(ge=1, le=60)` 擋？資料庫不是也會檢查嗎？

<details>
<summary>點開看解答</summary>

1. 日期隨時都算得出來（出發日 ＋ 第幾天 − 1）。另外存一份的話，改出發日時就要記得兩邊一起改，忘了就會對不起來：封面寫 12/20 出發，第 1 天那頁卻寫 12/18。
2. 因為找不到的時候，`get_trip_or_404` 裡面就已經 `raise` 了，整支 API 在那裡就中斷、回 404，後面的程式根本不會執行。所以只要能走到下一行，拿到的 `trip` 一定存在。
3. `downgrade` 執行的是施工單裡的 `op.drop_table('trips')`，**整張表連資料一起刪掉**；`upgrade` 執行的是 `op.create_table(...)`，重新建一張**空的**表。施工單只記錄「表長什麼樣子」，不記錄裡面的資料。所以正式環境裡有資料時，不能隨便 `downgrade`。
4. 資料庫只知道 `days` 是一個整數、不能是空的，`0`、`-3`、`9999` 它都會收。不先擋的話，就會存進「玩 0 天」的行程，之後的「第 0 天」「第 −1 天」都會出問題。Pydantic 在進資料庫**之前**就擋下、回 `422`，還會告訴前端哪裡填錯。（第 2 課說過：資料庫負責擋「格式」，像重複、空值；「合不合理」要靠我們的程式。）

</details>

#### 你的實作紀錄（2026-11-01）

- `schemas/trip.py`、`router/trips.py`、`main.py` 都正確；`models.py` 只多了一個空行。
- 施工單是 `e881274f6ece_create_trips_table.py`，接在第 3 課的 `e13117e75b93` 後面，已經 `upgrade` 到最新。
- 資料庫裡剩「京都三日遊」（id 1），大阪那筆（id 2）建立後刪掉了，中半會用到京都這筆。
- 4 支 API 都在；查 `999` 回 `404`，`days: 0` 回 `422`。
- 選做的 Alembic 退回實驗沒做，複習時可以試。
- 你的提問：為什麼 `get_trip_or_404(db: Session, ...)` 不用寫 `= Depends(get_db)`？因為 `Depends` 只有 FastAPI 會處理，只對「FastAPI 呼叫的函式」（有 `@router.get` 這種裝飾的）有用。`get_trip_or_404` 是我們自己在 API 裡呼叫的，直接把 API 手上那個 `db` 遞給它，兩邊才會用同一個 Session。硬寫的話，忘了傳 `db` 時，`db` 會是一個 `Depends(...)` 物件，`db.get` 就會出錯（`'Depends' object has no attribute 'get'`）。

---

## 中半：景點池（trip_places）

### 開始前的測試結果（2026-11-01）

我先在另一份複製的後端和資料庫測過（用你的「京都三日遊」，id 1）：

| 測試 | 結果 |
|---|---|
| 把清水寺（2）、伏見稻荷（4）、花見小路（6）加進景點池 | 都是 `201`，回傳景點的完整資料 |
| 清水寺再加一次 | `409`「這個景點已經在景點池裡了」 |
| 加一個不存在的景點、加到不存在的行程 | `404` |
| 列出景點池 | 照加入的順序，有名稱、介紹這些完整資料 |
| 移除伏見稻荷 | `204`；再移除一次 → `404` |
| 實驗：刪掉一個有 2 個景點的行程 | 景點池那 2 筆**自動跟著不見**。uvicorn 的紀錄裡，程式只送了 `DELETE FROM trips`，景點池是資料庫自己刪的 |
| 實驗：繞過 API，直接在資料庫塞資料 | 行程不存在、景點重複，**資料庫都直接拒絕** |

### 1. 學到的觀念

#### 外鍵（Foreign Key）：清單上只寫編號

手帳最後一頁的「想去清單」，不會把每個景點的名稱、地址、介紹整個抄一遍，只寫**景點編號**，要看詳細資料再去翻景點那本（`destinations` 表）。

`trip_places` 就是這樣，一筆只有兩個編號：

```
trip_places（景點池）              destinations（景點）
trip_id │ destination_id           id │ place_name
────────┼───────────────           ───┼──────────────
   1    │       2         ───→      2 │ 音羽山清水寺
   1    │       6         ───→      6 │ 花見小路
```

`trip_id` 指向 `trips.id`，`destination_id` 指向 `destinations.id`，這種「指向另一張表」的欄位就叫**外鍵**。資料庫會保證：**外鍵指到的東西一定存在**。想塞一個「行程 999」進去，資料庫會直接拒絕。

只寫編號的好處跟上半一樣：景點名稱只存一份，改了一個地方，所有行程看到的都是新的。

#### 兩個欄位一起當主鍵

`trip_places` 沒有自己的 `id`，而是 `(trip_id, destination_id)` **兩個一起當主鍵**。意思是「同一個行程 ＋ 同一個景點」只能有一筆，也就是**同一個景點不能加兩次**。

這又是第 2 課的觀念：**擋重複的是資料庫**，我們的程式只是接住 `IntegrityError`，把它翻譯成 `409` 告訴前端。

用主鍵找一筆的時候，兩個值都要給：`db.get(TripPlace, (trip_id, destination_id))`。

#### `ON DELETE CASCADE`：行程刪掉，清單跟著丟

外鍵上寫了 `ondelete="CASCADE"`：**被指到的那一筆刪掉時，指著它的資料也一起刪掉**。

- 刪掉一個行程 → 它的景點池一起清掉（不然會留下一堆「指向不存在行程」的資料）。
- 刪掉一個景點 → 所有行程的景點池裡，這個景點都會不見。

這件事是**資料庫自己做的**，我們的程式只叫它刪 `trips`。

#### JOIN：拿編號去另一張表接資料

景點池裡只有編號，但前端要顯示名稱、介紹。所以列出景點池時要用 **JOIN**：把 `trip_places` 和 `destinations` 用「`destination_id` ＝ `id`」接起來，一次拿到完整資料。

```python
select(Destination)
    .join(TripPlace, TripPlace.destination_id == Destination.id)   # 接起來
    .where(TripPlace.trip_id == trip_id)                           # 只要這個行程的
```

#### 白話：`POST /api/trips` 和 `POST /api/trips/1/places` 差在哪？（2026-11-02 你的提問）

**網址從左往右讀，就像地址從大到小：**

| 網址 | 白話 |
|---|---|
| `/api/trips` | 所有的手帳（整個書櫃） |
| `/api/trips/1` | 第 1 本手帳（京都三日遊） |
| `/api/trips/1/places` | 第 1 本手帳最後一頁的「想去清單」 |
| `/api/trips/1/places/4` | 第 1 本手帳想去清單上的伏見稻荷（4 號景點） |

前面的動詞決定要做什麼：`GET` 看、`POST` 新增、`DELETE` 刪掉。

| | `POST /api/trips` | `POST /api/trips/1/places` |
|---|---|---|
| 白話 | **買一本新手帳** | **在第 1 本手帳的想去清單上，寫一個景點** |
| 要送什麼 | `{"title": "京都三日遊", "days": 3}`：封面寫什麼 | `{"destination_id": 2}`：寫哪個景點（清水寺） |
| 結果 | `trips` 表多一筆 | `trip_places` 表多一筆「行程 1、景點 2」 |

實際使用的順序：

```
1. POST   /api/trips                → 買一本手帳「京都三日遊」，拿到編號 1
2. POST   /api/trips/1/places  {2}  → 在 1 號手帳的想去清單寫上「清水寺」
3. POST   /api/trips/1/places  {4}  → 再寫上「伏見稻荷」
4. GET    /api/trips/1/places       → 翻開 1 號手帳的想去清單看看
5. DELETE /api/trips/1/places/4     → 把伏見稻荷從清單上劃掉
```

`trip_id` 放在網址裡，是因為景點池一定屬於「某一本手帳」：網址先說是哪一本（`/trips/1`），再說是那一本裡的什麼（`/places`）。第 7 課做出畫面後，第 2、3 步就是搜尋頁卡片上的「加入」按鈕。

### 2. 實作步驟

#### 步驟 7：`models.py` 加上 `TripPlace`

`from sqlalchemy import ...` 那一行改成（多了 `ForeignKey`，太長所以拆成多行）：

```python
from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
```

檔案最下面（`Trip` 的後面）加上：

```python
class TripPlace(Base):
    __tablename__ = "trip_places"

    # 兩個欄位一起當主鍵：同一個行程裡，同一個景點只能出現一次
    trip_id: Mapped[int] = mapped_column(
        ForeignKey("trips.id", ondelete="CASCADE"), primary_key=True
    )
    destination_id: Mapped[int] = mapped_column(
        ForeignKey("destinations.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

| 寫法 | 意思 |
|---|---|
| `ForeignKey("trips.id", ...)` | 外鍵：這個欄位指向 `trips` 表的 `id` |
| `ondelete="CASCADE"` | 被指到的那一筆刪掉時，這一筆也跟著刪 |
| 兩個欄位都寫 `primary_key=True` | 兩個一起當主鍵 |

#### 步驟 8：產生施工單，然後執行

```bash
uv run alembic revision --autogenerate -m "create trip_places table"
```

要看到 `Detected added table 'trip_places'`。（同時出現兩行 `Detected sequence named ... assuming SERIAL and omitting` 是正常的訊息，不用理它。）施工單的 `upgrade()` 應該是：

```python
    op.create_table('trip_places',
    sa.Column('trip_id', sa.Integer(), nullable=False),
    sa.Column('destination_id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['destination_id'], ['destinations.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('trip_id', 'destination_id')
    )
```

`ForeignKeyConstraint` 就是兩個外鍵，`PrimaryKeyConstraint('trip_id', 'destination_id')` 就是兩個欄位一起當主鍵。確認沒問題就執行：

```bash
uv run alembic upgrade head
docker compose exec db psql -U travel -d travel_scheduler -c "\d trip_places"
```

最下面的 `Foreign-key constraints:` 會列出兩個外鍵，後面都有 `ON DELETE CASCADE`。

#### 步驟 9：`schemas/trip.py` 最下面加上

```python


# 點餐單：把一個景點加進景點池
class TripPlaceCreate(BaseModel):
    destination_id: int
```

加入景點池時，前端只要送景點的 id。回傳的景點資料，直接沿用第 2 課的 `DestinationOut`。

#### 步驟 10：`router/trips.py` 整個換成

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.database import get_db
from models import Destination, Trip, TripPlace
from schemas.destination import DestinationOut
from schemas.trip import TripCreate, TripOut, TripPlaceCreate

router = APIRouter()


def get_trip_or_404(db: Session, trip_id: int) -> Trip:
    """用 id 找行程，找不到就直接回 404。之後景點池、每日行程也會用到"""
    trip = db.get(Trip, trip_id)
    if trip is None:
        raise HTTPException(status_code=404, detail="找不到這個行程")
    return trip


@router.post("/api/trips", response_model=TripOut, status_code=201)
def create_trip(payload: TripCreate, db: Session = Depends(get_db)):
    trip = Trip(**payload.model_dump())
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


@router.get("/api/trips", response_model=list[TripOut])
def list_trips(db: Session = Depends(get_db)):
    # 還沒有登入功能，先列出全部的行程（第 8 課改成只列自己的）
    return db.scalars(select(Trip).order_by(Trip.id.desc())).all()


@router.get("/api/trips/{trip_id}", response_model=TripOut)
def get_trip(trip_id: int, db: Session = Depends(get_db)):
    return get_trip_or_404(db, trip_id)


@router.delete("/api/trips/{trip_id}", status_code=204)
def delete_trip(trip_id: int, db: Session = Depends(get_db)):
    trip = get_trip_or_404(db, trip_id)
    db.delete(trip)
    db.commit()


# ---------- 景點池 ----------


@router.get("/api/trips/{trip_id}/places", response_model=list[DestinationOut])
def list_trip_places(trip_id: int, db: Session = Depends(get_db)):
    get_trip_or_404(db, trip_id)
    # JOIN：景點池裡只有景點的 id，接到 destinations 表，才拿得到名稱、介紹這些資料
    stmt = (
        select(Destination)
        .join(TripPlace, TripPlace.destination_id == Destination.id)
        .where(TripPlace.trip_id == trip_id)
        .order_by(TripPlace.created_at)
    )
    return db.scalars(stmt).all()


@router.post(
    "/api/trips/{trip_id}/places", response_model=DestinationOut, status_code=201
)
def add_trip_place(
    trip_id: int, payload: TripPlaceCreate, db: Session = Depends(get_db)
):
    get_trip_or_404(db, trip_id)
    destination = db.get(Destination, payload.destination_id)
    if destination is None:
        raise HTTPException(status_code=404, detail="找不到這個景點")

    db.add(TripPlace(trip_id=trip_id, destination_id=destination.id))
    try:
        db.commit()
    except IntegrityError:
        # 主鍵（trip_id, destination_id）重複：這個景點已經在景點池裡了
        db.rollback()
        raise HTTPException(status_code=409, detail="這個景點已經在景點池裡了")
    return destination


@router.delete("/api/trips/{trip_id}/places/{destination_id}", status_code=204)
def remove_trip_place(
    trip_id: int, destination_id: int, db: Session = Depends(get_db)
):
    get_trip_or_404(db, trip_id)
    # 主鍵有兩個欄位，所以要用兩個值去找
    trip_place = db.get(TripPlace, (trip_id, destination_id))
    if trip_place is None:
        raise HTTPException(status_code=404, detail="這個景點不在景點池裡")
    db.delete(trip_place)
    db.commit()
```

上半那 4 支沒有變，新增的是 `# ---------- 景點池 ----------` 下面 3 支：

| API | 做什麼 | 會回什麼 |
|---|---|---|
| `GET /api/trips/{trip_id}/places` | 列出景點池，照加入的順序 | 景點的清單 |
| `POST /api/trips/{trip_id}/places` | 加一個景點進去 | `201` ＋ 景點資料；重複 `409`；景點或行程不存在 `404` |
| `DELETE /api/trips/{trip_id}/places/{destination_id}` | 從景點池移除 | `204`；不在景點池裡 `404` |

#### 步驟 11：測試

打開 http://localhost:8000/docs ，景點的 id 用京都的：清水寺 `2`、二年坂 `3`、伏見稻荷 `4`、八坂神社 `5`、花見小路 `6`。

1. `GET /api/trips/1/places` → `[]`，景點池還是空的。
2. `POST /api/trips/1/places` 送 `{"destination_id": 2}`，再送 `4`、`6` → 都是 `201`。
3. 再送一次 `{"destination_id": 2}` → `409`。
4. 送 `{"destination_id": 99999}` → `404`「找不到這個景點」；路徑改成 `/api/trips/999/places` → `404`「找不到這個行程」。
5. `GET /api/trips/1/places` → 3 個景點，有名稱、介紹。
6. `DELETE /api/trips/1/places/4` → `204`；再刪一次 → `404`。
7. **實驗：行程刪掉，景點池會怎樣？**
   1. `POST /api/trips` 建一個 `{"title": "測試行程", "days": 1}`，**記下回傳的 `id`**（應該是 `3`，因為 `2` 被大阪用過了，刪掉之後編號也不會重複使用）。
   2. 用這個 id 加兩個景點進景點池（例如 `3`、`5`）。
   3. `DELETE /api/trips/{這個 id}` → `204`。看 uvicorn 的分頁，SQLAlchemy 只印了 `DELETE FROM trips ...`。
   4. 到資料庫看景點池還剩什麼：

      ```bash
      docker compose exec db psql -U travel -d travel_scheduler -c "SELECT * FROM trip_places;"
      ```

      只剩京都三日遊（`trip_id` 是 `1`）的那兩筆，測試行程的景點**被資料庫自己刪掉了**。
8. **實驗（選做）：繞過 API，直接在資料庫塞壞資料**

   ```bash
   docker compose exec db psql -U travel -d travel_scheduler -c "INSERT INTO trip_places (trip_id, destination_id) VALUES (999, 2);"
   docker compose exec db psql -U travel -d travel_scheduler -c "INSERT INTO trip_places (trip_id, destination_id) VALUES (1, 2);"
   ```

   第一行：`violates foreign key constraint`，行程 999 不存在。第二行：`duplicate key value violates unique constraint "trip_places_pkey"`，清水寺已經在京都三日遊的景點池裡了。**就算繞過我們的程式，資料庫還是會擋。**

### 3. 這一段結束後的資料夾

```
backend/
├── alembic/versions/
│   └── xxxx_create_trip_places_table.py   ← 新增（Alembic 產生的）
├── models.py                              ← 改：加上 TripPlace
├── router/
│   └── trips.py                           ← 改：加上景點池的 3 支 API
└── schemas/
    └── trip.py                            ← 改：加上 TripPlaceCreate
```

### 4. 跟原專案對照

| 項目 | 原專案 | 我們 |
|---|---|---|
| 加入景點池時送什麼 | `google_place_id`：資料庫沒有這個景點的話，先問 Google 再新增 | `destination_id`：只能加資料庫裡已經有的景點。用 Google 搜尋框加任意景點，等第 7 課做地圖時再加 |
| 重複加入 | 不報錯，直接回景點資料 | `409`，讓前端知道已經加過了 |
| 移除不在景點池裡的景點 | 不報錯，回 `{"ok": true}` | `404` |
| 列出景點池的排序 | 景點 id 由大到小 | 照加入的順序 |
| 列出時回傳的欄位 | 名稱、城市、座標、Google id | 整個 `DestinationOut`（多了介紹、地址、標籤） |
| 寫法 | 直接寫 SQL 的 `JOIN` | SQLAlchemy 的 `.join(...)` |

### 5. 常見踩雷

| 症狀 | 原因 | 解法 |
|---|---|---|
| 產生施工單時出現 `Detected sequence named ... assuming SERIAL and omitting` | 只是 Alembic 的說明訊息 | 不用理它 |
| `NameError: name 'ForeignKey' is not defined` | `models.py` 最上面忘了 import `ForeignKey` | 對照步驟 7 |
| `ImportError: cannot import name 'TripPlaceCreate'` | `schemas/trip.py` 沒加，或沒存檔 | 對照步驟 9 |
| 加入景點回 `500`，錯誤是 `relation "trip_places" does not exist` | 產生了施工單，但沒有 `upgrade` | `uv run alembic upgrade head` |
| 實驗 7 刪掉行程後，景點池的資料還在 | 用錯 id（例如刪的是不存在的 `2`，回 `404`） | 用建立時回傳的那個 id |
| `DELETE` 時 `/docs` 要填兩個值 | 這支 API 的網址裡有 `trip_id` 和 `destination_id` 兩個 | 兩個都要填 |

### 📌 這一段的 3 個重點

1. **外鍵**：清單上只寫編號，指向另一張表；資料庫保證指到的東西一定存在。要詳細資料時，用 **JOIN** 接過去拿。
2. **兩個欄位一起當主鍵**：同一個行程裡，同一個景點只能加一次。擋重複的是資料庫，程式只是把錯誤翻譯成 `409`。
3. **`ON DELETE CASCADE`**：行程刪掉，它的景點池由資料庫自動一起刪掉。

### 6. 小測驗

（提示：每題都可以用「如果不這樣做，會發生什麼壞事？」來想。）

1. 為什麼 `trip_places` 只存 `destination_id`，不把景點名稱、地址也存進來？
2. 如果把 `add_trip_place` 裡的 `try / except IntegrityError` 拿掉，再加一次清水寺，會發生什麼事？資料庫裡會有兩筆清水寺嗎？
3. 如果外鍵沒有寫 `ondelete="CASCADE"`，刪掉一個景點池裡有東西的行程，會發生什麼事？
4. `list_trip_places` 如果不用 JOIN，只查 `trip_places`，前端會拿到什麼？

<details>
<summary>點開看解答</summary>

1. 景點的資料只該有一份。如果每個景點池都抄一份名稱和地址，之後景點的名稱改了，就要把所有行程裡的那一份都找出來改，漏了就會對不起來。只存編號，要看資料時用 JOIN 去拿，永遠是最新的。（跟上半「能算出來的就不要存」是同一個道理：**同一件事只存一份**。）
2. 資料庫裡**不會**有兩筆，因為主鍵 `(trip_id, destination_id)` 重複，資料庫會拒絕寫入。差別只在 API 會回 **`500`**（伺服器錯誤），而不是清楚的 `409`，前端就不知道其實只是「已經加過了」。這就是第 2 課說的：**擋重複的是資料庫，`try / except` 只負責決定要回什麼狀態碼。**
3. 刪不掉。資料庫會拒絕刪除這個行程，因為景點池裡還有資料指著它（外鍵保證「指到的東西一定存在」），API 會回 `500`。要嘛先把景點池清空再刪，要嘛就是加上 `CASCADE`，讓資料庫一起刪。
4. 只會拿到 `trip_id`、`destination_id`、`created_at` 這種編號，沒有名稱、沒有介紹。前端還得拿每個編號再打一次 API 去問「這個景點叫什麼」，景點池有 20 個就要多打 20 次。JOIN 讓資料庫一次接好給你。

</details>

#### 你的實作紀錄（2026-11-02）

- `schemas/trip.py`、`router/trips.py` 都正確；`models.py` 只多一個空行。
- 施工單是 `7bfa184a4600_create_trip_places_table.py`，接在 `e881274f6ece`（trips）後面，已經 `upgrade`。兩個外鍵都有 `ON DELETE CASCADE`。
- 京都三日遊的景點池：清水寺（2）、花見小路（6）。伏見稻荷（4）加入後又移除了。
- 實驗 7 有做：測試行程（id 3）建立又刪掉，它的景點池被資料庫自動清掉，`trip_places` 只剩行程 1 的資料。
- 你的提問：`POST /api/trips` 和 `POST /api/trips/1/places` 差在哪？前者是「建立一本新手帳」，後者是「在 1 號手帳的想去清單上寫一個景點」。白話說明已經整理在這一段的觀念裡。

---

## 下半：每日行程（itinerary_items）

> 原本下半還包含「一次存好整天的順序和時間」，內容太多，所以拆出去變成最後的**收尾段**。下半先做表和 3 支 API。

### 開始前的測試結果（2026-11-02）

我先在另一份複製的後端和資料庫測過（用你的京都三日遊，景點池裡有清水寺和花見小路）：

| 測試 | 結果 |
|---|---|
| 先把伏見稻荷（4）加回景點池，再把清水寺、花見小路、伏見稻荷依序排到第 1 天 | 都是 `201`，順序自動是 `0`、`1`、`2` |
| 清水寺再排到第 2 天 | `409`「這個景點已經排在第 1 天了」 |
| 排一個不在景點池的景點（二年坂） | `400`「請先把這個景點加進景點池」 |
| 排到第 4 天、第 0 天（行程只有 3 天） | `404`「這個行程只有 3 天」 |
| 列出第 1 天 | 照順序，每一站都帶著景點的完整資料 |
| 刪掉中間那一站（花見小路） | `204`，伏見稻荷的順序**自動從 2 補成 1** |
| 從景點池移除伏見稻荷 | 第 1 天的伏見稻荷那一站**也自動不見** |
| 刪掉一個行程 | 行程、景點池、每日行程**一路連鎖刪光** |
| 繞過 API，直接在資料庫排一個不在景點池的景點 | 資料庫拒絕 |

### 1. 學到的觀念

#### 每天那一頁：一站就是一筆資料

```
京都三日遊
  第 1 天：  0 清水寺  →  1 花見小路  →  2 伏見稻荷
  第 2 天：  （還沒排）
  第 3 天：  （還沒排）
```

`itinerary_items` 的一筆，就是「第幾天（`day_index`）的第幾站（`position`）去哪個景點」，還可以記幾點到、幾點走。`day_index` 從 **1** 開始（第 1 天），`position` 從 **0** 開始（跟 Python 的 list 一樣）。

#### 外鍵指向景點池：只能排想去清單上有的

每日行程的 `(trip_id, destination_id)` **兩個欄位一起**當外鍵，指向景點池的 `(trip_id, destination_id)`。中半是「兩個欄位一起當主鍵」，這裡是「兩個欄位一起當外鍵」。

這樣資料庫就會保證：

1. **只能排景點池裡有的景點**：想直接排二年坂？資料庫會說景點池裡沒有。
2. **從景點池劃掉，排好的那一站也跟著刪**（`ON DELETE CASCADE`）。

加上中半的 CASCADE，刪除會一路連鎖下去：

```
刪掉行程            → 景點池跟著刪 → 每日行程跟著刪
從景點池劃掉清水寺   →              每日行程裡的清水寺那一站跟著刪
```

原專案沒有這樣設計：從景點池移除時，排好的那一站還會留著，畫面上就會出現「想去清單裡沒有，行程裡卻有」的情況。

#### 同一個景點只能排一次：`UniqueConstraint`

`UniqueConstraint("trip_id", "destination_id")`：同一個行程裡，同一個景點只能出現一次，不能第 1 天、第 2 天都去清水寺。

跟主鍵的差別：主鍵是「用來找到這一筆」的編號（這張表的主鍵是 `id`）；`UniqueConstraint` 只是「這幾個欄位的組合不能重複」。

#### 加在最後面，刪掉時補位

- **加一站**：放在那一天的最後面，`position` ＝ 目前最大的 ＋ 1；那一天還是空的話就是 `0`。
- **刪一站**：後面的要往前補，重新編成 `0、1、2……`，中間不留空號。

刪除時有一行 `db.flush()`：它會先把「刪除」送到資料庫，但**還沒存檔**（存檔是 `commit`）。這樣下一行重新查這一天的時候，就不會把剛刪掉的那一站算進去。（其實 SQLAlchemy 在查詢前也會自動做一次 flush，這裡寫出來，是為了讓順序看得清楚。）

#### 一站帶著景點的完整資料：`relationship`

`destination: Mapped[Destination] = relationship(lazy="joined")` 的意思是：讀每一站的時候，**順便用 JOIN 把景點的資料一起拿回來**（跟中半的 JOIN 一樣）。所以回傳的 JSON 長這樣，景點資料包在 `destination` 裡面：

```json
{
  "id": 1,
  "day_index": 1,
  "position": 0,
  "arrival_time": null,
  "departure_time": null,
  "destination": { "id": 2, "place_name": "音羽山清水寺", "description": "…", "lat": 34.99, "lng": 135.78 }
}
```

前端第 7 課拿到之後，可以直接用 `destination` 畫卡片、在地圖上插針。

#### 先自己檢查，資料庫是最後一道防線

「不在景點池」「已經排過了」這兩件事，資料庫都會擋。但資料庫擋下來時，我們只會拿到一個 `IntegrityError`，**分不出是哪一種**，也不知道「排在第幾天」。所以 `add_to_day` 先自己檢查，才能回 `400` 或 `409`，加上清楚的訊息。資料庫的限制還是在，萬一兩個請求同時進來，它還是會擋住。

### 2. 實作步驟

#### 步驟 12：`models.py` 加上 `ItineraryItem`

最上面的 import **整段**（從第一行到 `from sqlalchemy.orm import ...` 那一行）換成：

```python
from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
```

多了 `time`、`ForeignKeyConstraint`、`Time`、`UniqueConstraint`、`relationship` 這五個。

檔案最下面（`TripPlace` 的後面）加上：

```python
class ItineraryItem(Base):
    __tablename__ = "itinerary_items"
    __table_args__ = (
        # 外鍵指向景點池：只能排景點池裡有的景點；從景點池移除，這一站也跟著刪掉
        ForeignKeyConstraint(
            ["trip_id", "destination_id"],
            ["trip_places.trip_id", "trip_places.destination_id"],
            ondelete="CASCADE",
        ),
        # 同一個行程裡，一個景點只能排一次（不能第 1 天、第 2 天都去清水寺）
        UniqueConstraint("trip_id", "destination_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[int] = mapped_column(Integer)
    destination_id: Mapped[int] = mapped_column(
        ForeignKey("destinations.id", ondelete="CASCADE")
    )
    day_index: Mapped[int] = mapped_column(Integer)  # 第幾天，從 1 開始
    position: Mapped[int] = mapped_column(Integer)  # 當天第幾站，從 0 開始
    arrival_time: Mapped[time | None] = mapped_column(Time)  # 幾點到
    departure_time: Mapped[time | None] = mapped_column(Time)  # 幾點走
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # 讀這一站時，順便用 JOIN 把景點的完整資料一起拿回來
    destination: Mapped[Destination] = relationship(lazy="joined")
```

| 寫法 | 意思 |
|---|---|
| `__table_args__ = (...)` | 放「跟好幾個欄位有關」的規則，寫不進單一欄位裡的 |
| `ForeignKeyConstraint([...], [...])` | 兩個欄位一起當外鍵，指向景點池的兩個欄位 |
| `UniqueConstraint("trip_id", "destination_id")` | 這兩個欄位的組合不能重複 |
| `destination_id` 上的 `ForeignKey("destinations.id")` | 讓 SQLAlchemy 知道 `destination_id` 對到哪個景點，下面的 `relationship` 才知道怎麼 JOIN |
| `Mapped[time \| None]` ＋ `Time` | 只有時間（幾點幾分），沒有日期 |
| `relationship(lazy="joined")` | 讀這一站時，順便把景點資料一起拿回來，放在 `item.destination` |

#### 步驟 13：產生施工單，然後執行

```bash
uv run alembic revision --autogenerate -m "create itinerary_items table"
```

要看到 `Detected added table 'itinerary_items'`。施工單的 `upgrade()` 應該是：

```python
    op.create_table('itinerary_items',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('trip_id', sa.Integer(), nullable=False),
    sa.Column('destination_id', sa.Integer(), nullable=False),
    sa.Column('day_index', sa.Integer(), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('arrival_time', sa.Time(), nullable=True),
    sa.Column('departure_time', sa.Time(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['destination_id'], ['destinations.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['trip_id', 'destination_id'], ['trip_places.trip_id', 'trip_places.destination_id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('trip_id', 'destination_id')
    )
```

注意有**兩個** `ForeignKeyConstraint`：一個指向 `destinations`，一個是兩個欄位一起指向 `trip_places`。確認沒問題就執行：

```bash
uv run alembic upgrade head
docker compose exec db psql -U travel -d travel_scheduler -c "\d itinerary_items"
```

#### 步驟 14：新增 `schemas/itinerary.py`

```python
from datetime import time

from pydantic import BaseModel, ConfigDict

from schemas.destination import DestinationOut


# 點餐單：把景點池裡的一個景點，排到某一天
class ItineraryItemCreate(BaseModel):
    destination_id: int


# 出餐單：某一天裡的其中一站
class ItineraryItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    day_index: int
    position: int
    arrival_time: time | None
    departure_time: time | None
    destination: DestinationOut  # 這一站是哪個景點（完整資料）
```

`destination: DestinationOut`：出餐單裡**包著另一張出餐單**。因為 `ItineraryItem` 有 `destination` 這個 `relationship`，Pydantic 會把它照 `DestinationOut` 的格式轉好。

#### 步驟 15：新增 `router/itinerary.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.database import get_db
from models import ItineraryItem, TripPlace
from router.trips import get_trip_or_404
from schemas.itinerary import ItineraryItemCreate, ItineraryItemOut

router = APIRouter()


def check_day(db: Session, trip_id: int, day_index: int) -> None:
    """行程要存在，而且要有這一天（第 1 天到最後一天）"""
    trip = get_trip_or_404(db, trip_id)
    if not 1 <= day_index <= trip.days:
        raise HTTPException(status_code=404, detail=f"這個行程只有 {trip.days} 天")


def day_items(db: Session, trip_id: int, day_index: int) -> list[ItineraryItem]:
    """某一天的每一站，照順序排好"""
    stmt = (
        select(ItineraryItem)
        .where(ItineraryItem.trip_id == trip_id, ItineraryItem.day_index == day_index)
        .order_by(ItineraryItem.position)
    )
    return list(db.scalars(stmt).all())


@router.get(
    "/api/trips/{trip_id}/days/{day_index}/itinerary",
    response_model=list[ItineraryItemOut],
)
def list_day_itinerary(trip_id: int, day_index: int, db: Session = Depends(get_db)):
    check_day(db, trip_id, day_index)
    return day_items(db, trip_id, day_index)


@router.post(
    "/api/trips/{trip_id}/days/{day_index}/itinerary",
    response_model=ItineraryItemOut,
    status_code=201,
)
def add_to_day(
    trip_id: int,
    day_index: int,
    payload: ItineraryItemCreate,
    db: Session = Depends(get_db),
):
    check_day(db, trip_id, day_index)

    # 資料庫也會擋這兩種情況，先自己檢查，是為了回比較清楚的訊息
    if db.get(TripPlace, (trip_id, payload.destination_id)) is None:
        raise HTTPException(status_code=400, detail="請先把這個景點加進景點池")
    scheduled = db.scalar(
        select(ItineraryItem).where(
            ItineraryItem.trip_id == trip_id,
            ItineraryItem.destination_id == payload.destination_id,
        )
    )
    if scheduled is not None:
        raise HTTPException(
            status_code=409, detail=f"這個景點已經排在第 {scheduled.day_index} 天了"
        )

    # 排在這一天的最後面：目前最大的 position ＋ 1；這一天還是空的，就是 0
    last = db.scalar(
        select(func.max(ItineraryItem.position)).where(
            ItineraryItem.trip_id == trip_id, ItineraryItem.day_index == day_index
        )
    )
    item = ItineraryItem(
        trip_id=trip_id,
        destination_id=payload.destination_id,
        day_index=day_index,
        position=0 if last is None else last + 1,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/api/trips/{trip_id}/itinerary/{item_id}", status_code=204)
def remove_from_day(trip_id: int, item_id: int, db: Session = Depends(get_db)):
    get_trip_or_404(db, trip_id)
    item = db.get(ItineraryItem, item_id)
    if item is None or item.trip_id != trip_id:
        raise HTTPException(status_code=404, detail="這個行程裡沒有這一站")

    day_index = item.day_index
    db.delete(item)
    db.flush()  # 先把「刪除」送到資料庫（還沒存檔），下面重新編號時才不會算到它

    # 補位：剩下的重新編成 0、1、2……，中間不留空號
    for new_position, rest in enumerate(day_items(db, trip_id, day_index)):
        rest.position = new_position
    db.commit()
```

| API | 做什麼 | 會回什麼 |
|---|---|---|
| `GET /api/trips/{trip_id}/days/{day_index}/itinerary` | 列出某一天的每一站，照順序 | 每一站的清單 |
| `POST /api/trips/{trip_id}/days/{day_index}/itinerary` | 把景點池裡的一個景點，排到這一天的最後面 | `201`；不在景點池 `400`；已經排過 `409`；沒有這一天 `404` |
| `DELETE /api/trips/{trip_id}/itinerary/{item_id}` | 刪掉一站，後面的往前補位 | `204`；沒有這一站 `404` |

| 寫法 | 意思 |
|---|---|
| `from router.trips import get_trip_or_404` | 上半寫的小函式，換個檔案一樣可以用 |
| `check_day(...)` | 行程要存在（交給 `get_trip_or_404`），而且第幾天要在 1 到 `days` 之間 |
| `day_items(...)` | 「某一天的每一站，照順序」，列出和補位都會用到，所以寫成函式 |
| `func.max(ItineraryItem.position)` | 讓資料庫算出這一天最大的 `position`；那一天還沒有任何一站時會是 `None` |
| `item.trip_id != trip_id` | 這一站要是**這個行程的**，不能用別的行程的 `item_id` 來刪 |
| `enumerate(...)` | 一邊數 `0、1、2……`，一邊拿出每一站，拿來重新編號 |

#### 步驟 16：`main.py` 掛上新的 router

整個檔案換成：

```python
from fastapi import FastAPI
from router import destinations, itinerary, search, trips

app = FastAPI()

app.include_router(destinations.router)
app.include_router(search.router)
app.include_router(trips.router)
app.include_router(itinerary.router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

#### 步驟 17：測試

打開 http://localhost:8000/docs 。景點 id：清水寺 `2`、二年坂 `3`、伏見稻荷 `4`、花見小路 `6`。

1. 先把伏見稻荷加回景點池：`POST /api/trips/1/places` 送 `{"destination_id": 4}`。
2. `GET /api/trips/1/days/1/itinerary` → `[]`。
3. `POST /api/trips/1/days/1/itinerary` 依序送 `2`、`6`、`4` → 都是 `201`，`position` 分別是 `0`、`1`、`2`。**記下花見小路那一站回傳的 `id`**（是這一站的 id，不是景點的 id）。
4. 故意送錯：
   - 清水寺排到第 2 天（`/days/2/itinerary` 送 `2`）→ `409`「已經排在第 1 天了」
   - 二年坂排到第 1 天（送 `3`）→ `400`「請先把這個景點加進景點池」
   - 排到第 4 天（`/days/4/itinerary`）→ `404`「這個行程只有 3 天」
5. `GET /api/trips/1/days/1/itinerary` → 三站，每一站裡有 `destination`，包著景點的完整資料。
6. `DELETE /api/trips/1/itinerary/{花見小路那一站的 id}` → `204`。再列出第 1 天：伏見稻荷的 `position` 從 `2` 變成 `1` 了。
7. **實驗：從景點池劃掉，行程裡的會怎樣？** `DELETE /api/trips/1/places/4`（移除伏見稻荷）→ 再列出第 1 天，伏見稻荷那一站**也不見了**。看 uvicorn 的分頁：程式只送了刪 `trip_places` 的指令，每日行程是資料庫自己刪的。
8. **實驗（選做）：連鎖刪除**
   1. `POST /api/trips` 建 `{"title": "測試行程", "days": 2}`，記下 id（應該是 `4`）。
   2. 用這個 id 把景點 `3`、`5` 加進景點池，再把 `5` 排到第 2 天。
   3. `DELETE /api/trips/{這個 id}`，再到資料庫看：

      ```bash
      docker compose exec db psql -U travel -d travel_scheduler -c "SELECT * FROM trip_places;" -c "SELECT id, trip_id, destination_id, day_index FROM itinerary_items;"
      ```

      測試行程的景點池和每日行程都不見了，只剩京都三日遊的。

### 3. 這一段結束後的資料夾

```
backend/
├── alembic/versions/
│   └── xxxx_create_itinerary_items_table.py   ← 新增（Alembic 產生的）
├── models.py                                  ← 改：import 多了 5 個、加上 ItineraryItem
├── main.py                                    ← 改：掛上 itinerary 的 router
├── router/
│   └── itinerary.py                           ← 新增
└── schemas/
    └── itinerary.py                           ← 新增
```

### 4. 跟原專案對照

| 項目 | 原專案 | 我們 |
|---|---|---|
| 外鍵 | `trip_id` 指向 `trips`、`destination_id` 指向 `destinations`；「在不在景點池」靠程式檢查 | `(trip_id, destination_id)` 一起指向景點池，資料庫保證 |
| 從景點池移除時 | 排好的那一站**還留著** | 資料庫自動把那一站刪掉 |
| 回傳格式 | 攤平：`item_id`、`place_name`、`lat`、`lng`…… | 巢狀：景點資料包在 `destination` 裡，直接用 `DestinationOut` |
| 有沒有這一天 | 查 `trip_days` 表 | 看 `1 ≤ 第幾天 ≤ days` |
| 兩個請求同時加到同一天 | 用 `SELECT ... FOR UPDATE` 鎖住那一天 | 先不處理（一個人編輯時用不到） |
| `(trip_id, day_index, position)` 索引 | 有 | 先不加，資料很少時用不到 |
| 存檔整天的順序和時間 | `PUT .../save` | 收尾段 |
| 兩站之間的交通時間（`itinerary_legs`） | 有 | 第 7 課做地圖時再加 |

### 5. 常見踩雷

| 症狀 | 原因 | 解法 |
|---|---|---|
| `NameError: name 'relationship' is not defined`（或 `UniqueConstraint`、`Time`……） | `models.py` 的 import 沒有整段換掉 | 對照步驟 12 |
| `NoForeignKeysError: Could not determine join condition ... on relationship ItineraryItem.destination` | `destination_id` 少了 `ForeignKey("destinations.id", ...)` | 對照步驟 12 |
| 刪一站回 `404`「這個行程裡沒有這一站」 | 網址填的是**景點的 id**（例如 6），不是**這一站的 id** | 用加入時回傳的那個 `id`，或先 `GET` 列出那一天看 |
| `400`「請先把這個景點加進景點池」 | 每日行程只能排景點池裡有的 | 先 `POST /api/trips/{id}/places` |
| `409`「已經排在第 N 天了」 | 同一個景點只能排一次 | 先把那一站刪掉，再排到別天 |
| `/docs` 裡沒有 itinerary 的 API | `main.py` 沒有 `include_router(itinerary.router)` | 對照步驟 16 |

### 📌 這一段的 3 個重點

1. **每日行程的外鍵指向景點池**：只能排想去清單上有的；從清單劃掉，排好的那一站由資料庫自動刪掉。
2. **順序用 `position` 記**：加在最後面（最大的 ＋ 1），刪掉時後面的往前補位，不留空號。
3. **先自己檢查、資料庫是最後一道防線**：自己檢查是為了回清楚的 `400` / `409`，資料庫的限制保證就算有漏網之魚也存不進去。

### 6. 小測驗

（提示：每題都可以用「如果不這樣做，會發生什麼壞事？」來想。）

1. 為什麼每日行程的外鍵要指向「景點池」，而不是直接指向「景點」？
2. 刪掉中間一站之後，如果不補位，會發生什麼事？
3. `add_to_day` 為什麼要先自己檢查「在不在景點池」「排過了沒」？資料庫不是也會擋嗎？
4. 實驗 7 從景點池移除伏見稻荷，第 1 天的那一站也不見了。我們的程式裡有寫「刪掉 `itinerary_items`」嗎？是誰刪的？

<details>
<summary>點開看解答</summary>

1. 指向景點池，資料庫就會保證兩件事：只能排想去清單上有的景點；從清單劃掉時，排好的那一站也一起刪。直接指向景點的話，這兩件事都要靠程式自己記得做，漏掉一次就會出現「想去清單裡沒有，行程裡卻有」（原專案就會這樣）。
2. 順序還是對的（照 `position` 大小排），但編號會**跳號**，例如只剩 `0` 和 `2`。畫面如果用 `position` 顯示「第幾站」，就會出現「第 1 站、第 3 站」；而且每刪一次就多一個洞，越用越亂。
3. 資料庫擋下來時，我們只拿到一個 `IntegrityError`，分不出是「不在景點池」還是「已經排過了」，也不知道排在第幾天，只能回一個模糊的錯誤。先自己檢查，才能回 `400`、`409` 和「已經排在第 1 天了」這種清楚的訊息。資料庫的限制還是要留著，當作最後一道防線。
4. **沒有**。程式只刪了 `trip_places` 的那一筆，是**資料庫**依照 `(trip_id, destination_id)` 這個外鍵上的 `ON DELETE CASCADE`，自己把指著它的每日行程刪掉的。

</details>

#### 你的實作紀錄（2026-11-03）

- `schemas/itinerary.py`、`router/itinerary.py`、`main.py` 都正確；`models.py` 只多一個空行。
- 施工單是 `6d9176c69eb2_create_itinerary_items_table.py`，接在 `7bfa184a4600`（trip_places）後面，已經 `upgrade`。
- 步驟 6 有做：花見小路那一站（id 2）刪掉了。
- 實驗 7 有做：從景點池移除伏見稻荷後，它在第 1 天的那一站（id 3）被資料庫自動刪掉。現在第 1 天只剩清水寺（`position` 0）。
- 選做的實驗 8（連鎖刪除）沒做。
- **實際踩到的雷**：`DELETE /api/trips/1/itinerary/6` 回「這個行程裡沒有這一站」。`6` 是花見小路的**景點 id**，這一站的 id 是 `2`。刪一站要用「這一站的 id」（`GET` 列出來時最外層的 `"id"`），包在 `"destination"` 裡面的才是景點 id。用手帳來想：要劃掉的是手帳上「寫下的那一行」，所以用那一行的編號。
- 你的提問：「3 天的行程，是 3 筆資料嗎？」不是。每日行程是**一站一筆**，「第 1 天」只是 `day_index = 1` 的那幾站放在一起看；還沒排的那一天就是 0 筆。「一天一筆」是原專案的 `trip_days` 表，我們在上半決定不做。

---

## 收尾：一次存好整天的順序和時間

### 開始前的測試結果（2026-11-04）

我先在另一份複製的後端和資料庫測過。第 1 天先排成「清水寺 → 花見小路 → 伏見稻荷」：

| 測試 | 結果 |
|---|---|
| 改成「伏見稻荷 → 清水寺 → 花見小路」，加上時間 | `200`，回傳新的順序和時間 |
| 少送一站、多送第 2 天的站、同一站送兩次 | 都是 `400` |
| 第 3 站的離開時間比抵達時間早 | `400`。**前兩站雖然在程式裡已經改到一半，資料庫完全沒變** |
| 反面實驗：改成「每改一站就存一次」，再送一樣的錯誤 | API 回 `400`，但資料庫**已經被改了一半**：出現兩個第 0 站，時間也改了一半 |
| 時間寫成 `"9:30"`、`"25:00"` | `422`，要寫成 `"09:30"` 這種兩位數格式 |
| 空的第 3 天，存一個空清單 | `200`，回 `[]` |

這一段**不用動資料表**，不用跑 Alembic。

### 1. 學到的觀念

#### 同一個網址，換一個動詞

| 動詞 ＋ 網址 | 白話 |
|---|---|
| `GET /api/trips/1/days/1/itinerary` | 翻開第 1 天那一頁看看 |
| `POST /api/trips/1/days/1/itinerary` | 在第 1 天那一頁最後面，加寫一站 |
| **`PUT /api/trips/1/days/1/itinerary`** | **把第 1 天那一頁整個重新謄一次**（新的順序、新的時間） |

`PUT` 的意思是「整份換掉」。同樣的內容送兩次，結果還是一樣，不會多出東西。這跟 `POST`（每送一次就多一站）不一樣。

#### 交易（Transaction）：全部成功，或全部不改

存檔一次要改好幾站。如果改到一半出錯，絕對不能留下「改了一半」的資料。

用手帳來想：你先用鉛筆在**便條紙**上把新的順序排好，全部確認沒問題，才一次**謄到手帳**上。排到一半發現寫錯，就把便條紙丟掉，手帳完全沒動過。

| 手帳 | 程式 |
|---|---|
| 在便條紙上排 | 改 `item.position`、`item.arrival_time`……（只改了 Session 裡的東西） |
| 謄到手帳上 | `db.commit()` |
| 發現寫錯，把便條紙丟掉 | `raise HTTPException`，沒有走到 `commit`；請求結束時 `get_db` 的 `db.close()` 會把沒存的改變丟掉 |

所以 `db.commit()` 只寫一次，放在迴圈**外面**、所有檢查都通過之後。反面實驗會讓你看到，放進迴圈裡會變成什麼樣子。

#### 不能多、不能少、不能重複

前端要把這一天的**每一站**都送來，而且只能是這一天的：

- **少送一站**：那一站的順序沒有更新，就可能跟別站撞號（兩個第 1 站）。
- **多送別天的站**：會把第 2 天的站，硬塞進第 1 天的順序裡。
- **重複**：同一站會被編到兩個位置。

程式用 `set`（集合）來比：「送來的 id」和「這一天原本的 id」要一模一樣。另外再比一次個數，抓出重複的。

#### 時間的格式

Pydantic 會把 `"09:30"` 轉成時間，回傳時會變成 `"09:30:00"`。小時要寫兩位數，`"9:30"` 會被擋下來（`422`）。第 7 課的時間輸入框，送出的就是 `"09:30"` 這種格式。

### 2. 實作步驟

#### 步驟 18：`schemas/itinerary.py` 最下面加上

```python


# 存檔時，每一站要送的資料
class ItineraryItemSave(BaseModel):
    id: int  # 這一站的 id（不是景點的 id）
    arrival_time: time | None = None
    departure_time: time | None = None


# 點餐單：一次存好整天，items 照新的順序排
class ItineraryDaySave(BaseModel):
    items: list[ItineraryItemSave]
```

`items: list[ItineraryItemSave]`：點餐單裡**包著一張清單**，清單裡每一個都是 `ItineraryItemSave`。清單的順序，就是新的順序。

#### 步驟 19：`router/itinerary.py` 加上存檔的 API

最上面那行 `from schemas.itinerary import ...` 改成：

```python
from schemas.itinerary import (
    ItineraryDaySave,
    ItineraryItemCreate,
    ItineraryItemOut,
)
```

檔案最下面加上：

```python
@router.put(
    "/api/trips/{trip_id}/days/{day_index}/itinerary",
    response_model=list[ItineraryItemOut],
)
def save_day(
    trip_id: int,
    day_index: int,
    payload: ItineraryDaySave,
    db: Session = Depends(get_db),
):
    check_day(db, trip_id, day_index)
    items = {item.id: item for item in day_items(db, trip_id, day_index)}

    # 要送這一天的每一站：不能多、不能少、不能重複
    sent_ids = [row.id for row in payload.items]
    if len(sent_ids) != len(set(sent_ids)) or set(sent_ids) != set(items):
        raise HTTPException(
            status_code=400, detail="要送這一天的每一站，不能多、不能少、不能重複"
        )

    for new_position, row in enumerate(payload.items):
        if (
            row.arrival_time is not None
            and row.departure_time is not None
            and row.departure_time < row.arrival_time
        ):
            # 在這裡出錯的話，前面幾站改到一半的資料都不會存進去（還沒 commit）
            raise HTTPException(
                status_code=400,
                detail=f"第 {new_position + 1} 站的離開時間比抵達時間早",
            )
        item = items[row.id]
        item.position = new_position
        item.arrival_time = row.arrival_time
        item.departure_time = row.departure_time

    db.commit()  # 全部都改好了，才一次存檔
    return day_items(db, trip_id, day_index)
```

| 寫法 | 意思 |
|---|---|
| `{item.id: item for item in ...}` | 把這一天的每一站做成「id → 這一站」的字典，等一下用 id 就能直接拿到那一站 |
| `set(sent_ids) != set(items)` | 送來的 id 和這一天原本的 id，有沒有完全一樣（`set(字典)` 拿到的是所有的 key，也就是 id） |
| `len(sent_ids) != len(set(sent_ids))` | 有重複的話，變成 `set` 之後個數會變少 |
| `enumerate(payload.items)` | 送來的順序就是新的順序，一邊數 `0、1、2`，一邊改每一站的 `position` |
| `db.commit()` 在迴圈外面 | 全部改好、全部檢查過，才一次存檔 |
| 最後 `return day_items(...)` | 把存好的這一天回傳給前端，前端可以直接用來更新畫面 |

#### 步驟 20：測試

打開 http://localhost:8000/docs 。你的第 1 天現在只有清水寺（這一站的 id 是 `1`），先多排幾站：

1. 把伏見稻荷（`4`）、八坂神社（`5`）加回景點池：`POST /api/trips/1/places`，分別送 `{"destination_id": 4}`、`{"destination_id": 5}`。
2. 排行程：`POST /api/trips/1/days/1/itinerary` 依序送花見小路 `6`、伏見稻荷 `4`；`POST /api/trips/1/days/2/itinerary` 送八坂神社 `5`。**記下回傳的 `id`**（應該是 `4`、`5`、`6`）。
3. `GET /api/trips/1/days/1/itinerary` → 清水寺（1）→ 花見小路（4）→ 伏見稻荷（5）。
4. **存檔**：`PUT /api/trips/1/days/1/itinerary`，送：

   ```json
   {
     "items": [
       {"id": 5, "arrival_time": "09:00", "departure_time": "10:30"},
       {"id": 1, "arrival_time": "11:00", "departure_time": "12:00"},
       {"id": 4, "arrival_time": "13:00"}
     ]
   }
   ```

   → `200`，順序變成伏見稻荷 → 清水寺 → 花見小路，每一站都有時間（花見小路沒填離開時間，就是 `null`）。
5. 故意送錯，都是 `400`：
   - 少一站：`{"items": [{"id": 5}, {"id": 1}]}`
   - 多送第 2 天的八坂神社：`{"items": [{"id": 5}, {"id": 1}, {"id": 4}, {"id": 6}]}`
   - 重複：`{"items": [{"id": 5}, {"id": 1}, {"id": 4}, {"id": 4}]}`
6. **實驗：存到一半出錯會怎樣？** 送這個（第 3 站 15:00 到、14:00 走）：

   ```json
   {
     "items": [
       {"id": 1, "arrival_time": "08:00", "departure_time": "09:00"},
       {"id": 4, "arrival_time": "09:30", "departure_time": "10:00"},
       {"id": 5, "arrival_time": "15:00", "departure_time": "14:00"}
     ]
   }
   ```

   → `400`「第 3 站的離開時間比抵達時間早」。再 `GET` 第 1 天：**跟第 4 點存的一模一樣**。前兩站在程式裡其實已經改了，但還沒 `commit` 就出錯，所以一個字都沒存進去。
7. **反面實驗（選做）：每站各存一次會怎樣？**
   1. 把 `save_day` 最後的 `db.commit()` 剪下來，貼到迴圈裡面（`item.departure_time = ...` 那一行的下面，同樣的縮排），存檔。
   2. 再送一次第 6 點的資料 → 一樣是 `400`。
   3. `GET` 第 1 天：清水寺和伏見稻荷**都是第 0 站**，前兩站的時間也被改掉了。API 說失敗，資料卻改了一半。
   4. 把 `db.commit()` **移回迴圈外面**，存檔，再送一次第 4 點的資料，把順序還原。
8. 時間寫成 `"9:30"` → `422`，要寫 `"09:30"`。

### 3. 這一段結束後的資料夾

```
backend/
├── router/
│   └── itinerary.py       ← 改：加上 PUT 存檔
└── schemas/
    └── itinerary.py       ← 改：加上 ItineraryItemSave、ItineraryDaySave
```

### 4. 跟原專案對照

| 項目 | 原專案 | 我們 |
|---|---|---|
| 網址 | `PUT .../itinerary/save` | `PUT .../itinerary`，跟列出、新增同一個網址 |
| 要送什麼 | 順序（`ordered_item_ids`）和時間（`item_times`）分成兩份，再加交通資料（`legs`） | 一份清單，照新的順序，每一站帶著自己的時間。交通資料第 7 課再加 |
| 時間 | 用文字存 | 用 `time` 型別，Pydantic 會檢查格式 |
| 離開比抵達早 | 沒有檢查 | `400` |
| 回傳 | `{"ok": true}` | 存好的這一天，前端可以直接拿來更新畫面 |
| 另外一支只改順序的 `reorder` | 有 | 沒有，`PUT` 一支就夠了 |
| 要嘛全部成功、要嘛全部不改 | 有（`conn.begin()` 開交易） | 有（全部改完才 `commit`） |

### 5. 常見踩雷

| 症狀 | 原因 | 解法 |
|---|---|---|
| `400`「要送這一天的每一站……」 | 少送、多送（例如送到別天的站）、或重複 | 先 `GET` 這一天，照列出來的 id 全部送 |
| 送的 id 明明對，還是 `400` | 送成**景點的 id**了（例如花見小路送 `6`） | 送這一站的 id（`GET` 時最外層的 `"id"`） |
| `422`，`time_parsing` | 時間格式不對 | 寫成 `"09:30"`，小時要兩位數 |
| `ImportError: cannot import name 'ItineraryDaySave'` | `schemas/itinerary.py` 沒加，或 router 的 import 沒改 | 對照步驟 18、19 |
| `/docs` 裡沒有 `PUT` | `router/itinerary.py` 沒存檔 | 存檔，uvicorn 會自己重開 |
| 做完反面實驗後，順序一直怪怪的 | `db.commit()` 還在迴圈裡面 | 移回迴圈外面 |

### 📌 這一段的 3 個重點

1. **`PUT` 是整份換掉**：同一個網址，`GET` 看、`POST` 加一站、`PUT` 把整天重新存一次。
2. **交易：全部成功，或全部不改**。`commit` 只寫一次，放在所有檢查通過之後；中途出錯，沒存的改變會被丟掉。
3. **不能多、不能少、不能重複**：前端要把這一天的每一站都送來，用 `set` 比對。

### 6. 小測驗

（提示：每題都可以用「如果不這樣做，會發生什麼壞事？」來想。）

1. 為什麼 `db.commit()` 要放在迴圈外面，不能每改一站就存一次？
2. 前端如果少送一站，為什麼要擋下來，不能「沒送的就維持原樣」？
3. 存檔為什麼用 `PUT`，而不是 `POST`？
4. 第 7 課在畫面上把伏見稻荷從第 1 天拖到第 2 天，可以直接用這支 `PUT` 存嗎？

<details>
<summary>點開看解答</summary>

1. 每改一站就存一次的話，改到一半出錯時，前面幾站已經存進去了，就會留下「改了一半」的資料（反面實驗：兩個第 0 站，時間也改了一半），而且 API 還回「失敗」，前端會以為什麼都沒改。全部檢查完、全部改好才 `commit`，出錯時就一個字都不會存進去。
2. 沒送的那一站，`position` 會維持舊的值，就可能跟新的編號撞號。例如原本是第 2 站，新的順序裡又有別站被編成第 2 站，兩站搶同一個位置，順序就亂了。要整天一起存，才能保證編號剛好是 `0、1、2……`。
3. `POST` 是「新增」，每送一次就多一筆；這支是把這一天的順序和時間**整個重寫**，同樣的內容送幾次，結果都一樣，不會多出東西，這就是 `PUT` 的意思。
4. 不行。`PUT` 只能重排「這一天原本就有的站」，送別天的站會被擋下來（多送）。換天要分兩步：先 `DELETE` 第 1 天的那一站，再 `POST` 到第 2 天。

</details>

#### 你的實作紀錄（2026-11-04）

- `schemas/itinerary.py` 正確；`router/itinerary.py` 只多一個空行，`db.commit()` 在迴圈外面。
- 第 1 天存成：伏見稻荷 09:00～10:30 → 清水寺 11:00～12:00 → 花見小路 13:00（離開時間空著）；第 2 天：八坂神社。
- 第 6 課的 11 支 API 都在。檢查時送了一個少一站的 `PUT`，回 `400`，資料完全沒變。

---

## 第 6 課做出來的 API 總覽

第 7 課做畫面時，就是打這些 API：

| 手帳 | 動詞 | 網址 | 做什麼 |
|---|---|---|---|
| 封面 | `POST` | `/api/trips` | 建立行程 |
| | `GET` | `/api/trips` | 列出全部行程 |
| | `GET` | `/api/trips/{trip_id}` | 看一個行程 |
| | `DELETE` | `/api/trips/{trip_id}` | 刪掉行程（景點池、每日行程一起刪） |
| 想去清單 | `GET` | `/api/trips/{trip_id}/places` | 列出景點池 |
| | `POST` | `/api/trips/{trip_id}/places` | 加一個景點進景點池 |
| | `DELETE` | `/api/trips/{trip_id}/places/{destination_id}` | 從景點池移除（排好的那一站也一起刪） |
| 每天那一頁 | `GET` | `/api/trips/{trip_id}/days/{day_index}/itinerary` | 列出某一天 |
| | `POST` | `/api/trips/{trip_id}/days/{day_index}/itinerary` | 排一個景點到某一天的最後面 |
| | `PUT` | `/api/trips/{trip_id}/days/{day_index}/itinerary` | 存好某一天的順序和時間 |
| | `DELETE` | `/api/trips/{trip_id}/itinerary/{item_id}` | 刪掉一站，後面的往前補位 |
