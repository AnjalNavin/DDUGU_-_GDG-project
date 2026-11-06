"""Unit and integration tests for faculty booking conflict prevention rules.

Requirements:
1. Same faculty, different rooms, identical time: Reject.
2. Same faculty, different buildings, overlapping time: Reject.
3. Different faculty, same branch/year/section, identical time: Reject.
4. Different faculty, same cohort, partially overlapping time: Reject.
5. Different faculty, different cohorts, same time: Allow.
6. Same faculty, same room, non-overlapping time: Allow.
7. Same faculty, back-to-back bookings: Allow.
8. Cancelled booking followed by a new booking: Allow, provided no other conflict exists.
9. Two simultaneous requests attempting conflicting bookings: Only one should succeed.
"""

from __future__ import annotations

import time as py_time
from datetime import date
from threading import Barrier, Thread

import pytest
from tests.conftest import ADMIN_EMAIL, FACULTY_EMAIL, future_date, login

FACULTY_2_EMAIL = "faculty2@example.com"
FACULTY_2_PASS = "TestPass123!"


@pytest.fixture()
def faculty2_headers(client, db):
    from app.models.enums import UserRole
    from app.models.user import User
    from app.security import hash_password

    u = db.query(User).filter(User.email == FACULTY_2_EMAIL).one_or_none()
    if not u:
        u = User(
            email=FACULTY_2_EMAIL,
            password_hash=hash_password(FACULTY_2_PASS),
            full_name="Second Faculty Member",
            role=UserRole.faculty,
        )
        db.add(u)
        db.commit()
    return login(client, FACULTY_2_EMAIL, FACULTY_2_PASS)


def make_booking_payload(
    room_id: int,
    day: date | None = None,
    start_time: str = "10:00",
    end_time: str = "11:00",
    academic_year: int = 1,
    branch_code: str = "AI ML",
    section: str = "A",
    title: str = "Test Lecture",
    **kwargs,
):
    payload = {
        "room_id": room_id,
        "title": title,
        "use_type": "lecture",
        "booking_date": (day or future_date()).isoformat(),
        "start_time": start_time,
        "end_time": end_time,
        "academic_year": academic_year,
        "branch_code": branch_code,
        "section": section,
    }
    payload.update(kwargs)
    return payload


# ---------------------------------------------------------------------------
# Test 1: Same faculty, different rooms, identical time: Reject
# ---------------------------------------------------------------------------
def test_1_same_faculty_different_rooms_identical_time_reject(
    client, faculty_headers, room_ids
):
    target_date = future_date(10)
    # First booking: Classroom IET 15, 10:00-11:00
    res1 = client.post(
        "/api/v1/bookings",
        json=make_booking_payload(
            room_ids["IET15"],
            day=target_date,
            start_time="10:00",
            end_time="11:00",
            branch_code="CSE",
            section="A",
        ),
        headers=faculty_headers,
    )
    assert res1.status_code == 201, res1.text

    # Second booking: Same faculty, Classroom IET 24, 10:00-11:00
    res2 = client.post(
        "/api/v1/bookings",
        json=make_booking_payload(
            room_ids["IET24"],
            day=target_date,
            start_time="10:00",
            end_time="11:00",
            branch_code="ECE",
            section="B",
        ),
        headers=faculty_headers,
    )
    assert res2.status_code == 409, res2.text
    err = res2.json()["error"]["message"]
    assert err == "You have already booked another room during this time slot. Please choose a different time."


# ---------------------------------------------------------------------------
# Test 2: Same faculty, different buildings, overlapping time: Reject
# ---------------------------------------------------------------------------
def test_2_same_faculty_different_buildings_overlapping_time_reject(
    client, faculty_headers, room_ids
):
    target_date = future_date(11)
    # Booking in IET building (IET15) 10:00-11:00
    res1 = client.post(
        "/api/v1/bookings",
        json=make_booking_payload(
            room_ids["IET15"],
            day=target_date,
            start_time="10:00",
            end_time="11:00",
            branch_code="CSE",
            section="A",
        ),
        headers=faculty_headers,
    )
    assert res1.status_code == 201, res1.text

    # Booking in Deeksha Bhawan building (LH01) with partial overlap: 10:30-11:30
    res2 = client.post(
        "/api/v1/bookings",
        json=make_booking_payload(
            room_ids["LH01"],
            day=target_date,
            start_time="10:30",
            end_time="11:30",
            branch_code="ME",
            section="A",
        ),
        headers=faculty_headers,
    )
    assert res2.status_code == 409, res2.text
    assert res2.json()["error"]["message"] == (
        "You have already booked another room during this time slot. Please choose a different time."
    )


