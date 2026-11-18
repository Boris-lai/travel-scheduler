# 第 8 課：登入、權限、分享

> **狀態**：第 1 段（後端：註冊、登入、登出）✅ ／ 第 2 段（前端：登入／註冊畫面）✅ ／ 第 3 段（權限：行程有主人）✅
> **日期**：2026-11-14 ～
> **對照原專案**：`backend/core/security.py`、`backend/core/dependencies.py`、`backend/router/auth.py`、`backend/schemas/auth.py`、`backend/router/share.py`、`frontend/app/context/AuthContext.tsx`、`frontend/app/components/layout/AuthCorner.tsx`、`frontend/app/lib/tripIndex.ts`

---

## 這一課在整個專案的位置

到第 7 課為止，網站**誰都能看、誰都能改**：打開 `/trips` 會看到所有人的行程，知道行程編號就能刪掉別人的行程。這一課要讓行程**有主人**。

跟原專案一樣，**沒登入也能建立行程**：先記在瀏覽器裡，登入之後再「認領」到帳號下。原專案在認領和分享這兩個地方有權限漏洞，我們做的時候會一起補起來。

分成 5 段：

| 段 | 做什麼 | 新東西 |
|---|---|---|
| **1** | 後端：註冊、登入、登出 | `users` 表、密碼雜湊、session、cookie |
| 2 | 前端：登入／註冊畫面、右上角顯示名字、登出 | 前端怎麼知道「我是誰」 |
| 3 | 權限：行程有主人，每支行程 API 都要檢查 | 401 和 403、共用的檢查 |
| 4 | 匿名行程：沒登入也能建立，登入後認領（補上原專案的漏洞） | 瀏覽器的 `localStorage`、自己加 header |
| 5 | 分享：產生分享連結，任何人都能看、不能改（補上原專案的漏洞） | `share_token`、唯讀頁面 |

---

## 第 1 段：後端：註冊、登入、登出

### 開始前的測試結果（2026-11-14）

我先在另一份複製的後端、資料庫（`pretest13`）和 Redis（第 1 號資料庫）測過，用 curl 打 API：

| 測試 | 結果 |
|---|---|
| 註冊 `Boris@Example.com` | `201`，回 `{"id": 1, "email": "boris@example.com", ...}`（Email 變小寫了），同時發了一個 `sid` cookie：`HttpOnly`，14 天後失效 |
| 帶著 cookie 問 `GET /api/me` | 回會員資料 |
| 不帶 cookie 問 `/api/me` | `200`，回 `null` |
| 用 `boris@example.com`（小寫）再註冊一次 | `409`「這個 Email 已經註冊過了」 |
| 密碼 `123` | `422`，至少要 8 個字 |
| Email 填 `not-an-email` | `422`，沒有 `@` |
| Redis | 多了一筆 `session:xxxx`，值是 `1`（會員的 id），剩 1209600 秒（14 天） |
| 登出 | `204`，cookie 被清掉，Redis 那一筆也不見了 |
| 登出後，拿**舊的號碼**再問 `/api/me` | `null`：號碼已經作廢 |
| 密碼錯 | `401`「Email 或密碼錯誤」，0.038 秒 |
| Email 不存在 | `401`，**同一句話**，0.034 秒（時間差不多，猜不出有沒有這個帳號） |
| 用 `BORIS@example.com` 登入 | `200`，大小寫不影響 |
| 登入兩次 | Redis 裡有 2 個號碼（像手機、電腦各登入一次），兩個都能用 |
| 資料庫的 `password_hash` | `$argon2id$v=19$m=65536,t=3,p=4$...`，97 個字，看不出原本的密碼 |
| 同一個密碼雜湊兩次 | 兩次結果**不一樣**，但都能驗證成功 |

### 1. 學到的觀念

#### 會員手環

延續手搖飲店的比喻，這次店裡多了會員制：

| 網站 | 手搖飲店 |
|---|---|
| 註冊 | 辦會員。店員**不抄**你的密碼，而是把密碼丟進果汁機**打成泥**再存起來 |
| 登入 | 報 Email 和密碼。店員把你剛說的密碼用**同一台果汁機**再打一次，跟存起來的泥比對，一樣就給你一條**手環** |
| 手環上的字 | 一串隨機的亂碼（`sid`），上面**沒有**你的名字或密碼 |
| 櫃檯的小本子（Redis） | 記著「這串亂碼 → 會員 1 號」，14 天後自動劃掉 |
| 之後每次點餐 | 不用再報密碼，亮手環就好（瀏覽器每次都會自動帶上 cookie） |
| 登出 | 店員把小本子上那一行**劃掉**，再請你把手環丟掉 |

#### 密碼為什麼要「打成泥」

資料庫存的是**雜湊**（hash），不是密碼本身。雜湊就像果汁機：

- 同樣的水果，打出來的泥一樣，所以可以拿來**比對**。
- 泥**變不回**水果：就算資料庫被偷了，小偷也只拿到一堆泥，看不出密碼。
- 每次打的時候，會先加一點**隨機的鹽**（salt），所以同一個密碼打兩次，結果也不一樣（開始前的測試最後一行）。鹽就記在泥的前面（`$argon2id$...$鹽$泥`），比對時拿出來用同樣的鹽再打一次。好處是：小偷沒辦法先算好「常見密碼 → 泥」的對照表來查。

我們用的演算法是 **Argon2**，套件是 **pwdlib**，跟你 todo-app 用的一樣。

#### Session 和 JWT

你在 todo-app 用過 **JWT**（`access_token`）。這一課用 **session**，兩種都是「登入之後發一個東西放進 cookie」，差別在手環上寫了什麼：

| | Session（這一課） | JWT（todo-app） |
|---|---|---|
| 手環上寫什麼 | 一串沒有意義的亂碼 | 會員編號、到期時間，再加上店家的**防偽簽名** |
| 伺服器怎麼認 | 查櫃檯的小本子（Redis） | 驗證簽名，不用查小本子 |
| 登出 | 劃掉小本子那一行，**馬上**失效 | 手環本身到期前都有效，所以 todo-app 的 `access_token` 只給很短的時間，再用 `refresh_token` 換新的 |
| 要多一台 Redis 嗎 | 要（我們第 4 課就有了） | 不用 |

我們已經有 Redis，登出又能馬上失效，所以跟原專案一樣用 session。

**你問的：主流比較推薦哪一種？（2026-11-15）**

沒有絕對比較好，看系統長什麼樣子：

| 情況 | 主流比較推薦 |
|---|---|
| 一個網站，配自己的後端（我們就是） | **Session**。Django、Rails、Laravel 內建的登入都是 session |
| 很多個服務都要各自確認「你是誰」，又不想共用資料庫或 Redis | **JWT**（短效 access ＋ refresh，像 todo-app） |
| 用別人的登入服務（Firebase、Supabase、Auth0）、「用 Google 登入」 | **JWT**：A 系統發的，B 系統不用問 A，自己驗簽名就知道是真的 |

JWT 擅長的是**跨系統**傳遞身分。只是自己的網站登入自己的後端的話，用 JWT 反而要多處理「登出作廢不了」的問題，所以這裡用 session。

#### Cookie 的三個設定

```python
response.set_cookie(
    key="sid",
    value=sid,
    max_age=14 天,
    httponly=True,
    samesite="lax",
    secure=COOKIE_SECURE,
)
```

| 設定 | 意思 | 不設會怎樣 |
|---|---|---|
| `httponly=True` | 網頁上的 JavaScript **讀不到**這個 cookie | 網站萬一被塞進壞程式，`document.cookie` 就能把手環偷走 |
| `samesite="lax"` | 從**別的網站**送過來的 POST 不會帶上這個 cookie | 壞網站放一個表單，偷偷用你的身分送出「刪除行程」 |
| `secure` | 只在 https 才送 | 本機是 http，設了反而送不出去，所以現在是 `False`；第 10 課上線改成 https，再到 `.env` 設 `COOKIE_SECURE=true` |

#### 兩種門口檢查

這一段寫了兩個 dependency，之後的 API 會一直用到：

| | 沒登入的時候 | 用在哪 |
|---|---|---|
| `get_optional_user` | 放行，拿到 `None` | `/api/me`：沒登入不算錯，回 `null` 就好 |
| `get_current_user` | 擋下來，回 **401**「請先登入」 | 第 3 段開始：「我的行程」這種一定要登入的 API |

#### 登入失敗，為什麼不說是哪裡錯

不管是「Email 不存在」還是「密碼錯」，都回同一句「Email 或密碼錯誤」。如果分開說，別人就能拿一堆 Email 來試，試出誰在你的網站有帳號。

光是訊息一樣還不夠：Email 不存在時如果直接回答，會比「密碼錯」快很多（不用打成泥），從**時間差**還是猜得出來。所以 Email 不存在時，也拿一個假的雜湊（`DUMMY_PASSWORD_HASH`）照樣比對一次，兩種情況花的時間就差不多了。todo-app 也是這樣做的。

### 2. 實作步驟

這一段**只改後端**，最後用 `/docs` 測。

#### 步驟 1：裝套件

```
cd ~/Desktop/travel-scheduler/backend
uv add "pwdlib[argon2]" "pydantic[email]"
```

- `pwdlib[argon2]`：密碼雜湊。
- `pydantic[email]`：讓 Pydantic 能檢查 Email 的格式（`EmailStr`）。
- **一定要加引號**：zsh 會把中括號當成「找檔名」的符號，不加引號會出現 `no matches found`。

#### 步驟 2：`models.py` 加 `User`

`class Trip(Base):` 的**上面**加上：

```python
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)  # 一個 Email 只能註冊一次
    name: Mapped[str] = mapped_column(String(100))
    password_hash: Mapped[str] = mapped_column(String(255))  # 打成泥的密碼，不存密碼本身
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

import 不用改，`String`、`DateTime`、`func` 上面都已經有了。放在 `Trip` 上面，是因為第 3 段 `Trip` 會指向 `User`，主人寫在前面比較好讀。

#### 步驟 3：用 Alembic 建表

```
uv run alembic revision --autogenerate -m "create users table"
```

打開 `alembic/versions/` 裡最新的檔案（後面是 `create_users_table`），確認 `upgrade()` 裡是：

```python
    op.create_table('users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email')
    )
