from typing import Literal

from pydantic import BaseModel

# 交通方式只能是這三種（名稱跟 Google Routes API 一樣，可以直接傳給 Google）
TravelMode = Literal["WALK", "DRIVE", "TRANSIT"]


# 出餐單：一段路（這一站到下一站）要多久
class LegEstimate(BaseModel):
    distance_meters: int
    duration_minutes: int
    estimated: bool  # False：Google 算的；True：Google 找不到路線，用直線距離估算的
