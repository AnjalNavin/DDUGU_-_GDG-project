"""Room availability endpoints."""

from __future__ import annotations

from datetime import date, time

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies import get_current_principal
from app.models.enums import RoomType, RoomUse
from app.schemas.booking import AvailabilityResponse, RoomDayAvailability
from app.services import availability_service

router = APIRouter(prefix="/availability", tags=["availability"])


@router.get("", response_model=AvailabilityResponse)
def search_availability(
    booking_date: date = Query(alias="date"),
    start_time: time = Query(),
    end_time: time = Query(),
    min_capacity: int | None = Query(default=None, ge=1),
    building_id: int | None = None,
    floor_id: int | None = None,
    room_type: RoomType | None = None,
    use_type: RoomUse | None = None,
    _ = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> AvailabilityResponse:
    results = availability_service.search_availability(
        db,
        booking_date=booking_date,
        start_time=start_time,
        end_time=end_time,
        min_capacity=min_capacity,
        building_id=building_id,
        floor_id=floor_id,
        room_type=room_type,
        use_type=use_type,
    )
    available = sum(1 for item in results if item.is_available)
    return AvailabilityResponse(
        booking_date=booking_date,
        start_time=start_time,
        end_time=end_time,
        total=len(results),
        available=available,
        results=results,
    )


@router.get("/rooms/{room_id}", response_model=RoomDayAvailability)
def room_day_availability(
    room_id: int,
    booking_date: date = Query(alias="date"),
    _ = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> RoomDayAvailability:
    return availability_service.get_room_day_availability(
        db, room_id, booking_date
    )