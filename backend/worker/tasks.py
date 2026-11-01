import json

from celery import Celery

from core.database import SessionLocal
from core.redis import REDIS_URL, redis_client
from services.ingest import ingest_location

FEW_NEW = 3  # 新增的景點少於這個數量，就當作這個地點被挖光了
COOLDOWN_SECONDS = 86400  # 挖光的地點，1 天內不要再派人去找

# broker：訂單夾（任務排隊的地方）；backend：結果放哪裡。兩個都用 Redis
celery_app = Celery("travel", broker=REDIS_URL, backend=REDIS_URL)
celery_app.conf.update(
    task_track_started=True,  # 廚師開始做時，把狀態標成 STARTED
    result_expires=3600,  # 結果在 Redis 留 1 小時就自動清掉
)


@celery_app.task(bind=True)
def ingest_location_task(self, location: str) -> int:
    channel = f"task_done:{self.request.id}"  # 每張單有自己的廣播頻道
    try:
        # worker 是另一個獨立的程式，沒有 FastAPI 的 Depends(get_db)，要自己開 Session
        # with SessionLocal() as db: 會在區塊結束時自動關掉 Session，等於 get_db 裡的 finally: db.close()。
        with SessionLocal() as db:
            added = ingest_location(db, location)
    except Exception as e:
        redis_client.publish(channel, json.dumps(
            {"status": "failed", "error": str(e)}, ensure_ascii=False))
        raise  # 繼續往外丟，讓 Celery 把這張單標成 FAILURE

    if added < FEW_NEW:
        # 貼一張便利貼：這個地點 1 天內不要再找了，時間到 Redis 會自動撕掉
        redis_client.set(f"exhausted:{location}", "1", ex=COOLDOWN_SECONDS)
        print(f"❄️ 只新增 {added} 個，「{location}」冷卻 1 天")

    redis_client.publish(channel, json.dumps(
        {"status": "completed", "added": added}, ensure_ascii=False))
    return added
