import requests
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from models import Destination
from services.article import fetch_article_text
from services.blog_search import find_blog_urls
from services.gemini import AttractionAI, extract_attractions
from services.places import verify_place

MIN_ARTICLE_CHARS = 1000  # 文章少於這個字數，多半沒抓到內容
MIN_ATTRACTIONS = 3  # AI 找到的景點少於這個數量，就換下一篇


def find_existing(db: Session, location: str) -> list[Destination]:
    """查資料庫裡跟這個地點有關的景點"""
    stmt = (
        select(Destination)
        .where(
            or_(
                Destination.input_region == location,
                Destination.city_name.contains(location),
                Destination.geo_tags.contains(location),
            )
        )
        .order_by(Destination.id)
    )
    return list(db.scalars(stmt).all())


def get_attractions_from_web(location: str) -> list[AttractionAI]:
    """① ② ③：候選文章一篇一篇試，直到 AI 找到足夠的景點"""
    for url in find_blog_urls(location):
        print(f"📄 試這篇：{url}")
        try:
            article = fetch_article_text(url)
        except requests.RequestException as e:
            print(f"   ❌ 抓不到文章：{e}")
            continue
        if len(article) < MIN_ARTICLE_CHARS:
            print(f"   ❌ 文章太短（{len(article)} 字），換下一篇")
            continue

        attractions = extract_attractions(article, location)
        if len(attractions) < MIN_ATTRACTIONS:
            print(f"   ❌ 只找到 {len(attractions)} 個景點，換下一篇")
            continue

        print(f"   ✅ AI 找到 {len(attractions)} 個景點")
        return attractions
    return []


def ingest_location(db: Session, location: str) -> int:
    """完整流程：上網找景點 → Google 查證 → 存進資料庫。回傳新增了幾筆"""
    attractions = get_attractions_from_web(location)

    # 資料庫裡已經有的 google_place_id，放進 set，查「有沒有」最快
    existing_ids = set(db.scalars(select(Destination.google_place_id)).all())

    added = 0
    for a in attractions:
        place = verify_place(a.name, location)  # ④
        if place is None:
            print(f"   🗑️ Google 查不到，丟掉：{a.name}")
            continue
        if place["google_place_id"] in existing_ids:
            print(f"   ⏭️ 已經有了，跳過：{a.name}")
            continue

        existing_ids.add(place["google_place_id"])  # 防止這一批自己重複
        db.add(
            Destination(
                place_name=a.name,  # 用 AI 讀到的中文名稱
                city_name=a.city,
                description=a.description,
                geo_tags=a.geo_tags,
                input_region=location,
                google_place_id=place["google_place_id"],
                address=place["address"],
                lat=place["lat"],
                lng=place["lng"],
                source="ai",
            )
        )
        added += 1

    db.commit()
    print(f"💾 新增了 {added} 個景點")
    return added
