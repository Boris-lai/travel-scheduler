# 第 3 課：AI 找景點（同步版）＋ Alembic 加欄位

> **狀態**：課前準備 ✅ ／ 上半（Alembic）✅ ／ 中半 A 段（搜尋、抓文章）✅ ／ 中半 B 段（Gemini、Places）✅ ／ 下半（搜尋 API）✅ → **第 3 課完成**
> **日期**：2026-10-23 ～
> **對照原專案**：`backend/services/ai_scraper.py`、`backend/services/geo_service.py`、`backend/worker/tasks.py`

---

## 這一課要決定的事

### 一定要用 Gemini 嗎？

不一定。這一步要 AI 做的事只是「讀一篇旅遊文章，列出景點」，Gemini、OpenAI、Claude 都做得到。真正的差別在「**文章由誰去抓**」：

| | 做法 A：AI 自己打開網址 | 做法 B：我們抓文章，再交給 AI |
|---|---|---|
| 流程 | 網址 → AI 自己抓、自己讀 → 景點 | 網址 → 我們抓成純文字 → AI 讀 → 景點 |
| 原專案 | 主要做法（Gemini `url_context`） | 備援做法（Jina Reader ＋ Gemini） |
| 換別家 AI | 要改很多，每家寫法不同 | 只改一個函式 |
| 除錯 | 看不到 AI 讀到什麼 | 看得到 AI 讀到的文字 |

**我們的決定**：用 **Gemini**（有免費額度，方便對照原專案），採**做法 B**，並把呼叫 AI 的部分包成一個函式 `extract_attractions(文章, 城市)`，以後要換 AI 只改這裡。

AI 就算讀錯或亂編景點，下一步也會用 Google Places 逐一查證，查不到的不會存進資料庫。

---

## 課前準備：申請兩把 API 金鑰

| 金鑰 | 用途 | 去哪申請 | 要信用卡嗎 |
|---|---|---|---|
| `GEMINI_API_KEY` | 讓 Gemini 讀文章、列景點 | Google AI Studio | 不用（免費額度） |
| `MAPS_API_KEY` | 用 Google Places 查景點的正確名稱、座標、ID | Google Cloud Console | 要（但有每月免費額度） |

### 一、Gemini API 金鑰

1. 打開 **https://aistudio.google.com/apikey**，用 Google 帳號登入。
2. 第一次使用要同意服務條款。新使用者 AI Studio 會自動幫你建一個專案和一把金鑰。
3. 如果沒有自動建立，按 **Create API key（建立 API 金鑰）**。
4. 複製金鑰。

注意事項：

- **不用綁信用卡**，沒綁就是免費方案。免費方案有每分鐘、每天的次數上限，學習用夠了，可以在 AI Studio 查看目前的額度。
- 免費方案送出的內容可能被 Google 用來改進產品。我們送的是公開的部落格文章，沒關係；但不要送私人資料。
- Gemini **不接受「沒有限制」的金鑰**。在 AI Studio 新建的金鑰預設就沒問題；如果金鑰旁邊標著 **Unrestricted**，要點 **Add restrictions → Restrict to Gemini API only → Restrict key**。

### 二、Google Maps（Places API）金鑰

1. **建專案**：打開 **https://console.cloud.google.com**，點最上方的專案選單 →「新增專案」，名稱填 `travel-scheduler`，建立後確認上方已切換到這個專案。
2. **綁帳單**：左上選單 →「帳單」→ 連結帳單帳戶（要填信用卡）。
3. **啟用 API**：左上選單 →「API 和服務」→「程式庫」→ 搜尋 **Places API (New)** → 點進去按「啟用」。
   - ⚠️ 要選名稱有 **(New)** 的那個。只叫「Places API」的是舊版，原專案和我們用的都是新版。
4. **建金鑰**：「API 和服務」→「憑證」→「建立憑證」→「API 金鑰」→ 複製金鑰。
5. **限制金鑰**（重要）：在憑證頁點這把金鑰 →「API 限制」選「限制金鑰」→ 勾選 **Places API (New)** →「儲存」。
   - 這樣金鑰就算外洩，也只能拿來查地點，不能用來呼叫其他會花錢的 Google 服務。
6. **設預算提醒**：「帳單」→「預算與快訊」→「建立預算」→ 金額填 **US$5**，在 50%、90%、100% 時寄信通知。
   - 預算提醒只會**寄信**，不會自動停止服務。它的用處是讓你在意外花錢時第一時間知道。

**會不會被收錢？** 我們用的是「Text Search」，要拿名稱、地址、座標，屬於 **Text Search Pro**，**每月前 5,000 次免費**。我們一次搜尋城市大約查 10 到 20 個景點，學習階段很難用完。

### 三、把金鑰放進 `.env`

打開 `backend/.env`，在 `DATABASE_URL` 下面加兩行（等號兩邊不要有空格，不用加引號）：

```
DATABASE_URL=postgresql+psycopg://travel:localdev@localhost:5433/travel_scheduler
GEMINI_API_KEY=貼上你的 Gemini 金鑰
MAPS_API_KEY=貼上你的 Maps 金鑰
```

變數名稱跟原專案一樣，方便對照。

### 金鑰安全守則

| ✅ 要 | ❌ 不要 |
|---|---|
| 只放在 `backend/.env`（已經在 `.gitignore` 裡） | 寫在程式碼裡 |
| 金鑰設好限制（Gemini 限 Gemini API、Maps 限 Places API (New)） | 上傳到 GitHub |
| 懷疑外洩就到後台刪掉、重建一把 | 貼到聊天室、截圖分享 |

---

### 課前準備的測試結果（2026-10-23）

| 金鑰 | 結果 |
|---|---|
| `GEMINI_API_KEY` | ✅ 可以用。可用模型包括 `gemini-3.5-flash`、`gemini-3-flash-preview`（原專案用的）等 |
| `MAPS_API_KEY` | 第一把 ❌ 403 `API_KEY_SERVICE_BLOCKED`；**換新金鑰後 ✅**，查「京都 清水寺」拿到真正的 `google_place_id`：`ChIJB_vchdMIAWARujTEUIZlr2I` |

**`API_KEY_SERVICE_BLOCKED` 是什麼意思？** 金鑰有設「API 限制」，但限制清單裡**沒有 Places API (New)**，所以被擋下來。最常見的原因是勾到了舊版的「Places API」。

修正方法：

1. 「API 和服務」→「已啟用的 API 和服務」，確認清單裡有 **Places API (New)**。沒有的話，回「程式庫」搜尋並啟用它。
2. 「API 和服務」→「憑證」→ 點你的金鑰 →「API 限制」的下拉選單 → 勾選 **Places API (New)**（舊版的「Places API」可以取消勾選）→「儲存」。
3. 設定可能要**等幾分鐘**才會生效，之後再測一次。

---

## 上半：用 Alembic 修改資料表

### 1. 學到的觀念

#### 為什麼需要 Alembic？

第 2 課說過：`create_all` **只會建表，不會改表**。可是 AI 寫進來的景點需要三個新欄位，表已經存在了，`create_all` 幫不上忙。

**Alembic 就是資料庫的版本控制**，很像 git：

| git | Alembic | 比喻 |
|---|---|---|
| 一次 commit | 一張 **migration（施工單）** | 「在 `destinations` 加三個欄位」 |
| commit 的內容 | 施工單裡的 `upgrade()` | 怎麼施工 |
| `git revert` | 施工單裡的 `downgrade()` | 怎麼拆掉、還原 |
| `git log` | `alembic history` | 施工紀錄 |
| 目前在哪個 commit | 資料庫裡的 `alembic_version` 表 | 倉庫門口掛的「目前施工到第幾張」牌子 |

#### autogenerate：Alembic 幫你寫施工單草稿

`alembic revision --autogenerate` 會**比對 Model 和資料庫**，把差異寫成一張施工單。
但它只是**草稿**（檔案裡還寫著 `please adjust!`），一定要打開來看一眼，確認它要做的事是你想要的，再執行。

#### 常用指令

| 指令 | 做什麼 |
|---|---|
| `alembic init alembic` | 第一次設定，產生 Alembic 的資料夾和設定檔 |
| `alembic revision --autogenerate -m "說明"` | 比對 Model 和資料庫，產生一張施工單 |
| `alembic upgrade head` | 把還沒執行的施工單全部執行，升到最新 |
| `alembic downgrade -1` | 退回上一張施工單 |
| `alembic current` | 看資料庫目前施工到哪一張 |
| `alembic history` | 看所有施工單的順序 |

#### 這次要加的欄位

| 欄位 | 存什麼 | 例子 |
|---|---|---|
| `input_region` | 使用者搜尋時輸入的字 | `京都` |
| `geo_tags` | 從大到小的地理標籤，讓搜尋「日本」也找得到京都的景點 | `日本,京都府,京都市` |
| `source` | 景點從哪來 | `ai`（AI 找的）或 `manual`（手動加的） |

另外替 `city_name` 和 `input_region` 加上 `index=True`（**索引**）。索引就像書的目錄，搜尋這兩欄時資料庫不用一頁一頁翻。

#### `server_default` 為什麼重要？

`source` 是 `Mapped[str]`，代表一定要有值（`NOT NULL`）。可是表裡**已經有資料**了，舊資料的 `source` 要填什麼？

`server_default="ai"` 告訴資料庫：「沒填的話就填 `ai`」。加欄位時，資料庫會自動幫所有舊資料填上 `ai`。少了它，施工會失敗，因為舊資料違反了「一定要有值」的規定。

### 2. 實作步驟

以下指令都在 `~/Desktop/travel-scheduler/backend` 裡執行。

