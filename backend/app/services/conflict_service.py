"""Conflict reporting and resolution service."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.audit_log import AdminAuditLog
from app.models.booking import Booking
from app.models.campus import Room
from app.models.conflict import ConflictReport, ConflictResolutionHistory
from app.models.enums import UserRole
from app.schemas.conflict import ConflictReportCreate, ConflictStatusUpdate
from app.services.exceptions import ForbiddenError, NotFoundError, ValidationError


def _query():
    return select(ConflictReport).options(
        selectinload(ConflictReport.room),
        selectinload(ConflictReport.booking),
        selectinload(ConflictReport.reporter_user),
        selectinload(ConflictReport.reporter_faculty),
        selectinload(ConflictReport.resolved_by),
        selectinload(ConflictReport.history),
    )


def get_conflict(db: Session, conflict_id: int) -> ConflictReport:
    conflict = db.scalar(_query().where(ConflictReport.id == conflict_id))
    if conflict is None:
        raise NotFoundError("Conflict report not found")
    return conflict


def list_conflicts(
    db: Session,
    principal,
    *,
    status: str | None = None,
    priority: str | None = None,
) -> list[ConflictReport]:
    stmt = _query()

    if status and status != "all":
        stmt = stmt.where(ConflictReport.status == status)
    else:
        # Resolved conflicts are deleted/cleared from active listing
        stmt = stmt.where(ConflictReport.status != "resolved")
    if priority and priority != "all":
        stmt = stmt.where(ConflictReport.priority == priority)

    # Sort with faculty priority first, then newest
    stmt = stmt.order_by(
        ConflictReport.priority.desc(),  # 'high' comes before 'normal'
        ConflictReport.created_at.desc(),
    )
    all_reports = list(db.scalars(stmt))

    # Admins see all reports
    if principal.role == UserRole.admin:
        return all_reports

    # Faculty members see their own reports
    if principal.is_faculty:
        my_mobile = str(principal.id)
        return [c for c in all_reports if c.reporter_faculty_mobile == my_mobile]

    # Students see their own reports
    if principal.role == UserRole.student and principal.is_user:
        return [c for c in all_reports if c.reporter_user_id == principal.user.id]

    return []


def create_conflict(
    db: Session,
    principal,
    data: ConflictReportCreate,
) -> ConflictReport:
    if principal.role == UserRole.admin:
        raise ForbiddenError("Administrators resolve conflicts, only students and faculty report conflicts.")

    if data.room_id is not None:
        room = db.get(Room, data.room_id)
        if not room:
            raise NotFoundError("Selected room not found")

    if data.booking_id is not None:
        booking = db.get(Booking, data.booking_id)
        if not booking:
            raise NotFoundError("Selected reservation not found")

    if principal.is_faculty:
        reporter_type = "faculty"
        reporter_faculty_mobile = str(principal.faculty.mobile_number) if principal.faculty else None
        reporter_user_id = principal.user.id if principal.is_user else None
        reporter_name = principal.full_name
        priority = "high"  # Faculty-reported conflicts have higher priority
    else:
        reporter_type = "student"
        reporter_user_id = principal.user.id if principal.is_user else None
        reporter_faculty_mobile = None
        reporter_name = principal.full_name
        priority = "normal"

    conflict = ConflictReport(
        reporter_type=reporter_type,
        reporter_user_id=reporter_user_id,
        reporter_faculty_mobile=reporter_faculty_mobile,
        reporter_name=reporter_name,
        priority=priority,
        room_id=data.room_id,
        booking_id=data.booking_id,
        seat_id=data.seat_id,
        title=data.title.strip(),
        description=data.description.strip(),
        status="pending",
    )
    db.add(conflict)
    db.commit()
    return get_conflict(db, conflict.id)


def update_conflict_status(
    db: Session,
    principal,
    conflict_id: int,
    data: ConflictStatusUpdate,
) -> ConflictReport:
    if principal.role != UserRole.admin:
        raise ForbiddenError("Only administrators can resolve conflicts.")

    valid_statuses = {"pending", "under_review", "resolved", "rejected"}
    if data.status not in valid_statuses:
        raise ValidationError(f"Status must be one of: {', '.join(sorted(valid_statuses))}")

    conflict = get_conflict(db, conflict_id)
    old_status = conflict.status
    new_status = data.status

    # Record history
    history = ConflictResolutionHistory(
        conflict_id=conflict.id,
        changed_by_id=principal.user.id,
        changed_by_name=principal.full_name,
        old_status=old_status,
        new_status=new_status,
        action_note=data.resolution_note,
    )
    db.add(history)

    # If marked resolved, record audit log and permanently delete from system
    if new_status == "resolved":
        audit = AdminAuditLog(
            admin_user_id=principal.user.id,
            admin_name=principal.full_name,
            action="conflict_resolution",
            target_type="conflict",
            target_id=str(conflict.id),
            details=f"Conflict resolved and deleted from system. Note: {data.resolution_note or 'None'}",
        )
        db.add(audit)
        db.delete(conflict)
        db.commit()
        return None

    # Update conflict
    conflict.status = new_status
    conflict.resolution_note = data.resolution_note
    if new_status == "rejected":
        conflict.resolved_by_id = principal.user.id
        conflict.resolved_at = datetime.now(timezone.utc)

    # Record in admin audit log
    audit = AdminAuditLog(
        admin_user_id=principal.user.id,
        admin_name=principal.full_name,
        action="conflict_resolution",
        target_type="conflict",
        target_id=str(conflict.id),
        details=f"Status changed from {old_status} to {new_status}. Note: {data.resolution_note or 'None'}",
    )
    db.add(audit)

    db.commit()
    return get_conflict(db, conflict.id)