# ---------------------------------------------------------------------------
# Test 3: Different faculty, same branch/year/section, identical time: Reject
# ---------------------------------------------------------------------------
def test_3_different_faculty_same_cohort_identical_time_reject(
    client, faculty_headers, faculty2_headers, room_ids
):
    target_date = future_date(12)
    # Faculty 1 books IET 15 for 1st Year AI & ML Section A at 10:00-11:00
    res1 = client.post(
        "/api/v1/bookings",
        json=make_booking_payload(
            room_ids["IET15"],
            day=target_date,
            start_time="10:00",
            end_time="11:00",
            academic_year=1,
            branch_code="AI & ML",
            section="A",
        ),
        headers=faculty_headers,
    )
    assert res1.status_code == 201, res1.text

    # Faculty 2 attempts to book IET 24 for 1st Year AI & ML Section A at 10:00-11:00
    res2 = client.post(
        "/api/v1/bookings",
        json=make_booking_payload(
            room_ids["IET24"],
            day=target_date,
            start_time="10:00",
            end_time="11:00",
            academic_year=1,
            branch_code="AI & ML",
            section="A",
        ),
        headers=faculty2_headers,
    )
    assert res2.status_code == 409, res2.text
    assert res2.json()["error"]["message"] == (
        "This student section is already scheduled for another lecture during this time slot. Please choose a different time."
    )


# ---------------------------------------------------------------------------
# Test 4: Different faculty, same cohort, partially overlapping time: Reject
# ---------------------------------------------------------------------------
def test_4_different_faculty_same_cohort_partially_overlapping_time_reject(
    client, faculty_headers, faculty2_headers, room_ids
):
    target_date = future_date(13)
    # Faculty 1 books IET 15: 10:00-11:00 for 2nd Year CSE Section B
    res1 = client.post(
        "/api/v1/bookings",
        json=make_booking_payload(
            room_ids["IET15"],
            day=target_date,
            start_time="10:00",
            end_time="11:00",
            academic_year=2,
            branch_code="CSE",
            section="B",
        ),
        headers=faculty_headers,
    )
    assert res1.status_code == 201, res1.text

    # Faculty 2 attempts LH 01: 10:30-11:30 for 2nd Year CSE Section B
    res2 = client.post(
        "/api/v1/bookings",
        json=make_booking_payload(
            room_ids["LH01"],
            day=target_date,
            start_time="10:30",
            end_time="11:30",
            academic_year=2,
            branch_code="CSE",
            section="B",
        ),
        headers=faculty2_headers,
    )
    assert res2.status_code == 409, res2.text
    assert res2.json()["error"]["message"] == (
        "This student section is already scheduled for another lecture during this time slot. Please choose a different time."
    )


# ---------------------------------------------------------------------------
# Test 5: Different faculty, different cohorts, same time: Allow
# ---------------------------------------------------------------------------
def test_5_different_faculty_different_cohorts_same_time_allow(
    client, faculty_headers, faculty2_headers, room_ids
):
    target_date = future_date(14)
    # Faculty 1: IET 15, 10:00-11:00, 1st Year CSE-A
    res1 = client.post(
        "/api/v1/bookings",
        json=make_booking_payload(
            room_ids["IET15"],
            day=target_date,
            start_time="10:00",
            end_time="11:00",
            academic_year=1,
            branch_code="CSE",
            section="A",
        ),
        headers=faculty_headers,
    )
    assert res1.status_code == 201, res1.text

    # Faculty 2: IET 24, 10:00-11:00, 2nd Year ECE-A (Different room, faculty, cohort)
    res2 = client.post(
        "/api/v1/bookings",
        json=make_booking_payload(
            room_ids["IET24"],
            day=target_date,
            start_time="10:00",
            end_time="11:00",
            academic_year=2,
            branch_code="ECE",
            section="A",
        ),
        headers=faculty2_headers,
    )
    assert res2.status_code == 201, res2.text
    assert res2.json()["id"] != res1.json()["id"]