#### 步驟 1：安裝 Alembic，產生設定

```bash
cd ~/Desktop/travel-scheduler/backend
uv add alembic
uv run alembic init alembic
```

會多出這些東西：

```
backend/
├── alembic.ini          ← Alembic 的設定檔
└── alembic/
    ├── env.py           ← 告訴 Alembic 去哪連資料庫、Model 在哪（等一下要改）
    ├── script.py.mako   ← 施工單的範本，不用動
    ├── README
    └── versions/        ← 施工單都放這裡，現在是空的
```

#### 步驟 2：修改 `alembic/env.py`

找到這一段：

```python
# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = None
```

整段換成：

```python
import models  # noqa: F401  ← 讓 Base 認識所有 Model
from core.database import DATABASE_URL, Base

# 連線網址從 .env 讀取，不寫死在 alembic.ini 裡
config.set_main_option("sqlalchemy.url", DATABASE_URL)

# 讓 autogenerate 知道 Model 長什麼樣，才能拿來跟資料庫比對
target_metadata = Base.metadata
```

- `import models`：跟 `create_tables.py` 一樣，要 import 才會向 Base 登記。
- `set_main_option`：`alembic.ini` 裡的 `sqlalchemy.url = driver://...` 是範例，不用改。我們從 `.env` 讀，因為 `alembic.ini` 會進 git，密碼不能寫在裡面。

#### 步驟 3：刪掉舊的表和 `create_tables.py`

舊的表是 `create_all` 建的，Alembic 不認識它。最乾淨的做法是刪掉，從現在開始**全部交給 Alembic 管**。裡面只有清水寺和伏見稻荷大社兩筆測試資料，刪掉沒關係。

```bash
cd ~/Desktop/travel-scheduler
docker compose exec db psql -U travel -d travel_scheduler -c "DROP TABLE destinations;"
rm backend/create_tables.py
```

`create_tables.py` 的工作，之後由 `alembic upgrade head` 接手。

#### 步驟 4：第一張施工單，建立 `destinations` 表

```bash
cd ~/Desktop/travel-scheduler/backend
uv run alembic revision --autogenerate -m "create destinations table"
```

應該會看到 `Detected added table 'destinations'`，並在 `alembic/versions/` 產生一個檔案，檔名像 `ac7cbd99faba_create_destinations_table.py`，前面那串亂碼是施工單編號，每個人都不一樣。

**打開這個檔案看一下**，`upgrade()` 裡應該是 `op.create_table('destinations', ...)`，欄位跟 `models.py` 一樣；`downgrade()` 是 `op.drop_table('destinations')`。確認沒問題後執行：

```bash
uv run alembic upgrade head
```

看到 `Running upgrade  -> ac7cbd99faba, create destinations table` 就成功了。檢查一下：

```bash
cd ~/Desktop/travel-scheduler
docker compose exec db psql -U travel -d travel_scheduler -c "\dt"
```

應該有兩張表：`destinations` 和 `alembic_version`。

#### 步驟 5：在 `/docs` 新增清水寺

用第 2 課的清水寺 JSON 新增一筆，讓表裡有「舊資料」，等一下觀察 `server_default` 的效果。

#### 步驟 6：在 `models.py` 加三個欄位

把 `Destination` 改成這樣（新增的是 `input_region`、`geo_tags`、`source`，`city_name` 多了 `index=True`）：

```python
class Destination(Base):
    __tablename__ = "destinations"

    id: Mapped[int] = mapped_column(primary_key=True)
    input_region: Mapped[str | None] = mapped_column(String(100), index=True)
    city_name: Mapped[str | None] = mapped_column(String(100), index=True)
    place_name: Mapped[str] = mapped_column(String(255))
    geo_tags: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    address: Mapped[str | None] = mapped_column(String(255))
    google_place_id: Mapped[str | None] = mapped_column(String(255), unique=True)
    lat: Mapped[Decimal | None] = mapped_column(Numeric(10, 8))
    lng: Mapped[Decimal | None] = mapped_column(Numeric(11, 8))
    source: Mapped[str] = mapped_column(String(20), server_default="ai")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

⚠️ 存檔後**先不要**碰 `/docs`。這時 Model 已經有新欄位，資料庫還沒有，打 API 會出錯（見常見踩雷）。

#### 步驟 7：第二張施工單，加欄位

```bash
cd ~/Desktop/travel-scheduler/backend
uv run alembic revision --autogenerate -m "add input_region geo_tags source"
```

應該會看到它偵測到 3 個新欄位、2 個新索引。打開新產生的檔案，`upgrade()` 應該長這樣：

```python
op.add_column('destinations', sa.Column('input_region', sa.String(length=100), nullable=True))
op.add_column('destinations', sa.Column('geo_tags', sa.String(length=255), nullable=True))
op.add_column('destinations', sa.Column('source', sa.String(length=20), server_default='ai', nullable=False))
op.create_index(op.f('ix_destinations_city_name'), 'destinations', ['city_name'], unique=False)
op.create_index(op.f('ix_destinations_input_region'), 'destinations', ['input_region'], unique=False)
```

確認後執行：

```bash
uv run alembic upgrade head
```

#### 步驟 8：確認結果

```bash
cd ~/Desktop/travel-scheduler
docker compose exec db psql -U travel -d travel_scheduler -c "SELECT id, place_name, input_region, source FROM destinations;"
```

清水寺是在加欄位**之前**新增的，但它的 `source` 已經自動填上 `ai`，這就是 `server_default` 的效果。`input_region` 是空的，因為它允許空值。

再用 `\d destinations` 看一下，新欄位會排在最後面。資料庫加欄位一律加在尾巴，跟 `models.py` 裡的順序無關，不影響使用。

#### 加碼實驗：退回再升級

```bash
cd ~/Desktop/travel-scheduler/backend
uv run alembic downgrade -1    # 退回上一張：三個欄位和兩個索引會被拆掉
uv run alembic current         # 顯示第一張施工單的編號
uv run alembic upgrade head    # 再升級回來
uv run alembic history         # 看施工紀錄
```

### 3. 這半課結束後的資料夾

```
backend/
├── .env
├── pyproject.toml
├── uv.lock
├── alembic.ini                  ← 新增
├── alembic/                     ← 新增
│   ├── env.py
│   └── versions/
│       ├── xxxx_create_destinations_table.py
│       └── xxxx_add_input_region_geo_tags_source.py
├── main.py
├── models.py                    ← 多了三個欄位
├── core/database.py
├── schemas/destination.py
└── router/destinations.py
```

`create_tables.py` 已經刪除，由 Alembic 取代。

### 4. 跟原專案對照

| 項目 | 原專案 | 我們 |
|---|---|---|
| 建表 | 一個 `schema.sql` 寫好所有表 | Alembic 施工單 |
| 改表 | 沒有工具，要自己連進資料庫下 `ALTER TABLE` | 改 Model → autogenerate → `upgrade head` |
| 改過什麼有沒有紀錄 | 沒有 | `alembic/versions/` 裡每張施工單都進 git |
| `source` 欄位 | MySQL 的 `ENUM('ai','manual')` | `String(20)`，預設 `ai`。PostgreSQL 的 ENUM 搭配 Alembic 很麻煩，先用文字 |
| `geo_tags` 搜尋 | MySQL 的全文索引（`FULLTEXT ... ngram`） | 先不加索引，用 `LIKE` 搜尋。景點數量不多時夠快 |

### 5. 常見踩雷

| 症狀 | 原因 | 解法 |
|---|---|---|
| 施工單的 `upgrade()` 裡只有 `pass` | Alembic 沒看到任何差異：`env.py` 沒改、忘了 `import models`，或 Model 根本沒改 | 檢查步驟 2 和步驟 6 |
| `Target database is not up to date.` | 上一張施工單還沒 `upgrade` 就產生新的 | 先 `uv run alembic upgrade head`，再產生新的 |
| `relation "destinations" already exists` | 舊的表沒刪掉 | 做步驟 3 |
| `column destinations.input_region does not exist`（API 回 500） | 改了 Model，但還沒 `upgrade` | 跑 `uv run alembic upgrade head` |
| `No module named 'core'` 或 `'models'` | 不是在 `backend/` 裡執行 | 先 `cd ~/Desktop/travel-scheduler/backend` |
| 想修改一張已經 `upgrade` 過的施工單 | — | **不要改舊的**，改 Model 後產生一張新的。跟 git 一樣，已經發生的紀錄不要竄改 |

### 6. 小測驗

1. `create_all` 和 Alembic 最大的差別是什麼？
2. 如果 `source` 沒有寫 `server_default="ai"`，步驟 7 執行 `upgrade head` 時會發生什麼事？
3. 改了 `models.py` 加欄位，但忘了 `alembic upgrade head`，這時打 `GET /api/destinations` 會怎樣？為什麼？
4. 資料庫裡的 `alembic_version` 表是做什麼用的？

<details>
<summary>點開看解答</summary>

1. `create_all` 只會建立**不存在**的表，已經存在的表一律跳過、不會修改。Alembic 會比對 Model 和資料庫的差異，產生施工單，可以**修改已經存在的表**（加欄位、加索引…），而且每次修改都有紀錄、可以退回。
2. 會**失敗**。`source` 是 `NOT NULL`，但表裡已經有清水寺這筆舊資料，資料庫不知道要幫它填什麼，只能填空值，違反了「一定要有值」的規定，整張施工單就會被拒絕（錯誤訊息類似 `column "source" ... contains null values`）。
3. 會拿到 **500**。SQLAlchemy 照著新的 Model 去查，`SELECT` 裡包含 `input_region`，但資料庫的表裡還沒有這個欄位，資料庫回報「欄位不存在」。Model 和資料庫**必須一致**，Alembic 的工作就是讓兩邊保持一致。
4. 記錄這個資料庫**目前施工到哪一張施工單**。`upgrade head` 時，Alembic 會看這張表，只執行還沒做過的施工單，所以重複執行也不會重複施工。

</details>

#### 你的實作紀錄（2026-10-23）

- 施工單：`e35b79a83790_create_destinations_table.py` → `e13117e75b93_add_input_region_geo_tags_source.py`，都已升級 ✅
- 步驟 5（新增清水寺）一開始跳過了，所以步驟 8 查到 0 筆。後來用「退回 → 用 SQL 塞一筆 → 再升級」補做：

  ```bash
  uv run alembic downgrade -1
  docker compose exec db psql -U travel -d travel_scheduler -c "INSERT INTO destinations (place_name, city_name) VALUES ('清水寺', '京都');"
  uv run alembic upgrade head
  ```

  結果清水寺的 `source` 自動變成 `ai` ✅。這一筆是在**還沒有** `source` 欄位時塞進去的，是 `server_default` 幫它補上的。
- 為什麼補做時不能用 `/docs`：退回後 Model 有新欄位、資料庫沒有，打 API 會 500（就是 Q3）。

#### 你的作答（2026-10-23）

**Q1. `create_all` 和 Alembic 最大的差別？**
- 你的答案：Alembic 只有負責改表，不建表。 ❌ 剛好反過來
- 正解：**`create_all` 只會建表、不會改表；Alembic 建表和改表都會。** 你的第一張施工單 `create destinations table`，裡面就是 `op.create_table(...)`，表就是 Alembic 建的。Alembic 還多了「紀錄」和「可以退回」。

**Q2. 沒有 `server_default="ai"`，加欄位時會怎樣？**
- 你的答案：不知。
- 正解：**整張施工單會失敗。** `source` 規定一定要有值（`NOT NULL`），但清水寺是舊資料，資料庫不知道該幫它填什麼。PostgreSQL 會回報 `column "source" of relation "destinations" contains null values`，然後拒絕整個施工。你剛剛補做的實驗就是這個情境，因為有 `server_default`，才順利補上 `ai`。

**Q3. 改了 Model 但忘了 `upgrade`，打 `GET /api/destinations` 會怎樣？**
- 你的答案：會看不到剛剛新增的欄位。 ❌
- 正解：**整支 API 會壞掉，回 500**，不是只少幾個欄位。SQLAlchemy 照著 Model 要「所有欄位」，包含 `input_region`；資料庫說「沒有這個欄位」，整個查詢就被拒絕。
- 比喻：你拿著新的貨架規格去倉庫領貨，要求「連產地那格一起拿」，可是倉庫的貨架還是舊的、根本沒有產地那格。倉庫管理員不會只給你其他格，而是整張領貨單直接退回。

**Q4. `alembic_version` 表的用途？**
- 你的答案：有點像是資料庫欄位目前更改到什麼版本。 ✅
- 補充：更精確地說，是「目前執行到哪一張施工單」。`upgrade head` 會看這張表，只執行還沒做過的施工單。

**💡 兩課的 Q3 是同一種直覺。** 第 2 課你以為「沒有 `try/except` 就會存進兩筆重複資料」，這一課以為「欄位不一致只是看不到新欄位」。兩題的真相一樣：**資料庫非常嚴格，不符合規定就整個拒絕**，不會「部分成功」或「默默放行」。之後遇到資料庫相關的問題，可以先想：「資料庫會不會直接拒絕？」

---

## 中半：AI 找景點的 4 個零件

```
「京都」
  ① blog_search.py ── DuckDuckGo 搜尋 → 3 個候選部落格網址
  ② article.py ────── Jina Reader 把文章抓成純文字
  ③ gemini.py ─────── Gemini 讀文章 → 景點清單（名稱、城市、介紹、地理標籤）
  ④ places.py ─────── Google Places 查證 → 補上 google_place_id、座標、地址
