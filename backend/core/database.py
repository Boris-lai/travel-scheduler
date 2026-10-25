import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# echo=True：學習用，把 SQLAlchemy 翻譯出來的 SQL 印在終端機
engine = create_engine(DATABASE_URL, echo=True)
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()   # 借出
    try:
        yield db          # 交給 API 函式使用
    finally:
        db.close()        # 不管成功還是出錯，都一定歸還
