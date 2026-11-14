import requests
from fastapi import APIRouter, HTTPException, Query

from schemas.leg import LegEstimate, TravelMode
from services.legs import estimate_leg

router = APIRouter()


@router.get("/api/legs/estimate", response_model=LegEstimate)
def leg_estimate(
    mode: TravelMode,
    from_lat: float = Query(ge=-90, le=90),
    from_lng: float = Query(ge=-180, le=180),
    to_lat: float = Query(ge=-90, le=90),
    to_lng: float = Query(ge=-180, le=180),
):
    try:
        return estimate_leg(from_lat, from_lng, to_lat, to_lng, mode)
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Google 路線查詢失敗，請稍後再試")
