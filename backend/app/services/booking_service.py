"""Booking lifecycle: create, approve, reject, cancel, update and query."""

from __future__ import annotations

from datetime import date, datetime, time, timezone
import hashlib
import re
import threading
from typing import TYPE_CHECKING, Union

from sqlalchemy import func, or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.models.academic import Faculty, Student, StudentGroup
from app.models.booking import Booking, BookingHistory
from app.models.campus import Floor, Room
from app.models.enums import BookingAction, BookingStatus, UserRole
from app.models.user import User
from app.schemas.booking import BookingCreate, BookingUpdate
from app.services import availability_service
from app.services.campus_service import get_room
from app.services.exceptions import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
)

if TYPE_CHECKING:
    from app.dependencies import CurrentPrincipal

ACTIVE_STATUSES = (BookingStatus.pending, BookingStatus.approved)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _booking_query():
    return (
        select(Booking)
        .options(
            selectinload(Booking.room)
            .selectinload(Room.floor)
            .selectinload(Floor.building),
            selectinload(Booking.booked_by),
            selectinload(Booking.student),
            selectinload(Booking.faculty),
            selectinload(Booking.student_group),
        )
    )


def get_booking(db: Session, booking_id: int) -> Booking:
    booking = db.scalar(_booking_query().where(Booking.id == booking_id))
    if booking is None:
        raise NotFoundError("Booking not found")
    return booking


def get_booking_with_history(db: Session, booking_id: int) -> Booking:
    booking = db.scalar(
        _booking_query()
        .where(Booking.id == booking_id)
        .options(
            selectinload(Booking.history).selectinload(
                BookingHistory.performed_by
            )
        )
    )
    if booking is None:
        raise NotFoundError("Booking not found")
    return booking


def _validate_window(booking_date: date, start_time: time, end_time: time) -> None:
    if booking_date < date.today():
        raise ValidationError("Booking date cannot be in the past")
    if end_time <= start_time:
        raise ValidationError("end_time must be later than start_time")
    if booking_date == date.today() and start_time <= datetime.now().time():
        raise ValidationError("Booking start time must be in the future")
    earliest = time(settings.first_booking_hour, 0)
    latest = time(settings.last_booking_hour, 0)
    if start_time < earliest or end_time > latest:
        raise ValidationError(
            "Bookings are allowed between "
            f"{earliest.strftime('%H:%M')} and {latest.strftime('%H:%M')}"
        )


def _validate_room_rules(
    db: Session,
    room_id: int,
    use_type,
    expected_attendees: int | None,
) -> None:
    room = get_room(db, room_id)
    non_reservable = {
        "teachers office",
        "teachers' office",
        "placement cell",
        "director office",
        "director's office",
    }
    if (
        (room.code and room.code.strip().lower() in non_reservable)
        or (room.name and room.name.strip().lower() in non_reservable)
    ):
        raise ValidationError("This room is non-reservable and cannot be booked")

    if not room.is_active:
        raise ValidationError("This room is not available for booking")
    permitted = {item.use_type for item in room.permitted_uses}
    if permitted and use_type not in permitted:
        allowed = ", ".join(sorted(item.value for item in permitted))
        raise ValidationError(
            f"This room is not permitted for '{use_type.value}' use. "
            f"Allowed uses: {allowed}"
        )
    if (
        expected_attendees is not None
        and room.capacity is not None
        and expected_attendees > room.capacity
    ):
        raise ValidationError(
            f"The room capacity ({room.capacity}) is smaller than the "
            f"expected attendance ({expected_attendees})"
        )


def _validate_group(db: Session, group_id: int | None) -> None:
    if group_id is not None and db.get(StudentGroup, group_id) is None:
        raise NotFoundError("Student group not found")


def _profile_ids(
    db: Session, principal
) -> tuple[int | None, str | None]:
    """Return (student_id, faculty_mobile_number) for the principal."""
    student_id = None
    faculty_mobile = None

    if principal.is_user:
        user = principal.user
        if user.role == UserRole.student:
            student_id = db.scalar(
                select(Student.id).where(Student.user_id == user.id)
            )
        elif user.role == UserRole.faculty:
            faculty = db.scalar(
                select(Faculty).where(Faculty.name == user.full_name)
            )
            if faculty:
                faculty_mobile = faculty.mobile_number
    elif principal.is_faculty:
        faculty_mobile = principal.faculty.mobile_number

    return student_id, faculty_mobile


