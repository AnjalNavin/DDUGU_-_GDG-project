"""Campus structure service plus the idempotent campus seed."""

from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.academic import Branch
from app.models.campus import Building, Floor, Room, RoomPermittedUse
from app.models.enums import RoomType, RoomUse
from app.schemas.campus import (
    BuildingCreate,
    BuildingUpdate,
    FloorCreate,
    FloorUpdate,
    RoomCreate,
    RoomUpdate,
)
from app.services.exceptions import ConflictError, NotFoundError

DEFAULT_PERMITTED_USES: dict[RoomType, list[RoomUse]] = {
    RoomType.lecture_hall: [
        RoomUse.lecture,
        RoomUse.exam,
        RoomUse.seminar,
        RoomUse.event,
    ],
    RoomType.classroom: [
        RoomUse.lecture,
        RoomUse.exam,
        RoomUse.seminar,
        RoomUse.meeting,
    ],
    RoomType.lab: [RoomUse.lab, RoomUse.seminar],
    RoomType.library: [RoomUse.library, RoomUse.study],
    RoomType.seminar: [RoomUse.seminar, RoomUse.meeting, RoomUse.lecture],
    RoomType.faculty_room: [RoomUse.meeting],
    RoomType.other: [RoomUse.meeting, RoomUse.event],
}


# ---------------------------------------------------------------------------
# Seed data: only the campus information supplied by the project owner.
# Capacities are deliberately NULL because they were not provided.
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class SeedRoom:
    code: str
    name: str
    room_type: RoomType
    capacity: int | None = None


