import re

import requests

MAX_CHARS = 15000  # 大約 1 萬個 token，夠放下一篇攻略文的重點


def fetch_article_text(url: str) -> str:
    # Jina Reader：在網址前面加上 r.jina.ai/，它會把網頁轉成乾淨的純文字
    resp = requests.get(f"https://r.jina.ai/{url}", timeout=60)
    resp.raise_for_status()
    return clean_text(resp.text)


def clean_text(text: str) -> str:
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)  # 拿掉圖片：![說明](網址)
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1",
                  text)  # 連結只留文字：[文字](網址) → 文字
    lines = [
        line
        for line in text.split("\n")
        # 很短的清單項目，幾乎都是網站選單，例如「*   京都交通」
        if not (line.strip().startswith(("*", "-")) and len(line.strip()) < 20)
    ]
    text = "\n".join(lines)
    text = re.sub(r"\n\s*\n+", "\n", text)  # 連續空行壓成一行
    return text[:MAX_CHARS]


if __name__ == "__main__":
    import sys

    text = fetch_article_text(sys.argv[1])
    print(text[:800])
    print(f"\n……（共 {len(text)} 字）")
