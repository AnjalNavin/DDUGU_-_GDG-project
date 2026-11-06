"""Personal visibility service for hiding seen announcements and cancelled bookings."""

from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.announcement import Announcement
from app.models.booking import Booking
from app.models.enums import BookingStatus
from app.models.personal_visibility import UserHiddenItem
from app.schemas.personal_visibility import HiddenItemCreate, HiddenItemsSummary
from app.services.exceptions import ForbiddenError, NotFoundError, ValidationError


def hide_record(db: Session, principal, data: HiddenItemCreate) -> UserHiddenItem:
    user_id = str(principal.id)
    rec_type = data.record_type.lower().strip()
    rec_id = str(data.record_id).strip()

    if rec_type not in ("announcement", "booking"):
        raise ValidationError("record_type must be either 'announcement' or 'booking'")

    if rec_type == "booking":
        try:
            b_id = int(rec_id)
        except ValueError:
            raise ValidationError("Invalid booking id")
        booking = db.get(Booking, b_id)
        if not booking:
            raise NotFoundError("Booking not found")

        # Requirement 8.2: Do not allow users to delete active, pending, or confirmed bookings through this option.
        if booking.status != BookingStatus.cancelled:
            raise ValidationError("Only cancelled bookings can be removed from history.")

        # Non-admins can only remove their own cancelled bookings from their history
        if principal.role.value != "admin":
            user_int_id = principal.user.id if principal.is_user else None
            if user_int_id and booking.booked_by_id != user_int_id:
                raise ForbiddenError("You can only remove your own cancelled bookings from history.")

    elif rec_type == "announcement":
        try:
            a_id = int(rec_id)
        except ValueError:
            raise ValidationError("Invalid announcement id")
        ann = db.get(Announcement, a_id)
        if not ann:
            raise NotFoundError("Announcement not found")

    existing = db.scalar(
        select(UserHiddenItem).where(
            UserHiddenItem.user_id == user_id,
            UserHiddenItem.record_type == rec_type,
            UserHiddenItem.record_id == rec_id,
        )
    )
    if existing:
        return existing

    hidden_item = UserHiddenItem(
        user_id=user_id,
        record_type=rec_type,
        record_id=rec_id,
    )
    db.add(hidden_item)
    db.commit()
    db.refresh(hidden_item)
    return hidden_item


def get_hidden_ids(db: Session, user_id: str, record_type: str | None = None) -> set[str]:
    stmt = select(UserHiddenItem.record_id).where(UserHiddenItem.user_id == user_id)
    if record_type:
        stmt = stmt.where(UserHiddenItem.record_type == record_type)
    return set(db.scalars(stmt).all())


def get_hidden_summary(db: Session, principal) -> HiddenItemsSummary:
    user_id = str(principal.id)
    items = list(db.scalars(select(UserHiddenItem).where(UserHiddenItem.user_id == user_id)))
    ann_ids = [item.record_id for item in items if item.record_type == "announcement"]
    booking_ids = [item.record_id for item in items if item.record_type == "booking"]
    return HiddenItemsSummary(announcements=ann_ids, bookings=booking_ids)


def unhide_record(db: Session, principal, record_type: str, record_id: str) -> None:
    user_id = str(principal.id)
    db.execute(
        delete(UserHiddenItem).where(
            UserHiddenItem.user_id == user_id,
            UserHiddenItem.record_type == record_type.lower().strip(),
            UserHiddenItem.record_id == str(record_id).strip(),
        )
    )
    db.commit()
