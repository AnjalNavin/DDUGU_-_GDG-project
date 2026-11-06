"""Branches, student groups, students and faculty."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    DateTime,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.booking import Booking
    from app.models.timetable import Timetable
    from app.models.user import User


class Branch(Base, TimestampMixin):
    __tablename__ = "branches"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(150))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    student_groups: Mapped[list[StudentGroup]] = relationship(
        back_populates="branch", cascade="all, delete-orphan"
    )
    students: Mapped[list[Student]] = relationship(back_populates="branch")


class StudentGroup(Base, TimestampMixin):
    __tablename__ = "student_groups"
    __table_args__ = (
        UniqueConstraint(
            "branch_id",
            "academic_year",
            "batch",
            "section",
            name="uq_student_groups_cohort",
            postgresql_nulls_not_distinct=True,
        ),
        CheckConstraint(
            "academic_year BETWEEN 1 AND 4",
            name="academic_year_between_1_and_4",
        ),
        CheckConstraint(
            "section IS NULL OR section IN ('A', 'B')",
            name="section_a_or_b",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    branch_id: Mapped[int] = mapped_column(
        ForeignKey("branches.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(120))
    academic_year: Mapped[int] = mapped_column(Integer)
    batch: Mapped[str] = mapped_column(String(20))
    section: Mapped[str | None] = mapped_column(String(1), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    branch: Mapped[Branch] = relationship(back_populates="student_groups")
    students: Mapped[list[Student]] = relationship(back_populates="group")

    @property
    def branch_code(self) -> str:
        return self.branch.code

    @property
    def branch_name(self) -> str:
        return self.branch.name


class Student(Base, TimestampMixin):
    __tablename__ = "students"
    __table_args__ = (
        CheckConstraint(
            "academic_year BETWEEN 1 AND 4",
            name="academic_year_between_1_and_4",
        ),
        CheckConstraint(
            "section IS NULL OR section IN ('A', 'B')",
            name="section_a_or_b",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    enrollment_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True
    )
    full_name: Mapped[str] = mapped_column(String(150))
    email: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True
    )
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    branch_id: Mapped[int] = mapped_column(
        ForeignKey("branches.id", ondelete="RESTRICT"), index=True
    )
    student_group_id: Mapped[int | None] = mapped_column(
        ForeignKey("student_groups.id", ondelete="SET NULL"), nullable=True
    )
    academic_year: Mapped[int] = mapped_column(Integer)
    batch: Mapped[str] = mapped_column(String(20))
    section: Mapped[str | None] = mapped_column(String(1), nullable=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), unique=True, nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    branch: Mapped[Branch] = relationship(back_populates="students")
    group: Mapped[StudentGroup | None] = relationship(back_populates="students")
    user: Mapped[User | None] = relationship(
        back_populates="student_profile", foreign_keys=[user_id]
    )
    bookings: Mapped[list[Booking]] = relationship(back_populates="student")

    @property
    def branch_code(self) -> str:
        return self.branch.code

    @property
    def branch_name(self) -> str:
        return self.branch.name

    @property
    def group_name(self) -> str | None:
        return self.group.name if self.group else None


class Faculty(Base, TimestampMixin):
    """Faculty directory and login identity.

    The mobile number is the sole identifier: it is the primary key, the login
    name and the value every related table references. There is deliberately no
    surrogate faculty id or email-based faculty account.
    """

    __tablename__ = "faculty"

    mobile_number: Mapped[str] = mapped_column(
        String(10), primary_key=True, autoincrement=False
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    department: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )
    designation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )

    timetables: Mapped[list[Timetable]] = relationship(
        back_populates="faculty", foreign_keys="Timetable.faculty_mobile_number"
    )
    bookings: Mapped[list[Booking]] = relationship(
        back_populates="faculty",
        foreign_keys="Booking.faculty_mobile_number",
    )

    @property
    def has_password(self) -> bool:
        return bool(self.password_hash)