```

每個零件都是一個獨立的檔案，放在 `backend/services/`，**都可以單獨測試**。下半課再把它們串成一支 API。

中半分兩段：**A 段**做 ①②（不需要金鑰），**B 段**做 ③④（需要 Gemini 和 Maps 金鑰）。

### 開始前的測試結果（2026-10-24）

上課前我先在暫存區把 4 個零件完整跑過一次：

| 零件 | 結果 |
|---|---|
| 金鑰 | Gemini、Maps 都正常；`gemini-3.5-flash` 和 `gemini-3-flash-preview` 都能產生內容 |
| ① 搜尋 | 「京都」「台北」都能找到 3 篇合格的文章 |
| ② 抓文章 | 第 1 篇（utravel.com.hk）只抓到 **2,338 字**，幾乎都是選單；第 2 篇（bring-you.info）有 **13,398 字** |
| ③ Gemini | 從 bring-you 那篇讀出 **29 個景點**，約 25 秒。第一次試的時候 `gemini-3.5-flash` 回了 **503（需求量太大）**，換模型就成功 |
| ④ Places | 「金閣寺」回傳的名稱是英文 `Kinkaku-ji`；亂編的「會飛的魔法城堡遊樂園」竟然被配到一間真的「復古遊樂場」 |

這些真實狀況決定了接下來的設計：

- ② 的結果 → ① 要回傳**多個候選網址**，第一篇不能用就換下一篇。
- ③ 的結果 → Gemini 要有**備用模型**，忙線就自動換。
- ④ 的結果 → 景點名稱**保留 AI 從文章讀到的中文**，Google 只拿來補 ID、座標、地址。而且 Google 查證**不是萬能**，它會盡量找「最像的」，所以真正防止 AI 亂編的，是「只讓 AI 從真實文章裡挑」（做法 B）。

---

### A 段：零件 ① 搜尋部落格、零件 ② 抓文章

#### 1. 學到的觀念

##### 四道閘門：從搜尋結果裡挑出好文章

DuckDuckGo 一次給 15 筆結果，不是每筆都能用。我們用 4 道閘門過濾，**全部通過**才算合格：

| 閘門 | 檢查什麼 | 擋掉什麼 |
|---|---|---|
| 1 | 網址裡有沒有黑名單網域 | 臉書、YouTube、維基百科、訂房網站、新聞網站、廣告連結 |
| 2 | 標題＋摘要有沒有提到這個地點 | 跟這個地點無關的文章 |
| 3 | 有沒有負面關鍵字 | 新聞、徵才、租屋、天氣… |
| 4 | 有沒有旅遊關鍵字 | 不是在介紹景點的文章 |

閘門 2 要**同時看標題和摘要**，因為很多台北的文章標題只寫「淡水」「北投」這種區名，不會寫「台北」。只看標題的話，搜尋台北會一篇都找不到。

##### 為什麼回傳 3 個網址，不是 1 個？

排第一的文章不一定能用。實測搜尋京都時，第 1 篇抓下來只有 2,338 字，幾乎都是網站選單。多準備幾個候選，下半課的流程就能「這篇不行換下一篇」。

##### Jina Reader：把網頁變成純文字

網頁原始碼充滿 HTML 標籤、廣告、JavaScript。只要在網址前面加上 `https://r.jina.ai/`，Jina 就會把網頁轉成乾淨的純文字（Markdown 格式），不用金鑰。原專案的備援引擎也是用它。

抓回來後我們再做一點清理：拿掉圖片、連結只留文字、刪掉網站選單、壓縮空行，最後只留前 15,000 字（大約 1 萬個 token），夠放下一篇攻略文的重點。

清理用到的是**正規表達式**（regex），一種「描述文字長相」的寫法。這裡看得懂註解就好，不用背。

##### `if __name__ == "__main__":`：零件自己的測試按鈕

```python
if __name__ == "__main__":
    # 只有「直接執行這個檔案」時才會跑
    # 被別的檔案 import 時不會跑
```

這讓每個零件都能單獨測試，下半課被 API import 時又不會亂跑。

##### `uv run python -m services.blog_search 京都`

- `-m services.blog_search`：把 `services/blog_search.py` 當成**模組**來執行。這樣檔案裡的 `from services.xxx import ...` 才找得到其他零件。
- `京都`：傳給程式的參數，在程式裡用 `sys.argv[1]` 拿到。

#### 2. 實作步驟

##### 步驟 9：安裝套件

```bash
cd ~/Desktop/travel-scheduler/backend
uv add ddgs requests google-genai
```

| 套件 | 用途 |
|---|---|
| `ddgs` | 用程式搜尋 DuckDuckGo |
| `requests` | 送 HTTP 請求（抓 Jina、呼叫 Google Places） |
| `google-genai` | Gemini 的官方套件（B 段才用到，先一起裝） |

##### 步驟 10：新增 `backend/services/blog_search.py`

