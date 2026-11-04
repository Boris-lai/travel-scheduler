from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


# 點餐單：建立行程時要送來的資料
class TripCreate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    days: int = Field(ge=1, le=60)
    start_date: date | None = None


# 出餐單：回給客人的行程資料
class TripOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    days: int
    start_date: date | None
    created_at: datetime


# 點餐單：把一個景點加進景點池
class TripPlaceCreate(BaseModel):
    destination_id: int
