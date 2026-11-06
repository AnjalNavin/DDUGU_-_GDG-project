"""Student seat reservation service."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.academic import Student
from app.models.booking import Booking
from app.models.campus import Room
from app.models.enums import BookingStatus, RoomType, UserRole
from app.models.seat_reservation import SeatReservation
from app.schemas.seat_reservation import SeatAvailabilityRead, SeatReservationCreate
from app.services.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError


def _query():
    return select(SeatReservation).options(
        selectinload(SeatReservation.booking),
        selectinload(SeatReservation.room),
        selectinload(SeatReservation.student_user),
    )


def get_seat_reservation(db: Session, res_id: int) -> SeatReservation:
    res = db.scalar(_query().where(SeatReservation.id == res_id))
    if res is None:
        raise NotFoundError("Seat reservation not found")
    return res


def get_seat_availability(db: Session, booking_id: int) -> SeatAvailabilityRead:
    booking = db.scalar(
        select(Booking).options(selectinload(Booking.room)).where(Booking.id == booking_id)
    )
    if not booking:
        raise NotFoundError("Lecture / booking not found")

    room = booking.room
    capacity = room.capacity if (room and room.capacity) else 75

    active_reservations = list(
        db.scalars(
            select(SeatReservation.seat_number).where(
                SeatReservation.booking_id == booking_id,
                SeatReservation.status == "active",
            )
        )
    )

    return SeatAvailabilityRead(
        booking_id=booking.id,
        room_id=room.id if room else 0,
        room_name=room.name if room else "Unknown",
        capacity=capacity,
        occupied_seats=active_reservations,
        total_occupied=len(active_reservations),
        total_available=max(0, capacity - len(active_reservations)),
    )


def reserve_seat(
    db: Session,
    principal,
    data: SeatReservationCreate,
) -> SeatReservation:
    if principal.role != UserRole.student or principal.is_faculty:
        raise ForbiddenError("Only students can reserve seats.")

    # Validation: academic year, branch, section are strictly mandatory
    if not data.academic_year or not (1 <= data.academic_year <= 4):
        raise ValidationError("Academic year must be selected (between 1 and 4).")
    if not data.branch_code or not data.branch_code.strip():
        raise ValidationError("Branch must be selected.")
    if not data.section or not data.section.strip():
        raise ValidationError("Section must be selected.")

    booking = db.scalar(
        select(Booking).options(selectinload(Booking.room)).where(Booking.id == data.booking_id)
    )
    if not booking:
        raise NotFoundError("Lecture / classroom booking not found")

    room = booking.room
    if not room or room.room_type in (RoomType.faculty_room, RoomType.other) or not room.is_active:
        raise ValidationError("This space is an administrative office and does not support seat reservations.")

    capacity = room.capacity or 75

    # Match eligibility if booking has audience constraints
    if booking.academic_year and booking.academic_year != data.academic_year:
        raise ForbiddenError(f"This lecture is scheduled for Year {booking.academic_year} students only.")
    if booking.branch_code and booking.branch_code.lower() != "all":
        if booking.branch_code.upper() != data.branch_code.strip().upper():
            raise ForbiddenError(f"This lecture is designated for {booking.branch_code} branch only.")
    if booking.section and booking.section.lower() != "all":
        if booking.section.upper() != data.section.strip().upper():
            raise ForbiddenError(f"This lecture is designated for Section {booking.section} only.")

    # Concurrency check 1: Prevent duplicate reservation by same student
    student_user_id = principal.user.id if principal.is_user else None
    existing_my_res = db.scalar(
        select(SeatReservation).where(
            SeatReservation.booking_id == data.booking_id,
            SeatReservation.student_user_id == student_user_id,
            SeatReservation.status == "active",
        )
    )
    if existing_my_res:
        raise ConflictError("You already have an active seat reservation for this lecture.")

    # Concurrency check 2: Query active seats
    active_stmt = select(SeatReservation.seat_number).where(
        SeatReservation.booking_id == data.booking_id,
        SeatReservation.status == "active",
    )
    if db.bind and db.bind.dialect.name != "sqlite":
        active_stmt = active_stmt.with_for_update()

    active_seat_numbers = set(db.scalars(active_stmt).all())

    if len(active_seat_numbers) >= capacity:
        raise ConflictError("Classroom is full. No seats available.")

    assigned_seat: int | None = data.seat_number
    if assigned_seat is None:
        for s in range(1, capacity + 1):
            if s not in active_seat_numbers:
                assigned_seat = s
                break
        if assigned_seat is None:
            raise ConflictError("Classroom is full. No seats available.")
    else:
        if assigned_seat < 1 or assigned_seat > capacity:
            raise ValidationError(f"Invalid seat number {assigned_seat}. Room capacity is {capacity} seats.")
        if assigned_seat in active_seat_numbers:
            raise ConflictError(f"Seat {assigned_seat} is already reserved for this lecture.")

    # Link to student record if available
    student_record = db.scalar(select(Student).where(Student.user_id == student_user_id))
    student_id = student_record.id if student_record else None

    reservation = SeatReservation(
        booking_id=booking.id,
        room_id=booking.room_id,
        student_user_id=student_user_id,
        student_id=student_id,
        student_name=principal.full_name,
        academic_year=data.academic_year,
        branch_code=data.branch_code.strip().upper(),
        section=data.section.strip().upper(),
        seat_number=assigned_seat,
        status="active",
    )
    db.add(reservation)
    db.commit()
    return get_seat_reservation(db, reservation.id)


def cancel_seat_reservation(
    db: Session,
    principal,
    res_id: int,
) -> SeatReservation:
    res = get_seat_reservation(db, res_id)

    # Permission check: owner or admin
    if principal.role != UserRole.admin:
        if not principal.is_user or res.student_user_id != principal.user.id:
            raise ForbiddenError("You can only cancel your own seat reservations.")

    if res.status == "cancelled":
        raise ValidationError("This reservation has already been cancelled.")

    res.status = "cancelled"
    db.commit()
    return res


def list_seat_reservations(
    db: Session,
    principal,
    *,
    booking_id: int | None = None,
    room_id: int | None = None,
    branch_code: str | None = None,
    academic_year: int | None = None,
    section: str | None = None,
    status: str | None = None,
) -> list[SeatReservation]:
    stmt = _query()

    if booking_id:
        stmt = stmt.where(SeatReservation.booking_id == booking_id)
    if room_id:
        stmt = stmt.where(SeatReservation.room_id == room_id)
    if branch_code and branch_code != "all":
        stmt = stmt.where(SeatReservation.branch_code == branch_code.upper())
    if academic_year:
        stmt = stmt.where(SeatReservation.academic_year == academic_year)
    if section and section != "all":
        stmt = stmt.where(SeatReservation.section == section.upper())
    if status and status != "all":
        stmt = stmt.where(SeatReservation.status == status)

    stmt = stmt.order_by(SeatReservation.created_at.desc())
    all_res = list(db.scalars(stmt))

    # Admins see all with filters
    if principal.role == UserRole.admin:
        return all_res

    # Faculty see reservations associated with their own lectures/bookings
    if principal.is_faculty:
        my_mobile = str(principal.id)
        return [r for r in all_res if r.booking and r.booking.faculty_mobile_number == my_mobile]

    # Students see only their own reservations
    if principal.role == UserRole.student and principal.is_user:
        return [r for r in all_res if r.student_user_id == principal.user.id]

    return []
