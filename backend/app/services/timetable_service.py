"""Timetable service with room/time conflict checks."""

from __future__ import annotations

from datetime import date, time

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.academic import Branch, Faculty, StudentGroup
from app.models.timetable import Timetable
from app.models.user import User
from app.schemas.timetable import TimetableCreate, TimetableUpdate
from app.services.campus_service import get_room
from app.services.exceptions import ConflictError, NotFoundError, ValidationError


def _query():
    return select(Timetable).options(
        selectinload(Timetable.room),
        selectinload(Timetable.branch),
        selectinload(Timetable.student_group),
        selectinload(Timetable.faculty),
    )


def get_timetable(db: Session, timetable_id: int) -> Timetable:
    timetable = db.scalar(_query().where(Timetable.id == timetable_id))
    if timetable is None:
        raise NotFoundError("Timetable entry not found")
    return timetable


def _validate_references(
    db: Session,
    *,
    room_id: int,
    branch_id: int | None,
    group_id: int | None,
    faculty_mobile: str | None,
) -> None:
    get_room(db, room_id)
    if branch_id is not None and db.get(Branch, branch_id) is None:
        raise NotFoundError("Branch not found")
    if group_id is not None and db.get(StudentGroup, group_id) is None:
        raise NotFoundError("Student group not found")
    if faculty_mobile is not None and db.get(Faculty, faculty_mobile) is None:
        raise NotFoundError("Faculty member not found")


def _check_conflict(
    db: Session,
    *,
    room_id: int,
    day_of_week: int,
    start_time: time,
    end_time: time,
    valid_from: date,
    valid_to: date | None,
    exclude_id: int | None = None,
) -> None:
    stmt = select(Timetable).where(
        Timetable.room_id == room_id,
        Timetable.day_of_week == day_of_week,
        Timetable.is_active.is_(True),
        Timetable.start_time < end_time,
        Timetable.end_time > start_time,
    )
    if exclude_id is not None:
        stmt = stmt.where(Timetable.id != exclude_id)
    for existing in db.scalars(stmt):
        if existing.valid_to is not None and existing.valid_to < valid_from:
            continue
        if valid_to is not None and existing.valid_from > valid_to:
            continue
        raise ConflictError(
            "The room already has a timetable entry for that day and time"
        )


def list_timetables(
    db: Session,
    *,
    room_id: int | None = None,
    branch_id: int | None = None,
    group_id: int | None = None,
    faculty_mobile: str | None = None,
    day_of_week: int | None = None,
    active_only: bool = True,
) -> list[Timetable]:
    stmt = _query().order_by(
        Timetable.day_of_week, Timetable.start_time, Timetable.room_id
    )
    if room_id is not None:
        stmt = stmt.where(Timetable.room_id == room_id)
    if branch_id is not None:
        stmt = stmt.where(Timetable.branch_id == branch_id)
    if group_id is not None:
        stmt = stmt.where(Timetable.student_group_id == group_id)
    if faculty_mobile is not None:
        stmt = stmt.where(Timetable.faculty_mobile_number == faculty_mobile)
    if day_of_week is not None:
        stmt = stmt.where(Timetable.day_of_week == day_of_week)
    if active_only:
        stmt = stmt.where(Timetable.is_active.is_(True))
    return list(db.scalars(stmt))


def create_timetable(
    db: Session, user: User, data: TimetableCreate
) -> Timetable:
    _validate_references(
        db,
        room_id=data.room_id,
        branch_id=data.branch_id,
        group_id=data.student_group_id,
        faculty_mobile=data.faculty_mobile_number,
    )
    _check_conflict(
        db,
        room_id=data.room_id,
        day_of_week=data.day_of_week,
        start_time=data.start_time,
        end_time=data.end_time,
        valid_from=data.valid_from,
        valid_to=data.valid_to,
    )
    timetable = Timetable(created_by_id=user.id, **data.model_dump())
    db.add(timetable)
    db.commit()
    return get_timetable(db, timetable.id)


def update_timetable(
    db: Session, timetable: Timetable, data: TimetableUpdate
) -> Timetable:
    values = data.model_dump(exclude_unset=True)
    room_id = values.get("room_id", timetable.room_id)
    day = values.get("day_of_week", timetable.day_of_week)
    start = values.get("start_time", timetable.start_time)
    end = values.get("end_time", timetable.end_time)
    valid_from = values.get("valid_from", timetable.valid_from)
    valid_to = values.get("valid_to", timetable.valid_to)

    if end <= start:
        raise ValidationError("end_time must be later than start_time")
    if valid_to is not None and valid_to < valid_from:
        raise ValidationError("valid_to must not be earlier than valid_from")

    _validate_references(
        db,
        room_id=room_id,
        branch_id=values.get("branch_id", timetable.branch_id),
        group_id=values.get("student_group_id", timetable.student_group_id),
        faculty_mobile=values.get("faculty_mobile_number", timetable.faculty_mobile_number),
    )
    _check_conflict(
        db,
        room_id=room_id,
        day_of_week=day,
        start_time=start,
        end_time=end,
        valid_from=valid_from,
        valid_to=valid_to,
        exclude_id=timetable.id,
    )
    for key, value in values.items():
        setattr(timetable, key, value)
    db.commit()
    return get_timetable(db, timetable.id)


def deactivate_timetable(db: Session, timetable: Timetable) -> Timetable:
    timetable.is_active = False
    db.commit()
    return get_timetable(db, timetable.id)