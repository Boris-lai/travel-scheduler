import json
import time

import redis
import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from core.database import get_db
from core.redis import REDIS_URL, redis_client
from schemas.destination import DestinationOut
from schemas.search import SearchIn, SearchOut, TaskStatusOut
from services.ingest import find_existing
from worker.tasks import celery_app, ingest_location_task

router = APIRouter()

ENOUGH = 5  # 資料庫已經有這麼多景點，就不用再上網找
HEARTBEAT_SECONDS = 15  # 沒消息時，每隔多久送一次心跳
MAX_WAIT_SECONDS = 600  # 最多等 10 分鐘
CACHE_SECONDS = 3600  # 小白板上的結果，1 小時後自動擦掉


def read_cache(key: str) -> list | None:
    try:
        raw = redis_client.get(key)
    except redis.RedisError as e:
        print(f"⚠️ 讀快取失敗，改查資料庫：{e}")
        return None
    return None if raw is None else json.loads(raw)


def write_cache(key: str, data: list) -> None:
    try:
        redis_client.set(key, json.dumps(
            data, ensure_ascii=False), ex=CACHE_SECONDS)
        print(f"📝 寫入快取：{key}（{len(data)} 筆）")
    except redis.RedisError as e:
        print(f"⚠️ 寫快取失敗：{e}")  # 寫不進去也沒關係，下次再查資料庫就好


@router.post("/api/search", response_model=SearchOut)
def search(payload: SearchIn, db: Session = Depends(get_db)):
    location = payload.location.strip()
    cache_key = f"search:{location}"

    # 1. 先看小白板
    cached = read_cache(cache_key)
    if cached is not None:
        print(f"🚀 命中快取：{location}")
        return {"location": location, "status": "completed", "destinations": cached}

    # 2. 小白板沒有，查資料庫
    existing = find_existing(db, location)
    # 不夠的話，再看有沒有「冷卻中」的便利貼（or 前面成立就不會看後面）
    if len(existing) >= ENOUGH or redis_client.exists(f"exhausted:{location}"):
        # 資料庫的物件不能直接存進 Redis，先轉成 dict（日期轉成字串）
        destinations = [
            DestinationOut.model_validate(d).model_dump(mode="json") for d in existing
        ]
        write_cache(cache_key, destinations)
        return {"location": location, "status": "completed", "destinations": destinations}

    # 3. 不夠又沒在冷卻：把工作丟進訂單夾，馬上回一個號碼牌
    task = ingest_location_task.delay(location)
    return {
        "location": location,
        "status": "processing",
        "task_id": task.id,
        "destinations": existing,
    }


@router.get("/api/search/status/{task_id}", response_model=TaskStatusOut)
def get_search_status(task_id: str):
    result = celery_app.AsyncResult(task_id)

    if result.state in ("PENDING", "STARTED"):
        return {"status": "processing"}
    if result.state == "SUCCESS":
        return {"status": "completed", "added": result.result}
    return {"status": "failed", "error": str(result.info)}


def sse_message(data: dict) -> str:
    # SSE 的格式：「data: 內容」後面接兩個換行
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.get("/api/search/stream/{task_id}")
async def stream_search_status(task_id: str, request: Request):
    async def event_stream():
        redis_conn = aioredis.from_url(REDIS_URL, decode_responses=True)
        pubsub = redis_conn.pubsub()
        await pubsub.subscribe(f"task_done:{task_id}")  # 先打開收音機
        try:
            # 打開收音機之前，任務可能已經做完、廣播已經錯過了，先查一次出餐台
            result = celery_app.AsyncResult(task_id)
            if result.state == "SUCCESS":
                yield sse_message({"status": "completed", "added": result.result})
                return
            if result.state == "FAILURE":
                yield sse_message({"status": "failed", "error": str(result.info)})
                return

            deadline = time.monotonic() + MAX_WAIT_SECONDS
            while time.monotonic() < deadline:
                if await request.is_disconnected():  # 使用者關掉頁面了
                    return
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=HEARTBEAT_SECONDS
                )
                if message:  # 收到 worker 的廣播
                    yield f"data: {message['data']}\n\n"
                    return
                yield ": heartbeat\n\n"  # 冒號開頭是註解，讓連線保持活著

            yield sse_message({"status": "timeout"})
        finally:
            # 不管怎麼結束，都要關掉收音機、還掉連線
            await pubsub.unsubscribe()
            await pubsub.aclose()
            await redis_conn.aclose()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
