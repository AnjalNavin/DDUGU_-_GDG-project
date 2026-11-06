"""Timetable and announcement endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies import get_current_principal, require_admin, require_staff
from app.models.announcement import Announcement
from app.models.timetable import Timetable
from app.models.user import User
from app.schemas.announcement import (
    AnnouncementCreate,
    AnnouncementRead,
    AnnouncementUpdate,
)
from app.schemas.common import Message
from app.schemas.timetable import (
    TimetableCreate,
    TimetableRead,
    TimetableUpdate,
)
from app.services import announcement_service, timetable_service

router = APIRouter(tags=["timetables", "announcements"])


# ---------------------------------------------------------------------------
# Timetables
# ---------------------------------------------------------------------------

@router.get("/timetables", response_model=list[TimetableRead])
def list_timetables(
    room_id: int | None = None,
    branch_id: int | None = None,
    group_id: int | None = None,
    faculty_mobile: str | None = None,
    day_of_week: int | None = Query(default=None, ge=0, le=6),
    active_only: bool = True,
    _: User = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> list[Timetable]:
    return timetable_service.list_timetables(
        db,
        room_id=room_id,
        branch_id=branch_id,
        group_id=group_id,
        faculty_mobile=faculty_mobile,
        day_of_week=day_of_week,
        active_only=active_only,
    )


@router.get("/timetables/{timetable_id}", response_model=TimetableRead)
def get_timetable(
    timetable_id: int,
    _: User = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> Timetable:
    return timetable_service.get_timetable(db, timetable_id)


@router.post(
    "/timetables",
    response_model=TimetableRead,
    status_code=status.HTTP_201_CREATED,
)
def create_timetable(
    payload: TimetableCreate,
    principal = Depends(require_staff),
    db: Session = Depends(get_db),
) -> Timetable:
    return timetable_service.create_timetable(db, principal, payload)


@router.patch("/timetables/{timetable_id}", response_model=TimetableRead)
def update_timetable(
    timetable_id: int,
    payload: TimetableUpdate,
    _: User = Depends(require_staff),
    db: Session = Depends(get_db),
) -> Timetable:
    timetable = timetable_service.get_timetable(db, timetable_id)
    return timetable_service.update_timetable(db, timetable, payload)


@router.delete("/timetables/{timetable_id}", response_model=TimetableRead)
def deactivate_timetable(
    timetable_id: int,
    _: User = Depends(require_staff),
    db: Session = Depends(get_db),
) -> Timetable:
    timetable = timetable_service.get_timetable(db, timetable_id)
    return timetable_service.deactivate_timetable(db, timetable)


# ---------------------------------------------------------------------------
# Announcements
# ---------------------------------------------------------------------------

@router.get("/announcements", response_model=list[AnnouncementRead])
def list_announcements(
    include_expired: bool = False,
    building_id: int | None = None,
    principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> list[Announcement]:
    return announcement_service.list_announcements(
        db,
        principal,
        include_expired=include_expired,
        building_id=building_id,
    )


@router.get(
    "/announcements/{announcement_id}", response_model=AnnouncementRead
)
def get_announcement(
    announcement_id: int,
    _: User = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> Announcement:
    return announcement_service.get_announcement(db, announcement_id)


@router.post(
    "/announcements",
    response_model=AnnouncementRead,
    status_code=status.HTTP_201_CREATED,
)
def create_announcement(
    payload: AnnouncementCreate,
    principal = Depends(require_staff),
    db: Session = Depends(get_db),
) -> Announcement:
    return announcement_service.create_announcement(db, principal, payload)


@router.patch(
    "/announcements/{announcement_id}", response_model=AnnouncementRead
)
def update_announcement(
    announcement_id: int,
    payload: AnnouncementUpdate,
    principal = Depends(require_staff),
    db: Session = Depends(get_db),
) -> Announcement:
    announcement = announcement_service.get_announcement(db, announcement_id)
    return announcement_service.update_announcement(db, announcement, principal, payload)


@router.delete(
    "/announcements/{announcement_id}", response_model=Message
)
def delete_announcement(
    announcement_id: int,
    principal = Depends(require_staff),
    db: Session = Depends(get_db),
) -> Message:
    announcement = announcement_service.get_announcement(db, announcement_id)
    announcement_service.delete_announcement(db, announcement, principal)
    return Message(detail="Announcement deleted")