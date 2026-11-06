"""Weekly timetables for rooms, groups and faculty."""

from __future__ import annotations

from datetime import date, time
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Integer,
    String,
    Time,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.academic import Branch, Faculty, StudentGroup
    from app.models.campus import Room
    from app.models.user import User


class Timetable(Base, TimestampMixin):
    __tablename__ = "timetables"
    __table_args__ = (
        CheckConstraint("end_time > start_time", name="time_order"),
        CheckConstraint("day_of_week BETWEEN 0 AND 6", name="day_of_week_range"),
        CheckConstraint(
            "valid_to IS NULL OR valid_to >= valid_from", name="valid_range_order"
        ),
        Index("ix_timetables_room_day", "room_id", "day_of_week"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(
        ForeignKey("rooms.id", ondelete="CASCADE"), index=True
    )
    branch_id: Mapped[int | None] = mapped_column(
        ForeignKey("branches.id", ondelete="SET NULL"), nullable=True
    )
    student_group_id: Mapped[int | None] = mapped_column(
        ForeignKey("student_groups.id", ondelete="SET NULL"), nullable=True
    )
    faculty_mobile_number: Mapped[str | None] = mapped_column(
        ForeignKey("faculty.mobile_number", ondelete="SET NULL"), nullable=True
    )
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    subject: Mapped[str] = mapped_column(String(150))
    day_of_week: Mapped[int] = mapped_column(Integer)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    valid_from: Mapped[date] = mapped_column(Date)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    room: Mapped[Room] = relationship(back_populates="timetables")
    branch: Mapped[Branch | None] = relationship()
    student_group: Mapped[StudentGroup | None] = relationship()
    faculty: Mapped[Faculty | None] = relationship(back_populates="timetables")
    created_by: Mapped[User | None] = relationship()

    @property
    def room_code(self) -> str:
        return self.room.code

    @property
    def room_name(self) -> str:
        return self.room.name

    @property
    def building_name(self) -> str:
        return self.room.floor.building.name

    @property
    def faculty_name(self) -> str | None:
        return self.faculty.name if self.faculty else None

    @property
    def group_name(self) -> str | None:
        return self.student_group.name if self.student_group else None

    @property
    def branch_code(self) -> str | None:
        return self.branch.code if self.branch else None