```

最後一行的 `UniqueConstraint('email')`，就是「一個 Email 只能註冊一次」。確認沒問題就套用：

```
uv run alembic upgrade head
```

最後一行應該是 `Running upgrade ddabbd182919 -> ……, create users table`。

#### 步驟 4：新增 `core/security.py`（果汁機和手環）

```python
import os
import secrets

from fastapi import Response
from pwdlib import PasswordHash

from core.redis import redis_client

# 密碼雜湊用 Argon2（pwdlib 推薦的演算法），跟 todo-app 一樣
password_hash = PasswordHash.recommended()
# 假的雜湊：Email 不存在時也照樣比對一次，讓回應時間一樣長
DUMMY_PASSWORD_HASH = password_hash.hash("dummy-password-for-timing")

SESSION_COOKIE = "sid"  # cookie 的名字
SESSION_SECONDS = 14 * 24 * 60 * 60  # 手環 14 天後失效
# 本機是 http，要 False；第 10 課上線改成 https 後，在 .env 設 COOKIE_SECURE=true
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false") == "true"


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return password_hash.verify(password, hashed)


def create_session(user_id: int) -> str:
    """發手環：產生一串隨機號碼，在 Redis 記下「這個號碼是哪個會員」"""
    sid = secrets.token_urlsafe(32)
    redis_client.set(f"session:{sid}", user_id, ex=SESSION_SECONDS)
    return sid


def get_session_user_id(sid: str) -> int | None:
    """看手環：查 Redis，這個號碼是哪個會員。過期或登出了就是 None"""
    user_id = redis_client.get(f"session:{sid}")
    return int(user_id) if user_id is not None else None


def delete_session(sid: str) -> None:
    """手環作廢：從 Redis 刪掉這個號碼"""
    redis_client.delete(f"session:{sid}")


def set_session_cookie(response: Response, sid: str) -> None:
    """把手環交給瀏覽器（放進 cookie）"""
    response.set_cookie(
        key=SESSION_COOKIE,
        value=sid,
        max_age=SESSION_SECONDS,
        httponly=True,  # 網頁上的 JavaScript 讀不到，被塞了壞程式也偷不走
        samesite="lax",  # 從別的網站送過來的 POST 不會帶上這個 cookie
        secure=COOKIE_SECURE,
    )


def clear_session_cookie(response: Response) -> None:
    """叫瀏覽器把 cookie 丟掉"""
    response.delete_cookie(key=SESSION_COOKIE)
```

- `secrets.token_urlsafe(32)`：產生一串很長、猜不到的亂碼，當手環上的號碼。不能用 `random`，`random` 是可以被推算出來的。
- `redis_client.set(..., ex=SESSION_SECONDS)`：跟第 4 課的快取一樣，`ex` 是幾秒後自動刪掉。
- `COOKIE_SECURE`：`.env` 沒設就是 `False`，所以**現在不用改 `.env`**。

#### 步驟 5：新增 `core/dependencies.py`（兩種門口檢查）

```python
from fastapi import Cookie, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import get_session_user_id
from models import User


def get_optional_user(
    sid: str | None = Cookie(default=None),  # 參數叫 sid，FastAPI 就去拿名字叫 sid 的 cookie
    db: Session = Depends(get_db),
) -> User | None:
    """有登入就回傳會員，沒登入回 None（不擋人）"""
    if sid is None:
        return None  # 沒戴手環
    user_id = get_session_user_id(sid)
    if user_id is None:
        return None  # 手環過期了，或已經登出
    return db.get(User, user_id)


def get_current_user(user: User | None = Depends(get_optional_user)) -> User:
    """一定要登入：沒登入就回 401"""
    if user is None:
        raise HTTPException(status_code=401, detail="請先登入")
    return user
```

- `Cookie(default=None)`：跟第 6 課的 `Query` 一樣，告訴 FastAPI 去哪裡拿這個值，這次是從 cookie 拿。
- `get_current_user` 裡又用了 `Depends(get_optional_user)`：dependency 可以疊起來用，先看手環，再決定要不要擋。

#### 步驟 6：新增 `schemas/auth.py`

```python
from pydantic import BaseModel, ConfigDict, EmailStr, Field


# 點餐單：註冊
class SignupIn(BaseModel):
    email: EmailStr  # 會檢查是不是 Email 的格式
    password: str = Field(min_length=8, max_length=128)  # 上限：防止有人送超長的密碼拖慢伺服器
    name: str = Field(min_length=1, max_length=30)


# 點餐單：登入
class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


# 出餐單：會員資料（沒有 password_hash，不會送出去）
class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
```

`UserOut` 沒有 `password_hash`，所以就算 API 回的是整個 `User`，`response_model` 也會把雜湊濾掉（第 2 課學過的出餐單）。

#### 步驟 7：新增 `router/auth.py`

```python
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_optional_user
from core.security import (
    DUMMY_PASSWORD_HASH,
    clear_session_cookie,
    create_session,
    delete_session,
    hash_password,
    set_session_cookie,
    verify_password,
)
from models import User
from schemas.auth import LoginIn, SignupIn, UserOut

router = APIRouter()


