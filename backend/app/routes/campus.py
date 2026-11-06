"""Building, floor and room endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies import get_current_principal, require_admin
from app.models.campus import Building, Floor, Room
from app.models.enums import RoomType, RoomUse
from app.schemas.campus import (
    BuildingCreate,
    BuildingDetail,
    BuildingRead,
    BuildingUpdate,
    FloorCreate,
    FloorRead,
    FloorUpdate,
    RoomCreate,
    RoomRead,
    RoomUpdate,
)
from app.services import campus_service

router = APIRouter(tags=["campus"])


# ---------------------------------------------------------------------------
# Buildings
# ---------------------------------------------------------------------------

@router.get("/buildings", response_model=list[BuildingRead])
def list_buildings(
    include_inactive: bool = False,
    _ = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> list[Building]:
    return campus_service.list_buildings(
        db, include_inactive=include_inactive
    )


@router.get("/buildings/{building_id}", response_model=BuildingDetail)
def get_building(
    building_id: int,
    _ = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> Building:
    return campus_service.get_building(db, building_id)


@router.post(
    "/buildings",
    response_model=BuildingDetail,
    status_code=status.HTTP_201_CREATED,
)
def create_building(
    payload: BuildingCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Building:
    return campus_service.create_building(db, payload)


@router.patch("/buildings/{building_id}", response_model=BuildingDetail)
def update_building(
    building_id: int,
    payload: BuildingUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Building:
    building = campus_service.get_building(db, building_id)
    return campus_service.update_building(db, building, payload)


# ---------------------------------------------------------------------------
# Floors
# ---------------------------------------------------------------------------

@router.get("/floors", response_model=list[FloorRead])
def list_floors(
    building_id: int | None = None,
    _ = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> list[Floor]:
    return campus_service.list_floors(db, building_id=building_id)


@router.get("/floors/{floor_id}", response_model=FloorRead)
def get_floor(
    floor_id: int,
    _ = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> Floor:
    return campus_service.get_floor(db, floor_id)


@router.post(
    "/floors", response_model=FloorRead, status_code=status.HTTP_201_CREATED
)
def create_floor(
    payload: FloorCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Floor:
    return campus_service.create_floor(db, payload)


@router.patch("/floors/{floor_id}", response_model=FloorRead)
def update_floor(
    floor_id: int,
    payload: FloorUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Floor:
    floor = campus_service.get_floor(db, floor_id)
    return campus_service.update_floor(db, floor, payload)


# ---------------------------------------------------------------------------
# Rooms
# ---------------------------------------------------------------------------

@router.get("/rooms", response_model=list[RoomRead])
def list_rooms(
    building_id: int | None = None,
    floor_id: int | None = None,
    room_type: RoomType | None = None,
    min_capacity: int | None = Query(default=None, ge=1),
    include_inactive: bool = False,
    _ = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> list[Room]:
    return campus_service.list_rooms(
        db,
        building_id=building_id,
        floor_id=floor_id,
        room_type=room_type,
        min_capacity=min_capacity,
        include_inactive=include_inactive,
    )


@router.get("/rooms/{room_id}", response_model=RoomRead)
def get_room(
    room_id: int,
    _ = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> Room:
    return campus_service.get_room(db, room_id)


@router.post(
    "/rooms", response_model=RoomRead, status_code=status.HTTP_201_CREATED
)
def create_room(
    payload: RoomCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Room:
    return campus_service.create_room(db, payload)


@router.patch("/rooms/{room_id}", response_model=RoomRead)
def update_room(
    room_id: int,
    payload: RoomUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Room:
    room = campus_service.get_room(db, room_id)
    return campus_service.update_room(db, room, payload)


@router.put("/rooms/{room_id}/permitted-uses", response_model=RoomRead)
def set_permitted_uses(
    room_id: int,
    uses: list[RoomUse],
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Room:
    room = campus_service.get_room(db, room_id)
    return campus_service.set_permitted_uses(db, room, uses)