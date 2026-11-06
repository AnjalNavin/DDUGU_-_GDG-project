"""Import all models so SQLAlchemy can configure mappers and metadata."""

from app.models.academic import Branch, Faculty, Student, StudentGroup
from app.models.announcement import Announcement, AnnouncementTargetFaculty
from app.models.audit_log import AdminAuditLog
from app.models.booking import Booking, BookingHistory
from app.models.campus import Building, Floor, Room, RoomPermittedUse
from app.models.conflict import ConflictReport, ConflictResolutionHistory
from app.models.enums import (
    AnnouncementAudience,
    AudienceType,
    BookingAction,
    BookingStatus,
    ConflictPriority,
    ConflictStatus,
    RoomType,
    RoomUse,
    SeatReservationStatus,
    UserRole,
)
from app.models.personal_visibility import UserHiddenItem
from app.models.seat_reservation import SeatReservation
from app.models.timetable import Timetable
from app.models.user import User

__all__ = [
    "AdminAuditLog",
    "Announcement",
    "AnnouncementAudience",
    "AnnouncementTargetFaculty",
    "AudienceType",
    "Booking",
    "BookingAction",
    "BookingHistory",
    "BookingStatus",
    "Branch",
    "Building",
    "ConflictPriority",
    "ConflictReport",
    "ConflictResolutionHistory",
    "ConflictStatus",
    "Faculty",
    "Floor",
    "Room",
    "RoomPermittedUse",
    "RoomType",
    "RoomUse",
    "SeatReservation",
    "SeatReservationStatus",
    "Student",
    "StudentGroup",
    "Timetable",
    "User",
    "UserHiddenItem",
    "UserRole",
]
