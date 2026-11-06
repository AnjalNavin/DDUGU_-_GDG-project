"""Room availability computation shared by search and booking services."""

from __future__ import annotations

from datetime import date, time

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.models.booking import Booking
from app.models.campus import Floor, Room, RoomPermittedUse
from app.models.enums import BookingStatus, RoomType, RoomUse
from app.models.timetable import Timetable
from app.schemas.booking import (
    BusySlot,
    RoomAvailability,
    RoomDayAvailability,
    TimeWindow,
)
from app.services.campus_service import get_room
from app.services.exceptions import ValidationError

BLOCKING_STATUSES = (BookingStatus.pending, BookingStatus.approved)


def _booking_slots(db: Session, booking_date: date) -> dict[int, list[BusySlot]]:
    slots: dict[int, list[BusySlot]] = {}
    bookings = db.scalars(
        select(Booking)
        .where(
            Booking.booking_date == booking_date,
            Booking.status.in_(BLOCKING_STATUSES),
        )
        .order_by(Booking.room_id, Booking.start_time)
    )
    for booking in bookings:
        slots.setdefault(booking.room_id, []).append(
            BusySlot(
                source="booking",
                id=booking.id,
                title=booking.title,
                status=booking.status,
                start_time=booking.start_time,
                end_time=booking.end_time,
            )
        )
    return slots


def _timetable_slots(db: Session, booking_date: date) -> dict[int, list[BusySlot]]:
    slots: dict[int, list[BusySlot]] = {}
    timetables = db.scalars(
        select(Timetable)
        .where(
            Timetable.day_of_week == booking_date.weekday(),
            Timetable.is_active.is_(True),
            Timetable.valid_from <= booking_date,
            or_(Timetable.valid_to.is_(None), Timetable.valid_to >= booking_date),
        )
        .order_by(Timetable.room_id, Timetable.start_time)
    )
    for timetable in timetables:
        slots.setdefault(timetable.room_id, []).append(
            BusySlot(
                source="timetable",
                id=timetable.id,
                title=timetable.subject,
                status=None,
                start_time=timetable.start_time,
                end_time=timetable.end_time,
            )
        )
    return slots


def _merge_slots(
    booking_slots: dict[int, list[BusySlot]],
    timetable_slots: dict[int, list[BusySlot]],
) -> dict[int, list[BusySlot]]:
    merged: dict[int, list[BusySlot]] = {}
    for room_id in set(booking_slots) | set(timetable_slots):
        items = booking_slots.get(room_id, []) + timetable_slots.get(room_id, [])
        merged[room_id] = sorted(items, key=lambda item: item.start_time)
    return merged


def _overlaps(start: time, end: time, other_start: time, other_end: time) -> bool:
    return start < other_end and other_start < end


def _room_uses(room: Room) -> list[RoomUse]:
    return [item.use_type for item in room.permitted_uses]


def _room_availability(
    room: Room, conflicts: list[BusySlot], start: time, end: time
) -> RoomAvailability:
    relevant = [
        conflict
        for conflict in conflicts
        if _overlaps(start, end, conflict.start_time, conflict.end_time)
    ]
    return RoomAvailability(
        room_id=room.id,
        room_code=room.code,
        room_name=room.name,
        room_type=room.room_type.value,
        capacity=room.capacity,
        building_id=room.floor.building_id,
        building_name=room.floor.building.name,
        floor_id=room.floor_id,
        floor_level=room.floor.level,
        floor_name=room.floor.name,
        permitted_uses=_room_uses(room),
        is_available=not relevant,
        conflicts=relevant,
    )


def search_availability(
    db: Session,
    *,
    booking_date: date,
    start_time: time,
    end_time: time,
    min_capacity: int | None = None,
    building_id: int | None = None,
    floor_id: int | None = None,
    room_type: RoomType | None = None,
    use_type: RoomUse | None = None,
    include_inactive: bool = False,
) -> list[RoomAvailability]:
    if end_time <= start_time:
        raise ValidationError("end_time must be later than start_time")

    stmt = (
        select(Room)
        .join(Floor, Room.floor_id == Floor.id)
        .options(
            selectinload(Room.permitted_uses),
            selectinload(Room.floor).selectinload(Floor.building),
        )
        .order_by(Floor.building_id, Floor.level, Room.name)
    )
    if building_id is not None:
        stmt = stmt.where(Floor.building_id == building_id)
    if floor_id is not None:
        stmt = stmt.where(Room.floor_id == floor_id)
    if room_type is not None:
        stmt = stmt.where(Room.room_type == room_type)
    if min_capacity is not None:
        stmt = stmt.where(
            Room.capacity.is_not(None), Room.capacity >= min_capacity
        )
    if use_type is not None:
        stmt = stmt.where(
            Room.permitted_uses.any(
                RoomPermittedUse.use_type == use_type
            )
        )
    if not include_inactive:
        stmt = stmt.where(Room.is_active.is_(True))

    rooms = list(db.scalars(stmt))
    slots = _merge_slots(
        _booking_slots(db, booking_date),
        _timetable_slots(db, booking_date),
    )
    return [
        _room_availability(
            room, slots.get(room.id, []), start_time, end_time
        )
        for room in rooms
    ]


def get_alternatives(
    db: Session,
    *,
    booking_date: date,
    start_time: time,
    end_time: time,
    use_type: RoomUse | None = None,
    min_capacity: int | None = None,
    building_id: int | None = None,
    floor_id: int | None = None,
    exclude_room_id: int | None = None,
    limit: int = 5,
) -> list[RoomAvailability]:
    results = search_availability(
        db,
        booking_date=booking_date,
        start_time=start_time,
        end_time=end_time,
        min_capacity=min_capacity,
        building_id=building_id,
        floor_id=floor_id,
        use_type=use_type,
    )
    available = [
        item
        for item in results
        if item.is_available and item.room_id != exclude_room_id
    ]
    return available[:limit]


def has_conflict(
    db: Session,
    *,
    room_id: int,
    booking_date: date,
    start_time: time,
    end_time: time,
    exclude_booking_id: int | None = None,
) -> list[BusySlot]:
    slots = _merge_slots(
        _booking_slots(db, booking_date),
        _timetable_slots(db, booking_date),
    )
    conflicts = []
    for slot in slots.get(room_id, []):
        if (
            slot.source == "booking"
            and exclude_booking_id is not None
            and slot.id == exclude_booking_id
        ):
            continue
        if _overlaps(start_time, end_time, slot.start_time, slot.end_time):
            conflicts.append(slot)
    return conflicts


def get_room_day_availability(
    db: Session, room_id: int, booking_date: date
) -> RoomDayAvailability:
    room = get_room(db, room_id)
    slots = _merge_slots(
        _booking_slots(db, booking_date),
        _timetable_slots(db, booking_date),
    )
    busy = slots.get(room.id, [])
    window_start = time(settings.first_booking_hour, 0)
    window_end = time(settings.last_booking_hour, 0)

    cursor = window_start
    free: list[TimeWindow] = []
    for slot in busy:
        slot_start = max(slot.start_time, window_start)
        slot_end = min(slot.end_time, window_end)
        if slot_end <= slot_start:
            continue
        if slot_start > cursor:
            free.append(TimeWindow(start_time=cursor, end_time=slot_start))
        cursor = max(cursor, slot_end)
    if cursor < window_end:
        free.append(TimeWindow(start_time=cursor, end_time=window_end))

    return RoomDayAvailability(
        room_id=room.id,
        booking_date=booking_date,
        busy=busy,
        free_windows=free,
    )