def _conflict_error(
    db: Session,
    *,
    booking_date: date,
    start_time: time,
    end_time: time,
    use_type,
    expected_attendees: int | None,
    room_id: int,
    conflicts,
) -> ConflictError:
    alternatives = availability_service.get_alternatives(
        db,
        booking_date=booking_date,
        start_time=start_time,
        end_time=end_time,
        use_type=use_type,
        min_capacity=expected_attendees,
        exclude_room_id=room_id,
    )
    message = "This room is already booked for the selected time"
    if conflicts and conflicts[0].source == "timetable":
        message = "This room is reserved by a timetable for the selected time"
    return ConflictError(
        message,
        detail={
            "conflicts": [item.model_dump(mode="json") for item in conflicts],
            "alternatives": [
                item.model_dump(mode="json") for item in alternatives
            ],
        },
    )


def _add_history(
    db: Session,
    booking: Booking,
    action: BookingAction,
    principal,
    *,
    from_status: BookingStatus | None = None,
    to_status: BookingStatus | None = None,
    note: str | None = None,
) -> None:
    db.add(
        BookingHistory(
            booking_id=booking.id,
            action=action,
            from_status=from_status,
            to_status=to_status,
            performed_by_id=principal.user.id if principal.is_user else None,
            note=note,
        )
    )


def normalize_cohort_str(val: str | None) -> str:
    if not val:
        return ""
    return re.sub(r"[^a-zA-Z0-9]", "", val).lower()


_booking_process_lock = threading.Lock()


def check_faculty_conflict(
    db: Session,
    *,
    faculty_mobile: str | None,
    booked_by_id: int | None,
    room_id: int | None = None,
    booking_date: date,
    start_time: time,
    end_time: time,
    exclude_booking_id: int | None = None,
) -> None:
    """Rule 1: Prevent double booking by the same faculty member across rooms/buildings."""
    conditions = []
    if faculty_mobile:
        conditions.append(Booking.faculty_mobile_number == faculty_mobile)
    if booked_by_id:
        conditions.append(Booking.booked_by_id == booked_by_id)

    if not conditions:
        return

    # Check active bookings on the same date (exclude cancelled and rejected)
    stmt = (
        select(Booking)
        .where(
            Booking.booking_date == booking_date,
            Booking.status.notin_([BookingStatus.cancelled, BookingStatus.rejected]),
            or_(*conditions),
            Booking.start_time < end_time,
            Booking.end_time > start_time,
        )
    )
    if room_id is not None:
        stmt = stmt.where(Booking.room_id != room_id)
    if exclude_booking_id is not None:
        stmt = stmt.where(Booking.id != exclude_booking_id)

    if db.bind and db.bind.dialect.name == "postgresql":
        stmt = stmt.with_for_update()

    conflict = db.scalar(stmt)
    if conflict is not None:
        raise ConflictError(
            "You have already booked another room during this time slot. Please choose a different time."
        )


def check_cohort_conflict(
    db: Session,
    *,
    academic_year: int | None,
    branch_code: str | None,
    section: str | None,
    room_id: int | None = None,
    booking_date: date,
    start_time: time,
    end_time: time,
    exclude_booking_id: int | None = None,
) -> None:
    """Rule 2: Prevent academic cohort (Year + Branch + Section) scheduling conflicts across rooms/buildings/faculty."""
    if academic_year is None or not branch_code or not section:
        return

    # Check active bookings on the same date (exclude cancelled and rejected)
    stmt = (
        select(Booking)
        .where(
            Booking.booking_date == booking_date,
            Booking.status.notin_([BookingStatus.cancelled, BookingStatus.rejected]),
            Booking.academic_year == academic_year,
            Booking.start_time < end_time,
            Booking.end_time > start_time,
        )
    )
    if room_id is not None:
        stmt = stmt.where(Booking.room_id != room_id)
    if exclude_booking_id is not None:
        stmt = stmt.where(Booking.id != exclude_booking_id)

    if db.bind and db.bind.dialect.name == "postgresql":
        stmt = stmt.with_for_update()

    candidates = db.scalars(stmt).all()
    norm_branch = normalize_cohort_str(branch_code)
    norm_section = normalize_cohort_str(section)

    for b in candidates:
        if (
            normalize_cohort_str(b.branch_code) == norm_branch
            and normalize_cohort_str(b.section) == norm_section
        ):
            raise ConflictError(
                "This student section is already scheduled for another lecture during this time slot. Please choose a different time."
            )


