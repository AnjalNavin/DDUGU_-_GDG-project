"""Room bookings and their audit history."""

from __future__ import annotations

from datetime import date, datetime, time
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin
from app.models.enums import (
    BookingAction,
    BookingStatus,
    RoomUse,
    booking_action_enum,
    booking_status_enum,
    room_use_enum,
)

if TYPE_CHECKING:
    from app.models.academic import Faculty, Student, StudentGroup
    from app.models.campus import Room
    from app.models.user import User


class Booking(Base, TimestampMixin):
    __tablename__ = "bookings"
    __table_args__ = (
        CheckConstraint("end_time > start_time", name="time_order"),
        CheckConstraint(
            "expected_attendees IS NULL OR expected_attendees > 0",
            name="attendees_positive",
        ),
        Index("ix_bookings_room_date", "room_id", "booking_date"),
        Index("ix_bookings_date_status", "booking_date", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(
        ForeignKey("rooms.id", ondelete="CASCADE"), index=True
    )
    booked_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    faculty_mobile_number: Mapped[str | None] = mapped_column(
        ForeignKey("faculty.mobile_number", ondelete="SET NULL"), nullable=True
    )
    student_id: Mapped[int | None] = mapped_column(
        ForeignKey("students.id", ondelete="SET NULL"), nullable=True
    )
    student_group_id: Mapped[int | None] = mapped_column(
        ForeignKey("student_groups.id", ondelete="SET NULL"), nullable=True
    )

    title: Mapped[str] = mapped_column(String(150))
    purpose: Mapped[str | None] = mapped_column(Text, nullable=True)
    use_type: Mapped[RoomUse] = mapped_column(room_use_enum, nullable=False)
    booking_date: Mapped[date] = mapped_column(Date, index=True)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    expected_attendees: Mapped[int | None] = mapped_column(Integer, nullable=True)
    academic_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    branch_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    section: Mapped[str | None] = mapped_column(String(50), nullable=True)
    audience_desc: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[BookingStatus] = mapped_column(
        booking_status_enum,
        default=BookingStatus.pending,
        nullable=False,
        index=True,
    )

    approved_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    rejected_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    rejected_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    cancelled_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancellation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    room: Mapped[Room] = relationship(back_populates="bookings")
    booked_by: Mapped[User] = relationship(
        back_populates="bookings", foreign_keys=[booked_by_id]
    )
    approved_by: Mapped[User | None] = relationship(foreign_keys=[approved_by_id])
    rejected_by: Mapped[User | None] = relationship(foreign_keys=[rejected_by_id])
    cancelled_by: Mapped[User | None] = relationship(foreign_keys=[cancelled_by_id])
    faculty: Mapped[Faculty | None] = relationship(
        back_populates="bookings", foreign_keys=[faculty_mobile_number]
    )
    student: Mapped[Student | None] = relationship(
        back_populates="bookings", foreign_keys=[student_id]
    )
    student_group: Mapped[StudentGroup | None] = relationship()
    history: Mapped[list[BookingHistory]] = relationship(
        back_populates="booking",
        cascade="all, delete-orphan",
        order_by="BookingHistory.created_at",
    )

    @property
    def room_code(self) -> str:
        return self.room.code

    @property
    def room_name(self) -> str:
        return self.room.name

    @property
    def building_id(self) -> int:
        return self.room.floor.building_id

    @property
    def building_name(self) -> str:
        return self.room.floor.building.name

    @property
    def floor_level(self) -> int:
        return self.room.floor.level

    @property
    def booked_by_name(self) -> str:
        return self.booked_by.full_name

    @property
    def student_name(self) -> str | None:
        return self.student.full_name if self.student else None

    @property
    def faculty_name(self) -> str | None:
        return self.faculty.name if self.faculty else None

    @property
    def group_name(self) -> str | None:
        return self.student_group.name if self.student_group else None


class BookingHistory(Base):
    __tablename__ = "booking_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), index=True
    )
    action: Mapped[BookingAction] = mapped_column(
        booking_action_enum, nullable=False
    )
    from_status: Mapped[BookingStatus | None] = mapped_column(
        booking_status_enum, nullable=True
    )
    to_status: Mapped[BookingStatus | None] = mapped_column(
        booking_status_enum, nullable=True
    )
    performed_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    booking: Mapped[Booking] = relationship(back_populates="history")
    performed_by: Mapped[User | None] = relationship()

    @property
    def performed_by_name(self) -> str | None:
        return self.performed_by.full_name if self.performed_by else None