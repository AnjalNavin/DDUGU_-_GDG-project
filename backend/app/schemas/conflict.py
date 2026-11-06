"""Conflict report schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ConflictReportCreate(BaseModel):
    room_id: int | None = None
    booking_id: int | None = None
    seat_id: str | None = None
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(min_length=5)


class ConflictStatusUpdate(BaseModel):
    status: str = Field(description="pending, under_review, resolved, or rejected")
    resolution_note: str | None = None


class ConflictResolutionHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    changed_by_name: str
    old_status: str
    new_status: str
    action_note: str | None = None
    created_at: datetime


class ConflictReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    reporter_type: str
    reporter_name: str
    priority: str
    room_id: int | None = None
    room_name: str | None = None
    booking_id: int | None = None
    booking_title: str | None = None
    seat_id: str | None = None
    title: str
    description: str
    status: str
    resolution_note: str | None = None
    resolved_by_name: str | None = None
    resolved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    history: list[ConflictResolutionHistoryRead] = Field(default_factory=list)
