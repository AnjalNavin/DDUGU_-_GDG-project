"""CSV and Excel student imports with duplicate protection."""

from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass
from pathlib import Path

from openpyxl import load_workbook
from pydantic import EmailStr, TypeAdapter, ValidationError as PydanticValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.academic import Branch, Student, StudentGroup
from app.schemas.academic import ImportErrorItem, ImportResult
from app.services.exceptions import ValidationError

EMAIL_ADAPTER = TypeAdapter(EmailStr)

FIELD_ALIASES: dict[str, set[str]] = {
    "enrollment_number": {
        "enrollment_number",
        "enrollment_no",
        "enrollment",
        "enrollmentnumber",
        "roll_number",
        "roll_no",
    },
    "full_name": {"full_name", "name", "student_name", "studentname"},
    "email": {"email", "email_address", "mail"},
    "phone": {"phone", "mobile", "contact", "phone_number"},
    "branch_code": {"branch_code", "branch", "department", "dept", "programme"},
    "academic_year": {"academic_year", "year", "study_year", "current_year"},
    "batch": {"batch", "batch_year", "admission_batch", "admission_year"},
    "section": {"section", "sec"},
    "group_name": {"group", "group_name", "student_group", "class"},
}

REQUIRED_FIELDS = (
    "enrollment_number",
    "full_name",
    "branch_code",
    "academic_year",
    "batch",
)


@dataclass
class RawRow:
    number: int
    values: dict[str, str]


def _normalise_header(value: object) -> str:
    text = str(value or "").strip().lower()
    return re.sub(r"[\s\-]+", "_", text)


def _header_map(headers: list[object]) -> tuple[dict[int, str], list[str]]:
    mapping: dict[int, str] = {}
    for index, header in enumerate(headers):
        normalised = _normalise_header(header)
        if not normalised:
            continue
        for field, aliases in FIELD_ALIASES.items():
            if normalised in aliases:
                mapping[index] = field
                break
    found = set(mapping.values())
    missing = [field for field in REQUIRED_FIELDS if field not in found]
    return mapping, missing


def _rows_from_csv(content: bytes) -> list[RawRow]:
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("cp1252", errors="replace")
    reader = list(csv.reader(io.StringIO(text)))
    return _build_rows(reader)


def _rows_from_xlsx(content: bytes) -> list[RawRow]:
    workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    sheet = workbook.active
    raw = [list(row) for row in sheet.iter_rows(values_only=True)]
    workbook.close()
    return _build_rows(raw)


def _build_rows(raw_rows: list[list[object]]) -> list[RawRow]:
    header_index = None
    for index, row in enumerate(raw_rows):
        if any(str(cell or "").strip() for cell in row):
            header_index = index
            break
    if header_index is None:
        raise ValidationError("The uploaded file is empty")

    headers = raw_rows[header_index]
    mapping, missing = _header_map(headers)
    if missing:
        raise ValidationError(
            "Missing required column(s): " + ", ".join(sorted(missing))
        )

    rows: list[RawRow] = []
    for offset, raw in enumerate(raw_rows[header_index + 1 :], start=1):
        if not any(str(cell or "").strip() for cell in raw):
            continue
        values: dict[str, str] = {}
        for index, field in mapping.items():
            cell = raw[index] if index < len(raw) else None
            values[field] = str(cell).strip() if cell is not None else ""
        rows.append(RawRow(number=header_index + 1 + offset, values=values))
    return rows


def _parse_rows(content: bytes, filename: str) -> list[RawRow]:
    suffix = Path(filename or "").suffix.lower()
    if suffix == ".csv":
        return _rows_from_csv(content)
    if suffix in {".xlsx", ".xlsm"}:
        return _rows_from_xlsx(content)
    raise ValidationError("Only .csv, .xlsx and .xlsm files are supported")


def _find_group(
    groups: list[StudentGroup],
    branch_id: int,
    academic_year: int,
    batch: str,
    section: str | None,
    group_name: str | None,
) -> StudentGroup | None:
    branch_groups = [group for group in groups if group.branch_id == branch_id]
    if group_name:
        matches = [
            group
            for group in branch_groups
            if group.name.strip().lower() == group_name.strip().lower()
        ]
        return matches[0] if len(matches) == 1 else None
    matches = [
        group
        for group in branch_groups
        if group.academic_year == academic_year
        and group.batch == batch
        and (group.section or None) == (section or None)
    ]
    return matches[0] if len(matches) == 1 else None