```python
import re

from ddgs import DDGS

# 閘門 1：這些網站不是旅遊部落格（社群、訂房、新聞、廣告…）
EXCLUDED_DOMAINS = [
    "google", "facebook", "youtube", "instagram", "wikipedia",
    "dcard", "ptt.cc", "mobile01",
    "klook", "kkday", "agoda", "booking", "tripadvisor", "trip.com", "getyourguide",
    "ettoday", "ltn", "udn", "chinatimes",
    "/aclick",
]
# 閘門 3：出現這些字，通常不是遊記
NEGATIVE_KEYWORDS = ["新聞", "徵才", "職缺", "租屋", "售票", "天氣", "旅行社"]
# 閘門 4：至少要出現一個旅遊相關的字
TRAVEL_KEYWORDS = ["景點", "遊記", "推薦", "行程", "攻略", "懶人包", "一日遊", "自由行"]


def find_blog_urls(location: str, limit: int = 3) -> list[str]:
    query = f"{location} 旅遊 景點 推薦 懶人包"
    with DDGS() as ddgs:
        results = ddgs.text(query, region="tw-tz", max_results=15, backend="auto")

    urls = []
    for r in results:
        url = r["href"]
        text = re.sub(r"\s+", "", r["title"] + r["body"])  # 標題＋摘要，去掉所有空白

        if any(domain in url.lower() for domain in EXCLUDED_DOMAINS):  # 閘門 1
            continue
        if location not in text:  # 閘門 2：要提到這個地點
            continue
        if any(word in text for word in NEGATIVE_KEYWORDS):  # 閘門 3
            continue
        if not any(word in text for word in TRAVEL_KEYWORDS):  # 閘門 4
            continue

        urls.append(url)
        if len(urls) == limit:
            break
    return urls


if __name__ == "__main__":
    import sys

    for url in find_blog_urls(sys.argv[1]):
        print(url)
```

| 寫法 | 意思 |
|---|---|
| `region="tw-tz"` | 優先找台灣的繁體中文結果 |
| `backend="auto"` | 讓 ddgs 自動輪流用不同的搜尋來源，某一個被擋時還有別的可以用 |
| `any(... for ...)` | 「只要有任何一個符合就是 True」 |
| `continue` | 這筆不合格，跳過，看下一筆 |

##### 語法拆解：四道閘門

**整體結構：像機場安檢。** 每一筆搜尋結果排隊走過 4 道門，**任何一道門響了**（`if` 成立）就 `continue`：請這筆離開，換下一筆。4 道門都沒響，才會走到底下的 `urls.append(url)`，被收進名單。

**`in`：「有沒有出現在裡面」**

```python
"京都" in "2026京都景點推薦"     # True，「京都」有出現
"台北" in "2026京都景點推薦"     # False
"京都" not in "2026京都景點推薦" # False，not in 就是「沒出現」
```

**`.lower()`：轉成小寫。** 網址可能寫成 `YouTube.com`，轉成 `youtube.com` 才比對得到黑名單裡的 `"youtube"`。

**`any(條件 for 變數 in 清單)`：「清單裡只要有任何一個符合，就是 True」**

```python
any(domain in url.lower() for domain in EXCLUDED_DOMAINS)
```

讀法：拿 `EXCLUDED_DOMAINS` 裡的每一個 `domain`，檢查「`domain` 有沒有出現在網址裡」，**只要有一個出現**就是 `True`。它等於下面這段長版寫法：

```python
found = False
for domain in EXCLUDED_DOMAINS:
    if domain in url.lower():
        found = True
        break          # 找到一個就夠了，不用再找
```

**四道門逐一翻譯**

| 閘門 | 程式 | 白話 | 什麼時候被擋 |
|---|---|---|---|
| 1 | `any(domain in url.lower() for domain in EXCLUDED_DOMAINS)` | 網址裡有沒有**任何一個**黑名單網域？ | 有 |
| 2 | `location not in text` | 標題＋摘要裡**沒有**提到這個地點？ | 沒提到 |
| 3 | `any(word in text for word in NEGATIVE_KEYWORDS)` | 有沒有**任何一個**負面字？ | 有 |
| 4 | `not any(word in text for word in TRAVEL_KEYWORDS)` | 是不是**一個**旅遊字都沒有？ | 一個都沒有 |

注意閘門 1、3 和閘門 4 剛好相反：黑名單是「有一個就擋」，旅遊字是「一個都沒有才擋」，所以閘門 4 前面多了 `not`。

**實際走一遍（搜尋「京都」）**

| 搜尋結果 | 閘門 1 | 閘門 2 | 閘門 3 | 閘門 4 | 結果 |
|---|---|---|---|---|---|
| `youtube.com/...`「京都一日遊 Vlog」 | ❌ 網址有 `youtube` | — | — | — | 擋下 |
| `bring-you.info/...`「2026京都景點 30+必去…」 | ✅ | ✅ 有「京都」 | ✅ | ✅ 有「景點」 | **收進名單** |
| `example.com/...`「京都今日天氣」 | ✅ | ✅ | ❌ 有「天氣」 | — | 擋下 |
| `example.com/...`「京都拉麵店排名」 | ✅ | ✅ | ✅ | ❌ 一個旅遊字都沒有 | 擋下 |

一被擋就 `continue`，後面的閘門不會再檢查，所以表格裡是「—」。

測試：

```bash
uv run python -m services.blog_search 京都
uv run python -m services.blog_search 台北
```

各應該印出 3 個網址。搜尋結果每天都會變，跟日誌裡的不一樣是正常的。

##### 步驟 11：新增 `backend/services/article.py`

```python
import re

import requests

MAX_CHARS = 15000  # 大約 1 萬個 token，夠放下一篇攻略文的重點


def fetch_article_text(url: str) -> str:
    # Jina Reader：在網址前面加上 r.jina.ai/，它會把網頁轉成乾淨的純文字
    resp = requests.get(f"https://r.jina.ai/{url}", timeout=60)
    resp.raise_for_status()
    return clean_text(resp.text)


def clean_text(text: str) -> str:
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)  # 拿掉圖片：![說明](網址)
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)  # 連結只留文字：[文字](網址) → 文字
    lines = [
        line
        for line in text.split("\n")
        # 很短的清單項目，幾乎都是網站選單，例如「*   京都交通」
        if not (line.strip().startswith(("*", "-")) and len(line.strip()) < 20)
    ]
    text = "\n".join(lines)
    text = re.sub(r"\n\s*\n+", "\n", text)  # 連續空行壓成一行
    return text[:MAX_CHARS]


if __name__ == "__main__":
    import sys

    text = fetch_article_text(sys.argv[1])
    print(text[:800])
    print(f"\n……（共 {len(text)} 字）")
```

| 寫法 | 意思 |
|---|---|
| `timeout=60` | 最多等 60 秒，不要無限等下去 |
| `resp.raise_for_status()` | 如果回應是錯誤（例如 404、500），直接丟出例外，不要假裝成功 |
| `text[:MAX_CHARS]` | 只取前 15,000 個字 |

測試：把步驟 10 印出來的網址貼進來（網址要加引號，因為有些網址含中文或特殊符號）：

```bash
uv run python -m services.article "貼上步驟 10 的其中一個網址"
```

會印出文章開頭 800 字和總字數。**三個網址都試試看**，比較一下字數，你應該會發現有的網址抓得到內容、有的抓不太到。

#### 3. 這一段結束後的資料夾

```
backend/
├── ...
└── services/                ← 新增
    ├── blog_search.py       ← 零件 ①
    └── article.py           ← 零件 ②
```

#### 4. 跟原專案對照

| 項目 | 原專案（`services/ai_scraper.py`） | 我們 |
|---|---|---|
| 檔案 | 搜尋、抓文章、Gemini 全部擠在一個 432 行的檔案 | 一個零件一個檔案，各自可以測試 |
| 搜尋結果 | 找到**第一個**合格網址就回傳 | 回傳**最多 3 個**候選 |
| 閘門 2 | 只看標題 | 看標題＋摘要 |
| 搜尋來源 | 只用 DuckDuckGo | `backend="auto"`，被擋時自動換來源 |
| 抓文章 | 主要讓 Gemini 自己開網址（`url_context`），失敗才用 Jina | 一律先用 Jina 抓成文字（做法 B） |
| 中文網址 | 手動用 `urllib.parse.quote` 編碼 | `requests` 會自動處理 |

#### 5. 常見踩雷

| 症狀 | 原因 | 解法 |
|---|---|---|
| `DDGSException: No results found` | 搜尋引擎暫時擋了你的 IP（搜太多次） | 等一陣子再試。之前遇過的特殊情況：要 `uv add -U primp`（ddgs 底層的連線套件），而且要**完全重啟**程式 |
| 印出 0 個或不到 3 個網址 | 15 筆結果裡合格的不夠 | 正常現象，冷門地點會比較少。可以換個地點試試 |
| `No module named 'services'` | 用了 `python services/blog_search.py`，或不在 `backend/` 裡 | 在 `backend/` 裡用 `uv run python -m services.blog_search` |
| `ReadTimeout` | 目標網站或 Jina 太慢，超過 60 秒 | 換下一個網址 |
| 抓到的字數很少 | 那個網站內容是用 JavaScript 動態產生，或大部分是選單 | 換下一個網址，這就是要準備 3 個候選的原因 |

#### 6. 小測驗

1. 為什麼 `find_blog_urls` 要回傳 3 個網址，而不是只回傳第一個？
2. `if __name__ == "__main__":` 底下的程式，什麼時候會執行、什麼時候不會？
3. 閘門 2 為什麼要同時看標題和摘要，不能只看標題？

<details>
<summary>點開看解答</summary>

1. 排第一的文章不一定能用：可能抓不到內容（實測第一篇只有 2,338 字，幾乎都是選單），也可能是美食文、不是景點文。多準備幾個候選，下半課的流程就能「這篇不行換下一篇」。
2. **直接執行**這個檔案時會跑（例如 `uv run python -m services.blog_search 京都`）；被別的檔案 **import** 時不會跑。所以它很適合放零件自己的測試程式。
3. 很多文章的標題只寫比較小的地名。例如台北的文章標題常常只寫「淡水」「北投」，不會寫「台北」，但摘要裡會提到。只看標題的話，這些好文章全部會被擋掉。

</details>

#### 你的實作紀錄（2026-10-24）

