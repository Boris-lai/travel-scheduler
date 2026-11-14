import math
import os

import requests
from dotenv import load_dotenv

load_dotenv()

MAPS_API_KEY = os.getenv("MAPS_API_KEY")
ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"
# 只拿時間和距離：屬於 Compute Routes Essentials，每月前 10,000 次免費
ROUTES_FIELD_MASK = "routes.duration,routes.distanceMeters"

# 備案（直線估算）用的：每種交通方式的平均速度（公里／小時），都是粗估
SPEED_KMH = {"WALK": 4.5, "DRIVE": 30, "TRANSIT": 20}
DETOUR = 1.3  # 實際走的路通常比直線遠，多算 3 成
TRANSIT_WAIT_MINUTES = 8  # 大眾運輸還要走去車站、等車


def waypoint(lat: float, lng: float) -> dict:
    """Google Routes API 要的地點格式"""
    return {"location": {"latLng": {"latitude": lat, "longitude": lng}}}


def google_route(a_lat: float, a_lng: float, b_lat: float, b_lng: float, mode: str) -> dict | None:
    """問 Google 真正的路線要多久。Google 找不到路線就回 None"""
    resp = requests.post(
        ROUTES_URL,
        headers={"X-Goog-Api-Key": MAPS_API_KEY,
                 "X-Goog-FieldMask": ROUTES_FIELD_MASK},
        json={
            "origin": waypoint(a_lat, a_lng),
            "destination": waypoint(b_lat, b_lng),
            "travelMode": mode,  # 我們的名字跟 Google 一樣，直接傳
        },
        timeout=10,
    )
    resp.raise_for_status()
    routes = resp.json().get("routes", [])
    if not routes:
        return None  # 例如：日本的大眾運輸 Google 沒有資料、兩站隔著海

    route = routes[0]
    seconds = int(route["duration"].rstrip("s"))  # Google 回的是 "1288s" 這種字串
    return {
        "distance_meters": route.get("distanceMeters", 0),  # 同一個地點時 Google 不給
        "duration_minutes": max(1, round(seconds / 60)),  # 再近也至少算 1 分鐘
        "estimated": False,
    }


def straight_distance_meters(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    """兩點之間的直線距離（公尺）。城市裡的距離不長，把地面當成平的來算就夠準"""
    meters_per_degree = 111_320  # 緯度差 1 度，大約 111 公里
    dy = (b_lat - a_lat) * meters_per_degree
    # 經度越往南北兩極越窄，所以要乘上 cos(緯度)
    dx = (b_lng - a_lng) * meters_per_degree * \
        math.cos(math.radians((a_lat + b_lat) / 2))
    return math.hypot(dx, dy)  # 畢氏定理：√(dx² + dy²)


def straight_estimate(a_lat: float, a_lng: float, b_lat: float, b_lng: float, mode: str) -> dict:
    """備案：用直線距離估算"""
    distance = straight_distance_meters(a_lat, a_lng, b_lat, b_lng) * DETOUR
    minutes = distance / 1000 / SPEED_KMH[mode] * 60
    if mode == "TRANSIT":
        minutes += TRANSIT_WAIT_MINUTES
    return {
        "distance_meters": round(distance),
        "duration_minutes": max(1, round(minutes)),
        "estimated": True,
    }


def estimate_leg(a_lat: float, a_lng: float, b_lat: float, b_lng: float, mode: str) -> dict:
    """一段路要多久：先問 Google，Google 找不到路線才用直線估算"""
    route = google_route(a_lat, a_lng, b_lat, b_lng, mode)
    if route is None:
        return straight_estimate(a_lat, a_lng, b_lat, b_lng, mode)
    return route
