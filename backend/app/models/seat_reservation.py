"""Student seat reservations for scheduled lectures/classes."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.academic import Student
    from app.models.booking import Booking
    from app.models.campus import Room
    from app.models.user import User


class SeatReservation(Base, TimestampMixin):
    __tablename__ = "seat_reservations"
    __table_args__ = (
        Index("ix_seat_res_booking_seat", "booking_id", "seat_number"),
        Index("ix_seat_res_booking_student", "booking_id", "student_user_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), index=True
    )
    room_id: Mapped[int] = mapped_column(
        ForeignKey("rooms.id", ondelete="CASCADE"), index=True
    )
    student_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    student_id: Mapped[int | None] = mapped_column(
        ForeignKey("students.id", ondelete="SET NULL"), nullable=True
    )

    # Student snapshot metadata
    student_name: Mapped[str] = mapped_column(String(150), nullable=False)
    academic_year: Mapped[int] = mapped_column(Integer, nullable=False)
    branch_code: Mapped[str] = mapped_column(String(20), nullable=False)
    section: Mapped[str] = mapped_column(String(10), nullable=False)

    seat_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="active", nullable=False, index=True
    )  # 'active' | 'cancelled'

    # Relationships
    booking: Mapped[Booking] = relationship()
    room: Mapped[Room] = relationship()
    student_user: Mapped[User | None] = relationship(foreign_keys=[student_user_id])
    student: Mapped[Student | None] = relationship(foreign_keys=[student_id])
