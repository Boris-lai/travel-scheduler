from fastapi import Cookie, Depends, HTTPException
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