- `blog_search.py`、`article.py` 都寫好了 ✅，跟測試版只差在編輯器自動換行。
- 用你的程式搜尋「京都」，三篇文章抓到的字數：

| 網址 | 字數 |
|---|---|
| utravel.com.hk/news/…京都自由行… | 13,094 |
| letsgokyoto.com/tourist-attractions-in-kyoto/ | 15,000（到上限了，後面被截掉） |
| fullfenblog.tw/kyoto/ | 5,439 |

  跟前一天比，搜尋結果和排名都變了，字數也差很多。這就是要準備多個候選的原因。

#### 你的作答（2026-10-24）

**Q1. 為什麼回傳 3 個網址，不是只回傳第一個？**
- 你的答案：因為有限制 `limit = 3`。 🔶 這是「程式怎麼做到的」，不是「為什麼要這樣做」
- 正解：因為**排第一的文章不一定能用**。前一天測試時，第一名只抓到 2,338 字，幾乎都是選單；今天三篇從 5,439 字到 15,000 字都有。多準備幾篇，第一篇不行還能換下一篇。
- 小技巧：題目問「為什麼」時，要回答「目的」或「不這樣做會發生什麼壞事」，而不是描述程式碼。

**Q2. `if __name__ == "__main__":` 什麼時候會執行？**
- 你的答案：不知。
- 正解：Python 會給每個檔案一個名字，存在 `__name__` 裡：
  - **直接執行**的那個檔案，名字是 `"__main__"`
  - **被 import** 的檔案，名字是它自己的模組名，例如 `"services.article"`

  所以 `if __name__ == "__main__":` 的意思就是「我是不是被直接執行的那一個？」。是的話才跑底下的測試程式。
- 不加會怎樣：B 段的 `gemini.py` 會 `from services.article import fetch_article_text`。如果 `article.py` 的測試程式沒有包在這個 `if` 裡，一 import 就會執行它，拿 `gemini.py` 收到的參數（「京都」）當成網址去抓，直接出錯。

**Q3. 閘門 2 為什麼要同時看標題和摘要？**
- 你的答案：不知。
- 正解：很多好文章的**標題只寫比較小的地名**。例如介紹台北的文章，標題常常是「淡水一日遊」「北投溫泉懶人包」，不會出現「台北」，只有摘要會提到。只看標題的話，這些文章全部會被擋掉。
- 這是真實踩過的雷：你上一次重寫這個專案時，閘門 2 只看標題，結果**搜尋台北一篇文章都找不到**。改成「標題或摘要」之後，台北就能找到 22 個景點。

---

### B 段：零件 ③ Gemini 列景點、零件 ④ Google 查證

#### 1. 學到的觀念

##### Prompt：給 AI 的工作說明書

我們給 Gemini 的指示分成三塊：

| 區塊 | 內容 | 為什麼 |
|---|---|---|
| 任務 | 找出位於該地點的景點、只要有專有名詞的地點、去重、寫 40 字介紹 | 不寫清楚，AI 會把「吃拉麵」「看夜景」這種活動也列進來 |
| 欄位 | `name`、`city`、`description`、`geo_tags` 各是什麼 | 讓 AI 知道每一格要填什麼 |
| 文章 | 零件 ② 抓下來的純文字 | AI **只能從這篇文章裡挑**，這是防止 AI 亂編景點最重要的一道防線 |

`PROMPT.format(location=..., article=...)` 會把範本裡的 `{location}`、`{article}` 換成真正的值。

##### 結構化輸出：給 AI 一張填空表格

| | 原專案的做法 | 我們的做法 |
|---|---|---|
| 怎麼要求 | 在 prompt 裡拜託 AI「請回傳 JSON、不要加 \`\`\`json」 | 直接告訴 Gemini 回答的**格式**：`response_schema=list[AttractionAI]` |
| 拿到什麼 | 一段文字，要用正規表達式把 `[...]` 挖出來，再 `json.loads` | `resp.parsed` 直接就是一串 `AttractionAI` 物件 |
| 會不會壞掉 | AI 多講一句話、多加個符號，解析就可能失敗 | Gemini 保證照格式回答 |

`AttractionAI` 是 Pydantic 的 class，跟第 2 課的點餐單、出餐單一樣。這次它是「**AI 的答案卷**」。

比喻：原專案像是請 AI「寫一篇作文」，再自己從作文裡挑出重點；我們是直接發一張**填空表格**給 AI。

##### 備用模型：忙線就換一個

```python
for model in MODELS:
    try:
        ...                      # 試這個模型
        return resp.parsed       # 成功就直接回傳，迴圈結束
    except errors.ServerError as e:
        print(...)               # 失敗就印個訊息，迴圈繼續試下一個
raise RuntimeError(...)          # 全部都失敗才會走到這裡
```

只接 `errors.ServerError`（5xx，Google 那邊的暫時性問題，例如 503 忙線），**不接**所有錯誤：

| 錯誤 | 是誰的問題 | 換模型有用嗎 |
|---|---|---|
| `ServerError`（5xx） | Google 那邊忙或壞 | ✅ 有，換一個模型可能就好了 |
| `ClientError`（4xx），例如金鑰錯誤 | 我們這邊 | ❌ 沒用，換幾個都一樣錯，應該讓錯誤直接浮出來 |

##### Google Places 查證

```
POST https://places.googleapis.com/v1/places:searchText
Header：X-Goog-Api-Key（金鑰）、X-Goog-FieldMask（要哪些欄位）
Body：{"textQuery": "京都 金閣寺", "languageCode": "zh-TW"}
```

- **Field Mask（欄位遮罩）**：告訴 Google「我只要這 4 個欄位」。**要得越多越貴**，這 4 個屬於 Text Search Pro，每月前 5,000 次免費。
- 查詢字串是「地點 ＋ 景點名」，例如「京都 金閣寺」，避免查到別的城市的同名地點。
- 只取第一筆（最符合的）。查不到就回傳 `None`，這個景點就丟掉。

**它的兩個限制（實測發現）：**

| 狀況 | 例子 | 我們怎麼處理 |
|---|---|---|
| 名稱可能是英文 | 「金閣寺」→ `Kinkaku-ji` | 存進資料庫的名稱用 **AI 讀到的中文**，Google 的名稱只回傳成 `google_name` 給你參考 |
| 會「盡量找最像的」 | 亂編的「會飛的魔法城堡遊樂園」→ 配到真的「復古遊樂場」 | 所以 Google 查證**不能完全防止 AI 亂編**。真正的防線是「AI 只能從真實文章裡挑」 |

##### 一次搜尋大概花多少

| 項目 | 用量 | 費用 |
|---|---|---|
| Gemini | 1 次，約 1 萬個輸入 token | 免費方案內 |
| Google Places | 每個景點 1 次，一篇文章大約 30 次 | 每月 5,000 次免費，大約夠搜尋 160 個城市 |

#### 2. 實作步驟

##### 步驟 12：新增 `backend/services/gemini.py`

```python
import os

from dotenv import load_dotenv
from google import genai
from google.genai import errors, types
from pydantic import BaseModel

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# 依序嘗試：前一個忙線（503）就換下一個
MODELS = ["gemini-3.5-flash", "gemini-3-flash-preview"]

PROMPT = """以下是一篇關於「{location}」的旅遊文章。

# 任務
1. 找出文章裡提到、位於「{location}」的旅遊景點。
2. 只要有專有名詞的明確地點（寺廟、神社、公園、街道、建築…），不要活動、美食或模糊的描述（例如「看夜景的地方」）。
3. 相同景點只留一個。
4. 每個景點寫一段 40 字左右的繁體中文介紹，內容要根據文章。

# 每個景點的欄位
- name：景點名稱
- city：所在城市
- description：介紹
- geo_tags：從大到小的地理標籤，用逗號隔開，例如「日本,京都府,京都市」

# 文章
{article}
"""


# AI 回傳的每個景點長這樣（Gemini 會照這個格式回答）
class AttractionAI(BaseModel):
    name: str
    city: str
    description: str
    geo_tags: str


def extract_attractions(article: str, location: str) -> list[AttractionAI]:
    prompt = PROMPT.format(location=location, article=article)
    for model in MODELS:
        try:
            resp = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=list[AttractionAI],
                ),
            )
            return resp.parsed
        except errors.ServerError as e:
            print(f"⚠️ {model} 暫時無法使用（{e.code}），換下一個模型")
    raise RuntimeError("Gemini 的模型都暫時無法使用，請稍後再試")


if __name__ == "__main__":
    import sys

    from services.article import fetch_article_text

    location, url = sys.argv[1], sys.argv[2]
    attractions = extract_attractions(fetch_article_text(url), location)
    for a in attractions:
        print(f"{a.name}｜{a.city}｜{a.geo_tags}｜{a.description}")
    print(f"\n共 {len(attractions)} 個景點")
```

| 寫法 | 意思 |
|---|---|
| `response_mime_type="application/json"` | 回答要是 JSON |
| `response_schema=list[AttractionAI]` | JSON 的格式是「一串 `AttractionAI`」 |
| `resp.parsed` | SDK 已經幫你把 JSON 轉成 `AttractionAI` 物件 |
| `a.name`、`a.city` | 物件的屬性，像第 2 課的 `destination.id` |

測試（會花 20 到 30 秒，請耐心等）：

```bash
cd ~/Desktop/travel-scheduler/backend
uv run python -m services.gemini 京都 "https://letsgokyoto.com/tourist-attractions-in-kyoto/"
```

應該會印出 20 到 30 個景點，每行是「名稱｜城市｜地理標籤｜介紹」。

##### 步驟 13：新增 `backend/services/places.py`

```python
import os

