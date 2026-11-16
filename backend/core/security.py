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
