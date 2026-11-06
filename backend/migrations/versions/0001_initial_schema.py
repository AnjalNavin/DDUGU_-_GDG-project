"""Initial normalized schema for the Smart Campus system.

Revision ID: 0001_initial
Revises:
Create Date: 2026-11-05
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

USER_ROLE = postgresql.ENUM(
    "admin", "faculty", "student", name="user_role", create_type=False
)
ROOM_TYPE = postgresql.ENUM(
    "lecture_hall",
    "classroom",
    "lab",
    "library",
    "seminar",
    "faculty_room",
    "other",
    name="room_type",
    create_type=False,
)
ROOM_USE = postgresql.ENUM(
    "lecture",
    "lab",
    "seminar",
    "exam",
    "meeting",
    "study",
    "library",
    "event",
    name="room_use",
    create_type=False,
)
BOOKING_STATUS = postgresql.ENUM(
    "pending",
    "approved",
    "rejected",
    "cancelled",
    "completed",
    name="booking_status",
    create_type=False,
)
BOOKING_ACTION = postgresql.ENUM(
    "created",
    "updated",
    "approved",
    "rejected",
    "cancelled",
    "completed",
    name="booking_action",
    create_type=False,
)
ANNOUNCEMENT_AUDIENCE = postgresql.ENUM(
    "all",
    "students",
    "faculty",
    "admins",
    name="announcement_audience",
    create_type=False,
)

ENUMS = (
    ("user_role", ("admin", "faculty", "student")),
    (
        "room_type",
        (
            "lecture_hall",
            "classroom",
            "lab",
            "library",
            "seminar",
            "faculty_room",
            "other",
        ),
    ),
    (
        "room_use",
        ("lecture", "lab", "seminar", "exam", "meeting", "study", "library", "event"),
    ),
    (
        "booking_status",
        ("pending", "approved", "rejected", "cancelled", "completed"),
    ),
    (
        "booking_action",
        ("created", "updated", "approved", "rejected", "cancelled", "completed"),
    ),
    ("announcement_audience", ("all", "students", "faculty", "admins")),
)


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    ]


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    for name, values in ENUMS:
        labels = ", ".join(f"'{value}'" for value in values)
        op.execute(f"CREATE TYPE {name} AS ENUM ({labels})")

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=150), nullable=False),
        sa.Column("role", USER_ROLE, nullable=False, server_default=sa.text("'student'")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_role", "users", ["role"])

    op.create_table(
        "branches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        *_timestamps(),
        sa.UniqueConstraint("code", name="uq_branches_code"),
    )
    op.create_index("ix_branches_code", "branches", ["code"])

    op.create_table(
        "buildings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=30), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("address", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        *_timestamps(),
        sa.UniqueConstraint("code", name="uq_buildings_code"),
    )
    op.create_index("ix_buildings_code", "buildings", ["code"])

    op.create_table(
        "floors",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "building_id",
            sa.Integer(),
            sa.ForeignKey("buildings.id", ondelete="CASCADE", name="fk_floors_building_id_buildings"),
            nullable=False,
        ),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        *_timestamps(),
        sa.UniqueConstraint("building_id", "level", name="uq_floors_building_level"),
        sa.CheckConstraint("level >= 0", name="ck_floors_level_non_negative"),
    )
    op.create_index("ix_floors_building_id", "floors", ["building_id"])

    op.create_table(
        "rooms",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "floor_id",
            sa.Integer(),
            sa.ForeignKey("floors.id", ondelete="CASCADE", name="fk_rooms_floor_id_floors"),
            nullable=False,
        ),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("room_type", ROOM_TYPE, nullable=False, server_default=sa.text("'classroom'")),
        sa.Column("capacity", sa.Integer(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        *_timestamps(),
        sa.UniqueConstraint("floor_id", "code", name="uq_rooms_floor_code"),
        sa.CheckConstraint("capacity IS NULL OR capacity > 0", name="ck_rooms_capacity_positive"),
    )
    op.create_index("ix_rooms_floor_id", "rooms", ["floor_id"])
    op.create_index("ix_rooms_code", "rooms", ["code"])

    op.create_table(
        "room_permitted_uses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "room_id",
            sa.Integer(),
            sa.ForeignKey("rooms.id", ondelete="CASCADE", name="fk_room_permitted_uses_room_id_rooms"),
            nullable=False,
        ),
        sa.Column("use_type", ROOM_USE, nullable=False),
        *_timestamps(),
        sa.UniqueConstraint("room_id", "use_type", name="uq_room_permitted_uses_room_use"),
    )
    op.create_index("ix_room_permitted_uses_room_id", "room_permitted_uses", ["room_id"])

    op.create_table(
        "student_groups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "branch_id",
            sa.Integer(),
            sa.ForeignKey("branches.id", ondelete="CASCADE", name="fk_student_groups_branch_id_branches"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("academic_year", sa.Integer(), nullable=False),
        sa.Column("batch", sa.String(length=20), nullable=False),
        sa.Column("section", sa.String(length=1), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        *_timestamps(),
        sa.CheckConstraint(
            "academic_year BETWEEN 1 AND 4",
            name="ck_student_groups_academic_year_between_1_and_4",
        ),
        sa.CheckConstraint(
            "section IS NULL OR section IN ('A', 'B')",
            name="ck_student_groups_section_a_or_b",
        ),
    )
    op.create_index("ix_student_groups_branch_id", "student_groups", ["branch_id"])
    op.execute(
        "ALTER TABLE student_groups ADD CONSTRAINT "
        "uq_student_groups_cohort UNIQUE NULLS NOT DISTINCT "
        "(branch_id, academic_year, batch, section)"
    )

    op.create_table(
        "students",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("enrollment_number", sa.String(length=50), nullable=False),
        sa.Column("full_name", sa.String(length=150), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column(
            "branch_id",
            sa.Integer(),
            sa.ForeignKey("branches.id", ondelete="RESTRICT", name="fk_students_branch_id_branches"),
            nullable=False,
        ),
        sa.Column(
            "student_group_id",
            sa.Integer(),
            sa.ForeignKey("student_groups.id", ondelete="SET NULL", name="fk_students_student_group_id_student_groups"),
            nullable=True,
        ),
        sa.Column("academic_year", sa.Integer(), nullable=False),
        sa.Column("batch", sa.String(length=20), nullable=False),
        sa.Column("section", sa.String(length=1), nullable=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL", name="fk_students_user_id_users"),
            nullable=True,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        *_timestamps(),
        sa.UniqueConstraint("enrollment_number", name="uq_students_enrollment_number"),
        sa.UniqueConstraint("email", name="uq_students_email"),
        sa.UniqueConstraint("user_id", name="uq_students_user_id"),
        sa.CheckConstraint(
            "academic_year BETWEEN 1 AND 4",
            name="ck_students_academic_year_between_1_and_4",
        ),
        sa.CheckConstraint(
            "section IS NULL OR section IN ('A', 'B')",
            name="ck_students_section_a_or_b",
        ),
    )
    op.create_index("ix_students_enrollment_number", "students", ["enrollment_number"])
    op.create_index("ix_students_branch_id", "students", ["branch_id"])

    op.create_table(
        "faculty",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.String(length=50), nullable=False),
        sa.Column("full_name", sa.String(length=150), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column(
            "branch_id",
            sa.Integer(),
            sa.ForeignKey("branches.id", ondelete="SET NULL", name="fk_faculty_branch_id_branches"),
            nullable=True,
        ),
        sa.Column("designation", sa.String(length=100), nullable=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL", name="fk_faculty_user_id_users"),
            nullable=True,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        *_timestamps(),
        sa.UniqueConstraint("employee_id", name="uq_faculty_employee_id"),
        sa.UniqueConstraint("email", name="uq_faculty_email"),
        sa.UniqueConstraint("user_id", name="uq_faculty_user_id"),
    )
    op.create_index("ix_faculty_employee_id", "faculty", ["employee_id"])
    op.create_index("ix_faculty_branch_id", "faculty", ["branch_id"])

    op.create_table(
        "bookings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "room_id",
            sa.Integer(),
            sa.ForeignKey("rooms.id", ondelete="CASCADE", name="fk_bookings_room_id_rooms"),
            nullable=False,
        ),
        sa.Column(
            "booked_by_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="RESTRICT", name="fk_bookings_booked_by_id_users"),
            nullable=False,
        ),
        sa.Column(
            "faculty_id",
            sa.Integer(),
            sa.ForeignKey("faculty.id", ondelete="SET NULL", name="fk_bookings_faculty_id_faculty"),
            nullable=True,
        ),
        sa.Column(
            "student_id",
            sa.Integer(),
            sa.ForeignKey("students.id", ondelete="SET NULL", name="fk_bookings_student_id_students"),
            nullable=True,
        ),
        sa.Column(
            "student_group_id",
            sa.Integer(),
            sa.ForeignKey("student_groups.id", ondelete="SET NULL", name="fk_bookings_student_group_id_student_groups"),
            nullable=True,
        ),
        sa.Column("title", sa.String(length=150), nullable=False),
        sa.Column("purpose", sa.Text(), nullable=True),
        sa.Column("use_type", ROOM_USE, nullable=False),
        sa.Column("booking_date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("expected_attendees", sa.Integer(), nullable=True),
        sa.Column("status", BOOKING_STATUS, nullable=False, server_default=sa.text("'pending'")),
        sa.Column(
            "approved_by_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL", name="fk_bookings_approved_by_id_users"),
            nullable=True,
        ),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "rejected_by_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL", name="fk_bookings_rejected_by_id_users"),
            nullable=True,
        ),
        sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column(
            "cancelled_by_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL", name="fk_bookings_cancelled_by_id_users"),
            nullable=True,
        ),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancellation_reason", sa.Text(), nullable=True),
        *_timestamps(),
        sa.CheckConstraint("end_time > start_time", name="ck_bookings_time_order"),
        sa.CheckConstraint(
            "expected_attendees IS NULL OR expected_attendees > 0",
            name="ck_bookings_attendees_positive",
        ),
    )
    op.create_index("ix_bookings_room_id", "bookings", ["room_id"])
    op.create_index("ix_bookings_booked_by_id", "bookings", ["booked_by_id"])
    op.create_index("ix_bookings_status", "bookings", ["status"])
    op.create_index("ix_bookings_booking_date", "bookings", ["booking_date"])
    op.create_index("ix_bookings_room_date", "bookings", ["room_id", "booking_date"])
    op.create_index("ix_bookings_date_status", "bookings", ["booking_date", "status"])
    op.execute(
        """
        ALTER TABLE bookings
        ADD CONSTRAINT ex_bookings_no_overlap
        EXCLUDE USING gist (
            room_id WITH =,
            tsrange(booking_date + start_time, booking_date + end_time) WITH &&
        )
        WHERE (status IN ('pending'::booking_status, 'approved'::booking_status))
        """
    )

    op.create_table(
        "booking_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "booking_id",
            sa.Integer(),
            sa.ForeignKey("bookings.id", ondelete="CASCADE", name="fk_booking_history_booking_id_bookings"),
            nullable=False,
        ),
        sa.Column("action", BOOKING_ACTION, nullable=False),
        sa.Column("from_status", BOOKING_STATUS, nullable=True),
        sa.Column("to_status", BOOKING_STATUS, nullable=True),
        sa.Column(
            "performed_by_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL", name="fk_booking_history_performed_by_id_users"),
            nullable=True,
        ),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_booking_history_booking_id", "booking_history", ["booking_id"])

    op.create_table(
        "timetables",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "room_id",
            sa.Integer(),
            sa.ForeignKey("rooms.id", ondelete="CASCADE", name="fk_timetables_room_id_rooms"),
            nullable=False,
        ),
        sa.Column(
            "branch_id",
            sa.Integer(),
            sa.ForeignKey("branches.id", ondelete="SET NULL", name="fk_timetables_branch_id_branches"),
            nullable=True,
        ),
        sa.Column(
            "student_group_id",
            sa.Integer(),
            sa.ForeignKey("student_groups.id", ondelete="SET NULL", name="fk_timetables_student_group_id_student_groups"),
            nullable=True,
        ),
        sa.Column(
            "faculty_id",
            sa.Integer(),
            sa.ForeignKey("faculty.id", ondelete="SET NULL", name="fk_timetables_faculty_id_faculty"),
            nullable=True,
        ),
        sa.Column(
            "created_by_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL", name="fk_timetables_created_by_id_users"),
            nullable=True,
        ),
        sa.Column("subject", sa.String(length=150), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        *_timestamps(),
        sa.CheckConstraint("end_time > start_time", name="ck_timetables_time_order"),
        sa.CheckConstraint(
            "day_of_week BETWEEN 0 AND 6", name="ck_timetables_day_of_week_range"
        ),
        sa.CheckConstraint(
            "valid_to IS NULL OR valid_to >= valid_from",
            name="ck_timetables_valid_range_order",
        ),
    )
    op.create_index("ix_timetables_room_id", "timetables", ["room_id"])
    op.create_index("ix_timetables_room_day", "timetables", ["room_id", "day_of_week"])

    op.create_table(
        "announcements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "audience",
            ANNOUNCEMENT_AUDIENCE,
            nullable=False,
            server_default=sa.text("'all'"),
        ),
        sa.Column(
            "building_id",
            sa.Integer(),
            sa.ForeignKey("buildings.id", ondelete="SET NULL", name="fk_announcements_building_id_buildings"),
            nullable=True,
        ),
        sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "published_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_by_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL", name="fk_announcements_created_by_id_users"),
            nullable=True,
        ),
        *_timestamps(),
    )
    op.create_index("ix_announcements_audience", "announcements", ["audience"])


def downgrade() -> None:
    op.drop_table("announcements")
    op.drop_table("timetables")
    op.drop_table("booking_history")
    op.drop_table("bookings")
    op.drop_table("faculty")
    op.drop_table("students")
    op.drop_table("student_groups")
    op.drop_table("room_permitted_uses")
    op.drop_table("rooms")
    op.drop_table("floors")
    op.drop_table("buildings")
    op.drop_table("branches")
    op.drop_table("users")
    for name, _ in reversed(ENUMS):
        op.execute(f"DROP TYPE IF EXISTS {name}")