def _acquire_booking_locks(
    db: Session,
    *,
    booking_date: date,
    room_id: int,
    faculty_mobile: str | None,
    booked_by_id: int | None,
    academic_year: int | None,
    branch_code: str | None,
    section: str | None,
) -> None:
    if not db.bind or db.bind.dialect.name != "postgresql":
        return
    try:
        keys = [f"room_{room_id}_{booking_date}"]
        fac_key = faculty_mobile or str(booked_by_id or "")
        if fac_key:
            keys.append(f"fac_{fac_key}_{booking_date}")
        if academic_year and branch_code and section:
            norm_b = normalize_cohort_str(branch_code)
            norm_s = normalize_cohort_str(section)
            keys.append(f"coh_{academic_year}_{norm_b}_{norm_s}_{booking_date}")

        for k in keys:
            lock_id = int(hashlib.md5(k.encode("utf-8")).hexdigest()[:14], 16) - (1 << 50)
            db.execute(text("SELECT pg_advisory_xact_lock(:id)"), {"id": lock_id})
    except Exception:
        pass


def create_booking(db: Session, principal, data: BookingCreate) -> Booking:
    if (principal.is_user and principal.user.role == UserRole.student) or (hasattr(principal, "role") and principal.role == UserRole.student):
        raise ForbiddenError(
            "Students are not permitted to book campus rooms. Please use seat reservation for library or scheduled classes."
        )

    if data.academic_year is None or not data.branch_code or not data.section:
        raise ValidationError(
            "Academic details are mandatory: academic_year, branch_code, and section must be provided."
        )

    _validate_window(data.booking_date, data.start_time, data.end_time)
    _validate_room_rules(
        db, data.room_id, data.use_type, data.expected_attendees
    )
    _validate_group(db, data.student_group_id)

    student_id, faculty_mobile = _profile_ids(db, principal)
    booked_by_id = principal.user.id if principal.is_user else None

    with _booking_process_lock:
        # Advisory lock for PostgreSQL to safely handle simultaneous booking requests
        _acquire_booking_locks(
            db,
            booking_date=data.booking_date,
            room_id=data.room_id,
            faculty_mobile=faculty_mobile,
            booked_by_id=booked_by_id,
            academic_year=data.academic_year,
            branch_code=data.branch_code,
            section=data.section,
        )

        # 1. Prevent Room Availability Overlaps
        conflicts = availability_service.has_conflict(
            db,
            room_id=data.room_id,
            booking_date=data.booking_date,
            start_time=data.start_time,
            end_time=data.end_time,
        )
        if conflicts:
            raise _conflict_error(
                db,
                booking_date=data.booking_date,
                start_time=data.start_time,
                end_time=data.end_time,
                use_type=data.use_type,
                expected_attendees=data.expected_attendees,
                room_id=data.room_id,
                conflicts=conflicts,
            )

        # 2. Rule 1: Prevent Double Booking by the Same Faculty Member in another room
        check_faculty_conflict(
            db,
            faculty_mobile=faculty_mobile,
            booked_by_id=booked_by_id,
            room_id=data.room_id,
            booking_date=data.booking_date,
            start_time=data.start_time,
            end_time=data.end_time,
        )

        # 3. Rule 2: Prevent Academic Cohort Scheduling Conflicts in another room
        check_cohort_conflict(
            db,
            academic_year=data.academic_year,
            branch_code=data.branch_code,
            section=data.section,
            room_id=data.room_id,
            booking_date=data.booking_date,
            start_time=data.start_time,
            end_time=data.end_time,
        )

        booking = Booking(
            room_id=data.room_id,
            booked_by_id=principal.user.id if principal.is_user else None,
            student_id=student_id,
            faculty_mobile_number=faculty_mobile,
            student_group_id=data.student_group_id,
            academic_year=data.academic_year,
            branch_code=data.branch_code,
            section=data.section,
            audience_desc=data.audience_desc,
            title=data.title.strip(),
            purpose=data.purpose,
            use_type=data.use_type,
            booking_date=data.booking_date,
            start_time=data.start_time,
            end_time=data.end_time,
            expected_attendees=data.expected_attendees,
            status=BookingStatus.pending,
        )
        db.add(booking)
        try:
            db.flush()
            _add_history(
                db,
                booking,
                BookingAction.created,
                principal,
                to_status=BookingStatus.pending,
            )
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise _conflict_error(
                db,
                booking_date=data.booking_date,
                start_time=data.start_time,
                end_time=data.end_time,
                use_type=data.use_type,
                expected_attendees=data.expected_attendees,
                room_id=data.room_id,
                conflicts=[],
            ) from exc
        return get_booking(db, booking.id)


