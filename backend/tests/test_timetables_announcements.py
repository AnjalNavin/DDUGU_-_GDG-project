"""Timetable conflict checks and announcement audience filtering tests."""

from __future__ import annotations

from datetime import date, timedelta

from tests.conftest import next_weekday


def timetable_payload(room_id: int, weekday: int, **overrides):
    payload = {
        "room_id": room_id,
        "subject": "Test Subject",
        "day_of_week": weekday,
        "start_time": "09:00",
        "end_time": "10:00",
        "valid_from": (date.today() - timedelta(days=30)).isoformat(),
    }
    payload.update(overrides)
    return payload


def test_timetable_conflicts_and_booking_availability(
    client, admin_headers, faculty_headers, room_ids
):
    weekday = next_weekday(0).weekday()  # Monday
    first = client.post(
        "/api/v1/timetables",
        json=timetable_payload(room_ids["IET32"], weekday),
        headers=faculty_headers,
    )
    assert first.status_code == 201, first.text
    timetable_id = first.json()["id"]
    assert first.json()["room_code"] == "IET32"

    # Overlapping timetable entry on the same room/day is rejected.
    overlap = client.post(
        "/api/v1/timetables",
        json=timetable_payload(
            room_ids["IET32"], weekday, start_time="09:30", end_time="10:30"
        ),
        headers=faculty_headers,
    )
    assert overlap.status_code == 409, overlap.text

    # Adjacent entry is allowed.
    adjacent = client.post(
        "/api/v1/timetables",
        json=timetable_payload(
            room_ids["IET32"], weekday, start_time="10:00", end_time="11:00"
        ),
        headers=faculty_headers,
    )
    assert adjacent.status_code == 201, adjacent.text

    class_day = next_weekday(0)
    availability = client.get(
        "/api/v1/availability",
        params={
            "date": class_day.isoformat(),
            "start_time": "09:15",
            "end_time": "09:45",
        },
        headers=admin_headers,
    )
    assert availability.status_code == 200, availability.text
    row = next(
        item
        for item in availability.json()["results"]
        if item["room_id"] == room_ids["IET32"]
    )
    assert row["is_available"] is False
    assert row["conflicts"][0]["source"] == "timetable"

    # A booking overlapping the timetable is rejected with a clear message.
    booking = client.post(
        "/api/v1/bookings",
        json={
            "room_id": room_ids["IET32"],
            "title": "Conflicting class",
            "use_type": "lecture",
            "academic_year": 1,
            "branch_code": "CSE",
            "section": "A",
            "booking_date": class_day.isoformat(),
            "start_time": "09:15",
            "end_time": "09:45",
        },
        headers=admin_headers,
    )
    assert booking.status_code == 409, booking.text
    assert "timetable" in booking.json()["error"]["message"].lower()

    # Deactivating the timetable releases the room.
    removed = client.delete(
        f"/api/v1/timetables/{timetable_id}", headers=faculty_headers
    )
    assert removed.status_code == 200, removed.text
    assert removed.json()["is_active"] is False

    rebooked = client.post(
        "/api/v1/bookings",
        json={
            "room_id": room_ids["IET32"],
            "title": "Now free",
            "use_type": "lecture",
            "academic_year": 1,
            "branch_code": "CSE",
            "section": "A",
            "booking_date": class_day.isoformat(),
            "start_time": "09:15",
            "end_time": "09:45",
        },
        headers=admin_headers,
    )
    assert rebooked.status_code == 201, rebooked.text


def test_students_cannot_manage_timetables(client, student_headers, room_ids):
    response = client.post(
        "/api/v1/timetables",
        json=timetable_payload(room_ids["IET24"], 0),
        headers=student_headers,
    )
    assert response.status_code == 403


def test_announcement_audience_filtering(
    client, admin_headers, faculty_headers, student_headers
):
    for audience in ("all", "students", "faculty", "admins"):
        created = client.post(
            "/api/v1/announcements",
            json={
                "title": f"Audience {audience}",
                "body": "Test announcement body",
                "audience": audience,
            },
            headers=admin_headers,
        )
        assert created.status_code == 201, created.text

    def titles(headers):
        response = client.get("/api/v1/announcements", headers=headers)
        assert response.status_code == 200, response.text
        return {item["title"] for item in response.json()}

    assert titles(student_headers) == {"Audience all", "Audience students"}
    assert titles(faculty_headers) == {"Audience all", "Audience faculty"}
    assert titles(admin_headers) == {
        "Audience all",
        "Audience students",
        "Audience faculty",
        "Audience admins",
    }


def test_announcement_building_filter_and_delete(
    client, admin_headers, student_headers
):
    buildings = {
        item["code"]: item
        for item in client.get("/api/v1/buildings", headers=admin_headers).json()
    }
    created = client.post(
        "/api/v1/announcements",
        json={
            "title": "IET notice",
            "body": "Specific to the IET building",
            "audience": "all",
            "building_id": buildings["IET"]["id"],
        },
        headers=admin_headers,
    )
    assert created.status_code == 201, created.text
    announcement_id = created.json()["id"]
    assert created.json()["building_name"] == "IET"

    filtered = client.get(
        "/api/v1/announcements",
        params={"building_id": buildings["DB"]["id"]},
        headers=student_headers,
    )
    assert filtered.status_code == 200
    assert filtered.json() == []

    # Students cannot delete announcements.
    denied = client.delete(
        f"/api/v1/announcements/{announcement_id}", headers=student_headers
    )
    assert denied.status_code == 403

    deleted = client.delete(
        f"/api/v1/announcements/{announcement_id}", headers=admin_headers
    )
    assert deleted.status_code == 200, deleted.text

    remaining = client.get("/api/v1/announcements", headers=admin_headers)
    assert all(item["id"] != announcement_id for item in remaining.json())


def test_expired_announcements_are_hidden_by_default(
    client, admin_headers, student_headers
):
    past = (date.today() - timedelta(days=1)).isoformat() + "T00:00:00Z"
    created = client.post(
        "/api/v1/announcements",
        json={
            "title": "Expired notice",
            "body": "This should be hidden",
            "audience": "all",
            "expires_at": past,
        },
        headers=admin_headers,
    )
    assert created.status_code == 201, created.text

    visible = client.get("/api/v1/announcements", headers=student_headers)
    assert all(item["title"] != "Expired notice" for item in visible.json())

    with_expired = client.get(
        "/api/v1/announcements",
        params={"include_expired": True},
        headers=student_headers,
    )
    assert any(item["title"] == "Expired notice" for item in with_expired.json())
