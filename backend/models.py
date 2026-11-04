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
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # 讀這一站時，順便用 JOIN 把景點的完整資料一起拿回來
    destination: Mapped[Destination] = relationship(lazy="joined")
