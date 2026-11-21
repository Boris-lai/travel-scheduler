import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_editable_trip
from models import ItineraryItem, Trip
from schemas.share import SharedTripOut, ShareOut

router = APIRouter()


@router.post("/api/trips/{trip_id}/share", response_model=ShareOut)
def share_trip(
    trip: Trip = Depends(get_editable_trip),  # 能編輯這個行程的人才能分享（原專案漏了這一關）
    db: Session = Depends(get_db),
):
    """產生分享連結"""
    if trip.share_token is None:
        trip.share_token = secrets.token_urlsafe(16)
        db.commit()
    # 已經分享過：回同一串，之前傳出去的連結繼續有效
    return {"share_token": trip.share_token}


@router.delete("/api/trips/{trip_id}/share", status_code=204)
def stop_sharing(
    trip: Trip = Depends(get_editable_trip), db: Session = Depends(get_db)
):
    """停止分享：亂碼清掉，傳出去的連結就打不開了"""
    trip.share_token = None
    db.commit()


@router.get("/api/share/{share_token}", response_model=SharedTripOut)
def get_shared_trip(share_token: str, db: Session = Depends(get_db)):
    """看分享的行程：不用登入、不用鑰匙，有連結就能看，但只能看"""
    trip = db.scalar(select(Trip).where(Trip.share_token == share_token))
    if trip is None:
        raise HTTPException(status_code=404, detail="找不到這個分享，可能已經停止分享了")

    stmt = (
        select(ItineraryItem)
        .where(ItineraryItem.trip_id == trip.id)
        .order_by(ItineraryItem.day_index, ItineraryItem.position)
    )
    return {
        "title": trip.title,
        "days": trip.days,
        "start_date": trip.start_date,
        "items": db.scalars(stmt).all(),
    }
