"""Faculty authentication and management services."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.academic import Faculty
from app.models.announcement import Announcement, AnnouncementTargetFaculty
from app.models.audit_log import AdminAuditLog
from app.models.booking import Booking
from app.models.conflict import ConflictReport
from app.models.timetable import Timetable
from app.schemas.faculty import FacultyCreate, FacultyImportRowError, FacultyImportSummary, FacultyUpdate
from app.security import hash_password, verify_password
from app.services.exceptions import ConflictError, NotFoundError, UnauthorizedError, ValidationError

if TYPE_CHECKING:
    from app.models.user import User


def get_faculty_by_mobile(db: Session, mobile_number: str) -> Faculty | None:
    """Get faculty by mobile number."""
    return db.get(Faculty, mobile_number)


def create_faculty(db: Session, data: FacultyCreate) -> Faculty:
    """Create a new faculty member with password."""
    mobile = data.mobile_number.strip()
    if get_faculty_by_mobile(db, mobile):
        raise ConflictError("Faculty with this mobile number already exists")

    faculty = Faculty(
        mobile_number=mobile,
        name=data.name.strip(),
        department=data.department.strip(),
        designation=data.designation.strip() if data.designation else None,
        password_hash=hash_password(data.password),
        is_active=True,
    )
    db.add(faculty)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError("Faculty with this mobile number already exists") from exc
    db.refresh(faculty)
    return faculty


def authenticate_faculty(db: Session, mobile_number: str, password: str) -> Faculty:
    """Authenticate a faculty member using mobile number and password."""
    faculty = get_faculty_by_mobile(db, mobile_number)
    if faculty is None or not verify_password(password, faculty.password_hash):
        raise UnauthorizedError("Invalid mobile number or password")
    if not faculty.is_active:
        raise UnauthorizedError("This account is disabled. Contact administrator.")
    return faculty


def update_faculty(
    db: Session, mobile_number: str, data: FacultyUpdate, admin: User | None = None
) -> Faculty:
    """Update faculty details, handling mobile number (primary key) changes atomically."""
    faculty = get_faculty_by_mobile(db, mobile_number)
    if faculty is None:
        raise NotFoundError("Faculty not found")

    new_mobile = data.mobile_number.strip() if data.mobile_number else None
    mobile_changed = new_mobile is not None and new_mobile != faculty.mobile_number

    if mobile_changed:
        if len(new_mobile) != 10 or not new_mobile.isdigit():
            raise ValidationError("Mobile number must be exactly 10 digits")
        if get_faculty_by_mobile(db, new_mobile):
            raise ConflictError("Faculty with this mobile number already exists")

    name = data.name.strip() if data.name is not None else faculty.name
    department = data.department.strip() if data.department is not None else faculty.department
    designation = (
        data.designation.strip()
        if data.designation is not None
        else faculty.designation
    )
    is_active = data.is_active if data.is_active is not None else faculty.is_active

    if not mobile_changed:
        faculty.name = name
        faculty.department = department
        faculty.designation = designation
        faculty.is_active = is_active
        try:
            db.commit()
            db.refresh(faculty)
            return faculty
        except IntegrityError as exc:
            db.rollback()
            raise ConflictError("Update failed due to conflict") from exc

    # Mobile number is changing: Primary Key update across all referencing tables
    old_mobile = faculty.mobile_number
    try:
        # Create new faculty entity first
        new_faculty = Faculty(
            mobile_number=new_mobile,
            name=name,
            department=department,
            designation=designation,
            password_hash=faculty.password_hash,
            is_active=is_active,
        )
        db.add(new_faculty)
        db.flush()

        # Update referencing tables
        # 1. Bookings
        db.execute(
            update(Booking)
            .where(Booking.faculty_mobile_number == old_mobile)
            .values(faculty_mobile_number=new_mobile)
        )
        # 2. Timetables
        db.execute(
            update(Timetable)
            .where(Timetable.faculty_mobile_number == old_mobile)
            .values(faculty_mobile_number=new_mobile)
        )
        # 3. Announcements created by faculty
        db.execute(
            update(Announcement)
            .where(Announcement.created_by_faculty_mobile == old_mobile)
            .values(created_by_faculty_mobile=new_mobile)
        )
        # 4. AnnouncementTargetFaculty
        db.execute(
            update(AnnouncementTargetFaculty)
            .where(AnnouncementTargetFaculty.faculty_mobile_number == old_mobile)
            .values(faculty_mobile_number=new_mobile)
        )
        # 5. Conflict reports
        db.execute(
            update(ConflictReport)
            .where(ConflictReport.reporter_faculty_mobile == old_mobile)
            .values(reporter_faculty_mobile=new_mobile)
        )

        # Delete old faculty
        db.delete(faculty)
        db.flush()

        # Audit log entry
        admin_id = getattr(admin, "id", None)
        admin_name = getattr(admin, "full_name", "Administrator")
        audit_entry = AdminAuditLog(
            admin_user_id=admin_id,
            admin_name=admin_name,
            action="UPDATE_FACULTY_MOBILE",
            target_type="faculty",
            target_id=new_mobile,
            details=f"Updated faculty mobile from {old_mobile} to {new_mobile} for {name}",
        )
        db.add(audit_entry)

        db.commit()
        db.refresh(new_faculty)
        return new_faculty
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(
            f"Failed to update mobile number due to integrity conflict: {exc}"
        ) from exc
    except Exception:
        db.rollback()
        raise


def set_faculty_status(db: Session, mobile_number: str, is_active: bool) -> Faculty:
    """Activate or deactivate a faculty account."""
    faculty = get_faculty_by_mobile(db, mobile_number)
    if faculty is None:
        raise NotFoundError("Faculty not found")
    faculty.is_active = is_active
    db.commit()
    db.refresh(faculty)
    return faculty


def reset_faculty_password(db: Session, mobile_number: str, new_password: str) -> Faculty:
    """Reset faculty password (admin only)."""
    faculty = get_faculty_by_mobile(db, mobile_number)
    if faculty is None:
        raise NotFoundError("Faculty not found")
    faculty.password_hash = hash_password(new_password)
    db.commit()
    db.refresh(faculty)
    return faculty


FACULTY_FIELD_ALIASES: dict[str, set[str]] = {
    "mobile_number": {"mobile_number", "mobile number", "mobile", "phone", "contact", "mobile_no", "contact_no", "mobilenumber", "phone_number"},
    "name": {"name", "full_name", "faculty_name", "faculty name", "faculty", "professor_name", "teacher_name"},
    "department": {"department", "dept", "branch", "branch_code"},
    "designation": {"designation", "post", "title", "role"},
}


def import_faculty_from_excel(db: Session, file_path: str) -> FacultyImportSummary:
    """Import faculty data from Excel file with robust column alias resolution."""
    import openpyxl
    import re

    def _normalize(val: str) -> str:
        return re.sub(r"[^a-z0-9]+", "_", str(val).strip().lower()).strip("_")

    wb = openpyxl.load_workbook(file_path)
    ws = wb.active

    total_rows = 0
    imported = 0
    skipped_duplicates = 0
    invalid_rows = 0
    errors: list[FacultyImportRowError] = []

    header_row = None
    col_mapping: dict[str, int] = {}

    for i, row in enumerate(ws.iter_rows(values_only=True), 1):
        if not row:
            continue
        mapping: dict[str, int] = {}
        for idx, cell in enumerate(row):
            if cell is None:
                continue
            norm = _normalize(str(cell))
            for canonical, aliases in FACULTY_FIELD_ALIASES.items():
                if norm in aliases or any(_normalize(a) == norm for a in aliases):
                    mapping[canonical] = idx
                    break
        if "mobile_number" in mapping and "name" in mapping and "department" in mapping:
            header_row = i
            col_mapping = mapping
            break

    if header_row is None:
        raise ValidationError("Excel file missing header row with required columns: mobile_number, name, department")

    # Process data rows
    for i, row in enumerate(ws.iter_rows(min_row=header_row + 1, values_only=True), header_row + 1):
        if not row or all(cell is None for cell in row):
            continue  # Skip empty rows

        total_rows += 1
        row_errors = []

        def get_val(canonical: str) -> str:
            idx = col_mapping.get(canonical)
            if idx is not None and idx < len(row) and row[idx] is not None:
                val = str(row[idx]).strip()
                # If Excel stored a float/int phone like 9876543210.0
                if canonical == "mobile_number" and val.endswith(".0"):
                    val = val[:-2]
                return val
            return ""

        # Extract values
        mobile_number = get_val("mobile_number")
        name = get_val("name")
        department = get_val("department")
        designation = get_val("designation") or None

        # Validate required fields
        if not mobile_number:
            row_errors.append("Missing mobile_number")
        elif not mobile_number.isdigit() or len(mobile_number) != 10:
            row_errors.append("Mobile number must be exactly 10 digits")

        if not name:
            row_errors.append("Missing name")

        if not department:
            row_errors.append("Missing department")

        if row_errors:
            invalid_rows += 1
            errors.append(FacultyImportRowError(row=i, mobile_number=mobile_number or None, errors=row_errors))
            continue

        # Check for duplicate in database
        existing = get_faculty_by_mobile(db, mobile_number)
        if existing:
            skipped_duplicates += 1
            errors.append(FacultyImportRowError(
                row=i,
                mobile_number=mobile_number,
                errors=[f"Duplicate mobile number (already exists: {existing.name})"]
            ))
            continue

        # Check for duplicate within the Excel file itself
        duplicate_in_file = any(
            e.mobile_number == mobile_number for e in errors if e.mobile_number
        )
        if duplicate_in_file:
            skipped_duplicates += 1
            errors.append(FacultyImportRowError(
                row=i,
                mobile_number=mobile_number,
                errors=["Duplicate mobile number within this import file"]
            ))
            continue

        # Import the faculty record (without password - admin must set later)
        try:
            faculty = Faculty(
                mobile_number=mobile_number,
                name=name,
                department=department,
                designation=designation,
                password_hash=None,  # No password on import - admin must assign
                is_active=False,  # Inactive by default - admin must activate
            )
            db.add(faculty)
            db.flush()  # Check for integrity errors
            imported += 1
        except IntegrityError as exc:
            db.rollback()
            invalid_rows += 1
            errors.append(FacultyImportRowError(
                row=i,
                mobile_number=mobile_number,
                errors=[f"Database error: {str(exc)}"]
            ))
            continue

    # Commit all successful imports
    if imported > 0:
        db.commit()
    else:
        db.rollback()

    return FacultyImportSummary(
        total_rows=total_rows,
        imported=imported,
        skipped_duplicates=skipped_duplicates,
        invalid_rows=invalid_rows,
        errors=errors,
    )


def delete_faculty(db: Session, mobile_number: str) -> None:
    """Permanently delete a faculty member."""
    faculty = get_faculty_by_mobile(db, mobile_number)
    if faculty is None:
        raise NotFoundError("Faculty not found")
    db.delete(faculty)
    db.commit()


def list_faculty(
    db: Session,
    search: str | None = None,
    department: str | None = None,
    is_active: bool | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Faculty]:
    """List faculty with optional filters."""
    query = select(Faculty)

    if search:
        search_term = f"%{search}%"
        query = query.where(
            (Faculty.name.ilike(search_term)) | (Faculty.mobile_number.ilike(search_term))
        )

    if department:
        query = query.where(Faculty.department == department)

    if is_active is not None:
        query = query.where(Faculty.is_active == is_active)

    query = query.order_by(Faculty.department, Faculty.name).offset(skip).limit(limit)
    return list(db.scalars(query))


def get_faculty_count(
    db: Session,
    search: str | None = None,
    department: str | None = None,
    is_active: bool | None = None,
) -> int:
    """Get total faculty count with optional filters."""
    query = select(Faculty)

    if search:
        search_term = f"%{search}%"
        query = query.where(
            (Faculty.name.ilike(search_term)) | (Faculty.mobile_number.ilike(search_term))
        )

    if department:
        query = query.where(Faculty.department == department)

    if is_active is not None:
        query = query.where(Faculty.is_active == is_active)

    return db.scalar(query.with_only_columns(Faculty.mobile_number).count()) or 0