import requests
from dotenv import load_dotenv

load_dotenv()

MAPS_API_KEY = os.getenv("MAPS_API_KEY")
SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
# 只拿這 4 個欄位：屬於 Text Search Pro，每月前 5,000 次免費。要得越多越貴
FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.location"


def verify_place(name: str, location: str) -> dict | None:
    resp = requests.post(
        SEARCH_URL,
        headers={"X-Goog-Api-Key": MAPS_API_KEY, "X-Goog-FieldMask": FIELD_MASK},
        json={"textQuery": f"{location} {name}", "languageCode": "zh-TW"},
        timeout=10,
    )
    resp.raise_for_status()
    places = resp.json().get("places", [])
    if not places:
        return None  # Google 查不到：可能是 AI 編的，或名稱太模糊，就丟掉

    place = places[0]  # 只取最符合的第一筆
    return {
        "google_place_id": place["id"],
        "google_name": place["displayName"]["text"],  # 參考用：可能是英文
        "address": place.get("formattedAddress"),
        "lat": place["location"]["latitude"],
        "lng": place["location"]["longitude"],
    }


if __name__ == "__main__":
    import sys

    print(verify_place(sys.argv[1], sys.argv[2]))
```

| 寫法 | 意思 |
|---|---|
| `requests.post(..., json={...})` | 送出 POST，`json=` 會自動把 dict 轉成 JSON 並設定好格式 |
| `resp.json().get("places", [])` | 拿 `places` 這一格，沒有的話就當成空清單，避免出錯 |
| `-> dict \| None` | 這個函式回傳 dict，或是 `None`（查不到） |

測試：

```bash
uv run python -m services.places 金閣寺 京都
uv run python -m services.places 嵐山 京都
uv run python -m services.places 會飛的魔法城堡遊樂園 京都
```

第三個是**亂編的名字**，注意看 Google 回傳了什麼。

#### 3. 這一段結束後的資料夾

```
backend/services/
├── blog_search.py       ← 零件 ①
├── article.py           ← 零件 ②
├── gemini.py            ← 零件 ③（新增）
└── places.py            ← 零件 ④（新增）
```

#### 4. 跟原專案對照

| 項目 | 原專案 | 我們 |
|---|---|---|
| Gemini 怎麼讀文章 | 主要讓 Gemini 自己開網址（`url_context`） | 我們抓好文字再交給 Gemini |
| 怎麼拿到 JSON | 正規表達式從回答裡挖 `[...]`，再 `json.loads` | 結構化輸出，`resp.parsed` 直接拿到物件 |
| 模型 | `gemini-3-flash-preview` | `gemini-3.5-flash`，忙線時換 `gemini-3-flash-preview` |
| 忙線處理 | 同一個模型休息 10 秒重試一次，再改用 Jina 引擎 | 直接換下一個模型 |
| 景點名稱 | 用 Google 回傳的名稱取代（`正名`） | 保留 AI 讀到的中文，Google 名稱只參考 |
| Places 查詢 | `services/geo_service.py` 的 `get_coordinates` | `services/places.py` 的 `verify_place`，寫法幾乎一樣 |

#### 5. 常見踩雷

| 症狀 | 原因 | 解法 |
|---|---|---|
| `⚠️ ... 暫時無法使用（503）` 然後成功 | 第一個模型忙線，自動換了第二個 | 正常，這就是備用模型的作用 |
| `RuntimeError: Gemini 的模型都暫時無法使用` | 兩個模型都忙線 | 等幾分鐘再試 |
| `ClientError: 429` | 免費方案的次數用完了（每分鐘或每天） | 等一下再試；可以在 AI Studio 查看額度 |
| `ClientError: 400/403` 跟金鑰有關 | 金鑰錯誤或沒設限制 | 檢查 `.env` 的 `GEMINI_API_KEY` |
| `requests.exceptions.HTTPError: 403` | Maps 金鑰被擋 | 見「課前準備」的 `API_KEY_SERVICE_BLOCKED` 修正方法 |
| 印出 `None` | Google 真的查不到這個名字 | 正常，這個景點會被丟掉 |
| Gemini 列出 0 個或很少景點 | 文章內容太少，或是美食文、不是景點文 | 換一篇文章，下半課的流程會自動換 |

#### 6. 小測驗

1. 結構化輸出（`response_schema`）比「在 prompt 裡拜託 AI 回 JSON，再自己解析」好在哪裡？
2. 為什麼 `except` 只接 `errors.ServerError`，不乾脆接住所有錯誤？
3. 存進資料庫的景點名稱，為什麼用 AI 的 `name`，而不用 Google 的 `google_name`？
4. 觀察題：用亂編的名字查 Google Places，結果是什麼？這代表什麼？

<details>
<summary>點開看解答</summary>

1. 自己解析很脆弱：AI 只要多講一句話、多加一個 \`\`\`json，`json.loads` 就可能失敗，原專案才需要用正規表達式先把 `[...]` 挖出來。結構化輸出是**直接規定回答的格式**，Gemini 保證照格式回答，`resp.parsed` 直接就是物件，不用自己挖。
2. 只有 5xx（Google 那邊的暫時性問題）換模型才有用。如果是 4xx，例如金鑰錯誤，換幾個模型都一樣錯；這時應該讓錯誤直接浮出來，你才知道要去修金鑰。全部接住的話，真正的問題會被藏起來，最後只看到「模型都無法使用」，很難查出原因。
3. Google 的名稱可能是英文（「金閣寺」會變成 `Kinkaku-ji`），對台灣使用者不友善。AI 的名稱是從中文文章裡讀到的，比較自然。Google 我們只拿來補 ID、座標和地址。
4. Google 不會說「查不到」，而是配到一個**看起來有點像的真實地點**（實測配到「復古遊樂場」）。這代表 Google 查證**不能完全防止 AI 亂編**，只能擋掉完全查不到的名字。真正的防線是「AI 只能從真實文章裡挑景點」。

</details>

#### 你的作答（2026-10-24）

這一段的小測驗你選擇直接看解答，沒有先作答。複習時可以先遮住解答，自己回答一次。

#### 你的實作紀錄（2026-10-24）

**步驟 12：Gemini 讀 letsgokyoto.com 那篇文章**

```
⚠️ gemini-3.5-flash 暫時無法使用（503），換下一個模型
清水寺｜京都市｜日本,京都府,京都市｜建立於西元778年的標誌性古寺…
八坂庚申堂｜京都市｜日本,京都府,京都市｜清水寺附近的熱門景點…
伏見稻荷大社｜京都市｜日本,京都府,京都市｜全日本稻荷神社總本社…
…
鞍馬寺｜京都市｜日本,京都府,京都市｜位於北邊山區的靈氣聖地…

共 32 個景點
```

- **備用模型真的派上用場了**：`gemini-3.5-flash` 忙線，程式自動換成 `gemini-3-flash-preview`，最後成功。
- 32 個景點裡大多是寺廟、神社、街道。少數像「京都車站」「京都大學」算是邊緣案例，AI 的判斷不一定百分之百符合你的期待，之後想更嚴格可以再調整 prompt。
- 宇治的平等院鳳凰堂被正確標成 `宇治市`。

**步驟 13：Google Places 查證**

| 查詢 | `google_name` | 結果 |
|---|---|---|
| 金閣寺 | `Kinkaku-ji` | 名稱變成英文 → 證實要保留 AI 的中文名稱 |
| 嵐山 | `嵐山` | 正常 |
| 會飛的魔法城堡遊樂園（亂編的） | `復古遊樂場` | 被配到一個真實地點 → 證實 Google 查證不是萬能 |

---

## 下半：把 4 個零件串成搜尋 API

### 開始前的測試結果（2026-10-24）

上課前我先在暫存區用臨時資料庫完整跑過一次：

| 測試 | 結果 |
|---|---|
| 第一次搜尋「京都」 | **54.8 秒**，新增 19 個景點（中間 `gemini-3.5-flash` 又 503，自動換模型） |
| 第二次搜尋「京都」 | **0.017 秒**，直接從資料庫拿 |
| 第一次搜尋進行中，另外打 `/health` | **0.001 秒**就回應 |
| 搜尋空白地點 | 422 |

### 1. 學到的觀念

#### 整條流程

```
POST /api/search {"location": "京都"}
  │
  ├─ router/search.py（櫃檯）
  │    資料庫已經有 5 個以上京都的景點？── 有 → 直接回傳（0.02 秒）
  │
  └─ 不夠 → services/ingest.py（廚房流程）
       get_attractions_from_web()
         ① 3 個候選網址，一篇一篇試
         ② 抓文章 ── 少於 1,000 字 → 換下一篇
         ③ Gemini ── 少於 3 個景點 → 換下一篇
       ingest_location()
         ④ 每個景點用 Google 查證 ── 查不到 → 丟掉
            資料庫已經有這個 google_place_id → 跳過
         全部加進 Session → 最後一次 commit
       → 重新查資料庫 → 回傳（約 30 到 60 秒）
```

#### 為什麼流程寫在 `services/ingest.py`，不寫在 router 裡？

- **router 只做櫃檯的事**：收單、決定要不要上網找、把錯誤翻譯成 HTTP 狀態碼。
- **`ingest_location()` 是廚房流程**：它不知道也不在乎是誰呼叫它。

第 4 課要讓 Celery worker 在背景跑這條流程，到時候 worker 直接呼叫 `ingest_location()` 就好，流程一行都不用改。

#### `or_()` 和 `.contains()`

```python
select(Destination).where(
    or_(
        Destination.input_region == location,
        Destination.city_name.contains(location),
        Destination.geo_tags.contains(location),
    )
)
```

翻成 SQL 就是：

```sql
SELECT * FROM destinations
WHERE input_region = '京都'
   OR city_name LIKE '%京都%'
   OR geo_tags LIKE '%京都%'