def import_students(db: Session, content: bytes, filename: str) -> ImportResult:
    rows = _parse_rows(content, filename)

    branches = {branch.code.upper(): branch for branch in db.scalars(select(Branch))}
    groups = list(db.scalars(select(StudentGroup)))
    existing_enrollments = set(
        db.scalars(select(Student.enrollment_number))
    )
    existing_emails = {
        email.lower()
        for email in db.scalars(select(Student.email).where(Student.email.is_not(None)))
        if email
    }

    seen_enrollments: set[str] = set()
    seen_emails: set[str] = set()
    created = 0
    skipped = 0
    errors: list[ImportErrorItem] = []

    for row in rows:
        values = row.values
        enrollment = values.get("enrollment_number", "").strip()
        full_name = values.get("full_name", "").strip()
        branch_code = values.get("branch_code", "").strip().upper()
        year_raw = values.get("academic_year", "").strip()
        batch = values.get("batch", "").strip()
        section_raw = values.get("section", "").strip().upper() or None
        email_raw = values.get("email", "").strip().lower() or None
        phone = values.get("phone", "").strip() or None
        group_name = values.get("group_name", "").strip() or None

        if not enrollment:
            errors.append(
                ImportErrorItem(row=row.number, message="Missing enrollment number")
            )
            continue
        if not full_name:
            errors.append(
                ImportErrorItem(
                    row=row.number,
                    enrollment_number=enrollment,
                    message="Missing full name",
                )
            )
            continue
        branch = branches.get(branch_code)
        if branch is None:
            errors.append(
                ImportErrorItem(
                    row=row.number,
                    enrollment_number=enrollment,
                    message=f"Unknown branch code: {branch_code or '(blank)'}",
                )
            )
            continue
        try:
            academic_year = int(float(year_raw)) if year_raw else 0
        except ValueError:
            academic_year = 0
        if not 1 <= academic_year <= 4:
            errors.append(
                ImportErrorItem(
                    row=row.number,
                    enrollment_number=enrollment,
                    message="academic_year must be 1, 2, 3 or 4",
                )
            )
            continue
        if not batch:
            errors.append(
                ImportErrorItem(
                    row=row.number,
                    enrollment_number=enrollment,
                    message="Missing batch",
                )
            )
            continue
        if section_raw is not None and section_raw not in {"A", "B"}:
            errors.append(
                ImportErrorItem(
                    row=row.number,
                    enrollment_number=enrollment,
                    message="section must be A or B",
                )
            )
            continue

        email: str | None = None
        if email_raw:
            try:
                email = str(EMAIL_ADAPTER.validate_python(email_raw)).lower()
            except PydanticValidationError:
                errors.append(
                    ImportErrorItem(
                        row=row.number,
                        enrollment_number=enrollment,
                        message=f"Invalid email: {email_raw}",
                    )
                )
                continue

        if enrollment in seen_enrollments:
            skipped += 1
            errors.append(
                ImportErrorItem(
                    row=row.number,
                    enrollment_number=enrollment,
                    message="Duplicate enrollment number in file",
                )
            )
            continue
        if enrollment in existing_enrollments:
            skipped += 1
            errors.append(
                ImportErrorItem(
                    row=row.number,
                    enrollment_number=enrollment,
                    message="Enrollment number already exists",
                )
            )
            continue
        if email and (email in seen_emails or email in existing_emails):
            errors.append(
                ImportErrorItem(
                    row=row.number,
                    enrollment_number=enrollment,
                    message=f"Email already exists: {email}",
                )
            )
            continue

        group = _find_group(
            groups, branch.id, academic_year, batch, section_raw, group_name
        )
        if group_name and group is None:
            errors.append(
                ImportErrorItem(
                    row=row.number,
                    enrollment_number=enrollment,
                    message=f"Student group not found: {group_name}",
                )
            )
            continue

        student = Student(
            enrollment_number=enrollment,
            full_name=full_name,
            email=email,
            phone=phone,
            branch_id=branch.id,
            student_group_id=group.id if group else None,
            academic_year=academic_year,
            batch=batch,
            section=section_raw,
        )
        try:
            with db.begin_nested():
                db.add(student)
                db.flush()
        except IntegrityError:
            if student in db:
                db.expunge(student)
            skipped += 1
            errors.append(
                ImportErrorItem(
                    row=row.number,
                    enrollment_number=enrollment,
                    message="Enrollment number or email already exists",
                )
            )
            continue

        created += 1
        seen_enrollments.add(enrollment)
        if email:
            seen_emails.add(email)

    db.commit()
    return ImportResult(
        created=created,
        skipped=skipped,
        total_rows=len(rows),
        errors=errors,
    )
