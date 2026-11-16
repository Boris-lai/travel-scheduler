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
