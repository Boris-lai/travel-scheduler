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


if __name__ == "__main__":
    import sys

    print(verify_place(sys.argv[1], sys.argv[2]))
