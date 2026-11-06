"""Seat reservation schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SeatReservationCreate(BaseModel):
    booking_id: int
    seat_number: int | None = Field(default=None, ge=1)
    academic_year: int = Field(ge=1, le=4)
    branch_code: str = Field(min_length=1, max_length=20)
    section: str = Field(min_length=1, max_length=10)


class SeatReservationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    booking_id: int
    booking_title: str | None = None
    room_id: int
    room_name: str | None = None
    student_name: str
    academic_year: int
    branch_code: str
    section: str
    seat_number: int
    status: str
    created_at: datetime


class SeatAvailabilityRead(BaseModel):
    booking_id: int
    room_id: int
    room_name: str
    capacity: int
    occupied_seats: list[int]
    total_occupied: int
    total_available: int
