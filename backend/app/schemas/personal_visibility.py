from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field


class HiddenItemCreate(BaseModel):
    record_type: str = Field(..., description="'announcement' or 'booking'")
    record_id: str = Field(..., description="ID of the announcement or booking to hide")


class HiddenItemRead(BaseModel):
    id: int
    user_id: str
    record_type: str
    record_id: str
    hidden_at: datetime

    class Config:
        from_attributes = True


class HiddenItemsSummary(BaseModel):
    announcements: list[str]
    bookings: list[str]
