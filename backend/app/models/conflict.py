"""Conflict reporting and resolution tracking."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.academic import Faculty
    from app.models.booking import Booking
    from app.models.campus import Room
    from app.models.user import User


class ConflictReport(Base, TimestampMixin):
    __tablename__ = "conflict_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Reporter metadata
    reporter_type: Mapped[str] = mapped_column(String(20), nullable=False)  # 'faculty' | 'student'
    reporter_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reporter_faculty_mobile: Mapped[str | None] = mapped_column(
        ForeignKey("faculty.mobile_number", ondelete="SET NULL"), nullable=True
    )
    reporter_name: Mapped[str] = mapped_column(String(150), nullable=False)

    # Priority: 'high' for faculty reports, 'normal' for students
    priority: Mapped[str] = mapped_column(String(20), default="normal", nullable=False, index=True)

    # Affected resource
    room_id: Mapped[int | None] = mapped_column(
        ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True
    )
    booking_id: Mapped[int | None] = mapped_column(
        ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True
    )
    seat_id: Mapped[str | None] = mapped_column(String(50), nullable=True)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    # Resolution status: 'pending' | 'under_review' | 'resolved' | 'rejected'
    status: Mapped[str] = mapped_column(
        String(30), default="pending", nullable=False, index=True
    )
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    room: Mapped[Room | None] = relationship()
    booking: Mapped[Booking | None] = relationship()
    reporter_user: Mapped[User | None] = relationship(foreign_keys=[reporter_user_id])
    reporter_faculty: Mapped[Faculty | None] = relationship(
        foreign_keys=[reporter_faculty_mobile]
    )
    resolved_by: Mapped[User | None] = relationship(foreign_keys=[resolved_by_id])
    history: Mapped[list[ConflictResolutionHistory]] = relationship(
        back_populates="conflict",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="ConflictResolutionHistory.created_at.desc()",
    )


class ConflictResolutionHistory(Base, TimestampMixin):
    __tablename__ = "conflict_resolution_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    conflict_id: Mapped[int] = mapped_column(
        ForeignKey("conflict_reports.id", ondelete="CASCADE"), index=True
    )
    changed_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    changed_by_name: Mapped[str] = mapped_column(String(150), nullable=False)
    old_status: Mapped[str] = mapped_column(String(30), nullable=False)
    new_status: Mapped[str] = mapped_column(String(30), nullable=False)
    action_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    conflict: Mapped[ConflictReport] = relationship(back_populates="history")
    changed_by: Mapped[User | None] = relationship(foreign_keys=[changed_by_id])
