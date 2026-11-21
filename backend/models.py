from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship


from core.database import Base


class Destination(Base):
    __tablename__ = "destinations"

    id: Mapped[int] = mapped_column(primary_key=True)
    input_region: Mapped[str | None] = mapped_column(String(100), index=True)
    city_name: Mapped[str | None] = mapped_column(String(100), index=True)
    place_name: Mapped[str] = mapped_column(String(255))
    geo_tags: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    address: Mapped[str | None] = mapped_column(String(255))
    google_place_id: Mapped[str | None] = mapped_column(
        String(255), unique=True)
    lat: Mapped[Decimal | None] = mapped_column(Numeric(10, 8))
    lng: Mapped[Decimal | None] = mapped_column(Numeric(11, 8))
    source: Mapped[str] = mapped_column(String(20), server_default="ai")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(100))
    days: Mapped[int] = mapped_column(Integer)  # 總共幾天
    start_date: Mapped[date | None] = mapped_column(Date)  # 出發日，可以不填
    # 行程的主人（指向 users 表）。會員被刪掉，他的行程也一起刪掉。
    # 可以是 None：舊的行程還沒有主人；第 4 段沒登入建立的行程也沒有
    user_id: Mapped[int | None] = mapped_column(
        # 外鍵要取名字，Alembic 退回上一版（downgrade）時才知道要刪哪一個
        ForeignKey("users.id", ondelete="CASCADE", name="fk_trips_user_id"),
        index=True
    )
    # 匿名行程的鑰匙：沒登入建立的行程才有，認領之後就清掉
    edit_token: Mapped[str | None] = mapped_column(String(64))
    # 分享連結裡的那串亂碼：按「產生分享連結」才有，停止分享就清掉。
    # unique：兩個行程不能用同一串；index：用這串找行程會比較快
    share_token: Mapped[str | None] = mapped_column(
        String(64), unique=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class TripPlace(Base):
    __tablename__ = "trip_places"

    # 兩個欄位一起當主鍵：同一個行程裡，同一個景點只能出現一次
    trip_id: Mapped[int] = mapped_column(
        ForeignKey("trips.id", ondelete="CASCADE"), primary_key=True
    )
    destination_id: Mapped[int] = mapped_column(
        ForeignKey("destinations.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ItineraryItem(Base):
    __tablename__ = "itinerary_items"
    __table_args__ = (
        # 外鍵指向景點池：只能排景點池裡有的景點；從景點池移除，這一站也跟著刪掉
        ForeignKeyConstraint(
            ["trip_id", "destination_id"],
            ["trip_places.trip_id", "trip_places.destination_id"],
            ondelete="CASCADE",
        ),
        # 同一個行程裡，一個景點只能排一次（不能第 1 天、第 2 天都去清水寺）
        UniqueConstraint("trip_id", "destination_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[int] = mapped_column(Integer)
    destination_id: Mapped[int] = mapped_column(
        ForeignKey("destinations.id", ondelete="CASCADE")
    )
    day_index: Mapped[int] = mapped_column(Integer)  # 第幾天，從 1 開始
    position: Mapped[int] = mapped_column(Integer)  # 當天第幾站，從 0 開始
    arrival_time: Mapped[time | None] = mapped_column(Time)  # 幾點到
    departure_time: Mapped[time | None] = mapped_column(Time)  # 幾點走
    # 從這一站去下一站怎麼去：WALK（走路）、DRIVE（開車）、TRANSIT（大眾運輸），還沒選是 None
    travel_mode: Mapped[str | None] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # 讀這一站時，順便用 JOIN 把景點的完整資料一起拿回來
    destination: Mapped[Destination] = relationship(lazy="joined")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(
        String(255), unique=True)  # 一個 Email 只能註冊一次
    name: Mapped[str] = mapped_column(String(100))
    password_hash: Mapped[str] = mapped_column(String(255))  # 打成泥的密碼，不存密碼本身
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
