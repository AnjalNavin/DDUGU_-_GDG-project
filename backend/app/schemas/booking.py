"""Booking and booking-history schemas."""

from __future__ import annotations

from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import BookingAction, BookingStatus, RoomUse


class BookingCreate(BaseModel):
    room_id: int
    title: str = Field(min_length=1, max_length=150)
    purpose: str | None = None
    use_type: RoomUse
    booking_date: date
    start_time: time
    end_time: time
    expected_attendees: int | None = Field(default=None, gt=0)
    student_group_id: int | None = None
    academic_year: int | None = None
    branch_code: str | None = None
    section: str | None = None
    audience_desc: str | None = None

    @model_validator(mode="after")
    def _check_time_order(self) -> "BookingCreate":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be later than start_time")
        return self


class BookingUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=150)
    purpose: str | None = None
    use_type: RoomUse | None = None
    booking_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    expected_attendees: int | None = Field(default=None, gt=0)
    student_group_id: int | None = None
    academic_year: int | None = None
    branch_code: str | None = None
    section: str | None = None
    audience_desc: str | None = None


class BookingDecision(BaseModel):
    reason: str | None = None


class BookingCancel(BaseModel):
    reason: str | None = None


class BookingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    room_id: int
    room_code: str
    room_name: str
    building_id: int
    building_name: str
    floor_level: int
    booked_by_id: int
    booked_by_name: str
    faculty_id: int | None = None
    faculty_mobile_number: str | None = None
    faculty_name: str | None = None
    student_id: int | None = None
    student_name: str | None = None
    student_group_id: int | None = None
    academic_year: int | None = None
    branch_code: str | None = None
    section: str | None = None
    audience_desc: str | None = None
    group_name: str | None = None
    title: str
    purpose: str | None = None
    use_type: RoomUse
    booking_date: date
    start_time: time
    end_time: time
    expected_attendees: int | None = None
    status: BookingStatus
    approved_by_id: int | None = None
    approved_at: datetime | None = None
    rejected_at: datetime | None = None
    rejection_reason: str | None = None
    cancelled_at: datetime | None = None
    cancellation_reason: str | None = None
    created_at: datetime
    updated_at: datetime


class BookingHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    booking_id: int
    action: BookingAction
    from_status: BookingStatus | None = None
    to_status: BookingStatus | None = None
    performed_by_id: int | None = None
    performed_by_name: str | None = None
    note: str | None = None
    created_at: datetime


class BookingWithHistory(BookingRead):
    history: list[BookingHistoryRead] = Field(default_factory=list)


class BusySlot(BaseModel):
    source: Literal["booking", "timetable"]
    id: int
    title: str
    status: BookingStatus | None = None
    start_time: time
    end_time: time


class TimeWindow(BaseModel):
    start_time: time
    end_time: time


class RoomAvailability(BaseModel):
    room_id: int
    room_code: str
    room_name: str
    room_type: str
    capacity: int | None = None
    building_id: int
    building_name: str
    floor_id: int
    floor_level: int
    floor_name: str
    permitted_uses: list[RoomUse] = Field(default_factory=list)
    is_available: bool
    conflicts: list[BusySlot] = Field(default_factory=list)


class AvailabilityResponse(BaseModel):
    booking_date: date
    start_time: time
    end_time: time
    total: int
    available: int
    results: list[RoomAvailability]


class RoomDayAvailability(BaseModel):
    room_id: int
    booking_date: date
    busy: list[BusySlot]
    free_windows: list[TimeWindow]
