import os

from dotenv import load_dotenv
from google import genai
from google.genai import errors, types
from pydantic import BaseModel

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# 依序嘗試：前一個忙線（503）就換下一個
MODELS = ["gemini-3.5-flash", "gemini-3-flash-preview"]

PROMPT = """以下是一篇關於「{location}」的旅遊文章。

# 任務
1. 找出文章裡提到、位於「{location}」的旅遊景點。
2. 只要有專有名詞的明確地點（寺廟、神社、公園、街道、建築…），不要活動、美食或模糊的描述（例如「看夜景的地方」）。
3. 相同景點只留一個。
4. 每個景點寫一段 40 字左右的繁體中文介紹，內容要根據文章。

# 每個景點的欄位
- name：景點名稱
- city：所在城市
- description：介紹
- geo_tags：從大到小的地理標籤，用逗號隔開，例如「日本,京都府,京都市」

# 文章
{article}
"""


# AI 回傳的每個景點長這樣（Gemini 會照這個格式回答）
class AttractionAI(BaseModel):
    name: str
    city: str
    description: str
    geo_tags: str


def extract_attractions(article: str, location: str) -> list[AttractionAI]:
    prompt = PROMPT.format(location=location, article=article)
    for model in MODELS:
        try:
            resp = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=list[AttractionAI],
                ),
            )
            return resp.parsed
        except errors.ServerError as e:
            print(f"⚠️ {model} 暫時無法使用（{e.code}），換下一個模型")
    raise RuntimeError("Gemini 的模型都暫時無法使用，請稍後再試")


if __name__ == "__main__":
    import sys

    from services.article import fetch_article_text

    location, url = sys.argv[1], sys.argv[2]
    attractions = extract_attractions(fetch_article_text(url), location)
    for a in attractions:
        print(f"{a.name}｜{a.city}｜{a.geo_tags}｜{a.description}")
    print(f"\n共 {len(attractions)} 個景點")