def _ensure_can_manage(principal, booking: Booking) -> None:
    if principal.role in (UserRole.admin, UserRole.faculty):
        return
    if booking.booked_by_id != principal.user.id:
        raise ForbiddenError("You can only manage your own bookings")


def update_booking(
    db: Session, principal, booking: Booking, data: BookingUpdate
) -> Booking:
    _ensure_can_manage(principal, booking)
    if booking.status != BookingStatus.pending:
        raise ConflictError("Only pending bookings can be edited")
    values = data.model_dump(exclude_unset=True)

    booking_date = values.get("booking_date", booking.booking_date)
    start_time = values.get("start_time", booking.start_time)
    end_time = values.get("end_time", booking.end_time)
    room_id = values.get("room_id", booking.room_id)
    use_type = values.get("use_type", booking.use_type)
    expected = values.get("expected_attendees", booking.expected_attendees)
    group_id = values.get("student_group_id", booking.student_group_id)

    _validate_window(booking_date, start_time, end_time)
    _validate_room_rules(db, room_id, use_type, expected)
    _validate_group(db, group_id)

    academic_year = values.get("academic_year", booking.academic_year)
    branch_code = values.get("branch_code", booking.branch_code)
    section = values.get("section", booking.section)

    conflicts = availability_service.has_conflict(
        db,
        room_id=room_id,
        booking_date=booking_date,
        start_time=start_time,
        end_time=end_time,
        exclude_booking_id=booking.id,
    )
    if conflicts:
        raise _conflict_error(
            db,
            booking_date=booking_date,
            start_time=start_time,
            end_time=end_time,
            use_type=use_type,
            expected_attendees=expected,
            room_id=room_id,
            conflicts=conflicts,
        )

    check_faculty_conflict(
        db,
        faculty_mobile=booking.faculty_mobile_number,
        booked_by_id=booking.booked_by_id,
        room_id=room_id,
        booking_date=booking_date,
        start_time=start_time,
        end_time=end_time,
        exclude_booking_id=booking.id,
    )

    check_cohort_conflict(
        db,
        academic_year=academic_year,
        branch_code=branch_code,
        section=section,
        room_id=room_id,
        booking_date=booking_date,
        start_time=start_time,
        end_time=end_time,
        exclude_booking_id=booking.id,
    )

    for key, value in values.items():
        setattr(booking, key, value)
    _add_history(
        db,
        booking,
        BookingAction.updated,
        principal,
        from_status=booking.status,
        to_status=booking.status,
        note="Booking details updated",
    )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise _conflict_error(
            db,
            booking_date=booking_date,
            start_time=start_time,
            end_time=end_time,
            use_type=use_type,
            expected_attendees=expected,
            room_id=room_id,
            conflicts=[],
        ) from exc
    return get_booking(db, booking.id)


def approve_booking(
    db: Session, principal, booking: Booking, note: str | None = None
) -> Booking:
    if booking.status != BookingStatus.pending:
        raise ConflictError("Only pending bookings can be approved")
    conflicts = availability_service.has_conflict(
        db,
        room_id=booking.room_id,
        booking_date=booking.booking_date,
        start_time=booking.start_time,
        end_time=booking.end_time,
        exclude_booking_id=booking.id,
    )
    if conflicts:
        raise _conflict_error(
            db,
            booking_date=booking.booking_date,
            start_time=booking.start_time,
            end_time=booking.end_time,
            use_type=booking.use_type,
            expected_attendees=booking.expected_attendees,
            room_id=booking.room_id,
            conflicts=conflicts,
        )
    booking.status = BookingStatus.approved
    booking.approved_by_id = principal.user.id if principal.is_user else None
    booking.approved_at = _now()
    _add_history(
        db,
        booking,
        BookingAction.approved,
        principal,
        from_status=BookingStatus.pending,
        to_status=BookingStatus.approved,
        note=note,
    )
    db.commit()
    return get_booking(db, booking.id)


