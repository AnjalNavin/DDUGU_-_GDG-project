"""Conflict reporting and resolution endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies import get_current_principal, require_admin
from app.schemas.conflict import (
    ConflictReportCreate,
    ConflictReportRead,
    ConflictStatusUpdate,
)
from app.services import conflict_service

router = APIRouter(prefix="/conflicts", tags=["conflicts"])


@router.get("", response_model=list[ConflictReportRead])
def list_conflicts(
    status: str | None = None,
    priority: str | None = None,
    principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> list[ConflictReportRead]:
    reports = conflict_service.list_conflicts(
        db, principal, status=status, priority=priority
    )
    return [
        ConflictReportRead(
            id=c.id,
            reporter_type=c.reporter_type,
            reporter_name=c.reporter_name,
            priority=c.priority,
            room_id=c.room_id,
            room_name=c.room.name if c.room else None,
            booking_id=c.booking_id,
            booking_title=c.booking.title if c.booking else None,
            seat_id=c.seat_id,
            title=c.title,
            description=c.description,
            status=c.status,
            resolution_note=c.resolution_note,
            resolved_by_name=c.resolved_by.full_name if c.resolved_by else None,
            resolved_at=c.resolved_at,
            created_at=c.created_at,
            updated_at=c.updated_at,
            history=[
                {
                    "id": h.id,
                    "changed_by_name": h.changed_by_name,
                    "old_status": h.old_status,
                    "new_status": h.new_status,
                    "action_note": h.action_note,
                    "created_at": h.created_at,
                }
                for h in c.history
            ],
        )
        for c in reports
    ]


@router.post("", response_model=ConflictReportRead, status_code=status.HTTP_201_CREATED)
def create_conflict(
    payload: ConflictReportCreate,
    principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> ConflictReportRead:
    c = conflict_service.create_conflict(db, principal, payload)
    return ConflictReportRead(
        id=c.id,
        reporter_type=c.reporter_type,
        reporter_name=c.reporter_name,
        priority=c.priority,
        room_id=c.room_id,
        room_name=c.room.name if c.room else None,
        booking_id=c.booking_id,
        booking_title=c.booking.title if c.booking else None,
        seat_id=c.seat_id,
        title=c.title,
        description=c.description,
        status=c.status,
        resolution_note=c.resolution_note,
        resolved_by_name=None,
        resolved_at=None,
        created_at=c.created_at,
        updated_at=c.updated_at,
        history=[],
    )


@router.get("/{conflict_id}", response_model=ConflictReportRead)
def get_conflict(
    conflict_id: int,
    principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> ConflictReportRead:
    c = conflict_service.get_conflict(db, conflict_id)
    return ConflictReportRead(
        id=c.id,
        reporter_type=c.reporter_type,
        reporter_name=c.reporter_name,
        priority=c.priority,
        room_id=c.room_id,
        room_name=c.room.name if c.room else None,
        booking_id=c.booking_id,
        booking_title=c.booking.title if c.booking else None,
        seat_id=c.seat_id,
        title=c.title,
        description=c.description,
        status=c.status,
        resolution_note=c.resolution_note,
        resolved_by_name=c.resolved_by.full_name if c.resolved_by else None,
        resolved_at=c.resolved_at,
        created_at=c.created_at,
        updated_at=c.updated_at,
        history=[
            {
                "id": h.id,
                "changed_by_name": h.changed_by_name,
                "old_status": h.old_status,
                "new_status": h.new_status,
                "action_note": h.action_note,
                "created_at": h.created_at,
            }
            for h in c.history
        ],
    )


@router.patch("/{conflict_id}/status", response_model=ConflictReportRead | None)
def update_conflict_status(
    conflict_id: int,
    payload: ConflictStatusUpdate,
    principal = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ConflictReportRead | None:
    c = conflict_service.update_conflict_status(db, principal, conflict_id, payload)
    if c is None:
        return None
    return ConflictReportRead(
        id=c.id,
        reporter_type=c.reporter_type,
        reporter_name=c.reporter_name,
        priority=c.priority,
        room_id=c.room_id,
        room_name=c.room.name if c.room else None,
        booking_id=c.booking_id,
        booking_title=c.booking.title if c.booking else None,
        seat_id=c.seat_id,
        title=c.title,
        description=c.description,
        status=c.status,
        resolution_note=c.resolution_note,
        resolved_by_name=c.resolved_by.full_name if c.resolved_by else None,
        resolved_at=c.resolved_at,
        created_at=c.created_at,
        updated_at=c.updated_at,
        history=[
            {
                "id": h.id,
                "changed_by_name": h.changed_by_name,
                "old_status": h.old_status,
                "new_status": h.new_status,
                "action_note": h.action_note,
                "created_at": h.created_at,
            }
            for h in c.history
        ],
    )
