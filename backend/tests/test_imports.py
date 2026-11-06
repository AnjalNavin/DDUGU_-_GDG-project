"""CSV and Excel student import tests using clearly fake test data."""

from __future__ import annotations

import io

from openpyxl import Workbook

CSV_HEADER = (
    "enrollment_number,full_name,email,branch_code,"
    "academic_year,batch,section\n"
)


def upload_csv(client, headers, content: str, filename: str = "students.csv"):
    return client.post(
        "/api/v1/students/import",
        files={"file": (filename, content.encode("utf-8"), "text/csv")},
        headers=headers,
    )


def test_csv_import_creates_valid_rows_and_reports_errors(
    client, admin_headers
):
    content = CSV_HEADER + (
        "TEST-IMP-001,Import One,test.import1@example.com,CSE,1,2025-2029,A\n"
        # Duplicate enrollment inside the same file.
        "TEST-IMP-001,Import Duplicate,test.import2@example.com,CSE,1,2025-2029,A\n"
        # Already present in the test database.
        "TEST-ENROLL-001,Existing Student,,CSE,2,2024-2028,A\n"
        # Unknown branch code.
        "TEST-IMP-004,Import Unknown Branch,,NOPE,1,2025-2029,A\n"
        # Invalid academic year.
        "TEST-IMP-005,Import Bad Year,,CSE,9,2025-2029,A\n"
    )
    response = upload_csv(client, admin_headers, content)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["created"] == 1
    assert body["skipped"] == 2
    assert body["total_rows"] == 5

    messages = " | ".join(error["message"] for error in body["errors"])
    assert "Duplicate enrollment number in file" in messages
    assert "Enrollment number already exists" in messages
    assert "Unknown branch code" in messages
    assert "academic_year must be 1, 2, 3 or 4" in messages

    listing = client.get(
        "/api/v1/students", params={"search": "TEST-IMP"}, headers=admin_headers
    ).json()
    assert listing["total"] == 1
    assert listing["items"][0]["enrollment_number"] == "TEST-IMP-001"


def test_reimporting_the_same_file_does_not_duplicate_students(
    client, admin_headers
):
    content = CSV_HEADER + (
        "TEST-IMP-010,Import Repeat,test.repeat@example.com,IT,3,2023-2027,B\n"
    )
    first = upload_csv(client, admin_headers, content)
    assert first.status_code == 200, first.text
    assert first.json()["created"] == 1

    second = upload_csv(client, admin_headers, content)
    assert second.status_code == 200, second.text
    body = second.json()
    assert body["created"] == 0
    assert body["skipped"] == 1
    assert body["errors"][0]["message"] == "Enrollment number already exists"


def test_xlsx_import_and_section_validation(client, admin_headers):
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(
        [
            "Enrollment No",
            "Name",
            "Email",
            "Department",
            "Year",
            "Admission Batch",
            "Sec",
        ]
    )
    sheet.append(
        ["TEST-XLSX-001", "Sheet Student", "test.sheet@example.com", "ECE", 2, "2024-2028", "B"]
    )
    sheet.append(
        ["TEST-XLSX-002", "Bad Section", "", "ME", 1, "2025-2029", "C"]
    )
    buffer = io.BytesIO()
    workbook.save(buffer)
    workbook.close()

    response = client.post(
        "/api/v1/students/import",
        files={
            "file": (
                "students.xlsx",
                buffer.getvalue(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["created"] == 1
    assert body["total_rows"] == 2
    assert any("section must be A or B" in e["message"] for e in body["errors"])

    listing = client.get(
        "/api/v1/students",
        params={"search": "Sheet Student"},
        headers=admin_headers,
    ).json()
    assert listing["total"] == 1
    assert listing["items"][0]["branch_code"] == "ECE"
    assert listing["items"][0]["section"] == "B"


def test_import_rejects_unsupported_files_and_missing_columns(
    client, admin_headers
):
    unsupported = upload_csv(
        client, admin_headers, "anything", filename="students.txt"
    )
    assert unsupported.status_code == 422

    missing_columns = upload_csv(
        client, admin_headers, "full_name,batch\nOnly A Name,2025-2029\n"
    )
    assert missing_columns.status_code == 422
    assert "Missing required column" in missing_columns.json()["error"]["message"]