def reject_booking(
    db: Session, principal, booking: Booking, reason: str | None = None
) -> Booking:
    if booking.status != BookingStatus.pending:
        raise ConflictError("Only pending bookings can be rejected")
    booking.status = BookingStatus.rejected
    booking.rejected_by_id = principal.user.id if principal.is_user else None
    booking.rejected_at = _now()
    booking.rejection_reason = reason
    _add_history(
        db,
        booking,
        BookingAction.rejected,
        principal,
        from_status=BookingStatus.pending,
        to_status=BookingStatus.rejected,
        note=reason,
    )
    db.commit()
    return get_booking(db, booking.id)


def cancel_booking(
    db: Session, principal, booking: Booking, reason: str | None = None
) -> Booking:
    _ensure_can_manage(principal, booking)
    if booking.status not in (BookingStatus.pending, BookingStatus.approved):
        raise ConflictError("Only pending or approved bookings can be cancelled")
    previous = booking.status
    booking.status = BookingStatus.cancelled
    booking.cancelled_by_id = principal.user.id if principal.is_user else None
    booking.cancelled_at = _now()
    booking.cancellation_reason = reason
    _add_history(
        db,
        booking,
        BookingAction.cancelled,
        principal,
        from_status=previous,
        to_status=BookingStatus.cancelled,
        note=reason,
    )
    db.commit()
    return get_booking(db, booking.id)


def list_bookings(
    db: Session,
    principal,
    *,
    room_id: int | None = None,
    building_id: int | None = None,
    floor_id: int | None = None,
    status: BookingStatus | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    mine: bool = False,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Booking], int]:
    conditions = []
    if principal.is_user and principal.user.role == UserRole.student:
        conditions.append(Booking.booked_by_id == principal.user.id)
    elif mine:
        conditions.append(Booking.booked_by_id == principal.user.id if principal.is_user else -1)

    if mine or (principal.is_user and principal.user.role == UserRole.student):
        from app.services.personal_visibility_service import get_hidden_ids
        hidden_ids = get_hidden_ids(db, str(principal.id), record_type="booking")
        if hidden_ids:
            int_ids = []
            for hid in hidden_ids:
                try:
                    int_ids.append(int(hid))
                except ValueError:
                    pass
            if int_ids:
                conditions.append(~Booking.id.in_(int_ids))

    if room_id is not None:
        conditions.append(Booking.room_id == room_id)
    if building_id is not None or floor_id is not None:
        room_query = select(Room.id).join(Floor, Room.floor_id == Floor.id)
        if floor_id is not None:
            room_query = room_query.where(Room.floor_id == floor_id)
        if building_id is not None:
            room_query = room_query.where(Floor.building_id == building_id)
        conditions.append(Booking.room_id.in_(room_query))
    if status is not None:
        conditions.append(Booking.status == status)
    if date_from is not None:
        conditions.append(Booking.booking_date >= date_from)
    if date_to is not None:
        conditions.append(Booking.booking_date <= date_to)
    if search:
        term = f"%{search.strip()}%"
        conditions.append(
            or_(Booking.title.ilike(term), Booking.purpose.ilike(term))
        )

    base = select(Booking)
    if conditions:
        base = base.where(*conditions)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    stmt = (
        _booking_query()
        .where(*conditions)
        .order_by(Booking.booking_date.desc(), Booking.start_time.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(db.scalars(stmt)), int(total)


def get_history(db: Session, booking_id: int) -> list[BookingHistory]:
    exists = db.get(Booking, booking_id)
    if exists is None:
        raise NotFoundError("Booking not found")
    return list(
        db.scalars(
            select(BookingHistory)
            .where(BookingHistory.booking_id == booking_id)
            .options(selectinload(BookingHistory.performed_by))
            .order_by(BookingHistory.created_at)
        )
    )