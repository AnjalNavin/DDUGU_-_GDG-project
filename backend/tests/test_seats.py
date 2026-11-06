"""Seat reservation functional and security tests."""

from __future__ import annotations

import pytest
from datetime import timedelta
from tests.conftest import future_date


def test_seat_reservation_flow(client, admin_headers, faculty_headers, student_headers, room_ids):
    # 1. Faculty creates a lecture booking for Year 1, CSE, Section A
    day = future_date()
    create_booking_res = client.post(
        "/api/v1/bookings",
        json={
            "room_id": room_ids["IET20"],
            "title": "Data Structures Lecture",
            "use_type": "lecture",
            "academic_year": 1,
            "branch_code": "CSE",
            "section": "A",
            "booking_date": day.isoformat(),
            "start_time": "14:00",
            "end_time": "15:00",
        },
        headers=faculty_headers,
    )
    assert create_booking_res.status_code == 201, create_booking_res.text
    booking_id = create_booking_res.json()["id"]

    # 2. Check seat availability for this lecture
    avail_res = client.get(f"/api/v1/seats/availability/{booking_id}", headers=student_headers)
    assert avail_res.status_code == 200
    avail_data = avail_res.json()
    assert avail_data["total_occupied"] == 0
    assert avail_data["total_available"] == avail_data["capacity"]

    # 3. Faculty cannot reserve seats (403 Forbidden)
    fac_reserve = client.post(
        "/api/v1/seats/reserve",
        json={
            "booking_id": booking_id,
            "academic_year": 1,
            "branch_code": "CSE",
            "section": "A",
            "seat_number": 5,
        },
        headers=faculty_headers,
    )
    assert fac_reserve.status_code == 403

    # 4. Student with wrong cohort cannot reserve seat (403 Forbidden)
    wrong_cohort = client.post(
        "/api/v1/seats/reserve",
        json={
            "booking_id": booking_id,
            "academic_year": 2,  # Lecture is Year 1
            "branch_code": "CSE",
            "section": "A",
            "seat_number": 5,
        },
        headers=student_headers,
    )
    assert wrong_cohort.status_code == 403

    # 5. Eligible student successfully reserves seat 5
    reserve_res = client.post(
        "/api/v1/seats/reserve",
        json={
            "booking_id": booking_id,
            "academic_year": 1,
            "branch_code": "CSE",
            "section": "A",
            "seat_number": 5,
        },
        headers=student_headers,
    )
    assert reserve_res.status_code == 201, reserve_res.text
    res_data = reserve_res.json()
    assert res_data["seat_number"] == 5
    assert res_data["status"] == "active"
    reservation_id = res_data["id"]

    # 6. Same student reserving again for same lecture fails with 409 Conflict
    dup_student_res = client.post(
        "/api/v1/seats/reserve",
        json={
            "booking_id": booking_id,
            "academic_year": 1,
            "branch_code": "CSE",
            "section": "A",
            "seat_number": 6,
        },
        headers=student_headers,
    )
    assert dup_student_res.status_code == 409
    assert "already have an active seat reservation" in dup_student_res.json()["error"]["message"]

    # 7. Student can cancel their reservation
    cancel_res = client.post(f"/api/v1/seats/reservations/{reservation_id}/cancel", headers=student_headers)
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"

    # Availability reflects cancellation
    after_cancel_avail = client.get(f"/api/v1/seats/availability/{booking_id}", headers=student_headers)
    assert after_cancel_avail.status_code == 200
    assert 5 not in after_cancel_avail.json()["occupied_seats"]
