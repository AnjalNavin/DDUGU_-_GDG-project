"""Admin faculty management tests."""

from __future__ import annotations

import io
from openpyxl import Workbook
import pytest


def test_admin_faculty_crud_and_status(client, admin_headers, student_headers):
    # 1. Student cannot access admin faculty endpoints (403 Forbidden)
    student_res = client.get("/api/v1/admin/faculty", headers=student_headers)
    assert student_res.status_code == 403

    # Unauthenticated access (401 Unauthorized)
    unauth_res = client.get("/api/v1/admin/faculty")
    assert unauth_res.status_code == 401

    # 2. Admin can create a new faculty member
    mobile = "9988776655"
    create_payload = {
        "mobile_number": mobile,
        "name": "Dr. Test Professor",
        "department": "Computer Science",
        "designation": "Associate Professor",
        "password": "TestPassword123!",
    }
    res = client.post("/api/v1/admin/faculty", json=create_payload, headers=admin_headers)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["mobile_number"] == mobile
    assert data["name"] == "Dr. Test Professor"
    assert data["is_active"] is True

    # 3. Duplicate mobile number fails with 409 Conflict
    dup_res = client.post("/api/v1/admin/faculty", json=create_payload, headers=admin_headers)
    assert dup_res.status_code == 409

    # 4. Faculty login works with the new credentials
    login_res = client.post(
        "/api/v1/auth/faculty/login",
        json={"mobile_number": mobile, "password": "TestPassword123!"},
    )
    assert login_res.status_code == 200, login_res.text
    assert login_res.json()["user"]["role"] == "faculty"

    # 5. Admin can deactivate the faculty account
    deactivate_res = client.patch(
        f"/api/v1/admin/faculty/{mobile}/status?is_active=false",
        headers=admin_headers,
    )
    assert deactivate_res.status_code == 200
    assert deactivate_res.json()["is_active"] is False

    # Deactivated faculty cannot login
    blocked_login = client.post(
        "/api/v1/auth/faculty/login",
        json={"mobile_number": mobile, "password": "TestPassword123!"},
    )
    assert blocked_login.status_code == 401
    err_body = blocked_login.json()
    err_msg = err_body.get("detail") or (err_body.get("error", {}).get("message", ""))
    assert "disabled" in err_msg.lower()

    # Re-activate
    reactivate_res = client.patch(
        f"/api/v1/admin/faculty/{mobile}/status?is_active=true",
        headers=admin_headers,
    )
    assert reactivate_res.status_code == 200
    assert reactivate_res.json()["is_active"] is True

    # 6. Admin can reset password
    reset_res = client.post(
        f"/api/v1/admin/faculty/{mobile}/reset-password",
        json={"password": "NewResetPassword456!"},
        headers=admin_headers,
    )
    assert reset_res.status_code == 200

    new_login = client.post(
        "/api/v1/auth/faculty/login",
        json={"mobile_number": mobile, "password": "NewResetPassword456!"},
    )
    assert new_login.status_code == 200

    # 7. Admin can update details including mobile number (atomic primary key change)
    new_mobile = "9988776656"
    update_res = client.patch(
        f"/api/v1/admin/faculty/{mobile}",
        json={
            "mobile_number": new_mobile,
            "name": "Dr. Updated Professor",
            "department": "Information Technology",
        },
        headers=admin_headers,
    )
    assert update_res.status_code == 200, update_res.text
    assert update_res.json()["mobile_number"] == new_mobile
    assert update_res.json()["name"] == "Dr. Updated Professor"

    # Old mobile no longer exists
    old_login = client.post(
        "/api/v1/auth/faculty/login",
        json={"mobile_number": mobile, "password": "NewResetPassword456!"},
    )
    assert old_login.status_code == 401

    # New mobile logs in
    new_mobile_login = client.post(
        "/api/v1/auth/faculty/login",
        json={"mobile_number": new_mobile, "password": "NewResetPassword456!"},
    )
    assert new_mobile_login.status_code == 200

    # 8. Admin can delete faculty
    del_res = client.delete(f"/api/v1/admin/faculty/{new_mobile}", headers=admin_headers)
    assert del_res.status_code == 204

    # Deleted faculty cannot log in
    after_del_login = client.post(
        "/api/v1/auth/faculty/login",
        json={"mobile_number": new_mobile, "password": "NewResetPassword456!"},
    )
    assert after_del_login.status_code == 401


def test_admin_faculty_excel_import(client, admin_headers):
    # Build a small in-memory .xlsx file with faculty data
    wb = Workbook()
    ws = wb.active
    ws.title = "Faculty"
    # Headers
    ws.append(["Name", "Department", "Designation", "Mobile Number"])
    ws.append(["Dr. Excel Alpha", "Computer Science", "Professor", "9111111111"])
    ws.append(["Dr. Excel Beta", "Mechanical Engineering", "Assistant Professor", "9222222222"])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    res = client.post(
        "/api/v1/admin/faculty/import",
        files={"file": ("faculty.xlsx", buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers=admin_headers,
    )
    assert res.status_code == 200, res.text
    summary = res.json()
    assert summary["imported"] >= 2 or (summary["created"] + summary["updated"]) >= 2

    # Clean up imported test faculty
    client.delete("/api/v1/admin/faculty/9111111111", headers=admin_headers)
    client.delete("/api/v1/admin/faculty/9222222222", headers=admin_headers)
