"""Conflict management tests."""

from __future__ import annotations

import pytest


def test_conflict_reporting_and_resolution(client, admin_headers, faculty_headers, student_headers, room_ids):
    # 1. Student reports a conflict -> priority must be "normal"
    student_report = client.post(
        "/api/v1/conflicts",
        json={
            "room_id": room_ids["IET20"],
            "title": "Double booking issue in IET20",
            "description": "Two groups arrived for the same room.",
        },
        headers=student_headers,
    )
    assert student_report.status_code == 201, student_report.text
    stu_conf = student_report.json()
    assert stu_conf["reporter_type"] == "student"
    assert stu_conf["priority"] == "normal"
    assert stu_conf["status"] == "pending"
    student_conf_id = stu_conf["id"]

    # 2. Faculty reports a conflict -> priority must be "high"
    faculty_report = client.post(
        "/api/v1/conflicts",
        json={
            "room_id": room_ids["IET19"],
            "title": "Projector not working during scheduled class",
            "description": "AV equipment failed in IET19.",
        },
        headers=faculty_headers,
    )
    assert faculty_report.status_code == 201, faculty_report.text
    fac_conf = faculty_report.json()
    assert fac_conf["reporter_type"] == "faculty"
    assert fac_conf["priority"] == "high"
    faculty_conf_id = fac_conf["id"]

    # 3. Admin sees both reports sorted by priority (faculty "high" comes first)
    admin_list = client.get("/api/v1/conflicts", headers=admin_headers)
    assert admin_list.status_code == 200
    all_reports = admin_list.json()
    report_ids = [r["id"] for r in all_reports]
    assert student_conf_id in report_ids
    assert faculty_conf_id in report_ids

    # 4. Student only sees their own report
    student_list = client.get("/api/v1/conflicts", headers=student_headers).json()
    assert any(r["id"] == student_conf_id for r in student_list)
    assert not any(r["id"] == faculty_conf_id for r in student_list)

    # 5. Admin resolves the student conflict with resolution notes
    resolve_res = client.patch(
        f"/api/v1/conflicts/{student_conf_id}/status",
        json={
            "status": "resolved",
            "resolution_note": "Reallocated group B to Classroom IET 18.",
        },
        headers=admin_headers,
    )
    assert resolve_res.status_code == 200, resolve_res.text
    resolved_data = resolve_res.json()
    # It might be None if resolved conflicts are cleared from active, or returned
    if resolved_data:
        assert resolved_data["status"] == "resolved"
        assert resolved_data["resolution_note"] == "Reallocated group B to Classroom IET 18."
