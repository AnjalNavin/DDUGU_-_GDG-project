"""Faculty schemas for import, management, and authentication."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class FacultyBase(BaseModel):
    mobile_number: str = Field(min_length=10, max_length=10)
    name: str = Field(min_length=1, max_length=150)
    department: str = Field(min_length=1, max_length=50)
    designation: Optional[str] = Field(default=None, max_length=100)

    @field_validator("mobile_number")
    @classmethod
    def validate_mobile_number(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 10:
            raise ValueError("Mobile number must be exactly 10 digits")
        return v


class FacultyCreate(FacultyBase):
    password: str = Field(min_length=8, max_length=128)


class FacultyUpdate(BaseModel):
    mobile_number: Optional[str] = Field(default=None, min_length=10, max_length=10)
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    department: Optional[str] = Field(default=None, min_length=1, max_length=50)
    designation: Optional[str] = Field(default=None, max_length=100)
    is_active: Optional[bool] = None

    @field_validator("mobile_number")
    @classmethod
    def validate_mobile_number(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and (not v.isdigit() or len(v) != 10):
            raise ValueError("Mobile number must be exactly 10 digits")
        return v


class FacultyRead(FacultyBase):
    model_config = ConfigDict(from_attributes=True)

    role: str = "faculty"
    is_active: bool
    has_password: bool
    created_at: datetime
    updated_at: datetime


class FacultyLoginRequest(BaseModel):
    mobile_number: str = Field(min_length=10, max_length=10)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("mobile_number")
    @classmethod
    def validate_mobile_number(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 10:
            raise ValueError("Mobile number must be exactly 10 digits")
        return v


class FacultyTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: FacultyRead


class FacultyPasswordReset(BaseModel):
    password: str = Field(min_length=8, max_length=128)


class FacultyImportRowError(BaseModel):
    row: int
    mobile_number: Optional[str] = None
    errors: list[str]


class FacultyImportSummary(BaseModel):
    total_rows: int
    imported: int
    skipped_duplicates: int
    invalid_rows: int
    errors: list[FacultyImportRowError]