import requests

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.database import get_db
from models import Destination
from schemas.destination import DestinationCreate, DestinationOut, PhotoOut
from services.places import place_photo

router = APIRouter()


@router.post("/api/destinations", response_model=DestinationOut, status_code=201)
def create_destination(payload: DestinationCreate, db: Session = Depends(get_db)):
    destination = Destination(**payload.model_dump(), source="manual")
    db.add(destination)
    try:
        db.commit()
    except IntegrityError:
        # 違反資料庫的限制（這裡是 google_place_id 重複）
        db.rollback()
        raise HTTPException(status_code=409, detail="這個景點已經存在")
    db.refresh(destination)
    return destination


@router.get("/api/destinations", response_model=list[DestinationOut])
def list_destinations(db: Session = Depends(get_db)):
    return db.scalars(select(Destination).order_by(Destination.id)).all()


@router.get(
    "/api/destinations/{destination_id}/photo", response_model=PhotoOut | None
)
def destination_photo(destination_id: int, db: Session = Depends(get_db)):
    destination = db.get(Destination, destination_id)
    if destination is None:
        raise HTTPException(status_code=404, detail="找不到這個景點")
    if not destination.google_place_id:
        return None  # 沒有 Google 的地點 id，就沒辦法問照片
    try:
        return place_photo(destination.google_place_id)
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Google 照片拿不到，請稍後再試")
