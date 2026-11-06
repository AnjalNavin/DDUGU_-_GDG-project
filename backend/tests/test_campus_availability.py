"""Campus structure, seed data and availability search tests."""

from __future__ import annotations

from datetime import timedelta

from tests.conftest import future_date

IET_GROUND = {"Library", "Teachers' Office", "Placement Cell", "Director Office"}
IET_FIRST = {
    "Classroom IET 14",
    "Classroom IET 15",
    "Classroom IET 16",
    "Classroom IET 17",
    "Classroom IET 18",
    "Classroom IET 19",
    "Classroom IET 20",
    "Classroom IET 22",
}
IET_SECOND = {
    "Seminar Hall IET 32",
    "Classroom IET 23",
    "Classroom IET 24",
    "Classroom IET 25",
    "Classroom IET 28",
    "Classroom IET 29",
    "Classroom IET 30",
}
DB_GROUND = {f"LH{i:02d}" for i in range(1, 8)}
DB_FIRST = {f"LH{i:02d}" for i in range(8, 15)}


def test_seeded_campus_has_exact_buildings_floors_and_rooms(
    client, admin_headers
):
    response = client.get("/api/v1/buildings", headers=admin_headers)
    assert response.status_code == 200, response.text
    buildings = {item["code"]: item for item in response.json()}
    assert set(buildings) == {"IET", "DB"}

    iet = client.get(
        f"/api/v1/buildings/{buildings['IET']['id']}", headers=admin_headers
    ).json()
    db = client.get(
        f"/api/v1/buildings/{buildings['DB']['id']}", headers=admin_headers
    ).json()

    iet_floors = {floor["level"]: floor for floor in iet["floors"]}
    db_floors = {floor["level"]: floor for floor in db["floors"]}
    assert set(iet_floors) == {0, 1, 2}
    assert set(db_floors) == {0, 1}

    def names(floor):
        return {room["name"] for room in floor["rooms"]}

    assert names(iet_floors[0]) == IET_GROUND
    assert names(iet_floors[1]) == IET_FIRST
    assert names(iet_floors[2]) == IET_SECOND
    assert names(db_floors[0]) == DB_GROUND
    assert names(db_floors[1]) == DB_FIRST

    assert iet["room_count"] == 19
    assert db["room_count"] == 14
    assert iet["floor_count"] == 3
    assert db["floor_count"] == 2

    rooms = client.get("/api/v1/rooms", headers=admin_headers).json()
    assert len(rooms) == 33
    assert all(room["permitted_uses"] for room in rooms)


def test_availability_returns_all_rooms_when_no_filters(
    client, admin_headers
):
    day = future_date().isoformat()
    response = client.get(
        "/api/v1/availability",
        params={"date": day, "start_time": "10:00", "end_time": "11:00"},
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total"] == 33
    assert body["available"] == 33
    assert all(item["is_available"] for item in body["results"])


def test_availability_filters_by_building_floor_and_use(
    client, admin_headers
):
    buildings = {
        item["code"]: item
        for item in client.get(
            "/api/v1/buildings", headers=admin_headers
        ).json()
    }
    day = future_date().isoformat()
    base = {"date": day, "start_time": "10:00", "end_time": "11:00"}

    iet = client.get(
        "/api/v1/availability",
        params={**base, "building_id": buildings["IET"]["id"]},
        headers=admin_headers,
    ).json()
    assert iet["total"] == 19

    db = client.get(
        "/api/v1/availability",
        params={**base, "building_id": buildings["DB"]["id"]},
        headers=admin_headers,
    ).json()
    assert db["total"] == 14

    iet_floors = {
        floor["level"]: floor
        for floor in client.get(
            f"/api/v1/buildings/{buildings['IET']['id']}",
            headers=admin_headers,
        ).json()["floors"]
    }
    first_floor = client.get(
        "/api/v1/availability",
        params={**base, "floor_id": iet_floors[1]["id"]},
        headers=admin_headers,
    ).json()
    assert first_floor["total"] == 8

    library = client.get(
        "/api/v1/availability",
        params={**base, "use_type": "library"},
        headers=admin_headers,
    ).json()
    assert library["total"] == 1
    assert library["results"][0]["room_code"] == "Library"


def test_capacity_filter_uses_configurable_capacity(client, admin_headers):
    building = client.post(
        "/api/v1/buildings",
        json={"code": "TESTB", "name": "Test Building"},
        headers=admin_headers,
    )
    assert building.status_code == 201, building.text
    floor = client.post(
        "/api/v1/floors",
        json={
            "building_id": building.json()["id"],
            "level": 0,
            "name": "Test Ground",
        },
        headers=admin_headers,
    )
    assert floor.status_code == 201, floor.text
    room = client.post(
        "/api/v1/rooms",
        json={
            "floor_id": floor.json()["id"],
            "code": "TEST-ROOM-1",
            "name": "Test Room 1",
            "room_type": "classroom",
            "capacity": 40,
            "permitted_uses": ["lecture"],
        },
        headers=admin_headers,
    )
    assert room.status_code == 201, room.text

    day = future_date().isoformat()
    response = client.get(
        "/api/v1/availability",
        params={
            "date": day,
            "start_time": "10:00",
            "end_time": "11:00",
            "min_capacity": 40,
        },
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total"] == 1
    assert body["results"][0]["room_code"] == "TEST-ROOM-1"
    assert body["results"][0]["capacity"] == 40

    # Rooms whose capacity is unknown must be excluded when a minimum is set.
    too_large = client.get(
        "/api/v1/availability",
        params={
            "date": day,
            "start_time": "10:00",
            "end_time": "11:00",
            "min_capacity": 41,
        },
        headers=admin_headers,
    ).json()
    assert too_large["total"] == 0


def test_room_day_availability_reports_free_windows(
    client, admin_headers, room_ids
):
    day = future_date()
    booking = client.post(
        "/api/v1/bookings",
        json={
            "room_id": room_ids["IET20"],
            "title": "Occupied window",
            "use_type": "lecture",
            "academic_year": 1,
            "branch_code": "CSE",
            "section": "A",
            "booking_date": day.isoformat(),
            "start_time": "10:00",
            "end_time": "11:00",
        },
        headers=admin_headers,
    )
    assert booking.status_code == 201, booking.text

    response = client.get(
        f"/api/v1/availability/rooms/{room_ids['IET20']}",
        params={"date": day.isoformat()},
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body["busy"]) == 1
    assert body["busy"][0]["start_time"] == "10:00:00"
    windows = body["free_windows"]
    assert any(
        window["start_time"] == "07:00:00" and window["end_time"] == "10:00:00"
        for window in windows
    )
    assert any(
        window["start_time"] == "11:00:00" and window["end_time"] == "21:00:00"
        for window in windows
    )
