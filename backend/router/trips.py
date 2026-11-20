import secrets

import requests
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user, get_editable_trip, get_optional_user
from models import Destination, Trip, TripPlace, User
from schemas.destination import DestinationOut
from schemas.trip import (
    TripCreate,
    TripCreateOut,
    TripOut,
    TripPlaceCreate,
    TripPlaceGoogleCreate,
)
from services.places import place_details


router = APIRouter()


@router.post("/api/trips", response_model=TripCreateOut, status_code=201)
def create_trip(
    payload: TripCreate,
    user: User | None = Depends(get_optional_user),  # 沒登入也可以建立
    db: Session = Depends(get_db),
):
    trip = Trip(**payload.model_dump())
    if user is not None:
        trip.user_id = user.id  # 有登入：誰建立的，誰就是主人
    else:
        trip.edit_token = secrets.token_urlsafe(32)  # 沒登入：沒有主人，發一把鑰匙
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


@router.post("/api/trips/{trip_id}/claim", response_model=TripOut)
def claim_trip(
    trip: Trip = Depends(get_editable_trip),  # 匿名行程：要有鑰匙才過得了這一關
    user: User = Depends(get_current_user),  # 而且要登入，才知道要歸給誰
    db: Session = Depends(get_db),
):
    """認領：把匿名行程歸到自己的帳號下"""
    if trip.user_id is None:
        trip.user_id = user.id
        trip.edit_token = None  # 鑰匙作廢：之後靠手環（登入）就好
        db.commit()
        db.refresh(trip)
    # 已經是自己的行程（例如重複認領）：什麼都不用做
    return trip


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
