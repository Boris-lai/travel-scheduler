# 第 8 課：登入、權限、分享

> **狀態**：第 1 段（後端：註冊、登入、登出）✅
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
