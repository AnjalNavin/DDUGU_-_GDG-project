"""Buildings, floors, rooms and room permitted uses."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin
from app.models.enums import RoomType, RoomUse, room_type_enum, room_use_enum

if TYPE_CHECKING:
    from app.models.announcement import Announcement
    from app.models.booking import Booking
    from app.models.timetable import Timetable


class Building(Base, TimestampMixin):
    __tablename__ = "buildings"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    floors: Mapped[list[Floor]] = relationship(
        back_populates="building",
        cascade="all, delete-orphan",
        order_by="Floor.level",
    )
    announcements: Mapped[list[Announcement]] = relationship(
        back_populates="building"
    )

    @property
    def floor_count(self) -> int:
        return len(self.floors)

    @property
    def room_count(self) -> int:
        return sum(len(floor.rooms) for floor in self.floors)


class Floor(Base, TimestampMixin):
    __tablename__ = "floors"
    __table_args__ = (
        UniqueConstraint("building_id", "level", name="uq_floors_building_level"),
        CheckConstraint("level >= 0", name="level_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    building_id: Mapped[int] = mapped_column(
        ForeignKey("buildings.id", ondelete="CASCADE"), index=True
    )
    level: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(80))

    building: Mapped[Building] = relationship(back_populates="floors")
    rooms: Mapped[list[Room]] = relationship(
        back_populates="floor",
        cascade="all, delete-orphan",
        order_by="Room.name",
    )


class Room(Base, TimestampMixin):
    __tablename__ = "rooms"
    __table_args__ = (
        UniqueConstraint("floor_id", "code", name="uq_rooms_floor_code"),
        CheckConstraint("capacity IS NULL OR capacity > 0", name="capacity_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    floor_id: Mapped[int] = mapped_column(
        ForeignKey("floors.id", ondelete="CASCADE"), index=True
    )
    code: Mapped[str] = mapped_column(String(50), index=True)
    name: Mapped[str] = mapped_column(String(120))
    room_type: Mapped[RoomType] = mapped_column(
        room_type_enum, default=RoomType.classroom, nullable=False
    )
    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    floor: Mapped[Floor] = relationship(back_populates="rooms")
    permitted_uses: Mapped[list[RoomPermittedUse]] = relationship(
        back_populates="room",
        cascade="all, delete-orphan",
        order_by="RoomPermittedUse.use_type",
    )
    bookings: Mapped[list[Booking]] = relationship(
        back_populates="room", cascade="all, delete-orphan"
    )
    timetables: Mapped[list[Timetable]] = relationship(
        back_populates="room", cascade="all, delete-orphan"
    )

    @property
    def building_id(self) -> int:
        return self.floor.building_id

    @property
    def building_name(self) -> str:
        return self.floor.building.name

    @property
    def floor_level(self) -> int:
        return self.floor.level

    @property
    def floor_name(self) -> str:
        return self.floor.name


class RoomPermittedUse(Base, TimestampMixin):
    __tablename__ = "room_permitted_uses"
    __table_args__ = (
        UniqueConstraint("room_id", "use_type", name="uq_room_permitted_uses"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(
        ForeignKey("rooms.id", ondelete="CASCADE"), index=True
    )
    use_type: Mapped[RoomUse] = mapped_column(room_use_enum, nullable=False)

    room: Mapped[Room] = relationship(back_populates="permitted_uses")
