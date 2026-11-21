from datetime import date

from pydantic import BaseModel

from schemas.itinerary import ItineraryItemOut


# 出餐單：產生分享連結之後回的資料
class ShareOut(BaseModel):
    share_token: str


# 出餐單：分享頁看到的行程。只放「看」需要的東西：沒有行程編號、主人、鑰匙
class SharedTripOut(BaseModel):
    title: str
    days: int
    start_date: date | None
    items: list[ItineraryItemOut]  # 每一天的每一站，照第幾天、第幾站排好
