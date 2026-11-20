import secrets

from fastapi import Cookie, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import get_session_user_id
from models import User, Trip


def get_optional_user(
    # 參數叫 sid，FastAPI 就去拿名字叫 sid 的 cookie
    sid: str | None = Cookie(default=None),
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


def get_editable_trip(
    trip_id: int,  # 從網址的 /api/trips/{trip_id}/... 拿
    user: User | None = Depends(get_optional_user),
    # 參數名的底線會變成 -，所以拿的是 header 裡的 X-Edit-Token（header 不分大小寫）
    x_edit_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Trip:
    """能不能動這個行程：有主人的看手環（登入），沒主人的看鑰匙（edit_token）"""
    trip = db.get(Trip, trip_id)
    if trip is None:
        raise HTTPException(status_code=404, detail="找不到這個行程")

    # 有主人：要登入，而且是主人
    if trip.user_id is not None:
        if user is None:
            raise HTTPException(status_code=401, detail="請先登入")
        if trip.user_id != user.id:
            raise HTTPException(status_code=403, detail="這不是你的行程")
        return trip

    # 沒有主人（匿名行程）：要出示建立時拿到的鑰匙
    if (
        x_edit_token is None
        or trip.edit_token is None
        # compare_digest：不管哪裡不一樣，比對的時間都一樣長，別人沒辦法從時間猜鑰匙
        or not secrets.compare_digest(x_edit_token.encode(), trip.edit_token.encode())
    ):
        raise HTTPException(status_code=403, detail="沒有這個行程的鑰匙")
    return trip
