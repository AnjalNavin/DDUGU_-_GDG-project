"""Campus announcements and audience targeting."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin
from app.models.enums import (
    AnnouncementAudience,
    announcement_audience_enum,
)

if TYPE_CHECKING:
    from app.models.academic import Faculty
    from app.models.campus import Building
    from app.models.user import User


class AnnouncementTargetFaculty(Base):
    __tablename__ = "announcement_target_faculty"

    announcement_id: Mapped[int] = mapped_column(
        ForeignKey("announcements.id", ondelete="CASCADE"), primary_key=True
    )
    faculty_mobile_number: Mapped[str] = mapped_column(
        ForeignKey("faculty.mobile_number", ondelete="CASCADE"), primary_key=True
    )


class Announcement(Base, TimestampMixin):
    __tablename__ = "announcements"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    audience: Mapped[AnnouncementAudience] = mapped_column(
        announcement_audience_enum,
        default=AnnouncementAudience.all,
        nullable=False,
        index=True,
    )
    # Audience targeting: 'all' | 'selected_faculty' | 'selected_students'
    audience_type: Mapped[str] = mapped_column(
        String(30), default="all", nullable=False, index=True
    )
    building_id: Mapped[int | None] = mapped_column(
        ForeignKey("buildings.id", ondelete="SET NULL"), nullable=True
    )
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    published_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Creator info: user ID (for Admin) or faculty mobile (for Faculty)
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_by_faculty_mobile: Mapped[str | None] = mapped_column(
        ForeignKey("faculty.mobile_number", ondelete="SET NULL"), nullable=True
    )
    creator_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    creator_role: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Student targeting criteria
    target_academic_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_branch_code: Mapped[str | None] = mapped_column(String(30), nullable=True)
    target_section: Mapped[str | None] = mapped_column(String(10), nullable=True)

    building: Mapped[Building | None] = relationship(back_populates="announcements")
    created_by: Mapped[User | None] = relationship(foreign_keys=[created_by_id])
    created_by_faculty: Mapped[Faculty | None] = relationship(
        foreign_keys=[created_by_faculty_mobile]
    )
    target_faculty: Mapped[list[AnnouncementTargetFaculty]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )

    @property
    def building_name(self) -> str | None:
        return self.building.name if self.building else None

    @property
    def created_by_name(self) -> str | None:
        if self.creator_name:
            return self.creator_name
        if self.created_by:
            return self.created_by.full_name
        if self.created_by_faculty:
            return self.created_by_faculty.name
        return "Administrator"