```

`or_` 是「三個條件只要有一個成立」，`.contains()` 是「有出現就算」（`LIKE '%…%'`）。所以 `city_name` 是「京都市」也查得到；`geo_tags` 是「日本,京都府,京都市」，搜尋「日本」也查得到。

#### 兩層去重

| 情況 | 怎麼擋 |
|---|---|
| 資料庫**已經有**這個景點（例如之前搜過京都） | 先把資料庫所有的 `google_place_id` 放進 `existing_ids`，有的就跳過 |
| 這一批**自己重複**（AI 用兩個名字講同一個地方，Google 查到同一個 ID） | 每加一筆就 `existing_ids.add(...)`，下一筆同 ID 就會被跳過 |

`existing_ids` 用 `set`（集合），因為「某個值在不在裡面」這種查詢，`set` 最快。

#### 一次 commit：全部成功，或全部不算

所有景點都先 `db.add()` 放進 Session，最後才 `commit()` 一次。如果中途有任何一筆違反資料庫規定，**整批都不會存進去**。這又是「資料庫很嚴格，不合規定就整個拒絕」。

#### 錯誤翻譯成 HTTP 狀態碼

| 錯誤 | 狀態碼 | 意思 |
|---|---|---|
| 地點是空字串（Pydantic 擋下） | 422 | 你送的資料格式不對 |
| `RuntimeError`（Gemini 的模型都忙線） | **503** Service Unavailable | 我們這邊暫時無法服務，請稍後再試 |

跟第 2 課把 `IntegrityError` 翻成 409 是同一個概念：**把程式內部的錯誤，翻譯成客人看得懂的狀態碼。**

#### 同步寫法真正的問題（修正我之前的說法）

我之前說「搜尋時整支 API 都卡著」，**這不精確**。實測時，搜尋進行中打 `/health`，0.001 秒就回應了。

原因是 FastAPI 遇到用 `def` 寫的 API，會把它丟到**執行緒池**（一群幫手）去跑，所以其他請求還是有人處理。

真正的問題是這三個：

| 問題 | 說明 |
|---|---|
| **使用者乾等將近一分鐘** | 畫面沒有任何進度，很多人會以為壞掉、直接關掉 |
| **可能被中途切斷** | 瀏覽器、Nginx 這些中間層通常等 60 秒左右就會放棄連線，搜尋做到一半，使用者卻拿到錯誤 |
| **同時很多人搜尋，資源會被佔光** | 每個搜尋從頭到尾都佔著一個幫手和一條資料庫連線（SQLAlchemy 預設最多 15 條）。20 個人同時搜新城市，其他人連查個景點都要排隊 |

第 4 課的解法：API 收到搜尋後**馬上**回一個號碼牌，真正的工作交給 Celery worker 在背景做，做完再通知前端。

### 2. 實作步驟

#### 步驟 14：清掉舊的測試資料

資料庫裡的清水寺是第 3 課上半手動塞的，沒有 `google_place_id`，會跟 AI 找到的清水寺重複。先清掉：

```bash
cd ~/Desktop/travel-scheduler
docker compose exec db psql -U travel -d travel_scheduler -c "DELETE FROM destinations;"
```

#### 步驟 15：`schemas/destination.py` 的出餐單加上新欄位

在 `DestinationOut` 裡加三行（位置不重要，這裡放在對應的欄位旁邊）：

```python
class DestinationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    place_name: str
    city_name: str | None
    input_region: str | None   # 新增
    geo_tags: str | None       # 新增
    description: str | None
    address: str | None
    google_place_id: str | None
    lat: float | None
    lng: float | None
    source: str                # 新增
    created_at: datetime
```

#### 步驟 16：`router/destinations.py` 手動新增的景點標成 `manual`

只改一行：

```python
destination = Destination(**payload.model_dump(), source="manual")
```

這樣就分得出哪些是 AI 找的、哪些是手動加的。

#### 步驟 17：新增 `backend/services/ingest.py`

```python
import requests
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from models import Destination
from services.article import fetch_article_text
from services.blog_search import find_blog_urls
from services.gemini import AttractionAI, extract_attractions
from services.places import verify_place

MIN_ARTICLE_CHARS = 1000  # 文章少於這個字數，多半沒抓到內容
MIN_ATTRACTIONS = 3  # AI 找到的景點少於這個數量，就換下一篇


def find_existing(db: Session, location: str) -> list[Destination]:
    """查資料庫裡跟這個地點有關的景點"""
    stmt = (
        select(Destination)
        .where(
            or_(
                Destination.input_region == location,
                Destination.city_name.contains(location),
                Destination.geo_tags.contains(location),
            )
        )
        .order_by(Destination.id)
    )
    return list(db.scalars(stmt).all())


def get_attractions_from_web(location: str) -> list[AttractionAI]:
    """① ② ③：候選文章一篇一篇試，直到 AI 找到足夠的景點"""
    for url in find_blog_urls(location):
        print(f"📄 試這篇：{url}")
        try:
            article = fetch_article_text(url)
        except requests.RequestException as e:
            print(f"   ❌ 抓不到文章：{e}")
            continue
        if len(article) < MIN_ARTICLE_CHARS:
            print(f"   ❌ 文章太短（{len(article)} 字），換下一篇")
            continue

        attractions = extract_attractions(article, location)
        if len(attractions) < MIN_ATTRACTIONS:
            print(f"   ❌ 只找到 {len(attractions)} 個景點，換下一篇")
            continue

        print(f"   ✅ AI 找到 {len(attractions)} 個景點")
        return attractions
    return []


def ingest_location(db: Session, location: str) -> int:
    """完整流程：上網找景點 → Google 查證 → 存進資料庫。回傳新增了幾筆"""
    attractions = get_attractions_from_web(location)

    # 資料庫裡已經有的 google_place_id，放進 set，查「有沒有」最快
    existing_ids = set(db.scalars(select(Destination.google_place_id)).all())

    added = 0
    for a in attractions:
        place = verify_place(a.name, location)  # ④
        if place is None:
            print(f"   🗑️ Google 查不到，丟掉：{a.name}")
            continue
        if place["google_place_id"] in existing_ids:
            print(f"   ⏭️ 已經有了，跳過：{a.name}")
            continue

        existing_ids.add(place["google_place_id"])  # 防止這一批自己重複
        db.add(
            Destination(
                place_name=a.name,  # 用 AI 讀到的中文名稱
                city_name=a.city,
                description=a.description,
                geo_tags=a.geo_tags,
                input_region=location,
                google_place_id=place["google_place_id"],
                address=place["address"],
                lat=place["lat"],
                lng=place["lng"],
                source="ai",
            )
        )
        added += 1

    db.commit()
    print(f"💾 新增了 {added} 個景點")
    return added
```

| 寫法 | 意思 |
|---|---|
| `except requests.RequestException` | 抓文章時任何網路錯誤（逾時、404…）都接住，換下一篇 |
| `return []` | 3 篇都不行，就回傳空清單，後面什麼都不會存 |
| `select(Destination.google_place_id)` | 只查這一欄，不用把整筆景點資料都拿出來 |
| `set(...)` | 轉成集合，「在不在裡面」查得最快 |

#### 步驟 18：新增 `backend/schemas/search.py`

```python
from pydantic import BaseModel, Field

from schemas.destination import DestinationOut


class SearchIn(BaseModel):
    location: str = Field(min_length=1, max_length=50)


class SearchOut(BaseModel):
    location: str
    searched_web: bool  # 這次有沒有上網找
    added: int  # 這次新增了幾個景點
    destinations: list[DestinationOut]
```

`destinations: list[DestinationOut]`：出餐單裡**放了一串**景點出餐單，Pydantic 會一筆一筆幫你整理。

#### 步驟 19：新增 `backend/router/search.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from schemas.search import SearchIn, SearchOut
from services.ingest import find_existing, ingest_location

router = APIRouter()

ENOUGH = 5  # 資料庫已經有這麼多景點，就不用再上網找


@router.post("/api/search", response_model=SearchOut)
def search(payload: SearchIn, db: Session = Depends(get_db)):
    location = payload.location.strip()

    existing = find_existing(db, location)
    if len(existing) >= ENOUGH:
        return {"location": location, "searched_web": False, "added": 0, "destinations": existing}

    try:
        added = ingest_location(db, location)
    except RuntimeError as e:  # Gemini 的模型都忙線
        raise HTTPException(status_code=503, detail=str(e))

    return {
        "location": location,
        "searched_web": True,
        "added": added,
        "destinations": find_existing(db, location),
    }
```

`.strip()` 會去掉前後的空白，避免「 京都 」和「京都」被當成不同地點。

#### 步驟 20：`main.py` 接上新的 router

```python
from fastapi import FastAPI

from router import destinations, search

app = FastAPI()

