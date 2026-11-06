"""Booking endpoints."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies import get_current_faculty, get_current_principal, require_staff
from app.models.booking import Booking, BookingHistory
from app.models.enums import BookingStatus, UserRole
from app.models.user import User
from app.schemas.booking import (
    BookingCancel,
    BookingCreate,
    BookingDecision,
    BookingHistoryRead,
    BookingRead,
    BookingUpdate,
    BookingWithHistory,
)
from app.schemas.common import Page
from app.services import booking_service
from app.services.exceptions import ForbiddenError

router = APIRouter(prefix="/bookings", tags=["bookings"])


def _ensure_can_view(principal, booking: Booking) -> None:
    if principal.role in (UserRole.admin, UserRole.faculty):
        return
    if booking.booked_by_id != principal.user.id:
        raise ForbiddenError("You can only view your own bookings")


@router.get("", response_model=Page[BookingRead])
def list_bookings(
    room_id: int | None = None,
    building_id: int | None = None,
    floor_id: int | None = None,
    status: BookingStatus | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    mine: bool = False,
    search: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> Page[BookingRead]:
    bookings, total = booking_service.list_bookings(
        db,
        principal,
        room_id=room_id,
        building_id=building_id,
        floor_id=floor_id,
        status=status,
        date_from=date_from,
        date_to=date_to,
        mine=mine,
        search=search,
        limit=limit,
        offset=offset,
    )
    return Page[BookingRead](
        items=[BookingRead.model_validate(item) for item in bookings],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "", response_model=BookingRead, status_code=status.HTTP_201_CREATED
)
def create_booking(
    payload: BookingCreate,
    principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> Booking:
    if principal.role == UserRole.student:
        raise ForbiddenError(
            "Students are not permitted to book campus rooms. Please use seat reservation for library or scheduled classes."
        )
    return booking_service.create_booking(db, principal, payload)


@router.get("/{booking_id}", response_model=BookingWithHistory)
def get_booking(
    booking_id: int,
    principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> Booking:
    booking = booking_service.get_booking_with_history(db, booking_id)
    _ensure_can_view(principal, booking)
    return booking


@router.patch("/{booking_id}", response_model=BookingRead)
def update_booking(
    booking_id: int,
    payload: BookingUpdate,
    principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> Booking:
    booking = booking_service.get_booking(db, booking_id)
    return booking_service.update_booking(db, principal, booking, payload)


@router.post("/{booking_id}/approve", response_model=BookingRead)
def approve_booking(
    booking_id: int,
    payload: BookingDecision | None = None,
    principal = Depends(require_staff),
    db: Session = Depends(get_db),
) -> Booking:
    booking = booking_service.get_booking(db, booking_id)
    return booking_service.approve_booking(
        db, principal, booking, payload.reason if payload else None
    )


@router.post("/{booking_id}/reject", response_model=BookingRead)
def reject_booking(
    booking_id: int,
    payload: BookingDecision,
    principal = Depends(require_staff),
    db: Session = Depends(get_db),
) -> Booking:
    booking = booking_service.get_booking(db, booking_id)
    return booking_service.reject_booking(db, principal, booking, payload.reason)


@router.post("/{booking_id}/cancel", response_model=BookingRead)
def cancel_booking(
    booking_id: int,
    payload: BookingCancel | None = None,
    principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> Booking:
    booking = booking_service.get_booking(db, booking_id)
    return booking_service.cancel_booking(
        db, principal, booking, payload.reason if payload else None
    )


@router.get(
    "/{booking_id}/history", response_model=list[BookingHistoryRead]
)
def booking_history(
    booking_id: int,
    principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> list[BookingHistory]:
    booking = booking_service.get_booking(db, booking_id)
    _ensure_can_view(principal, booking)
    return booking_service.get_history(db, booking_id)