@dataclass(frozen=True)
class SeedFloor:
    level: int
    name: str
    rooms: tuple[SeedRoom, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class SeedBuilding:
    code: str
    name: str
    description: str | None
    floors: tuple[SeedFloor, ...] = field(default_factory=tuple)


CAMPUS_SEED: tuple[SeedBuilding, ...] = (
    SeedBuilding(
        code="IET",
        name="IET",
        description="Institute of Engineering & Technology",
        floors=(
            SeedFloor(
                level=0,
                name="Ground Floor",
                rooms=(
                    SeedRoom("Library", "Library", RoomType.library, capacity=180),
                    SeedRoom("Teachers Office", "Teachers' Office", RoomType.faculty_room, capacity=None),
                    SeedRoom("Placement Cell", "Placement Cell", RoomType.other, capacity=None),
                    SeedRoom("Director Office", "Director Office", RoomType.other, capacity=None),
                ),
            ),
            SeedFloor(
                level=1,
                name="First Floor",
                rooms=(
                    SeedRoom("IET14", "Classroom IET 14", RoomType.classroom, capacity=75),
                    SeedRoom("IET15", "Classroom IET 15", RoomType.classroom, capacity=75),
                    SeedRoom("IET16", "Classroom IET 16", RoomType.classroom, capacity=75),
                    SeedRoom("IET17", "Classroom IET 17", RoomType.classroom, capacity=75),
                    SeedRoom("IET18", "Classroom IET 18", RoomType.classroom, capacity=75),
                    SeedRoom("IET19", "Classroom IET 19", RoomType.classroom, capacity=75),
                    SeedRoom("IET20", "Classroom IET 20", RoomType.classroom, capacity=75),
                    SeedRoom("IET22", "Classroom IET 22", RoomType.classroom, capacity=75),
                ),
            ),
            SeedFloor(
                level=2,
                name="Second Floor",
                rooms=(
                    SeedRoom("IET32", "Seminar Hall IET 32", RoomType.seminar, capacity=200),
                    SeedRoom("IET23", "Classroom IET 23", RoomType.classroom, capacity=75),
                    SeedRoom("IET24", "Classroom IET 24", RoomType.classroom, capacity=75),
                    SeedRoom("IET25", "Classroom IET 25", RoomType.classroom, capacity=75),
                    SeedRoom("IET28", "Classroom IET 28", RoomType.classroom, capacity=75),
                    SeedRoom("IET29", "Classroom IET 29", RoomType.classroom, capacity=75),
                    SeedRoom("IET30", "Classroom IET 30", RoomType.classroom, capacity=75),
                ),
            ),
        ),
    ),
    SeedBuilding(
        code="DB",
        name="Deeksha Bhawan",
        description="Central academic block",
        floors=(
            SeedFloor(
                level=0,
                name="Ground Floor",
                rooms=tuple(
                    SeedRoom(f"LH{i:02d}", f"LH{i:02d}", RoomType.lecture_hall, capacity=75)
                    for i in range(1, 8)
                ),
            ),
            SeedFloor(
                level=1,
                name="First Floor",
                rooms=tuple(
                    SeedRoom(f"LH{i:02d}", f"LH{i:02d}", RoomType.lecture_hall, capacity=75)
                    for i in range(8, 15)
                ),
            ),
        ),
    ),
)

BRANCH_SEED: tuple[tuple[str, str], ...] = (
    ("CSE", "Computer Science and Engineering"),
    ("AIML", "Artificial Intelligence and Machine Learning"),
    ("AIDS", "Artificial Intelligence and Data Science"),
    ("ECE", "Electronics and Communication Engineering"),
    ("ME", "Mechanical Engineering"),
    ("IT", "Information Technology"),
)


def seed_branches(db: Session) -> dict[str, int]:
    created = 0
    for code, name in BRANCH_SEED:
        if db.scalar(select(Branch).where(Branch.code == code)) is None:
            db.add(Branch(code=code, name=name))
            created += 1
    db.commit()
    return {"branches_created": created, "branches_total": len(BRANCH_SEED)}


def seed_campus(db: Session) -> dict[str, int]:
    created_buildings = created_floors = created_rooms = 0

    for building_seed in CAMPUS_SEED:
        building = db.scalar(
            select(Building).where(Building.code == building_seed.code)
        )
        if building is None:
            building = Building(
                code=building_seed.code,
                name=building_seed.name,
                description=building_seed.description,
            )
            db.add(building)
            db.flush()
            created_buildings += 1

        for floor_seed in building_seed.floors:
            floor = db.scalar(
                select(Floor).where(
                    Floor.building_id == building.id,
                    Floor.level == floor_seed.level,
                )
            )
            if floor is None:
                floor = Floor(
                    building_id=building.id,
                    level=floor_seed.level,
                    name=floor_seed.name,
                )
                db.add(floor)
                db.flush()
                created_floors += 1

            for room_seed in floor_seed.rooms:
                room = db.scalar(
                    select(Room).where(
                        Room.floor_id == floor.id,
                        Room.code == room_seed.code,
                    )
                )
                if room is None:
                    room = Room(
                        floor_id=floor.id,
                        code=room_seed.code,
                        name=room_seed.name,
                        room_type=room_seed.room_type,
                        capacity=room_seed.capacity,
                    )
                    db.add(room)
                    db.flush()
                    created_rooms += 1
                elif room.capacity != room_seed.capacity and room_seed.capacity is not None:
                    room.capacity = room_seed.capacity
                    db.flush()

                existing_uses = {
                    use.use_type
                    for use in db.scalars(
                        select(RoomPermittedUse).where(
                            RoomPermittedUse.room_id == room.id
                        )
                    )
                }
                for use in DEFAULT_PERMITTED_USES.get(
                    room_seed.room_type, [RoomUse.meeting]
                ):
                    if use not in existing_uses:
                        db.add(RoomPermittedUse(room_id=room.id, use_type=use))

    db.commit()
    return {
        "buildings_created": created_buildings,
        "floors_created": created_floors,
        "rooms_created": created_rooms,
    }


# ---------------------------------------------------------------------------
# Buildings
# ---------------------------------------------------------------------------

def list_buildings(db: Session, *, include_inactive: bool = False) -> list[Building]:
    stmt = (
        select(Building)
        .options(selectinload(Building.floors).selectinload(Floor.rooms))
        .order_by(Building.name)
    )
    if not include_inactive:
        stmt = stmt.where(Building.is_active.is_(True))
    return list(db.scalars(stmt))


def get_building(db: Session, building_id: int) -> Building:
    building = db.scalar(
        select(Building)
        .where(Building.id == building_id)
        .options(
            selectinload(Building.floors)
            .selectinload(Floor.rooms)
            .selectinload(Room.permitted_uses)
        )
    )
    if building is None:
        raise NotFoundError("Building not found")
    return building


def create_building(db: Session, data: BuildingCreate) -> Building:
    building = Building(**data.model_dump())
    db.add(building)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError("A building with this code already exists") from exc
    return get_building(db, building.id)


def update_building(db: Session, building: Building, data: BuildingUpdate) -> Building:
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(building, key, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError("A building with this code already exists") from exc
    return get_building(db, building.id)


def delete_building(db: Session, building: Building) -> None:
    db.delete(building)
    db.commit()


# ---------------------------------------------------------------------------
# Floors
# ---------------------------------------------------------------------------

def list_floors(db: Session, *, building_id: int | None = None) -> list[Floor]:
    stmt = (
        select(Floor)
        .options(
            selectinload(Floor.rooms).selectinload(Room.permitted_uses),
            selectinload(Floor.building),
        )
        .order_by(Floor.building_id, Floor.level)
    )
    if building_id is not None:
        stmt = stmt.where(Floor.building_id == building_id)
    return list(db.scalars(stmt))


def get_floor(db: Session, floor_id: int) -> Floor:
    floor = db.scalar(
        select(Floor)
        .where(Floor.id == floor_id)
        .options(
            selectinload(Floor.rooms).selectinload(Room.permitted_uses),
            selectinload(Floor.building),
        )
    )
    if floor is None:
        raise NotFoundError("Floor not found")
    return floor


def create_floor(db: Session, data: FloorCreate) -> Floor:
    if db.get(Building, data.building_id) is None:
        raise NotFoundError("Building not found")
    floor = Floor(**data.model_dump())
    db.add(floor)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(
            "This building already has a floor at that level"
        ) from exc
    return get_floor(db, floor.id)


def update_floor(db: Session, floor: Floor, data: FloorUpdate) -> Floor:
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(floor, key, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(
            "This building already has a floor at that level"
        ) from exc
    return get_floor(db, floor.id)


def delete_floor(db: Session, floor: Floor) -> None:
    db.delete(floor)
    db.commit()


# ---------------------------------------------------------------------------
# Rooms
# ---------------------------------------------------------------------------

def _sync_permitted_uses(
    db: Session, room: Room, uses: list[RoomUse]
) -> None:
    desired = set(uses)
    current = {item.use_type: item for item in room.permitted_uses}
    for use, item in current.items():
        if use not in desired:
            db.delete(item)
    for use in desired:
        if use not in current:
            db.add(RoomPermittedUse(room_id=room.id, use_type=use))


def list_rooms(
    db: Session,
    *,
    building_id: int | None = None,
    floor_id: int | None = None,
    room_type: RoomType | None = None,
    min_capacity: int | None = None,
    include_inactive: bool = False,
) -> list[Room]:
    stmt = (
        select(Room)
        .join(Floor, Room.floor_id == Floor.id)
        .options(
            selectinload(Room.permitted_uses),
            selectinload(Room.floor).selectinload(Floor.building),
        )
        .order_by(Floor.building_id, Floor.level, Room.name)
    )
    if building_id is not None:
        stmt = stmt.where(Floor.building_id == building_id)
    if floor_id is not None:
        stmt = stmt.where(Room.floor_id == floor_id)
    if room_type is not None:
        stmt = stmt.where(Room.room_type == room_type)
    if min_capacity is not None:
        stmt = stmt.where(Room.capacity.is_not(None), Room.capacity >= min_capacity)
    if not include_inactive:
        stmt = stmt.where(Room.is_active.is_(True))
    return list(db.scalars(stmt))


def get_room(db: Session, room_id: int) -> Room:
    room = db.scalar(
        select(Room)
        .where(Room.id == room_id)
        .options(
            selectinload(Room.permitted_uses),
            selectinload(Room.floor).selectinload(Floor.building),
        )
    )
    if room is None:
        raise NotFoundError("Room not found")
    return room


def create_room(db: Session, data: RoomCreate) -> Room:
    if db.get(Floor, data.floor_id) is None:
        raise NotFoundError("Floor not found")
    payload = data.model_dump(exclude={"permitted_uses"})
    room = Room(**payload)
    db.add(room)
    db.flush()
    uses = data.permitted_uses or DEFAULT_PERMITTED_USES.get(
        room.room_type, [RoomUse.meeting]
    )
    for use in dict.fromkeys(uses):
        db.add(RoomPermittedUse(room_id=room.id, use_type=use))
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(
            "A room with this code already exists on that floor"
        ) from exc
    return get_room(db, room.id)


def update_room(db: Session, room: Room, data: RoomUpdate) -> Room:
    values = data.model_dump(exclude_unset=True)
    uses = values.pop("permitted_uses", None)
    for key, value in values.items():
        setattr(room, key, value)
    if uses is not None:
        _sync_permitted_uses(db, room, uses)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(
            "A room with this code already exists on that floor"
        ) from exc
    return get_room(db, room.id)


def set_permitted_uses(
    db: Session, room: Room, uses: list[RoomUse]
) -> Room:
    _sync_permitted_uses(db, room, uses)
    db.commit()
    return get_room(db, room.id)


def delete_room(db: Session, room: Room) -> None:
    db.delete(room)
    db.commit()