# ---------------------------------------------------------------------------
# Test 6: Same faculty, same room, non-overlapping time: Allow
# ---------------------------------------------------------------------------
def test_6_same_faculty_same_room_non_overlapping_time_allow(
    client, faculty_headers, room_ids
):
    target_date = future_date(15)
    # Session 1: 10:00-11:00
    res1 = client.post(
        "/api/v1/bookings",
        json=make_booking_payload(
            room_ids["IET15"],
            day=target_date,
            start_time="10:00",
            end_time="11:00",
            academic_year=1,
            branch_code="CSE",
            section="A",
        ),
        headers=faculty_headers,
    )
    assert res1.status_code == 201, res1.text

    # Session 2: Same room, same faculty, afternoon 14:00-15:00
    res2 = client.post(
        "/api/v1/bookings",
        json=make_booking_payload(
            room_ids["IET15"],
            day=target_date,
            start_time="14:00",
            end_time="15:00",
            academic_year=1,
            branch_code="CSE",
            section="A",
        ),
        headers=faculty_headers,
    )
    assert res2.status_code == 201, res2.text


# ---------------------------------------------------------------------------
# Test 7: Same faculty, back-to-back bookings: Allow
# ---------------------------------------------------------------------------
def test_7_same_faculty_back_to_back_bookings_allow(
    client, faculty_headers, room_ids
):
    target_date = future_date(16)
    # Slot 1: 10:00-11:00
    res1 = client.post(
        "/api/v1/bookings",
        json=make_booking_payload(
            room_ids["IET15"],
            day=target_date,
            start_time="10:00",
            end_time="11:00",
            academic_year=1,
            branch_code="CSE",
            section="A",
        ),
        headers=faculty_headers,
    )
    assert res1.status_code == 201, res1.text

    # Slot 2: 11:00-12:00 (ends exactly when slot 2 starts)
    res2 = client.post(
        "/api/v1/bookings",
        json=make_booking_payload(
            room_ids["IET24"],
            day=target_date,
            start_time="11:00",
            end_time="12:00",
            academic_year=1,
            branch_code="CSE",
            section="B",
        ),
        headers=faculty_headers,
    )
    assert res2.status_code == 201, res2.text


# ---------------------------------------------------------------------------
# Test 8: Cancelled booking followed by a new booking: Allow
# ---------------------------------------------------------------------------
def test_8_cancelled_booking_followed_by_new_booking_allow(
    client, faculty_headers, room_ids
):
    target_date = future_date(17)
    # Create booking
    res1 = client.post(
        "/api/v1/bookings",
        json=make_booking_payload(
            room_ids["IET15"],
            day=target_date,
            start_time="10:00",
            end_time="11:00",
            academic_year=1,
            branch_code="CSE",
            section="A",
        ),
        headers=faculty_headers,
    )
    assert res1.status_code == 201, res1.text
    booking_id = res1.json()["id"]

    # Cancel the booking
    cancel_res = client.post(
        f"/api/v1/bookings/{booking_id}/cancel",
        json={"reason": "Rescheduling session"},
        headers=faculty_headers,
    )
    assert cancel_res.status_code == 200, cancel_res.text

    # New booking at the exact same time slot by the same faculty and same cohort is now allowed
    res2 = client.post(
        "/api/v1/bookings",
        json=make_booking_payload(
            room_ids["IET15"],
            day=target_date,
            start_time="10:00",
            end_time="11:00",
            academic_year=1,
            branch_code="CSE",
            section="A",
        ),
        headers=faculty_headers,
    )
    assert res2.status_code == 201, res2.text


# ---------------------------------------------------------------------------
# Test 9: Two simultaneous requests attempting conflicting bookings: Only one succeeds
# ---------------------------------------------------------------------------
def test_9_simultaneous_requests_only_one_succeeds(
    client, faculty_headers, faculty2_headers, room_ids
):
    target_date = future_date(18)
    barrier = Barrier(2)
    results = {}

    def try_book(index: int, headers, room_code: str):
        try:
            barrier.wait(timeout=5)
            # Both attempt overlapping slot for same student cohort (1st Year AI ML Sec A)
            res = client.post(
                "/api/v1/bookings",
                json=make_booking_payload(
                    room_ids[room_code],
                    day=target_date,
                    start_time="10:00",
                    end_time="11:00",
                    academic_year=1,
                    branch_code="AI ML",
                    section="A",
                ),
                headers=headers,
            )
            results[index] = res.status_code
        except Exception as e:
            results[index] = str(e)

    t1 = Thread(target=try_book, args=(1, faculty_headers, "IET15"))
    t2 = Thread(target=try_book, args=(2, faculty2_headers, "IET24"))
    t1.start()
    t2.start()
    t1.join(timeout=10)
    t2.join(timeout=10)

    # Exactly one must succeed (201) and the other must be rejected with 409 Conflict
    status_codes = sorted(results.values())
    assert status_codes == [201, 409], f"Expected [201, 409] but got: {results}"
