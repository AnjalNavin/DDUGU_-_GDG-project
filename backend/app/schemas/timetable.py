"""Timetable schemas."""

from __future__ import annotations

from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field, model_validator


class TimetableBase(BaseModel):
    room_id: int
    subject: str = Field(min_length=1, max_length=150)
    day_of_week: int = Field(ge=0, le=6)
    start_time: time
    end_time: time
    valid_from: date
    valid_to: date | None = None
    branch_id: int | None = None
    student_group_id: int | None = None
    faculty_mobile_number: str | None = Field(default=None, min_length=10, max_length=10)

    @model_validator(mode="after")
    def _check_ranges(self) -> "TimetableBase":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be later than start_time")
        if self.valid_to is not None and self.valid_to < self.valid_from:
            raise ValueError("valid_to must not be earlier than valid_from")
        return self


class TimetableCreate(TimetableBase):
    pass


class TimetableUpdate(BaseModel):
    room_id: int | None = None
    subject: str | None = Field(default=None, min_length=1, max_length=150)
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    start_time: time | None = None
    end_time: time | None = None
    valid_from: date | None = None
    valid_to: date | None = None
    branch_id: int | None = None
    student_group_id: int | None = None
    faculty_mobile_number: str | None = Field(default=None, min_length=10, max_length=10)
    is_active: bool | None = None


class TimetableRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    room_id: int
    room_code: str
    room_name: str
    building_name: str
    subject: str
    day_of_week: int
    start_time: time
    end_time: time
    valid_from: date
    valid_to: date | None = None
    branch_id: int | None = None
    branch_code: str | None = None
    student_group_id: int | None = None
    group_name: str | None = None
    faculty_mobile_number: str | None = None
    faculty_name: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime