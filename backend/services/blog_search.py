import re

from ddgs import DDGS

# 閘門 1：這些網站不是旅遊部落格（社群、訂房、新聞、廣告…）
EXCLUDED_DOMAINS = [
    "google", "facebook", "youtube", "instagram", "wikipedia",
    "dcard", "ptt.cc", "mobile01",
    "klook", "kkday", "agoda", "booking", "tripadvisor", "trip.com", "getyourguide",
    "ettoday", "ltn", "udn", "chinatimes",
    "/aclick",
]
# 閘門 3：出現這些字，通常不是遊記
NEGATIVE_KEYWORDS = ["新聞", "徵才", "職缺", "租屋", "售票", "天氣", "旅行社"]
# 閘門 4：至少要出現一個旅遊相關的字
TRAVEL_KEYWORDS = ["景點", "遊記", "推薦", "行程", "攻略", "懶人包", "一日遊", "自由行"]


def find_blog_urls(location: str, limit: int = 3) -> list[str]:
    query = f"{location} 旅遊 景點 推薦 懶人包"
    with DDGS() as ddgs:
        results = ddgs.text(query, region="tw-tz",
                            max_results=15, backend="auto")

    urls = []
    for r in results:
        url = r["href"]
        text = re.sub(r"\s+", "", r["title"] + r["body"])  # 標題＋摘要，去掉所有空白

        if any(domain in url.lower() for domain in EXCLUDED_DOMAINS):  # 閘門 1
            continue
        if location not in text:  # 閘門 2：要提到這個地點
            continue
        if any(word in text for word in NEGATIVE_KEYWORDS):  # 閘門 3
            continue
        if not any(word in text for word in TRAVEL_KEYWORDS):  # 閘門 4
            continue

        urls.append(url)
        if len(urls) == limit:
            break
    return urls


if __name__ == "__main__":
    import sys

    for url in find_blog_urls(sys.argv[1]):
        print(url)
