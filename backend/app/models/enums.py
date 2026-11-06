"""Enumerations shared by models, schemas and services."""

from __future__ import annotations

import enum

from sqlalchemy import Enum as SAEnum


class UserRole(str, enum.Enum):
    admin = "admin"
    faculty = "faculty"
    student = "student"


class RoomType(str, enum.Enum):
    lecture_hall = "lecture_hall"
    classroom = "classroom"
    lab = "lab"
    library = "library"
    seminar = "seminar"
    faculty_room = "faculty_room"
    other = "other"


class RoomUse(str, enum.Enum):
    lecture = "lecture"
    lab = "lab"
    seminar = "seminar"
    exam = "exam"
    meeting = "meeting"
    study = "study"
    library = "library"
    event = "event"


class BookingStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    cancelled = "cancelled"
    completed = "completed"


class BookingAction(str, enum.Enum):
    created = "created"
    updated = "updated"
    approved = "approved"
    rejected = "rejected"
    cancelled = "cancelled"
    completed = "completed"


class AnnouncementAudience(str, enum.Enum):
    all = "all"
    students = "students"
    faculty = "faculty"
    admins = "admins"


class AudienceType(str, enum.Enum):
    all = "all"
    selected_faculty = "selected_faculty"
    selected_students = "selected_students"


class ConflictStatus(str, enum.Enum):
    pending = "pending"
    under_review = "under_review"
    resolved = "resolved"
    rejected = "rejected"


class ConflictPriority(str, enum.Enum):
    high = "high"
    normal = "normal"


class SeatReservationStatus(str, enum.Enum):
    active = "active"
    cancelled = "cancelled"


def _enum(enum_cls: type[enum.Enum], name: str) -> SAEnum:
    return SAEnum(
        enum_cls,
        name=name,
        values_callable=lambda cls: [member.value for member in cls],
        native_enum=True,
        validate_strings=True,
    )


user_role_enum = _enum(UserRole, "user_role")
room_type_enum = _enum(RoomType, "room_type")
room_use_enum = _enum(RoomUse, "room_use")
booking_status_enum = _enum(BookingStatus, "booking_status")
booking_action_enum = _enum(BookingAction, "booking_action")
announcement_audience_enum = _enum(AnnouncementAudience, "announcement_audience")
audience_type_enum = _enum(AudienceType, "audience_type")
conflict_status_enum = _enum(ConflictStatus, "conflict_status")
conflict_priority_enum = _enum(ConflictPriority, "conflict_priority")
seat_reservation_status_enum = _enum(SeatReservationStatus, "seat_reservation_status")
