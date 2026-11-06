"""Authentication, role permissions and account-management tests."""

from __future__ import annotations

from tests.conftest import ADMIN_EMAIL, STUDENT_EMAIL, TEST_PASSWORD, login


def test_login_me_and_invalid_password(client):
    headers = login(client, ADMIN_EMAIL)
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["email"] == ADMIN_EMAIL
    assert response.json()["role"] == "admin"

    wrong = client.post(
        "/api/v1/auth/login",
        json={"email": ADMIN_EMAIL, "password": "wrong-password"},
    )
    assert wrong.status_code == 401
    assert wrong.json()["error"]["code"] == "unauthorized"


def test_authentication_is_required(client):
    for path in ("/api/v1/rooms", "/api/v1/buildings", "/api/v1/bookings"):
        response = client.get(path)
        assert response.status_code == 401, path


def test_student_cannot_use_admin_endpoints(client, student_headers):
    branch = client.post(
        "/api/v1/branches",
        json={"code": "TESTBR", "name": "Test Branch"},
        headers=student_headers,
    )
    assert branch.status_code == 403

    students = client.get("/api/v1/students", headers=student_headers)
    assert students.status_code == 403

    user = client.post(
        "/api/v1/auth/users",
        json={
            "email": "another@example.com",
            "password": "Password123!",
            "full_name": "Another User",
            "role": "admin",
        },
        headers=student_headers,
    )
    assert user.status_code == 403


def test_faculty_can_read_students_but_not_create_them(
    client, faculty_headers, admin_headers
):
    listing = client.get("/api/v1/students", headers=faculty_headers)
    assert listing.status_code == 200
    assert listing.json()["total"] == 1

    created = client.post(
        "/api/v1/students",
        json={
            "enrollment_number": "TEST-FACULTY-DENIED",
            "full_name": "Denied Student",
            "branch_id": listing.json()["items"][0]["branch_id"],
            "academic_year": 1,
            "batch": "2025-2029",
        },
        headers=faculty_headers,
    )
    assert created.status_code == 403


def test_admin_can_create_users_and_roles(client, admin_headers):
    created = client.post(
        "/api/v1/auth/users",
        json={
            "email": "new.faculty@example.com",
            "password": "Password123!",
            "full_name": "New Faculty",
            "role": "faculty",
        },
        headers=admin_headers,
    )
    assert created.status_code == 201, created.text
    assert created.json()["role"] == "faculty"

    duplicate = client.post(
        "/api/v1/auth/users",
        json={
            "email": "new.faculty@example.com",
            "password": "Password123!",
            "full_name": "Duplicate",
            "role": "faculty",
        },
        headers=admin_headers,
    )
    assert duplicate.status_code == 409

    users = client.get("/api/v1/auth/users", headers=admin_headers)
    assert users.status_code == 200
    assert len(users.json()) == 4


def test_password_change_allows_new_password(client):
    headers = login(client, STUDENT_EMAIL)
    changed = client.post(
        "/api/v1/auth/change-password",
        json={
            "current_password": TEST_PASSWORD,
            "new_password": "BrandNewPass123!",
        },
        headers=headers,
    )
    assert changed.status_code == 200, changed.text

    old_login = client.post(
        "/api/v1/auth/login",
        json={"email": STUDENT_EMAIL, "password": TEST_PASSWORD},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/v1/auth/login",
        json={"email": STUDENT_EMAIL, "password": "BrandNewPass123!"},
    )
    assert new_login.status_code == 200

    wrong_current = client.post(
        "/api/v1/auth/change-password",
        json={
            "current_password": "not-the-password",
            "new_password": "AnotherPass123!",
        },
        headers=headers,
    )
    assert wrong_current.status_code == 422


def test_seeded_student_profile_is_linked(client, student_headers):
    response = client.get("/api/v1/students/me", headers=student_headers)
    assert response.status_code == 200, response.text
    assert response.json()["enrollment_number"] == "TEST-ENROLL-001"
    assert response.json()["branch_code"] == "CSE"


def test_default_faculty_login(client):
    res = client.post(
        "/api/v1/auth/faculty/login",
        json={"mobile_number": "1112223334", "password": "facultypassword123"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["mobile_number"] == "1112223334"
    assert body["user"]["name"] == "Prof. Faculty Member"

