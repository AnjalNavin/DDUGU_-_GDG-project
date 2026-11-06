"""User accounts and role assignments."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin
from app.models.enums import UserRole, user_role_enum

if TYPE_CHECKING:
    from app.models.academic import Faculty, Student
    from app.models.booking import Booking


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(150))
    role: Mapped[UserRole] = mapped_column(
        user_role_enum, default=UserRole.student, nullable=False, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    student_profile: Mapped[Student | None] = relationship(
        back_populates="user",
        foreign_keys="Student.user_id",
        uselist=False,
    )
    bookings: Mapped[list[Booking]] = relationship(
        back_populates="booked_by",
        foreign_keys="Booking.booked_by_id",
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"<User id={self.id} email={self.email!r} role={self.role}>"
