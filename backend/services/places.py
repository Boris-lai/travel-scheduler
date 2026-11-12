import os

import requests
from dotenv import load_dotenv

load_dotenv()

MAPS_API_KEY = os.getenv("MAPS_API_KEY")
SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
# 只拿這 4 個欄位：屬於 Text Search Pro，每月前 5,000 次免費。要得越多越貴
# Field Mask 是告訴 Google「我只要這 4 個欄位」，要的欄位越多越貴。
FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.location"


def verify_place(name: str, location: str) -> dict | None:
    resp = requests.post(
        SEARCH_URL,
        headers={"X-Goog-Api-Key": MAPS_API_KEY,
                 "X-Goog-FieldMask": FIELD_MASK},
        json={"textQuery": f"{location} {name}", "languageCode": "zh-TW"},
        timeout=10,
    )
    resp.raise_for_status()
    places = resp.json().get("places", [])
    if not places:
        return None  # Google 查不到：可能是 AI 編的，或名稱太模糊，就丟掉

    place = places[0]  # 只取最符合的第一筆
    return {
        "google_place_id": place["id"],
        "google_name": place["displayName"]["text"],  # 參考用：可能是英文
        "address": place.get("formattedAddress"),
        "lat": place["location"]["latitude"],
        "lng": place["location"]["longitude"],
    }


AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete"
DETAILS_URL = "https://places.googleapis.com/v1/places/"
# 有 displayName，屬於 Place Details Pro，每月前 5,000 次免費
DETAILS_FIELD_MASK = "id,displayName,formattedAddress,location,addressComponents"


def autocomplete(text: str) -> list[dict]:
    """打字時的建議清單：Google 猜你要找的地點（最多 5 個）"""
    resp = requests.post(
        AUTOCOMPLETE_URL,
        headers={"X-Goog-Api-Key": MAPS_API_KEY},
        json={"input": text, "languageCode": "zh-TW"},
        timeout=10,
    )
    resp.raise_for_status()
    suggestions = []
    for s in resp.json().get("suggestions", []):
        p = s["placePrediction"]
        suggestions.append({
            "google_place_id": p["placeId"],
            "name": p["structuredFormat"]["mainText"]["text"],  # 例如「金閣寺」
            # 例如「日本京都府京都市北區金閣寺町」，有時候沒有
            "detail": p["structuredFormat"].get("secondaryText", {}).get("text"),
        })
    return suggestions


def find_city(components: list[dict]) -> str | None:
    """地址是一個一個零件。先找城市（locality），沒有就用縣市、都道府縣"""
    for wanted in ["locality", "administrative_area_level_1"]:     # 外層：依序想找的種類
        for c in components:                                       # 內層：每個零件看一遍
            if wanted in c["types"]:                               # 這個零件是我要的種類嗎？
                # 是 → 馬上回傳，整個函式結束
                return c["longText"]
    return None                                                    # 兩種都找遍了還是沒有


def place_details(google_place_id: str) -> dict:
    """用 google_place_id 查一個地點，整理成 Destination 要的欄位"""
    resp = requests.get(
        DETAILS_URL + google_place_id,
        headers={"X-Goog-Api-Key": MAPS_API_KEY,
                 "X-Goog-FieldMask": DETAILS_FIELD_MASK},
        params={"languageCode": "zh-TW"},
        timeout=10,
    )
    resp.raise_for_status()
    place = resp.json()
    return {
        "place_name": place["displayName"]["text"],
        "city_name": find_city(place.get("addressComponents", [])),
        "address": place.get("formattedAddress"),
        "lat": place["location"]["latitude"],
        "lng": place["location"]["longitude"],
    }


if __name__ == "__main__":
    import sys

    print(verify_place(sys.argv[1], sys.argv[2]))
