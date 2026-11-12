import requests
from fastapi import APIRouter, HTTPException, Query

from schemas.place import PlaceSuggestion
from services.places import autocomplete

router = APIRouter()


@router.get("/api/places/autocomplete", response_model=list[PlaceSuggestion])
def place_autocomplete(text: str = Query(min_length=1, max_length=100)):
    try:
        return autocomplete(text)
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Google 搜尋失敗，請稍後再試")
