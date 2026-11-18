from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_editable_trip
from models import ItineraryItem, Trip, TripPlace
from schemas.itinerary import (
    ItineraryDaySave,
    ItineraryItemCreate,
    ItineraryItemOut,
)


router = APIRouter()


def check_day(trip: Trip, day_index: int) -> None:
    """這個行程要有這一天（第 1 天到最後一天）"""
    if not 1 <= day_index <= trip.days:
        raise HTTPException(status_code=404, detail=f"這個行程只有 {trip.days} 天")


def day_items(db: Session, trip_id: int, day_index: int) -> list[ItineraryItem]:
    """某一天的每一站，照順序排好"""
    stmt = (
        select(ItineraryItem)
        .where(ItineraryItem.trip_id == trip_id, ItineraryItem.day_index == day_index)
        .order_by(ItineraryItem.position)
    )
    return list(db.scalars(stmt).all())


@router.get(
    "/api/trips/{trip_id}/days/{day_index}/itinerary",
    response_model=list[ItineraryItemOut],
)
def list_day_itinerary(
    day_index: int,
    trip: Trip = Depends(get_editable_trip),
    db: Session = Depends(get_db),
):
    check_day(trip, day_index)
    return day_items(db, trip.id, day_index)


@router.get("/api/trips/{trip_id}/itinerary", response_model=list[ItineraryItemOut])
def list_trip_itinerary(
    trip: Trip = Depends(get_editable_trip), db: Session = Depends(get_db)
):
    """整個行程每一天的每一站，照第幾天、第幾站排好"""
    stmt = (
        select(ItineraryItem)
        .where(ItineraryItem.trip_id == trip.id)
        .order_by(ItineraryItem.day_index, ItineraryItem.position)
    )
    return db.scalars(stmt).all()


@router.post(
    "/api/trips/{trip_id}/days/{day_index}/itinerary",
    response_model=ItineraryItemOut,
    status_code=201,
)
def add_to_day(
    day_index: int,
    payload: ItineraryItemCreate,
    trip: Trip = Depends(get_editable_trip),
    db: Session = Depends(get_db),
):
    check_day(trip, day_index)

    # 資料庫也會擋這兩種情況，先自己檢查，是為了回比較清楚的訊息
    if db.get(TripPlace, (trip.id, payload.destination_id)) is None:
        raise HTTPException(status_code=400, detail="請先把這個景點加進景點池")
    scheduled = db.scalar(
        select(ItineraryItem).where(
            ItineraryItem.trip_id == trip.id,
            ItineraryItem.destination_id == payload.destination_id,
        )
    )
    if scheduled is not None:
        raise HTTPException(
            status_code=409, detail=f"這個景點已經排在第 {scheduled.day_index} 天了"
        )

    # 排在這一天的最後面：目前最大的 position ＋ 1；這一天還是空的，就是 0
    last = db.scalar(
        select(func.max(ItineraryItem.position)).where(
            ItineraryItem.trip_id == trip.id, ItineraryItem.day_index == day_index
        )
    )
    item = ItineraryItem(
        trip_id=trip.id,
        destination_id=payload.destination_id,
        day_index=day_index,
        position=0 if last is None else last + 1,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/api/trips/{trip_id}/itinerary/{item_id}", status_code=204)
def remove_from_day(
    item_id: int,
    trip: Trip = Depends(get_editable_trip),
    db: Session = Depends(get_db),
):
    item = db.get(ItineraryItem, item_id)
    if item is None or item.trip_id != trip.id:
        raise HTTPException(status_code=404, detail="這個行程裡沒有這一站")

    day_index = item.day_index
    db.delete(item)
    db.flush()  # 先把「刪除」送到資料庫（還沒存檔），下面重新編號時才不會算到它

    # 補位：剩下的重新編成 0、1、2……，中間不留空號
    for new_position, rest in enumerate(day_items(db, trip.id, day_index)):
        rest.position = new_position
    db.commit()


@router.put(
    "/api/trips/{trip_id}/days/{day_index}/itinerary",
    response_model=list[ItineraryItemOut],
)
def save_day(
    day_index: int,
    payload: ItineraryDaySave,
    trip: Trip = Depends(get_editable_trip),
    db: Session = Depends(get_db),
):
    check_day(trip, day_index)
    items = {item.id: item for item in day_items(db, trip.id, day_index)}

    # 要送這一天的每一站：不能多、不能少、不能重複
    sent_ids = [row.id for row in payload.items]
    if len(sent_ids) != len(set(sent_ids)) or set(sent_ids) != set(items):
        raise HTTPException(
            status_code=400, detail="要送這一天的每一站，不能多、不能少、不能重複"
        )

    for new_position, row in enumerate(payload.items):
        if (
            row.arrival_time is not None
            and row.departure_time is not None
            and row.departure_time < row.arrival_time
        ):
            # 在這裡出錯的話，前面幾站改到一半的資料都不會存進去（還沒 commit）
            raise HTTPException(
                status_code=400,
                detail=f"第 {new_position + 1} 站的離開時間比抵達時間早",
            )
        item = items[row.id]
        item.position = new_position
        item.arrival_time = row.arrival_time
        item.departure_time = row.departure_time
        item.travel_mode = row.travel_mode

    db.commit()  # 全部都改好了，才一次存檔
    return day_items(db, trip.id, day_index)
