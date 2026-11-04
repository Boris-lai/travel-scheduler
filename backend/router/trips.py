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
