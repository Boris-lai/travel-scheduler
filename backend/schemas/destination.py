from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# 點餐單：客人新增景點時要送來的資料
class DestinationCreate(BaseModel):
    place_name: str = Field(min_length=1, max_length=255)
    city_name: str | None = None
    description: str | None = None
    address: str | None = None
    google_place_id: str | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)


# 出餐單：回給客人的景點資料
class DestinationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    place_name: str
    city_name: str | None
    description: str | None
    address: str | None
    google_place_id: str | None
    lat: float | None
    lng: float | None
    input_region: str | None
    geo_tags: str | None
    source: str
    created_at: datetime


# 景點的照片。Google 給的網址過一陣子就會失效，所以不存，每次都重新拿
class PhotoOut(BaseModel):
    url: str  # 照片網址
    author_name: str | None  # 拍照的人
    author_uri: str | None  # 拍照的人在 Google 地圖上的頁面
    maps_uri: str | None  # 這張照片在 Google 地圖上的頁面
