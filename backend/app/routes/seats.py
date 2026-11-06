"""Student seat reservation endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies import get_current_principal
from app.schemas.seat_reservation import (
    SeatAvailabilityRead,
    SeatReservationCreate,
    SeatReservationRead,
)
from app.services import seat_reservation_service

router = APIRouter(prefix="/seats", tags=["seat-reservations"])


@router.get("/availability/{booking_id}", response_model=SeatAvailabilityRead)
def get_seat_availability(
    booking_id: int,
    _: object = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> SeatAvailabilityRead:
    return seat_reservation_service.get_seat_availability(db, booking_id)


@router.get("/reservations", response_model=list[SeatReservationRead])
def list_seat_reservations(
    booking_id: int | None = None,
    room_id: int | None = None,
    branch_code: str | None = None,
    academic_year: int | None = None,
    section: str | None = None,
    status: str | None = None,
    principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> list[SeatReservationRead]:
    results = seat_reservation_service.list_seat_reservations(
        db,
        principal,
        booking_id=booking_id,
        room_id=room_id,
        branch_code=branch_code,
        academic_year=academic_year,
        section=section,
        status=status,
    )
    return [
        SeatReservationRead(
            id=r.id,
            booking_id=r.booking_id,
            booking_title=r.booking.title if r.booking else None,
            room_id=r.room_id,
            room_name=r.room.name if r.room else None,
            student_name=r.student_name,
            academic_year=r.academic_year,
            branch_code=r.branch_code,
            section=r.section,
            seat_number=r.seat_number,
            status=r.status,
            created_at=r.created_at,
        )
        for r in results
    ]


@router.post("/reserve", response_model=SeatReservationRead, status_code=status.HTTP_201_CREATED)
def reserve_seat(
    payload: SeatReservationCreate,
    principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> SeatReservationRead:
    r = seat_reservation_service.reserve_seat(db, principal, payload)
    return SeatReservationRead(
        id=r.id,
        booking_id=r.booking_id,
        booking_title=r.booking.title if r.booking else None,
        room_id=r.room_id,
        room_name=r.room.name if r.room else None,
        student_name=r.student_name,
        academic_year=r.academic_year,
        branch_code=r.branch_code,
        section=r.section,
        seat_number=r.seat_number,
        status=r.status,
        created_at=r.created_at,
    )


@router.post("/reservations/{reservation_id}/cancel", response_model=SeatReservationRead)
def cancel_reservation(
    reservation_id: int,
    principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> SeatReservationRead:
    r = seat_reservation_service.cancel_seat_reservation(db, principal, reservation_id)
    return SeatReservationRead(
        id=r.id,
        booking_id=r.booking_id,
        booking_title=r.booking.title if r.booking else None,
        room_id=r.room_id,
        room_name=r.room.name if r.room else None,
        student_name=r.student_name,
        academic_year=r.academic_year,
        branch_code=r.branch_code,
        section=r.section,
        seat_number=r.seat_number,
        status=r.status,
        created_at=r.created_at,
    )
