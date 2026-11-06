"""Branch, student group, student and faculty schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.common import Page


class BranchBase(BaseModel):
    code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1, max_length=150)

    @field_validator("code")
    @classmethod
    def _normalise_code(cls, value: str) -> str:
        return value.strip().upper()


class BranchCreate(BranchBase):
    pass


class BranchUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=20)
    name: str | None = Field(default=None, min_length=1, max_length=150)
    is_active: bool | None = None


class BranchRead(BranchBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class StudentGroupBase(BaseModel):
    academic_year: int = Field(ge=1, le=4)
    batch: str = Field(min_length=1, max_length=20)
    section: str | None = Field(default=None, max_length=1)

    @field_validator("section")
    @classmethod
    def _validate_section(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip().upper()
        if value not in {"A", "B"}:
            raise ValueError("section must be A or B")
        return value


class StudentGroupCreate(StudentGroupBase):
    branch_id: int
    name: str | None = Field(default=None, max_length=120)


class StudentGroupUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    academic_year: int | None = Field(default=None, ge=1, le=4)
    batch: str | None = Field(default=None, min_length=1, max_length=20)
    section: str | None = Field(default=None, max_length=1)
    is_active: bool | None = None


class StudentGroupRead(StudentGroupBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    branch_id: int
    branch_code: str
    name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class StudentBase(BaseModel):
    enrollment_number: str = Field(min_length=1, max_length=50)
    full_name: str = Field(min_length=1, max_length=150)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    branch_id: int
    student_group_id: int | None = None
    academic_year: int = Field(ge=1, le=4)
    batch: str = Field(min_length=1, max_length=20)
    section: str | None = Field(default=None, max_length=1)

    @field_validator("section")
    @classmethod
    def _validate_section(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip().upper()
        if value not in {"A", "B"}:
            raise ValueError("section must be A or B")
        return value

    @field_validator("enrollment_number")
    @classmethod
    def _strip_enrollment(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("enrollment_number must not be blank")
        return value


class StudentCreate(StudentBase):
    user_id: int | None = None


class StudentUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=150)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    branch_id: int | None = None
    student_group_id: int | None = None
    academic_year: int | None = Field(default=None, ge=1, le=4)
    batch: str | None = Field(default=None, min_length=1, max_length=20)
    section: str | None = Field(default=None, max_length=1)
    is_active: bool | None = None


class StudentRead(StudentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    branch_code: str
    branch_name: str
    group_name: str | None = None
    user_id: int | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class StudentPage(Page[StudentRead]):
    pass


class ImportErrorItem(BaseModel):
    row: int
    enrollment_number: str | None = None
    message: str


class ImportResult(BaseModel):
    created: int
    skipped: int
    total_rows: int
    errors: list[ImportErrorItem] = Field(default_factory=list)