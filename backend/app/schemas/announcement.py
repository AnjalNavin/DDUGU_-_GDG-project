"""Announcement schemas with enhanced audience targeting."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import AnnouncementAudience


class AnnouncementBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1)
    audience: AnnouncementAudience = AnnouncementAudience.all
    audience_type: str = Field(default="all")  # 'all' | 'selected_faculty' | 'selected_students'
    building_id: int | None = None
    is_pinned: bool = False
    expires_at: datetime | None = None

    # Targeting options
    target_faculty_mobiles: list[str] = Field(default_factory=list)
    target_academic_year: int | None = None
    target_branch_code: str | None = None
    target_section: str | None = None


class AnnouncementCreate(AnnouncementBase):
    pass


class AnnouncementUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    body: str | None = Field(default=None, min_length=1)
    audience: AnnouncementAudience | None = None
    audience_type: str | None = None
    building_id: int | None = None
    is_pinned: bool | None = None
    expires_at: datetime | None = None
    target_faculty_mobiles: list[str] | None = None
    target_academic_year: int | None = None
    target_branch_code: str | None = None
    target_section: str | None = None


class AnnouncementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    body: str
    audience: AnnouncementAudience
    audience_type: str
    building_id: int | None = None
    building_name: str | None = None
    is_pinned: bool = False
    expires_at: datetime | None = None
    created_by_id: int | None = None
    created_by_faculty_mobile: str | None = None
    creator_name: str | None = None
    creator_role: str | None = None
    created_by_name: str | None = None
    target_academic_year: int | None = None
    target_branch_code: str | None = None
    target_section: str | None = None
    target_faculty_mobiles: list[str] = Field(default_factory=list)
    published_at: datetime
    created_at: datetime
    updated_at: datetime
