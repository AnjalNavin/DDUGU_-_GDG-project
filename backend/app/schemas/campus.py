"""Campus structure schemas: buildings, floors, rooms and permitted uses."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import RoomType, RoomUse


class BuildingBase(BaseModel):
    code: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    address: str | None = Field(default=None, max_length=255)

    @field_validator("code")
    @classmethod
    def _normalise_code(cls, value: str) -> str:
        return value.strip().upper()


class BuildingCreate(BuildingBase):
    pass


class BuildingUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=30)
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    address: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None


class FloorBase(BaseModel):
    level: int = Field(ge=0, le=100)
    name: str = Field(min_length=1, max_length=80)


class FloorCreate(FloorBase):
    building_id: int


class FloorUpdate(BaseModel):
    level: int | None = Field(default=None, ge=0, le=100)
    name: str | None = Field(default=None, min_length=1, max_length=80)
    is_active: bool | None = None


class RoomBase(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=120)
    room_type: RoomType = RoomType.classroom
    capacity: int | None = Field(default=None, gt=0)
    description: str | None = None


class RoomCreate(RoomBase):
    floor_id: int
    permitted_uses: list[RoomUse] = Field(default_factory=list)


class RoomUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=50)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    room_type: RoomType | None = None
    capacity: int | None = Field(default=None, gt=0)
    description: str | None = None
    is_active: bool | None = None
    permitted_uses: list[RoomUse] | None = None


class RoomPermittedUseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    use_type: RoomUse


class RoomRead(RoomBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    floor_id: int
    is_active: bool
    permitted_uses: list[RoomUse] = Field(default_factory=list)
    building_id: int
    building_name: str
    floor_level: int
    floor_name: str
    created_at: datetime
    updated_at: datetime

    @field_validator("permitted_uses", mode="before")
    @classmethod
    def _extract_use_types(cls, value: object) -> object:
        if value is None:
            return []
        return [
            getattr(item, "use_type", item) if not isinstance(item, str) else item
            for item in value
        ]


class FloorRead(FloorBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    building_id: int
    created_at: datetime
    updated_at: datetime
    rooms: list[RoomRead] = Field(default_factory=list)


class BuildingRead(BuildingBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    floor_count: int = 0
    room_count: int = 0
    created_at: datetime
    updated_at: datetime


class BuildingDetail(BuildingRead):
    floors: list[FloorRead] = Field(default_factory=list)
