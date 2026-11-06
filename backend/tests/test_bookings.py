"""Booking lifecycle, conflicts, permissions and concurrency tests."""

from __future__ import annotations

from datetime import date, time, timedelta
from threading import Barrier, Thread

import pytest
from sqlalchemy import text

from tests.conftest import ADMIN_EMAIL, STUDENT_EMAIL, future_date


def booking_payload(room_id: int, day: date | None = None, **overrides):
    payload = {
        "room_id": room_id,
        "title": "Test booking",
        "use_type": "lecture",
        "booking_date": (day or future_date()).isoformat(),
        "start_time": "10:00",
        "end_time": "11:00",
        "academic_year": 1,
        "branch_code": "CSE",
        "section": "A",
    }
    payload.update(overrides)
    return payload


def count_bookings(client, headers, **params) -> int:
    response = client.get("/api/v1/bookings", params=params, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()["total"]


def test_create_booking_and_reject_overlap_with_alternatives(
    client, admin_headers, room_ids
):
    created = client.post(
        "/api/v1/bookings",
        json=booking_payload(room_ids["IET20"]),
        headers=admin_headers,
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["status"] == "pending"
    assert body["room_code"] == "IET20"
    assert body["building_name"] == "IET"

    overlap = client.post(
        "/api/v1/bookings",
        json=booking_payload(
            room_ids["IET20"], start_time="10:30", end_time="11:30"
        ),
        headers=admin_headers,
    )
    assert overlap.status_code == 409, overlap.text
    detail = overlap.json()["error"]["detail"]
    assert detail["conflicts"][0]["source"] == "booking"
    assert detail["alternatives"], "expected alternative rooms in the response"
    assert all(item["room_id"] != room_ids["IET20"] for item in detail["alternatives"])

    # End-to-start adjacency is not an overlap.
    adjacent = client.post(
        "/api/v1/bookings",
        json=booking_payload(
            room_ids["IET20"], start_time="11:00", end_time="12:00"
        ),
        headers=admin_headers,
    )
    assert adjacent.status_code == 201, adjacent.text

    availability = client.get(
        "/api/v1/availability",
        params={
            "date": future_date().isoformat(),
            "start_time": "10:00",
            "end_time": "11:00",
        },
        headers=admin_headers,
    ).json()
    iet20 = next(
        item for item in availability["results"] if item["room_id"] == room_ids["IET20"]
    )
    assert iet20["is_available"] is False
    assert iet20["conflicts"][0]["title"] == "Test booking"


def test_permitted_use_and_capacity_validation(
    client, admin_headers, room_ids
):
    library_lab = client.post(
        "/api/v1/bookings",
        json=booking_payload(room_ids["Library"], use_type="lab"),
        headers=admin_headers,
    )
    assert library_lab.status_code == 422
    assert "not permitted" in library_lab.json()["error"]["message"].lower()

    library_study = client.post(
        "/api/v1/bookings",
        json=booking_payload(room_ids["Library"], use_type="study"),
        headers=admin_headers,
    )
    assert library_study.status_code == 201, library_study.text

    # Capacity is configurable; it is set only inside this test and cleaned up.
    updated = client.patch(
        f"/api/v1/rooms/{room_ids['IET20']}",
        json={"capacity": 30},
        headers=admin_headers,
    )
    assert updated.status_code == 200, updated.text

    too_many = client.post(
        "/api/v1/bookings",
        json=booking_payload(
            room_ids["IET20"], expected_attendees=31, start_time="12:00",
            end_time="13:00",
        ),
        headers=admin_headers,
    )
    assert too_many.status_code == 422
    assert "capacity" in too_many.json()["error"]["message"].lower()

    fits = client.post(
        "/api/v1/bookings",
        json=booking_payload(
            room_ids["IET20"], expected_attendees=30, start_time="12:00",
            end_time="13:00",
        ),
        headers=admin_headers,
    )
    assert fits.status_code == 201, fits.text


def test_booking_window_and_past_date_validation(client, admin_headers, room_ids):
    past = client.post(
        "/api/v1/bookings",
        json=booking_payload(
            room_ids["IET20"], day=date.today() - timedelta(days=1)
        ),
        headers=admin_headers,
    )
    assert past.status_code == 422

    early = client.post(
        "/api/v1/bookings",
        json=booking_payload(
            room_ids["IET20"], start_time="05:00", end_time="06:00"
        ),
        headers=admin_headers,
    )
    assert early.status_code == 422

    late = client.post(
        "/api/v1/bookings",
        json=booking_payload(
            room_ids["IET20"], start_time="20:30", end_time="22:00"
        ),
        headers=admin_headers,
    )
    assert late.status_code == 422


def test_approval_cancellation_and_history(
    client, admin_headers, faculty_headers, student_headers, room_ids
):
    # Students cannot book campus rooms directly (Role-based restriction)
    student_denied = client.post(
        "/api/v1/bookings",
        json=booking_payload(room_ids["IET18"]),
        headers=student_headers,
    )
    assert student_denied.status_code == 403

    created = client.post(
        "/api/v1/bookings",
        json=booking_payload(room_ids["IET18"]),
        headers=faculty_headers,
    )
    assert created.status_code == 201, created.text
    booking_id = created.json()["id"]

    # Students cannot approve bookings.
    denied = client.post(
        f"/api/v1/bookings/{booking_id}/approve",
        json={},
        headers=student_headers,
    )
    assert denied.status_code == 403

    approved = client.post(
        f"/api/v1/bookings/{booking_id}/approve",
        json={"reason": "Approved for class"},
        headers=admin_headers,
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "approved"
    assert approved.json()["approved_by_id"] is not None

    history = client.get(
        f"/api/v1/bookings/{booking_id}/history", headers=faculty_headers
    )
    assert history.status_code == 200
    actions = [item["action"] for item in history.json()]
    assert actions == ["created", "approved"]

    cancelled = client.post(
        f"/api/v1/bookings/{booking_id}/cancel",
        json={"reason": "No longer needed"},
        headers=faculty_headers,
    )
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "cancelled"

    history = client.get(
        f"/api/v1/bookings/{booking_id}/history", headers=faculty_headers
    ).json()
    assert [item["action"] for item in history] == ["created", "approved", "cancelled"]

    # The slot is free again after cancellation.
    rebooked = client.post(
        "/api/v1/bookings",
        json=booking_payload(room_ids["IET18"]),
        headers=admin_headers,
    )
    assert rebooked.status_code == 201, rebooked.text


def test_rejection_frees_the_slot(client, admin_headers, room_ids):
    created = client.post(
        "/api/v1/bookings",
        json=booking_payload(room_ids["IET19"]),
        headers=admin_headers,
    )
    assert created.status_code == 201
    booking_id = created.json()["id"]

    rejected = client.post(
        f"/api/v1/bookings/{booking_id}/reject",
        json={"reason": "Room under maintenance"},
        headers=admin_headers,
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"
    assert rejected.json()["rejection_reason"] == "Room under maintenance"

    rebooked = client.post(
        "/api/v1/bookings",
        json=booking_payload(room_ids["IET19"]),
        headers=admin_headers,
    )
    assert rebooked.status_code == 201


def test_update_booking_checks_its_own_slot(client, admin_headers, room_ids):
    first = client.post(
        "/api/v1/bookings",
        json=booking_payload(room_ids["IET17"]),
        headers=admin_headers,
    )
    second = client.post(
        "/api/v1/bookings",
        json=booking_payload(
            room_ids["IET17"], start_time="12:00", end_time="13:00"
        ),
        headers=admin_headers,
    )
    assert first.status_code == second.status_code == 201
    second_id = second.json()["id"]

    conflict = client.patch(
        f"/api/v1/bookings/{second_id}",
        json={"start_time": "10:30", "end_time": "11:30"},
        headers=admin_headers,
    )
    assert conflict.status_code == 409

    renamed = client.patch(
        f"/api/v1/bookings/{second_id}",
        json={"title": "Renamed booking"},
        headers=admin_headers,
    )
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["title"] == "Renamed booking"


def test_students_only_see_their_own_bookings(
    client, db, admin_headers, student_headers, room_ids
):
    student_id = db.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": STUDENT_EMAIL},
    ).scalar_one()

    # Students cannot book directly via API
    denied = client.post(
        "/api/v1/bookings",
        json=booking_payload(room_ids["IET25"]),
        headers=student_headers,
    )
    assert denied.status_code == 403

    # An existing booking assigned to the student in DB
    from app.models.booking import Booking, BookingStatus

    mine_booking = Booking(
        room_id=room_ids["IET25"],
        booked_by_id=student_id,
        title="Student assigned booking",
        use_type="lecture",
        booking_date=future_date(),
        start_time=time(10, 0),
        end_time=time(11, 0),
        academic_year=1,
        branch_code="CSE",
        section="A",
        status=BookingStatus.approved.value,
    )
    db.add(mine_booking)
    db.commit()
    db.refresh(mine_booking)

    other = client.post(
        "/api/v1/bookings",
        json=booking_payload(
            room_ids["IET24"], start_time="12:00", end_time="13:00"
        ),
        headers=admin_headers,
    )
    assert other.status_code == 201, other.text

    student_list = client.get("/api/v1/bookings", headers=student_headers)
    assert student_list.status_code == 200
    assert student_list.json()["total"] == 1
    assert student_list.json()["items"][0]["id"] == mine_booking.id

    hidden = client.get(
        f"/api/v1/bookings/{other.json()['id']}", headers=student_headers
    )
    assert hidden.status_code == 403

    staff_list = client.get("/api/v1/bookings", headers=admin_headers)
    assert staff_list.json()["total"] == 2


def test_database_exclusion_constraint_blocks_concurrent_overlaps(
    test_engine, db, room_ids, admin_headers, client
):
    if test_engine.dialect.name != "postgresql":
        pytest.skip("Exclusion constraint requires PostgreSQL btree_gist extension")
    room_id = room_ids["IET20"]
    user_id = db.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": ADMIN_EMAIL},
    ).scalar_one()
    day = future_date()

    barrier = Barrier(2)
    results: dict[int, str] = {}
    insert_sql = text(
        """
        INSERT INTO bookings
            (room_id, booked_by_id, title, use_type, booking_date,
             start_time, end_time, status)
        VALUES
            (:room_id, :user_id, :title, 'lecture', :day,
             :start_time, :end_time, 'pending')
        """
    )

    def attempt(index: int, start: str, end: str) -> None:
        try:
            with test_engine.begin() as connection:
                barrier.wait(timeout=10)
                connection.execute(
                    insert_sql,
                    {
                        "room_id": room_id,
                        "user_id": user_id,
                        "title": f"Concurrent {index}",
                        "day": day,
                        "start_time": start,
                        "end_time": end,
                    },
                )
            results[index] = "committed"
        except Exception:
            results[index] = "rejected"

    threads = [
        Thread(target=attempt, args=(1, "14:00", "15:00")),
        Thread(target=attempt, args=(2, "14:30", "15:30")),
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=20)

    assert sorted(results.values()) == ["committed", "rejected"], results
    with test_engine.connect() as connection:
        count = connection.execute(
            text(
                "SELECT count(*) FROM bookings WHERE room_id = :room "
                "AND booking_date = :day"
            ),
            {"room": room_id, "day": day},
        ).scalar_one()
    assert count == 1


def test_student_cannot_cancel_someone_elses_booking(
    client, admin_headers, student_headers, room_ids
):
    booking = client.post(
        "/api/v1/bookings",
        json=booking_payload(room_ids["IET28"]),
        headers=admin_headers,
    )
    assert booking.status_code == 201

    denied = client.post(
        f"/api/v1/bookings/{booking.json()['id']}/cancel",
        json={},
        headers=student_headers,
    )
    assert denied.status_code == 403
