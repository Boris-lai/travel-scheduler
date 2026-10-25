from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

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
