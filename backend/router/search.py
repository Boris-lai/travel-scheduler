from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from schemas.search import SearchIn, SearchOut
from services.ingest import find_existing, ingest_location

router = APIRouter()

ENOUGH = 5  # 資料庫已經有這麼多景點，就不用再上網找


@router.post("/api/search", response_model=SearchOut)
def search(payload: SearchIn, db: Session = Depends(get_db)):
    location = payload.location.strip()

    existing = find_existing(db, location)
    if len(existing) >= ENOUGH:
        return {"location": location, "searched_web": False, "added": 0, "destinations": existing}

    try:
        added = ingest_location(db, location)
    except RuntimeError as e:  # Gemini 的模型都忙線
        raise HTTPException(status_code=503, detail=str(e))

    return {
        "location": location,
        "searched_web": True,
        "added": added,
        "destinations": find_existing(db, location),
    }
