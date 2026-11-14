from datetime import time

from pydantic import BaseModel, ConfigDict

from schemas.destination import DestinationOut
from schemas.leg import TravelMode


# 點餐單：把景點池裡的一個景點，排到某一天
class ItineraryItemCreate(BaseModel):
    destination_id: int


# 出餐單：某一天裡的其中一站
class ItineraryItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    day_index: int
    position: int
    arrival_time: time | None
    departure_time: time | None
    travel_mode: TravelMode | None  # 去下一站怎麼去
    destination: DestinationOut  # 這一站是哪個景點（完整資料）


# 存檔時，每一站要送的資料
class ItineraryItemSave(BaseModel):
    id: int  # 這一站的 id（不是景點的 id）
    arrival_time: time | None = None
    departure_time: time | None = None
    travel_mode: TravelMode | None = None


# 點餐單：一次存好整天，items 照新的順序排
class ItineraryDaySave(BaseModel):
    items: list[ItineraryItemSave]