@router.post("/api/signup", response_model=UserOut, status_code=201)
def signup(payload: SignupIn, response: Response, db: Session = Depends(get_db)):
    user = User(
        email=payload.email.lower(),  # Boris@Mail.com 和 boris@mail.com 算同一個
        name=payload.name,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # email 是 unique，重複註冊會被資料庫擋下來
        db.rollback()
        raise HTTPException(status_code=409, detail="這個 Email 已經註冊過了")
    db.refresh(user)

    # 註冊完直接登入：發手環
    set_session_cookie(response, create_session(user.id))
    return user


@router.post("/api/login", response_model=UserOut)
def login(payload: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    # Email 不存在也照樣比對一次（用假的雜湊），回應時間才會一樣長
    hashed = user.password_hash if user is not None else DUMMY_PASSWORD_HASH
    password_ok = verify_password(payload.password, hashed)
    if user is None or not password_ok:
        # 不說是 Email 不存在還是密碼錯，免得別人試出誰有註冊
        raise HTTPException(status_code=401, detail="Email 或密碼錯誤")

    set_session_cookie(response, create_session(user.id))
    return user


@router.post("/api/logout", status_code=204)
def logout(response: Response, sid: str | None = Cookie(default=None)):
    if sid is not None:
        delete_session(sid)  # Redis 裡的號碼作廢，手環就沒用了
    clear_session_cookie(response)  # 也叫瀏覽器把手環丟掉


@router.get("/api/me", response_model=UserOut | None)
def me(user: User | None = Depends(get_optional_user)):
    # 沒登入不算錯誤，回 null 就好（前端一打開網頁就會問「我是誰」）
    return user
```

- `response: Response`：要發 cookie，就要拿到「這次的回應」，在上面加 `set-cookie`。
- 註冊的 `try/except IntegrityError`：跟第 2 課新增景點一樣，重複是**資料庫**擋下來的（`unique`），程式只負責把它變成 409。
- 登出回 `204`（成功，但沒有內容），跟刪除行程一樣。

#### 步驟 8：`main.py` 整個換掉（多了 `auth`）

```python
from fastapi import FastAPI
from router import auth, destinations, itinerary, legs, search, trips, places

app = FastAPI()

app.include_router(auth.router)
app.include_router(destinations.router)
app.include_router(search.router)
app.include_router(trips.router)
app.include_router(itinerary.router)
app.include_router(places.router)
app.include_router(legs.router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

存檔之後，uvicorn 會自己重開。

#### 步驟 9：測試

打開 http://localhost:8000/docs 。

**① 註冊**

`POST /api/signup` → Try it out，填：

```json
{
  "email": "me@example.com",
  "password": "password123",
  "name": "你的名字"
}
```

Email 填你之後想一直用的。本機測試不會寄信，亂填也可以。第 3 段會把現在的行程都歸到這個帳號。

→ `201`，回 `{"id": 1, "email": "me@example.com", "name": "你的名字"}`。

**② 看手環**

`/docs` 的回應裡**看不到** `set-cookie`，因為瀏覽器不讓網頁上的 JavaScript 看這個 header（`/docs` 本身也是網頁）。要到開發者工具看：

1. 按 `Cmd + Option + I` → **Application（應用程式）** 分頁 → 左邊 **Cookies** → `http://localhost:8000`。
2. 有一個 `sid`，`HttpOnly` 那一格打勾，到期日是 14 天後。

如果還看到 `access_token`、`refresh_token`，那是 todo-app 的。cookie **不分連接埠**，`localhost:3000`、`localhost:8000` 的 cookie 都放在一起，名字不一樣就不會互相影響。

**③ 問「我是誰」**

`GET /api/me` → Try it out → `sid` 那一格**留空**，直接 Execute。瀏覽器會自己帶上 cookie。

→ 回你的會員資料。

**④ 看櫃檯的小本子（Redis）**

開一個新的終端機分頁：

```
cd ~/Desktop/travel-scheduler
docker compose exec redis redis-cli KEYS "session:*"
```

會看到一筆 `session:` 開頭、後面一串亂碼。把整串複製起來，查它記了什麼、還剩幾秒：

```
docker compose exec redis redis-cli GET "session:貼上那串亂碼"
docker compose exec redis redis-cli TTL "session:貼上那串亂碼"
```

`GET` 回 `"1"`：小本子只記了「會員 1 號」。`TTL` 回大約 `1209600`（14 天）。

**⑤ 看資料庫存了什麼**

```
docker compose exec db psql -U travel -d travel_scheduler -c "SELECT id, email, name, password_hash FROM users"
```

`password_hash` 是 `$argon2id$v=19$m=65536,t=3,p=4$...` 這樣的一長串，看不出你的密碼。

**⑥ 擋重複、擋格式**

回到 `/docs` 的 `POST /api/signup`：

1. Email 改成大寫 `ME@example.com`，其他不變 → `409`「這個 Email 已經註冊過了」。
2. 密碼改成 `123` → `422`，至少 8 個字。

**⑦ 登出**

`POST /api/logout` → `sid` 留空 → Execute → `204`。

- Application 分頁的 `sid` 不見了（按一下上面的重新整理圖示）。
- `GET /api/me` → `null`。
- 終端機再跑一次 `KEYS "session:*"` → 空的。

**⑧ 登入**

`POST /api/login`：

1. 密碼故意打錯 → `401`「Email 或密碼錯誤」。
2. Email 改成不存在的 `nobody@example.com` → **同一句** `401`。
3. 填正確的 Email、密碼 → `200`，Application 分頁又有 `sid` 了，`GET /api/me` 回你的資料。

**⑨ 加碼實驗：登出之後，舊手環還能用嗎？**

1. 在 Application 分頁點 `sid`，把 **Value** 那串複製起來。
2. 在終端機用它問「我是誰」（把 `貼上` 換成那串）：

   ```
   curl -s -H "Cookie: sid=貼上" http://localhost:8000/api/me
   ```

   → 回你的資料：拿到手環的人，就能用你的身分。所以手環要 `HttpOnly`，不能讓壞程式偷走。
3. 回 `/docs` 按 `POST /api/logout`。
4. 再跑一次同一行 `curl` → `null`。就算有人先把號碼抄走了，登出之後也沒用了，因為小本子上那一行已經劃掉。

做完之後，再用 `POST /api/login` 登入回來，第 2 段會用到。

### 3. 這一段結束後的資料夾

```
backend/
├── alembic/versions/
│   └── xxxx_create_users_table.py ← 新增（Alembic 產生的）
├── core/
│   ├── dependencies.py    ← 新增：get_optional_user、get_current_user
│   └── security.py        ← 新增：密碼雜湊、session、cookie
├── main.py                ← 改：掛上 auth
├── models.py              ← 改：加 User
├── pyproject.toml         ← 改：多了 pwdlib、pydantic[email]
├── router/
│   └── auth.py            ← 新增：signup、login、logout、me
└── schemas/
    └── auth.py            ← 新增：SignupIn、LoginIn、UserOut
```

### 4. 跟原專案對照

| 項目 | 原專案 | 我們 |
|---|---|---|
| 密碼雜湊 | `passlib` ＋ Argon2 | `pwdlib` ＋ Argon2（`passlib` 已經好幾年沒更新了；todo-app 也是用 `pwdlib`） |
| 手環（session）存哪 | Redis，`session:{sid}`，14 天 | 一樣 |
| Email 大小寫 | 照原樣存，`Me@` 和 `me@` 算兩個帳號 | 一律轉小寫 |
| 登入時 Email 不存在 | 馬上回 401，比密碼錯快，從時間差猜得出有沒有這個帳號 | 用假的雜湊照樣比對一次，時間差不多 |
| 停用帳號 | `users.is_active` | 先不做 |
| 密碼長度 | 8～72（72 是另一種演算法 bcrypt 的上限） | 8～128 |
| 存取資料庫 | 直接寫 SQL | SQLAlchemy ORM |
| `/api/me` 沒登入 | 回 `null` | 一樣 |

### 5. 常見踩雷

| 症狀 | 原因 | 解法 |
|---|---|---|
| `uv add` 出現 `no matches found: pwdlib[argon2]` | 沒加引號，zsh 把中括號當成找檔名 | 照步驟 1，整個用雙引號包起來 |
| uvicorn 出現 `ModuleNotFoundError: No module named 'pwdlib'` | 先改了程式才裝套件，uvicorn 重開時還沒裝好 | 裝好之後，隨便存一次檔，uvicorn 就會重開 |
| `email-validator is not installed` | 裝成 `pydantic`，少了 `[email]` | 照步驟 1 再裝一次 |
| 註冊、登入都成功，`/api/me` 卻一直是 `null` | 打開的是 `127.0.0.1:8000/docs`，cookie 卻存在 `localhost`（或反過來）。對瀏覽器來說這是兩個不同的網站 | 一律用 `http://localhost:8000/docs` |
| `/docs` 回應裡找不到 `set-cookie` | 瀏覽器不讓網頁看這個 header | 正常，到 Application 分頁看 |
| 第一次註冊就 `409` | 這個 Email 之前註冊過了 | 改用 `POST /api/login`，或換一個 Email |
| `/api/me` 回 500，錯誤是 `relation "users" does not exist` | 遷移檔產生了，但還沒 `upgrade` | `uv run alembic upgrade head` |
| Application 分頁有 `access_token`、`refresh_token` | todo-app 的 cookie；cookie 不分連接埠 | 不用管，名字不一樣不會互相影響 |

### 📌 這一段的 3 個重點

1. **密碼只存「打成泥」的雜湊**：登入時把輸入的密碼用同樣的方法（同樣的鹽）再打一次來比對。資料庫被偷了，也看不出密碼。
2. **登入就是發手環**：瀏覽器的 cookie 裡只有一串亂碼，Redis 記著「亂碼 → 會員幾號」。登出就是把 Redis 那一行刪掉，舊手環馬上失效。
3. **兩種門口檢查**：`get_optional_user` 沒登入也放行（拿到 `None`），`get_current_user` 沒登入就回 401。

### 6. 小測驗

（提示：每題都可以用「如果不這樣做，會發生什麼壞事？」來想。）

1. 為什麼資料庫存 `password_hash`，不直接存密碼？
2. 為什麼登入失敗時，不告訴使用者是「Email 不存在」還是「密碼錯」？
3. 如果 cookie 沒有設 `httponly=True`，會發生什麼壞事？
4. 如果登出時只叫瀏覽器刪掉 cookie，**沒有**刪 Redis 裡的那一筆，會怎樣？（提示：步驟 9 的 ⑨）

<details>
<summary>點開看解答</summary>

1. 資料庫萬一被偷，或是被看到（例如工程師查資料、備份檔外流），存密碼本身的話，所有人的密碼就直接曝光了。很多人好幾個網站用同一組密碼，等於連別的網站也一起被盜。存「打成泥」的雜湊，小偷只拿到泥，變不回密碼；每個人加的鹽又不一樣，也沒辦法用事先算好的對照表來查。
2. 分開說的話，壞人拿一堆 Email 來試，回「密碼錯」的就代表這個人有註冊，可以拿去寄詐騙信，或專心猜那個帳號的密碼。所以訊息要一樣，連回應時間也要差不多（假的雜湊）。
3. 網頁上的 JavaScript 就能用 `document.cookie` 讀到手環上的號碼。網站萬一被塞進壞程式（例如某個套件被動了手腳），就能把號碼偷偷送出去，壞人拿著它就是你（就像 ⑨ 的 `curl`）。`HttpOnly` 讓 JavaScript 摸不到，瀏覽器還是照樣會自動帶上。
4. 你的瀏覽器沒有手環了，但櫃檯的小本子還記著那個號碼，**號碼本身還是有效的**。如果之前有人抄走了號碼（例如在網咖用過、被壞程式偷走），他接下來 14 天都還能用你的身分。所以登出一定要把 Redis 那一筆刪掉，伺服器說了算。

</details>

#### 你的實作紀錄（2026-11-16）

- 後端 6 個檔案都正確。差別只有：`models.py` 的 `User` 放在檔案**最後面**（教材是放在 `Trip` 上面）；`core/dependencies.py` 的 `sid` 註解被編輯器移到上一行。功能都一樣，`User` 不用搬，第 3 段的程式碼放在哪裡都能用。
- 你裝到的是 `pwdlib` **0.4.0**（教材測試時是 0.3.1），`PasswordHash.recommended()` 用法沒變：雜湊是 `$argon2id$...`，正確密碼驗證成功、錯的失敗。
- 遷移檔 `5505095168bb` 只有建立 `users` 表，資料庫在最新版（`5505095168bb (head)`）。
- 你的資料庫（只讀）：`users` 有 1 筆，Email 是小寫，密碼存的是 97 個字的 Argon2 雜湊。名字是「你的名字」：步驟 9 ① 的範例照原樣送出去了，第 2 段右上角會顯示「你的名字」，想改的話看下面。
- 你的 Redis（只讀，號碼沒有印出來）：有 1 個 session，值是會員 1 號，剩大約 14 天。代表步驟 9 最後有重新登入回來。
- 打你開著的後端：不帶 cookie 問 `/api/me` → `null`；用不存在的 Email 登入 → `401`；`/docs` 裡有 4 支新 API。

---

## 第 2 段：前端：登入／註冊畫面

### 開始前的測試結果（2026-11-16）

我先在另一份複製的前端（3100）＋ 後端（8100）測過，這次用 `puppeteer-core` 讓 Chrome 自動操作：

| 測試 | 結果 |
|---|---|
| 沒登入打開網站 | 導覽列右邊是「登入／註冊」 |
| 密碼打錯 | 表單下面紅字「Email 或密碼錯誤」 |
| 登入成功 | 跳到「我的行程」，右邊變成「哈囉，Boris」和「登出」。登入之後**沒有**再打一次 `/api/me` |
| cookie | `sid` 是 `HttpOnly`；在網頁上執行 `document.cookie` 看不到它 |
| 按 F5 | 還是登入的狀態 |
| 開兩個分頁，在第二個分頁登出 | 切回第一個分頁，右邊**自己**變成「登入／註冊」 |
| 在「我的行程」按登出 | 回到首頁，cookie 不見了 |
| 註冊「測試二號」 | 直接登入，右邊變成「哈囉，測試二號」 |
| 用 `TEST2@example.com`（大寫）再註冊 | 紅字「這個 Email 已經註冊過了」；切換到登入，紅字就消失 |
| 註冊時密碼只打 7 個字 | 瀏覽器自己擋下來（「請將這段文字加長到 8 個字元以上」），**沒有**送出請求 |
| Email 打 `not-an-email` | 瀏覽器自己擋下來 |
| 主控台 | 只有密碼錯（401）、重複註冊（409）那兩行紅字，是瀏覽器自己印的，正常 |

### 1. 學到的觀念

#### 前端怎麼知道「我是誰」

手環（cookie）是 `HttpOnly`，前端的 JavaScript **讀不到**。所以前端沒辦法自己看手環，只能問後端：「我是誰？」（`GET /api/me`），後端看了手環，回答「小明」或 `null`。

導覽列、登入頁，第 3、4 段的「我的行程」都需要知道答案，所以寫成一個小工具 `useMe()`：

```ts
export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: getMe });
}
```

每個地方都呼叫 `useMe()`，因為 `queryKey` 一樣，拿到的是**小白板上同一份**資料（跟第 7 課景點池和 Google 搜尋框共用 `["tripPlaces", tripId]` 是同一招）。原專案是自己用 `useState` ＋ `useEffect` ＋ Context 寫一套，我們用 TanStack Query 的快取就夠了。

`useQuery` 還有一個預設的好處：**切回這個分頁時，會再問一次**。所以在另一個分頁登出，切回來就知道了（開始前的測試第 6 行）。

#### cookie 不用自己帶

`api.ts` 裡打 `/api/me`、`/api/login`，都**沒有**寫任何跟 cookie 有關的程式。因為：

```
瀏覽器 ──► localhost:3000/api/login ──► Next.js 轉給 localhost:8000/api/login
        ◄── set-cookie: sid=... ◄────── 後端發手環
```

第 5 課設定的轉送（`next.config.ts` 的 `rewrites`），讓瀏覽器以為一直在跟 **3000 同一個網站**講話：

- 後端回的 `set-cookie`，Next.js 會原封不動轉給瀏覽器，瀏覽器就存起來。
- 之後打 `/api/...`，瀏覽器看到是同一個網站，就**自動**帶上 cookie。

如果前端直接打 `localhost:8000`（不同的網址），就要多寫 `credentials: "include"`，後端也要設定 CORS 允許帶 cookie。我們從第 5 課就用轉送，所以這些都不用。

#### 登入成功：直接放上小白板

```ts
onSuccess: (user) => {
  queryClient.setQueryData(["me"], user);
  router.push("/trips");
},
```

`/api/login` 本來就會回會員資料，所以用 `setQueryData` **直接寫上小白板**，不用再問一次 `/api/me`。導覽列用的是同一份 `["me"]`，馬上就換成名字。

#### 登出：小白板全部擦掉

```ts
onSuccess: () => {
  queryClient.resetQueries();
  router.push("/");
},
```

小白板上可能有上一個人的資料（第 3 段開始就是「他的行程」）。如果下一個人在同一台電腦登入，不能讓他看到。`resetQueries()` 把小白板**全部清回空白**，畫面上正在用的會重新去問後端（`["me"]` 重問就變成 `null`）。

原專案是用 `window.location.href = "/"`，讓整個網站重新載入。效果一樣，但 Next.js 的 lint 會警告這種換頁方式，所以我們用 `router.push`，自己把小白板擦掉。

#### 瀏覽器先擋一次，後端才是真的關卡

輸入框加了 `type="email"`、`required`、`minLength={8}`，資料不對，瀏覽器就**不會送出**，馬上提示使用者，不用等後端回 422。

但這只是**方便**，不是保護：有人可以不透過網頁，直接用 `/docs` 或 `curl` 打 API。所以第 1 段後端的 `EmailStr`、`Field(min_length=8)` 一定要留著，那才是真的關卡。

### 2. 實作步驟

這一段**只改前端**。開始前確認 uvicorn 和 `npm run dev` 都在跑。

#### 步驟 10：`app/lib/types.ts` 最下面加上

```ts
// 後端 UserOut 的樣子（schemas/auth.py）：登入的會員
export type User = {
  id: number;
  email: string;
  name: string;
};

// 註冊時要送的資料（schemas/auth.py 的 SignupIn）
export type SignupInput = {
  email: string;
  password: string;
  name: string;
};

// 登入時要送的資料（schemas/auth.py 的 LoginIn）
export type LoginInput = {
  email: string;
  password: string;
};
```

#### 步驟 11：`app/lib/api.ts`

**① 最上面的 `import type`** 整段換成：

```ts
import type {
  Destination,
  ItineraryItem,
  LegEstimate,
  LoginInput,
  PlaceSuggestion,
  SearchResponse,
  SignupInput,
  TravelMode,
  Trip,
  TripCreate,
  User,
} from "@/app/lib/types";
```

**② 最下面**加上：

```ts
// ---------- 會員 ----------
// cookie（手環）不用自己帶：網址跟網頁同一個網站，瀏覽器每次都會自動帶上

// 我是誰：沒登入回 null
export function getMe() {
  return apiFetch<User | null>("/api/me");
}

export function signup(input: SignupInput) {
  return apiFetch<User>("/api/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function login(input: LoginInput) {
  return apiFetch<User>("/api/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function logout() {
  return apiFetch<void>("/api/logout", { method: "POST" });
}
```

#### 步驟 12：新增 `app/lib/useMe.ts`

```ts
import { useQuery } from "@tanstack/react-query";

import { getMe } from "@/app/lib/api";

// 我是誰：每個用到的地方都呼叫 useMe()，拿到的是小白板上同一份資料（queryKey 一樣）
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: getMe,
  });
}
```

這個檔案沒有 `"use client"`：它不是元件，只是一個給元件用的工具。用到它的元件（`AuthCorner`、登入頁）有寫就好。

#### 步驟 13：新增 `app/components/AuthCorner.tsx`

```tsx
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { logout } from "@/app/lib/api";
import { useMe } from "@/app/lib/useMe";

// 導覽列右邊：沒登入顯示「登入／註冊」，登入了顯示名字和「登出」
export default function AuthCorner() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me, isPending } = useMe();

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // 小白板上的資料可能是上一個人的（例如他的行程）：全部清回空白，畫面上正在用的會重新抓
      queryClient.resetQueries();
      router.push("/");
    },
  });

  // 還不知道有沒有登入：先什麼都不顯示，免得「登入」閃一下又變成名字
  if (isPending) return null;

  if (!me) {
    return (
      <Link href="/login" className="hover:text-blue-600">
        登入／註冊
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="font-normal text-gray-500">哈囉，{me.name}</span>
      <button
        type="button"
        onClick={() => logoutMutation.mutate()}
        disabled={logoutMutation.isPending}
        className="rounded-lg px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
      >
        登出
      </button>
    </div>
  );
}
```

- `if (isPending) return null`：剛打開網頁，還沒問到答案時，什麼都不顯示。不然會先閃一下「登入／註冊」，再變成「哈囉，小明」。
- 登出按鈕用 `useMutation`，跟第 7 課的刪除行程一樣。

#### 步驟 14：`app/layout.tsx` 改兩個地方

**① import** 多一行（放在 `Providers` 那行的上面）：

```tsx
import AuthCorner from "@/app/components/AuthCorner";
import Providers from "@/app/providers";
```

**② `<nav>` 裡面那個 `<div>`** 整個換掉（多了 `items-center` 和最後的 `AuthCorner`）：

```tsx
            <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3 font-semibold">
              <Link href="/" className="hover:text-blue-600">
                搜尋景點
              </Link>
              <Link href="/trips" className="hover:text-blue-600">
                我的行程
              </Link>
              {/* ml-auto：把登入那一塊推到最右邊 */}
              <div className="ml-auto">
                <AuthCorner />
              </div>
            </div>
```

`ml-auto`：左邊的空間全部撐開，把登入那一塊推到最右邊。

#### 步驟 15：新增 `app/login/page.tsx`

資料夾 `login` 要自己建，網址就是 `/login`（第 7 課學過：資料夾就是網址）。

```tsx
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { login, signup } from "@/app/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const isLogin = mode === "login";

  const submit = useMutation({
    mutationFn: () =>
      isLogin
        ? login({ email, password })
        : signup({ email, password, name: name.trim() }),
    onSuccess: (user) => {
      // 後端已經用 cookie 發了手環。回來的會員資料直接放上小白板，導覽列馬上換成名字
      queryClient.setQueryData(["me"], user);
      router.push("/trips");
    },
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    submit.mutate();
  }

  function switchMode() {
    setMode(isLogin ? "signup" : "login");
    submit.reset(); // 換模式時，清掉上一次的錯誤訊息
  }

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-6 text-3xl font-bold">{isLogin ? "登入" : "註冊"}</h1>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-xl bg-white p-6 shadow"
      >
        {!isLogin && (
          <label className="flex flex-col gap-1 text-sm">
            名字
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={30}
              className="rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {isLogin ? "密碼" : "密碼（至少 8 個字）"}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={isLogin ? undefined : 8}
            maxLength={128}
            autoComplete={isLogin ? "current-password" : "new-password"}
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>

        {submit.isError && (
          <p className="text-sm text-red-600">{submit.error.message}</p>
        )}

        <button
          type="submit"
          disabled={submit.isPending}
          className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400"
        >
          {submit.isPending ? "處理中…" : isLogin ? "登入" : "註冊"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-500">
        {isLogin ? "還沒有帳號？" : "已經有帳號了？"}
        <button
          type="button"
          onClick={switchMode}
          className="text-blue-600 hover:underline"
        >
          {isLogin ? "註冊" : "登入"}
        </button>
      </p>
    </main>
  );
}
```

- 登入、註冊是**同一頁**，用 `mode` 切換。註冊模式多一個「名字」輸入框（`{!isLogin && ...}`）。
- `mutationFn` 裡看 `isLogin`，決定打 `login` 還是 `signup`。
- `autoComplete`：告訴瀏覽器這是 Email、目前的密碼、新密碼，瀏覽器的密碼管理才會正確提示要不要儲存。

#### 步驟 16：測試

打開 http://localhost:3000 。

**① 已經登入了？**

右上角**已經**是「哈囉，小明」，因為你第 1 段最後在 `/docs`（8000）登入了。第 1 段說過：cookie **不分連接埠**，8000 拿到的手環，3000 也帶得到。

如果右上角是「登入／註冊」，代表瀏覽器裡沒有手環（例如第 1 段最後是用 `curl` 登入的），直接跳到 ③。

**② 登出**

按「登出」→ 回到首頁，右上角變成「登入／註冊」。`Cmd + Option + I` → Application → Cookies → `http://localhost:3000`，`sid` 不見了。

**③ 登入**

1. 點「登入／註冊」→ 網址變成 `/login`。
2. 密碼故意打錯 → 紅字「Email 或密碼錯誤」。Console 分頁會多一行紅字 `401 (Unauthorized)`，那是瀏覽器自己印的，正常。
3. 打開 **Network** 分頁，填正確的密碼 → 跳到「我的行程」，右上角「哈囉，小明」。
   - Network 有一行 `login`，點它 → **Response Headers** 裡有 `set-cookie: sid=...`（Next.js 從後端轉過來的）。
   - **沒有**新的 `me`：登入回來的資料直接放上小白板了。
4. 按 `F5` → 還是「哈囉，小明」。

**④ 註冊第二個帳號**

第 3 段要用它測「不能動別人的行程」。

1. 登出 → 點「登入／註冊」→ 下面的「**註冊**」。
2. 名字「測試二號」、Email `test2@example.com`、密碼 `password123` → 跳到「我的行程」，右上角「哈囉，測試二號」。

**⑤ 擋重複、擋格式**

1. 登出 → 註冊模式，Email 填 `TEST2@example.com`（大寫），名字、密碼隨便 → 紅字「這個 Email 已經註冊過了」。
2. 按下面的「登入」切換模式 → 紅字消失。
3. 再切回註冊，密碼只打 7 個字 → 瀏覽器跳出「請將這段文字加長到 8 個字元以上」。Network **沒有**新的 `signup`：根本沒送出去。

**⑥ 兩個分頁**

1. 用小明登入。
2. 再開一個分頁，打開 http://localhost:3000 → 右上角也是「哈囉，小明」。
3. 在**第二個**分頁按「登出」。
4. 切回**第一個**分頁 → 右上角自己變成「登入／註冊」：切回分頁時，`useMe()` 又問了一次後端。

**⑦ 看資料庫**

```
cd ~/Desktop/travel-scheduler
docker compose exec db psql -U travel -d travel_scheduler -c "SELECT id, email, name FROM users"
```

有 2 筆：小明、測試二號。

最後用**小明**登入回來。

### 3. 這一段結束後的資料夾

```
frontend/app/
├── components/
│   └── AuthCorner.tsx     ← 新增：導覽列右邊（登入／註冊、名字、登出）
├── layout.tsx             ← 改：導覽列放上 AuthCorner
├── lib/
│   ├── api.ts             ← 改：getMe、signup、login、logout
│   ├── types.ts           ← 改：User、SignupInput、LoginInput
│   └── useMe.ts           ← 新增：我是誰（共用小白板上的 ["me"]）
└── login/
    └── page.tsx           ← 新增：/login，登入和註冊同一頁
```

### 4. 跟原專案對照

| 項目 | 原專案 | 我們 |
|---|---|---|
| 「我是誰」記在哪 | `AuthContext`（`useState` ＋ `useEffect` ＋ Context） | TanStack Query 的 `["me"]`，用 `useMe()` 拿 |
| 登入畫面 | 導覽列打開的彈出視窗 | 獨立的 `/login` 頁 |
| 登入成功後 | 再打一次 `/api/me` | 把登入回來的會員資料直接放上小白板（`setQueryData`） |
| 登出後 | `window.location.href = "/"`，整個網站重新載入 | `resetQueries()` 擦掉小白板 ＋ `router.push("/")` |
| cookie 怎麼帶 | 也是經過 Next.js 轉送，另外寫了 `credentials: "include"` | 只靠轉送。同一個網站，瀏覽器本來就會帶 |
| 測試帳號一鍵登入 | 有 | 沒有 |

### 5. 常見踩雷

| 症狀 | 原因 | 解法 |
|---|---|---|
| 一打開網站就已經登入了 | 在 `/docs`（8000）登入過；cookie 不分連接埠 | 正常 |
| 右上角好幾秒都是空的 | 後端沒開：`/api/me` 失敗，TanStack Query 會先自動重試 3 次，這段時間 `isPending` 一直是 `true` | 開 uvicorn |
| 登入成功、跳頁了，右上角還是「登入／註冊」 | 登入頁少了 `setQueryData(["me"], user)` | 對照步驟 15 |
| 按了登出、回到首頁，右上角還是名字 | `AuthCorner` 少了 `resetQueries()` | 對照步驟 13 |
| Console 有紅字 `401`、`409` | 密碼錯、重複註冊時，瀏覽器自己印的 | 正常，畫面上的紅字訊息才是給使用者看的 |
| 打開 `/login` 是 404 | 資料夾名稱打錯，或 `page.tsx` 放錯地方 | 要是 `app/login/page.tsx` |
| 註冊時名字只打空白，出現「後端回應 422」 | 前端 `trim()` 之後變空字串，被後端的 `min_length=1` 擋下來 | 正常，後端是真的關卡 |

### 📌 這一段的 3 個重點

1. **前端讀不到手環，只能問後端「我是誰」**：`useMe()` 讓整個網站共用小白板上同一份 `["me"]`。
2. **cookie 不用自己帶**：經過 Next.js 轉送，瀏覽器以為一直在跟同一個網站講話，`set-cookie` 會存、之後每次都會自動帶上。
3. **登入寫上小白板，登出全部擦掉**：登入用 `setQueryData` 直接放上去；登出用 `resetQueries()`，不留上一個人的資料。

### 6. 小測驗

（提示：每題都可以用「如果不這樣做，會發生什麼壞事？」來想。）

1. 前端為什麼不能自己讀 cookie 看「我是誰」，一定要打 `/api/me`？
2. 登出時如果**沒有** `resetQueries()`，只有 `router.push("/")`，會發生什麼事？
3. 註冊表單已經用 `minLength={8}` 擋住短密碼了，後端的 `Field(min_length=8)` 可以拿掉嗎？
4. 為什麼 `api.ts` 不用寫任何跟 cookie 有關的程式，瀏覽器就會帶上手環？

<details>
<summary>點開看解答</summary>

1. 手環是 `HttpOnly`，JavaScript 讀不到（這是故意的，第 1 段第 3 題：讀得到就偷得走）。而且手環上只有一串亂碼，就算讀得到，也看不出是誰，要查 Redis 才知道。所以只能問後端。
2. 右上角還是「哈囉，小明」，因為小白板上的 `["me"]` 還留著舊答案，後端其實已經登出了。第 3 段開始更嚴重：下一個人在同一台電腦打開「我的行程」，會先看到小白板上**上一個人的行程**。
3. 不行。前端的檢查只是讓使用者馬上知道哪裡錯，不用等後端。有人可以不透過網頁，直接用 `/docs`、`curl` 打 `/api/signup`，前端的檢查完全管不到。後端才是真的關卡。
4. 因為瀏覽器只跟 `localhost:3000` 講話（`/api/...` 是由 Next.js 轉給 8000 的）。後端的 `set-cookie` 經過轉送回到瀏覽器，瀏覽器把它記在 `localhost` 底下；之後再打同一個網站的 `/api/...`，瀏覽器就自動帶上。

</details>

#### 你的實作紀錄（2026-11-16）

- 前端 6 個檔案都正確。差別只有：`useMe.ts` 寫成 `import { getMe } from "./api"`（教材是 `"@/app/lib/api"`，兩個指向同一個檔案，應該是 VS Code 自動補的）；`layout.tsx` 的 import 之間少了一行空白。型別檢查、lint 都通過。
- 你的資料庫（只讀）：`users` 有小明（id 1）、測試二號（id **3**）。**沒有 id 2**，跟第 2 課一樣：第 1 段 ⑥ 用大寫 Email 重複註冊時，資料庫先拿了號碼 2 才發現重複，那個號碼就跳過不用了。⑤ 再重複註冊一次，號碼 4 也被用掉了，下一個新帳號會是 5。
- 你的 Redis（只讀）：1 個 session，是小明的，剛發的（剩 14 天）。代表最後有用小明登入回來。
- 用 Chrome 開一個全新的視窗（沒有 cookie）看你的 3000，只看不改：導覽列是「搜尋景點 我的行程 登入／註冊」；點進去是 `/login`，有 Email、密碼；切到註冊多了「名字」、「密碼（至少 8 個字）」。主控台沒有錯誤，也沒有送出任何 POST。

---

## 第 3 段：權限：行程有主人

### 開始前的測試結果（2026-11-16）

我先在另一份複製的前後端和資料庫測過：先用 curl 打 API，再用 Chrome 自動操作畫面。小明是 id 1，測試二號是 id 3，跟你的資料庫一樣。

**API（curl）**

| 誰 | 做什麼 | 結果 |
|---|---|---|
| 小明 | 剛加完欄位，還沒認領舊行程：`GET /api/trips` | `[]`：兩個行程都還沒有主人 |
| 小明 | 同上，`GET /api/trips/1` | `403`「這不是你的行程」：**自己的行程也打不開** |
| — | 認領：`UPDATE trips SET user_id = 1 WHERE user_id IS NULL` | `UPDATE 2` |
| 小明 | `GET /api/trips`、`/api/trips/1`、每日行程 | 都回來了 |
| 小明 | `GET /api/trips/999` | `404`「找不到這個行程」 |
| 測試二號 | `GET /api/trips` | `[]`：只列自己的 |
| 測試二號 | 小明的行程：讀、刪、加景點、存每日行程、刪一站（7 支） | 全部 `403`「這不是你的行程」 |
| 沒登入 | `GET /api/trips`、建立行程、讀行程、刪行程 | 全部 `401`「請先登入」 |
| 測試二號 | 建立「測試二號的行程」 | `201`，資料庫裡 `user_id` 是 `3` |
| 小明 | 打開測試二號的行程 | `403` |
| 測試二號 | 刪掉自己的行程 | `204` |
| 沒登入 | `/api/me`、交通時間 | 照樣能用：不屬於某個行程的 API 不檢查 |

**遷移檔**：`downgrade` 退回、再 `upgrade`，都成功（外鍵有取名字的關係，觀念裡會說明）。

**畫面（Chrome）**

| 測試 | 結果 |
|---|---|
| 沒登入打開「我的行程」 | 「請先登入，才能建立和查看你的行程。」而且**沒有**打 `/api/trips` |
| 沒登入打開首頁 | 「登入之後，可以把景點加進你的行程」，沒有選單 |
| 沒登入打開 `/trips/1` | 「請先登入」 |
| 小明 | 我的行程有京都三日遊、大阪兩日遊；編輯頁正常；首頁選單有兩個行程，搜京都有「加入＋」 |
| 在首頁登出 | 選單、「加入＋」都不見了 |
| 測試二號 | 我的行程「還沒有行程」；打開 `/trips/1` 是「這不是你的行程」 |
| 測試二號建立、刪除自己的行程 | 都正常 |

### 1. 學到的觀念

#### 401 和 403

延續會員手環的比喻，店裡多了**包廂**（行程），每個包廂都有訂位的人（主人）：

| | 意思 | 包廂門口 | 什麼時候 |
|---|---|---|---|
| **401** | 我不知道你是誰 | 「請先出示手環」 | 沒登入、手環過期 |
| **403** | 我知道你是誰，但你不能進 | 「認得你，但這間不是你訂的」 | 登入了，但不是主人 |
| **404** | 沒有這間 | 「我們沒有這個包廂」 | 行程不存在 |

測試二號打開小明的行程，是 **403** 不是 401：他有戴手環，店員知道他是誰，只是包廂不是他的。

#### 一個門口，守住所有 API

```python
def get_editable_trip(trip_id, user = Depends(get_current_user), db = ...) -> Trip:
    trip = db.get(Trip, trip_id)
    if trip is None:
        raise HTTPException(404, "找不到這個行程")
    if trip.user_id != user.id:
        raise HTTPException(403, "這不是你的行程")
    return trip
```

所有 `/api/trips/{trip_id}/...`，都把原本的 `trip_id: int` 換成：

```python
trip: Trip = Depends(get_editable_trip)
```

**能進到函式裡面，就代表「行程存在，而且你是主人」**。函式裡不用再寫任何檢查，直接用 `trip` 就好（原本的 `get_trip_or_404` 也用不到了）。

為什麼不在每支 API 裡面自己檢查？因為 `/api/trips/{trip_id}/...` 的 API 有 11 支，**忘了一支就是漏洞**。寫成一個 dependency，每支都長得一樣，少了一眼就看得出來。

幾個細節：

- `get_editable_trip` 的參數有 `trip_id`，FastAPI 會自己從網址的 `{trip_id}` 拿。所以 API 函式**不用**再寫 `trip_id`。
- 它裡面又用了 `Depends(get_current_user)`：沒登入的話，在這一步就回 401 了，不會走到 403。
- `get_editable_trip` 和 API 函式都用 `Depends(get_db)`，FastAPI 在同一個請求裡只會借**一次**資料庫連線，兩邊拿到的是同一個。所以 `delete_trip` 可以直接 `db.delete(trip)`。

不屬於某個行程的 API（搜尋、Google 建議、交通時間、`/api/me`）不用檢查，沒登入也能用。

#### 舊資料要「認領」

`trips` 加了 `user_id` 欄位，**舊的兩個行程這一格是空的**（`NULL`）。這時候：

- `list_trips` 只列 `user_id == 小明`，所以小明的列表是空的。
- `get_editable_trip` 比較 `None != 1`，所以小明打開京都三日遊是 403。

**自己的行程，自己也打不開了**。所以要下一行 SQL，把沒有主人的行程都歸給小明（id 1）：

```sql
UPDATE trips SET user_id = 1 WHERE user_id IS NULL
```

為什麼不寫在遷移檔裡？遷移檔是**每個環境都會跑**的：第 10 課上線時，正式機的資料庫也會跑同一個檔案。那裡的 id 1 不一定是你，甚至可能還沒有任何會員。「舊資料歸給誰」只跟你這台電腦有關，所以自己下 SQL。

#### 外鍵要取名字

```python
ForeignKey("users.id", ondelete="CASCADE", name="fk_trips_user_id")
```

- `ondelete="CASCADE"`：會員被刪掉，他的行程也一起刪掉（第 6 課景點池也是這樣）。
- `name=`：第 6 課的外鍵都是**建表時一起建的**，退回上一版時整張表刪掉，外鍵就跟著不見了。這次是在**已經有的表**上加外鍵，退回上一版時要單獨刪掉它，就要知道它叫什麼名字。沒取名字的話，Alembic 產生的 `downgrade()` 會出現 `WARNING: constraint name is None`，到時候退回就會失敗。

#### 前端：知道會 401 的，就不要打

```ts
const { data: me } = useMe();
useQuery({ queryKey: ["trips"], queryFn: listTrips, enabled: !!me });
```

沒登入時，`/api/trips` 一定是 401，打了也是白打，所以 `enabled: !!me`，登入了才去拿。`!!me` 是把 `me` 變成 `true`／`false`：有會員資料是 `true`，`null`、`undefined` 是 `false`。

「我的行程」頁沒登入時，直接顯示「請先登入」。注意 `return` 要寫在**所有 hook 的下面**：React 規定 hook 每次都要照同樣的順序、同樣的數量執行，如果在 `useMutation` 之前就 `return`，有時候執行到、有時候沒有，React 就會報錯。

### 2. 實作步驟

這一段前後端都要改，還要用 Alembic 加一個欄位。

#### 步驟 17：`models.py` 的 `Trip` 加 `user_id`

`start_date` 那行的**下面**加上：

```python
    # 行程的主人（指向 users 表）。會員被刪掉，他的行程也一起刪掉。
    # 可以是 None：舊的行程還沒有主人；第 4 段沒登入建立的行程也沒有
    user_id: Mapped[int | None] = mapped_column(
        # 外鍵要取名字，Alembic 退回上一版（downgrade）時才知道要刪哪一個
        ForeignKey("users.id", ondelete="CASCADE", name="fk_trips_user_id"),
        index=True,
    )
```

`User` 寫在檔案最後面也沒關係：`"users.id"` 是字串，Python 不用先認得 `User`。

#### 步驟 18：用 Alembic 加欄位

```
cd ~/Desktop/travel-scheduler/backend
uv run alembic revision --autogenerate -m "add user_id to trips"
```

打開最新的遷移檔（後面是 `add_user_id_to_trips`），確認 `upgrade()` 裡是這三行：

```python
    op.add_column('trips', sa.Column('user_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_trips_user_id'), 'trips', ['user_id'], unique=False)
    op.create_foreign_key('fk_trips_user_id', 'trips', 'users', ['user_id'], ['id'], ondelete='CASCADE')
```

1. 加欄位 2. 加索引（`index=True`：「列出小明的行程」會比較快）3. 加外鍵。第 3 行的第一個參數是 `'fk_trips_user_id'`，**不是 `None`**；`downgrade()` 裡也**沒有** `WARNING`。確認沒問題就套用：

```
uv run alembic upgrade head
```

最後一行應該是 `Running upgrade 5505095168bb -> ……, add user_id to trips`。

#### 步驟 19：`core/dependencies.py`

**① import** 改成：

```python
from models import Trip, User
```

**② 最下面**加上：

```python
def get_editable_trip(
    trip_id: int,  # 從網址的 /api/trips/{trip_id}/... 拿
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Trip:
    """行程存在，而且你是主人，才放行。所有 /api/trips/{trip_id}/... 都先過這一關"""
    trip = db.get(Trip, trip_id)
    if trip is None:
        raise HTTPException(status_code=404, detail="找不到這個行程")
    if trip.user_id != user.id:
        raise HTTPException(status_code=403, detail="這不是你的行程")
    return trip
```

#### 步驟 20：`router/trips.py` 整個換掉

```python
import requests
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user, get_editable_trip
from models import Destination, Trip, TripPlace, User
from schemas.destination import DestinationOut
from schemas.trip import TripCreate, TripOut, TripPlaceCreate, TripPlaceGoogleCreate
from services.places import place_details


router = APIRouter()


@router.post("/api/trips", response_model=TripOut, status_code=201)
def create_trip(
    payload: TripCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trip = Trip(**payload.model_dump(), user_id=user.id)  # 誰建立的，誰就是主人
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


@router.get("/api/trips", response_model=list[TripOut])
def list_trips(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 只列出自己的行程
    stmt = select(Trip).where(Trip.user_id == user.id).order_by(Trip.id.desc())
    return db.scalars(stmt).all()


# 下面每一支都有 trip: Trip = Depends(get_editable_trip)：
# 能進到函式裡面，就代表「行程存在，而且你是主人」


@router.get("/api/trips/{trip_id}", response_model=TripOut)
def get_trip(trip: Trip = Depends(get_editable_trip)):
    return trip


@router.delete("/api/trips/{trip_id}", status_code=204)
def delete_trip(trip: Trip = Depends(get_editable_trip), db: Session = Depends(get_db)):
    db.delete(trip)
    db.commit()


# ---------- 景點池 ----------


@router.get("/api/trips/{trip_id}/places", response_model=list[DestinationOut])
def list_trip_places(
    trip: Trip = Depends(get_editable_trip), db: Session = Depends(get_db)
):
    # JOIN：景點池裡只有景點的 id，接到 destinations 表，才拿得到名稱、介紹這些資料
    stmt = (
        select(Destination)
        .join(TripPlace, TripPlace.destination_id == Destination.id)
        .where(TripPlace.trip_id == trip.id)
        .order_by(TripPlace.created_at)
    )
    return db.scalars(stmt).all()


@router.post(
    "/api/trips/{trip_id}/places", response_model=DestinationOut, status_code=201
)
def add_trip_place(
    payload: TripPlaceCreate,
    trip: Trip = Depends(get_editable_trip),
    db: Session = Depends(get_db),
):
    destination = db.get(Destination, payload.destination_id)
    if destination is None:
        raise HTTPException(status_code=404, detail="找不到這個景點")

    db.add(TripPlace(trip_id=trip.id, destination_id=destination.id))
    try:
        db.commit()
    except IntegrityError:
        # 主鍵（trip_id, destination_id）重複：這個景點已經在景點池裡了
        db.rollback()
        raise HTTPException(status_code=409, detail="這個景點已經在景點池裡了")
    return destination


@router.post(
    "/api/trips/{trip_id}/places/google",
    response_model=DestinationOut,
    status_code=201,
)
def add_trip_place_from_google(
    payload: TripPlaceGoogleCreate,
    trip: Trip = Depends(get_editable_trip),
    db: Session = Depends(get_db),
):
    # 資料庫已經有這個地點（例如 AI 找過）就直接用，不用再問 Google
    destination = db.scalar(
        select(Destination).where(
            Destination.google_place_id == payload.google_place_id)
    )
    if destination is None:
        try:
            details = place_details(payload.google_place_id)
        except requests.RequestException:
            raise HTTPException(status_code=502, detail="Google 查詢失敗，請稍後再試")
        destination = Destination(
            **details, google_place_id=payload.google_place_id, source="google"
        )
        db.add(destination)
        db.flush()  # 先送到資料庫拿到 id（還沒存檔），下一行才用得到 destination.id

    db.add(TripPlace(trip_id=trip.id, destination_id=destination.id))
    try:
        db.commit()  # 新景點和景點池那一筆，一起存檔
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="這個景點已經在景點池裡了")
    return destination


@router.delete("/api/trips/{trip_id}/places/{destination_id}", status_code=204)
def remove_trip_place(
    destination_id: int,
    trip: Trip = Depends(get_editable_trip),
    db: Session = Depends(get_db),
):
    # 主鍵有兩個欄位，所以要用兩個值去找
    trip_place = db.get(TripPlace, (trip.id, destination_id))
    if trip_place is None:
        raise HTTPException(status_code=404, detail="這個景點不在景點池裡")
    db.delete(trip_place)
    db.commit()
```

跟原本比：

- `create_trip`：多了 `user = Depends(get_current_user)`，建立時 `user_id=user.id`。
- `list_trips`：多了 `.where(Trip.user_id == user.id)`。
- 其他每一支：`trip_id: int` 換成 `trip: Trip = Depends(get_editable_trip)`，`get_trip_or_404(...)` 那行刪掉，用到 `trip_id` 的地方改成 `trip.id`。
- `get_trip_or_404` 整個刪掉了（`router/itinerary.py` 原本也用它，下一步一起改）。

#### 步驟 21：`router/itinerary.py` 整個換掉

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_editable_trip
from models import ItineraryItem, Trip, TripPlace
from schemas.itinerary import (
    ItineraryDaySave,
    ItineraryItemCreate,
    ItineraryItemOut,
)


router = APIRouter()


def check_day(trip: Trip, day_index: int) -> None:
    """這個行程要有這一天（第 1 天到最後一天）"""
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
def list_day_itinerary(
    day_index: int,
    trip: Trip = Depends(get_editable_trip),
    db: Session = Depends(get_db),
):
    check_day(trip, day_index)
    return day_items(db, trip.id, day_index)


@router.get("/api/trips/{trip_id}/itinerary", response_model=list[ItineraryItemOut])
def list_trip_itinerary(
    trip: Trip = Depends(get_editable_trip), db: Session = Depends(get_db)
):
    """整個行程每一天的每一站，照第幾天、第幾站排好"""
    stmt = (
        select(ItineraryItem)
        .where(ItineraryItem.trip_id == trip.id)
        .order_by(ItineraryItem.day_index, ItineraryItem.position)
    )
    return db.scalars(stmt).all()


@router.post(
    "/api/trips/{trip_id}/days/{day_index}/itinerary",
    response_model=ItineraryItemOut,
    status_code=201,
)
def add_to_day(
    day_index: int,
    payload: ItineraryItemCreate,
    trip: Trip = Depends(get_editable_trip),
    db: Session = Depends(get_db),
):
    check_day(trip, day_index)

    # 資料庫也會擋這兩種情況，先自己檢查，是為了回比較清楚的訊息
    if db.get(TripPlace, (trip.id, payload.destination_id)) is None:
        raise HTTPException(status_code=400, detail="請先把這個景點加進景點池")
    scheduled = db.scalar(
        select(ItineraryItem).where(
            ItineraryItem.trip_id == trip.id,
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
            ItineraryItem.trip_id == trip.id, ItineraryItem.day_index == day_index
        )
    )
    item = ItineraryItem(
        trip_id=trip.id,
        destination_id=payload.destination_id,
        day_index=day_index,
        position=0 if last is None else last + 1,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/api/trips/{trip_id}/itinerary/{item_id}", status_code=204)
def remove_from_day(
    item_id: int,
    trip: Trip = Depends(get_editable_trip),
    db: Session = Depends(get_db),
):
    item = db.get(ItineraryItem, item_id)
    if item is None or item.trip_id != trip.id:
        raise HTTPException(status_code=404, detail="這個行程裡沒有這一站")

    day_index = item.day_index
    db.delete(item)
    db.flush()  # 先把「刪除」送到資料庫（還沒存檔），下面重新編號時才不會算到它

    # 補位：剩下的重新編成 0、1、2……，中間不留空號
    for new_position, rest in enumerate(day_items(db, trip.id, day_index)):
        rest.position = new_position
    db.commit()


@router.put(
    "/api/trips/{trip_id}/days/{day_index}/itinerary",
    response_model=list[ItineraryItemOut],
)
def save_day(
    day_index: int,
    payload: ItineraryDaySave,
    trip: Trip = Depends(get_editable_trip),
    db: Session = Depends(get_db),
):
    check_day(trip, day_index)
    items = {item.id: item for item in day_items(db, trip.id, day_index)}

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
        item.travel_mode = row.travel_mode

    db.commit()  # 全部都改好了，才一次存檔
    return day_items(db, trip.id, day_index)
```

- `check_day` 改成直接收 `trip`：行程已經在門口檢查過、拿到了，只要再看「有沒有這一天」。
- 每一支都跟 `trips.py` 一樣換成 `trip: Trip = Depends(get_editable_trip)`，`trip_id` 改成 `trip.id`。`day_items()` 不是 API，參數還是叫 `trip_id`，不用改。

存檔之後，uvicorn 會自己重開。

#### 步驟 22：先看看「自己的行程打不開」，再認領

1. 確認右上角是「哈囉，小明」，打開「我的行程」→「還沒有行程，先建立一個吧！」：兩個行程都還沒有主人。
2. 網址列直接打 http://localhost:3000/trips/1 →「這不是你的行程」。
3. 看一下資料庫：

   ```
   cd ~/Desktop/travel-scheduler
   docker compose exec db psql -U travel -d travel_scheduler -c "SELECT id, title, user_id FROM trips"
   ```

   `user_id` 那一欄是空的。
4. 認領，全部歸給小明（id 1）：

   ```
   docker compose exec db psql -U travel -d travel_scheduler -c "UPDATE trips SET user_id = 1 WHERE user_id IS NULL"
   ```

   → `UPDATE 2`。再跑一次第 3 點的 `SELECT`，`user_id` 都是 `1` 了。
5. 回「我的行程」按 `F5` → 京都三日遊、大阪兩日遊都回來了。

#### 步驟 23：前端 `app/trips/page.tsx` 改三個地方

**① import** 多一行（`api` 那行的下面）：

```tsx
import { createTrip, deleteTrip, listTrips } from "@/app/lib/api";
import { useMe } from "@/app/lib/useMe";
```

**② `useQuery` 那一段**換成這樣（上面多一行 `useMe()`，裡面多一行 `enabled`）：

```tsx
  const { data: me, isPending: mePending } = useMe();

  const {
    data: trips,
    isPending,
    isError,
  } = useQuery({
    queryKey: ["trips"],
    queryFn: listTrips,
    enabled: !!me, // 登入了才去拿（沒登入，後端只會回 401）
  });
```

**③ `handleDelete` 函式的下面、`return (` 的上面**，加上：

```tsx
  // 上面的 hook 都要先寫完，才能 return（React 規定 hook 每次都要照同樣的順序執行）
  if (mePending) {
    return <main className="mx-auto max-w-5xl p-6 text-gray-500">載入中…</main>;
  }
  if (!me) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="mb-6 text-3xl font-bold">我的行程</h1>
        <p className="text-gray-500">
          請先
          <Link href="/login" className="text-blue-600 hover:underline">
            登入
          </Link>
          ，才能建立和查看你的行程。
        </p>
      </main>
    );
  }
```

#### 步驟 24：前端 `app/page.tsx`（首頁）改五個地方

**① import** 多一行（`api` 那段的下面）：

```tsx
import { useMe } from "@/app/lib/useMe";
```

**② 「加入到哪個行程」的 `tripsQuery`** 換成：

```tsx
  // 「加入到哪個行程」的選單要用的行程清單：登入了才去拿
  const { data: me } = useMe();
  const tripsQuery = useQuery({
    queryKey: ["trips"],
    queryFn: listTrips,
    enabled: !!me,
  });
```

**③ `poolQuery` 裡的 `enabled`** 換成：

```tsx
    enabled: tripId !== null && !!me, // 還沒選行程、或沒登入，就不用拿
```

**④ `addButton` 函式的第一行**換成：

```tsx
    if (tripId === null || !me) return null; // 還沒選行程、或沒登入，就不顯示
```

在首頁登出時，頁面不會重新載入，選過的行程還記著。沒有這一行，景點卡片上還是會有「加入＋」，按下去就是 401。

**⑤ `<div className="mb-6 flex items-center gap-2 text-sm">` 那一整段**（「加入到：」的選單，到 `addPlace.isError` 下面的 `</div>` 為止）換成：

```tsx
      {/* 登入了才顯示「加入到」選單；沒登入的話，提示先登入 */}
      {me ? (
        <div className="mb-6 flex items-center gap-2 text-sm">
          <span className="text-gray-600">加入到：</span>
          <select
            value={tripId ?? ""}
            onChange={(e) =>
              setTripId(e.target.value ? Number(e.target.value) : null)
            }
            className="rounded-lg border border-gray-300 bg-white px-3 py-1"
          >
            <option value="">選一個行程</option>
            {tripsQuery.data?.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {trip.title}
              </option>
            ))}
          </select>
          {tripsQuery.data?.length === 0 && (
            <Link href="/trips" className="text-blue-600 hover:underline">
              先去建立一個行程
            </Link>
          )}
          {addPlace.isError && (
            <span className="text-red-600">{addPlace.error.message}</span>
          )}
        </div>
      ) : (
        <p className="mb-6 text-sm text-gray-500">
          <Link href="/login" className="text-blue-600 hover:underline">
            登入
          </Link>
          之後，可以把景點加進你的行程
        </p>
      )}
```

`{me ? (...) : (...)}`：登入了顯示選單，沒登入顯示「登入之後……」。

#### 步驟 25：測試

確認 uvicorn、`npm run dev` 都在跑，右上角是「哈囉，小明」。

**① 小明：跟以前一樣**

1. 我的行程：京都三日遊、大阪兩日遊。
2. 點進京都三日遊 → 景點池、每日行程、地圖都在。拖拉一下、按「儲存」→ 正常。
3. 首頁：「加入到」選單有兩個行程。

**② 測試二號：看不到、改不了小明的行程**

1. 登出 → 用測試二號登入（`test2@example.com`、`password123`）。
2. 我的行程 →「還沒有行程」。
3. 網址列打 http://localhost:3000/trips/1 →「這不是你的行程」。
4. 打開 http://localhost:8000/docs →`DELETE /api/trips/{trip_id}`，`trip_id` 填 `1`，`sid` 留空 → `403`「這不是你的行程」。cookie 不分連接埠，`/docs` 裡也是測試二號的身分。
5. 回 3000 建立一個「測試二號的行程」→ 自動進到它的編輯頁。看資料庫：

   ```
   docker compose exec db psql -U travel -d travel_scheduler -c "SELECT id, title, user_id FROM trips"
   ```

   新的那一筆 `user_id` 是 `3`。
6. 回「我的行程」，把「測試二號的行程」刪掉。

**③ 沒登入**

1. 登出。
2. 我的行程 →「請先登入，才能建立和查看你的行程。」
3. 首頁 →「登入之後，可以把景點加進你的行程」，沒有選單。
4. http://localhost:3000/trips/1 →「請先登入」。
5. 終端機（沒有 cookie）：

   ```
   curl -s -X DELETE http://localhost:8000/api/trips/1
   ```

   → `{"detail":"請先登入"}`。

最後用**小明**登入回來。

### 3. 這一段結束後的資料夾

```
backend/
├── alembic/versions/
│   └── xxxx_add_user_id_to_trips.py ← 新增（Alembic 產生的）
├── core/
│   └── dependencies.py    ← 改：get_editable_trip
├── models.py              ← 改：Trip 加 user_id
└── router/
    ├── itinerary.py       ← 改：每一支都用 get_editable_trip
    └── trips.py           ← 改：建立時記主人、只列自己的、每一支都用 get_editable_trip

frontend/app/
├── page.tsx               ← 改：沒登入不顯示「加入到」
└── trips/
    └── page.tsx           ← 改：沒登入顯示「請先登入」
```

### 4. 跟原專案對照

| 項目 | 原專案 | 我們 |
|---|---|---|
| 檢查寫在哪 | `assert_trip_owner`，掛在 `dependencies=[Depends(...)]`，只檢查、不回傳 | `get_editable_trip` 當成參數，檢查完把行程交給函式，不用再查一次 |
| `trips.user_id` | 只有索引，沒有外鍵 | 外鍵指向 `users`，刪會員連行程一起刪 |
| 建立行程 | 一律先建成沒有主人，登入的話前端再打 `/bind` 認領 | 登入了就直接是主人（第 4 段才有沒主人的） |
| 沒登入打 API | 先查行程（不存在回 404）；有主人的行程，沒登入回 **403**「此為私人行程，請先登入」 | 先看有沒有登入，沒登入一律 **401**，再查行程 |
| 我的行程 | `WHERE user_id = 自己` | 一樣 |

### 5. 常見踩雷

| 症狀 | 原因 | 解法 |
|---|---|---|
| 遷移檔的 `downgrade()` 有 `WARNING: constraint name is None` | `ForeignKey` 少了 `name=` | 補上 `name="fk_trips_user_id"`，刪掉那個遷移檔，再產生一次 |
| 小明打開自己的行程也是「這不是你的行程」 | 還沒認領，`user_id` 是空的 | 步驟 22 第 4 點 |
| uvicorn 印 `ImportError: cannot import name 'get_trip_or_404'`，整個後端起不來 | `trips.py` 換好了，`itinerary.py` 還沒換，還在 import 已經刪掉的函式 | 步驟 21 |
| 每支行程 API 都回 422，說少了一個 `query` 參數 | `get_editable_trip` 的 `trip_id` 打錯字：FastAPI 找不到同名的網址參數，就當成要從網址 `?` 後面拿 | 名字要跟網址的 `{trip_id}` 一模一樣，對照步驟 19 |
| 「我的行程」一直是「載入中…」 | 沒登入時用了 `enabled: !!me`，卻沒有先 `return` 請先登入，下面就一直等一個不會開始的請求 | 對照步驟 23 ③ |
| React 報錯 `Rendered fewer hooks than expected` | `return` 寫在某個 hook 的上面 | `return` 要放在所有 `useState`、`useQuery`、`useMutation` 的下面 |
| 在首頁登出時，Console 有幾行 `401` | 登出那一刻，小白板重抓了「我的行程」和景點池，後端已經不認你了 | 正常，畫面沒有影響 |
| 用測試二號在 `/docs` 測完，3000 也變成測試二號 | cookie 不分連接埠，兩邊是同一個手環 | 正常，最後記得用小明登入回來 |

### 📌 這一段的 3 個重點

1. **401 是「不知道你是誰」，403 是「知道你是誰，但不能進」**，404 是「沒有這個行程」。
2. **一個 dependency 守住所有行程 API**：`trip: Trip = Depends(get_editable_trip)`，能進到函式裡，就代表行程存在、你是主人。忘了一支就是漏洞，所以每支都長一樣。
3. **加了「主人」欄位，舊資料要認領**：舊的列 `user_id` 是空的，自己也打不開。只跟這台電腦有關的資料，自己下 SQL，不寫進遷移檔。

### 6. 小測驗

（提示：每題都可以用「如果不這樣做，會發生什麼壞事？」來想。）

1. 為什麼檢查要寫成一個 `get_editable_trip`，不在每支 API 裡面自己寫 `if trip.user_id != user.id`？
2. 測試二號打開小明的行程，為什麼是 403，不是 401？
3. 如果 `list_trips` 忘了加 `.where(Trip.user_id == user.id)`，會發生什麼事？`get_editable_trip` 救得了嗎？
4. 「把舊行程歸給小明」為什麼不寫在遷移檔裡？

<details>
<summary>點開看解答</summary>

1. `/api/trips/{trip_id}/...` 的 API 有 11 支，每支都自己寫，**只要忘了一支，那一支就誰都能用**，而且很難發現（功能照樣正常，只是沒檢查）。寫成一個 dependency，每支 API 都是同一行 `trip: Trip = Depends(get_editable_trip)`，少了一眼就看得出來；要改規則（例如第 4 段加上匿名行程）也只改一個地方。
2. 401 是「不知道你是誰」。測試二號有登入、有手環，後端知道他是會員 3 號，只是這個行程的主人是 1 號，所以是「知道你是誰，但不能進」的 403。
3. 每個人的「我的行程」都會列出**所有人**的行程，看得到別人的行程名稱、天數、日期。`get_editable_trip` 救不了：它只守 `/api/trips/{trip_id}/...` 這些「某一個行程」的 API，「列出行程」的條件要自己寫對。點進去才會被 403 擋下來，但名稱已經洩漏了。
4. 遷移檔是每個環境都會跑的（例如第 10 課的正式機）。那裡的 id 1 不一定是你，可能是別人，甚至還沒有任何會員（外鍵會讓 `UPDATE` 失敗）。「舊資料歸給誰」只跟你這台電腦的資料有關，所以自己下一次 SQL 就好。

</details>

#### 你的實作紀錄（2026-11-18）

- 後端 4 個檔案、前端 2 個檔案都正確。`trips.py`、`itinerary.py` 跟教材一模一樣。其他只差排版：`models.py` 的 `index=True` 後面少了逗號；`dependencies.py` 寫成 `import User, Trip`（順序不同）；`trips/page.tsx` 多一行空白、`enabled` 那行少了註解；首頁的 `useMe` 寫成相對路徑 `./lib/useMe`。型別檢查、lint 都通過。
- 遷移檔 `29da37c211c8`：外鍵是 `'fk_trips_user_id'`（不是 `None`），`downgrade()` 沒有 WARNING，資料庫在最新版。`\d trips` 看得到 `ix_trips_user_id` 索引和 `fk_trips_user_id` 外鍵（`ON DELETE CASCADE`）。
- 你的資料庫（只讀）：京都三日遊、大阪兩日遊的 `user_id` 都是 `1`，步驟 22 的認領有做。行程的流水號到了 5，代表步驟 25 ② 建了「測試二號的行程」又刪掉了。
- 打你開著的後端（沒有 cookie）：`/api/trips`、`/api/trips/1`、每日行程、`/api/trips/999`、`DELETE /api/trips/1` 全部 `401`「請先登入」。
- 用 Chrome 開一個沒有 cookie 的視窗看你的 3000（只看不改）：「我的行程」顯示「請先登入，才能建立和查看你的行程。」，而且沒有打 `/api/trips`；首頁顯示「登入之後，可以把景點加進你的行程」，沒有選單；`/trips/1` 顯示「請先登入」。主控台只有 `/trips/1` 那一行 `401`，正常。
- Redis：1 個 session，是小明的，代表最後有登入回來。