app.include_router(destinations.router)
app.include_router(search.router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

#### 步驟 21：測試

確認伺服器開著（`uv run uvicorn main:app --reload --port 8000`），**把跑伺服器的終端機分頁放在看得到的地方**，搜尋過程會一行一行印出來。

**① 第一次搜尋京都（要等將近一分鐘）**：打開 `/docs` → `POST /api/search` → Try it out → 送出：

```json
{"location": "京都"}
```

回傳裡 `searched_web` 應該是 `true`，`added` 是新增的數量。伺服器終端機會印出 `📄 試這篇…`、`✅ AI 找到…`、`💾 新增了…`。

**② 第二次搜尋京都**：再送一次一樣的內容。這次應該**一下子就回來**，`searched_web` 是 `false`。

**③ 用 curl 量時間**：

```bash
curl -s -o /dev/null -w "花了 %{time_total} 秒\n" -X POST localhost:8000/api/search -H "Content-Type: application/json" -d '{"location": "京都"}'
```

**④ 觀察實驗：搜尋進行中，其他 API 會不會卡住？**

1. 在 `/docs` 搜尋一個**還沒搜過**的城市，例如 `{"location": "大阪"}`，按下送出。
2. 趁它還在跑，用瀏覽器打開 http://localhost:8000/health。
3. 觀察 `/health` 是不是馬上就回應了。

#### 步驟 22：去資料庫看看

```bash
cd ~/Desktop/travel-scheduler
docker compose exec db psql -U travel -d travel_scheduler -c "SELECT input_region, count(*) FROM destinations GROUP BY input_region;"
```

會列出每個搜尋地點各存了幾個景點。

### 3. 這一課結束後的資料夾

```
backend/
├── main.py                    ← 接上 search router
├── models.py
├── alembic/ ...
├── core/database.py
├── schemas/
│   ├── destination.py         ← 出餐單多了 3 個欄位
│   └── search.py              ← 新增
├── router/
│   ├── destinations.py        ← 手動新增標成 manual
│   └── search.py              ← 新增：櫃檯
└── services/
    ├── blog_search.py
    ├── article.py
    ├── gemini.py
    ├── places.py
    └── ingest.py              ← 新增：廚房流程
```

### 4. 跟原專案對照

| 項目 | 原專案 | 我們 |
|---|---|---|
| 「夠不夠」的門檻 | 資料庫有 5 個以上就直接回傳 | 一樣 |
| 搜尋條件 | `input_region =` 或 `geo_tags LIKE` 或 `city_name LIKE`，而且只找 `source = 'ai'` | 一樣，但不限 `source` |
| 流程放哪 | `services/ai_scraper.py` 的 `run_web_scraping_workflow` ＋ `worker/tasks.py` | `services/ingest.py` 的 `ingest_location` |
| 去重 | 用 `WHERE google_place_id IN (...)` 只查這一批的 ID | 把資料庫所有 ID 拿出來比。景點少時比較簡單；景點很多時，原專案的寫法比較省 |
| 文章不能用時 | 只有一篇，失敗就整個失敗 | 3 篇候選，一篇一篇試 |
| 快取 | 前面還有一層 Redis 快取 | 還沒有，第 4 課加 |
| 背景任務 | 有（Celery） | 還沒有，第 4 課加 |

### 5. 常見踩雷

| 症狀 | 原因 | 解法 |
|---|---|---|
| 等了很久，`/docs` 顯示錯誤或沒反應 | 正常要等 30 到 60 秒；超過 2 分鐘才算異常 | 看伺服器終端機印到哪一步 |
| `503`：`Gemini 的模型都暫時無法使用` | 兩個模型都忙線 | 等幾分鐘再試 |
| 回傳 `added: 0`、`destinations` 是空的 | 3 篇文章都不能用 | 換個地點，或換個說法（例如「京都市」） |
| 搜尋結果裡有兩個清水寺 | 沒做步驟 14，舊的測試資料還在 | 做步驟 14 |
| `500`，終端機出現 `column ... does not exist` | 資料庫欄位跟 Model 不一致 | `uv run alembic upgrade head` |
| `500`，終端機出現 `HTTPError: 403` | Maps 金鑰被擋 | 見「課前準備」的修正方法 |
| 同一個城市，兩個人同時第一次搜尋，其中一個 500 | 兩邊都上網找，都想存同樣的景點，後 commit 的違反 `UNIQUE` | 目前的同步寫法擋不住，第 4 課再處理 |

### 6. 小測驗

1. 為什麼整條流程寫在 `services/ingest.py`，而不是直接寫在 `router/search.py` 裡？
2. `existing_ids.add(place["google_place_id"])` 這一行如果拿掉，什麼情況下會出事？會出什麼事？
3. 第二次搜尋京都，為什麼只要 0.02 秒？
4. 觀察題：步驟 21 ④，搜尋進行中打 `/health`，有沒有馬上回應？那同步寫法真正的問題是什麼？

<details>
<summary>點開看解答</summary>

1. router 只負責櫃檯的事（收單、決定要不要上網找、把錯誤翻成狀態碼），廚房流程獨立出來，**誰都可以呼叫**。第 4 課 Celery worker 要在背景跑這條流程時，直接呼叫 `ingest_location()` 就好，不用改流程本身。
2. 當 AI 用**兩個不同的名字講同一個地方**（例如「清水寺」和「音羽山清水寺」），Google 會查到同一個 `google_place_id`。少了這一行，兩筆都會被 `db.add()`，最後 `commit()` 時違反 `UNIQUE`，**整批 commit 失敗，一個景點都存不進去**，API 回 500。又是「資料庫很嚴格，整個拒絕」。
3. 第一次搜尋已經把景點存進資料庫了。第二次搜尋時，`find_existing` 查到 5 個以上，直接回傳，**完全不用上網、不用問 AI**。資料庫在這裡扮演了「快取」的角色。
4. **有，馬上回應**（實測 0.001 秒）。FastAPI 會把 `def` 寫的 API 丟到執行緒池跑，所以其他請求不受影響。同步寫法真正的問題是：① 使用者要乾等將近一分鐘，沒有任何進度；② 等太久可能被瀏覽器或 Nginx 中途切斷；③ 很多人同時搜尋時，每個搜尋都佔著一個幫手和一條資料庫連線，資源會被佔光，其他人也跟著變慢。

</details>

#### 你的實作紀錄（2026-10-25）

| 測試 | 結果 |
|---|---|
| 第一次搜尋「京都」 | 第 1 篇（utravel）就成功，Gemini 503 → 自動換模型，AI 找到 26 個，**全部存進去**。從 22:51:36 到 22:52:35，約 **59 秒** |
| 第二、三次搜尋「京都」 | 只有一個 `SELECT` 就回傳了 |
| curl 量時間 | **0.005 秒** |
| 搜尋「大阪」 | 第 1 篇（boo2k.com）成功，又一次 503 換模型，30 個景點，約 **62 秒** |
| 搜大阪的過程中打 `/health` | 終端機在 `📄 試這篇` 和 `⚠️ 503` 中間印出 `GET /health 200 OK` → **其他請求沒有被卡住** |
| 資料庫統計 | 大阪 30 筆、京都 26 筆 |

從伺服器的紀錄裡還能看到幾件事：

- **兩次搜尋都要 60 秒左右**，剛好碰到很多中間層的逾時界線，第 4 課非改不可。
- **26 筆景點只用了一個 `INSERT`**：SQLAlchemy 會把同一批 `db.add()` 合併成一次寫入，最後一個 `COMMIT`。
- **只讀資料的請求，結尾會出現 `ROLLBACK`**：這是正常的。`get_db` 結束時呼叫 `db.close()`，沒有 commit 的交易會被收掉。只是讀資料，沒有東西需要存，所以不影響任何資料。
- 大阪的結果裡有枚方市、池田市、泉佐野市的景點，它們都屬於**大阪府**，不是大阪市。AI 和 Google 都沒錯，只是「大阪」這兩個字本身就有點模糊。
- 河原町通的 `google_place_id` 是一長串 `Ei5LYXdh…`，跟其他景點的 `ChIJ…` 長得不一樣。街道、路名這類地點，Google 會給這種比較長的 ID，一樣可以用。

#### 你的作答（2026-10-25）

**Q1. 為什麼流程寫在 `services/ingest.py`，不寫在 `router/search.py`？**
- 你的答案：把 4 個零件串在一起變一個 API。 🔶 這是在說 `ingest.py`「做了什麼」，不是「為什麼要獨立出來」
- 正解：**讓流程可以被別人呼叫**。router 只做櫃檯的事；第 4 課 Celery worker 要在背景跑這條流程，直接呼叫 `ingest_location()` 就好，不用經過 API，流程也一行都不用改。

**Q2. 拿掉 `existing_ids.add(...)` 會怎樣？**
- 你的答案：防止重複？ 🔶 方向對，但沒說出「什麼情況」和「什麼後果」
- 正解：當 AI 用**兩個名字講同一個地方**（例如「清水寺」和「音羽山清水寺」），Google 查到同一個 `google_place_id`。少了這行，兩筆都會被加進 Session，`commit()` 時違反 `UNIQUE`，**整批一筆都存不進去**，API 回 500。

**Q3. 第二次搜尋為什麼這麼快？**
- 你的答案：因為第一次已經存進資料庫，而邏輯一開始是先去資料庫搜尋，有的話就直接回傳了。 ✅ 完全正確，而且講得很清楚

**Q4. 搜尋進行中打 `/health` 有沒有馬上回應？**
- 你的答案：有。 ✅ 你的伺服器紀錄也證明了：`GET /health 200 OK` 就出現在搜大阪的過程中間

**💡 又出現一次「做什麼」和「為什麼」的混淆。** 這一課的 Q1、Q2，跟中半 A 段的 Q1 一樣，你回答的是程式「做了什麼」。遇到「為什麼」的題目，可以用這個句型檢查自己：「**如果不這樣做，會發生什麼壞事？**」

- Q1：不獨立出來 → 第 4 課 Celery 要用時，得把流程從 router 裡拆出來重寫
- Q2：拿掉那一行 → 同一個景點出現兩次時，整批存不進去
