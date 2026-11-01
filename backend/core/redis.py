import os

import redis
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL")

# decode_responses=True：從 Redis 拿回來的是字串，不是 bytes
redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
