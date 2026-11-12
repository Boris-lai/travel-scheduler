from pydantic import BaseModel


# 出餐單：Google 自動完成的一筆建議
class PlaceSuggestion(BaseModel):
    google_place_id: str
    name: str
    detail: str | None
