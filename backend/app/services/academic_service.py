"""Branches, student groups, students and faculty services."""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import Select, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.academic import Branch, Faculty, Student, StudentGroup
from app.schemas.academic import (
    BranchCreate,
    BranchUpdate,
    StudentCreate,
    StudentGroupCreate,
    StudentGroupUpdate,
    StudentUpdate,
)
from app.services.exceptions import ConflictError, NotFoundError, ValidationError


# ---------------------------------------------------------------------------
# Branches
# ---------------------------------------------------------------------------

def list_branches(
    db: Session, *, include_inactive: bool = False
) -> list[Branch]:
    stmt = select(Branch).order_by(Branch.code)
    if not include_inactive:
        stmt = stmt.where(Branch.is_active.is_(True))
    return list(db.scalars(stmt))


def get_branch(db: Session, branch_id: int) -> Branch:
    branch = db.get(Branch, branch_id)
    if branch is None:
        raise NotFoundError("Branch not found")
    return branch


def create_branch(db: Session, data: BranchCreate) -> Branch:
    branch = Branch(**data.model_dump())
    db.add(branch)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError("A branch with this code already exists") from exc
    db.refresh(branch)
    return branch


def update_branch(db: Session, branch: Branch, data: BranchUpdate) -> Branch:
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(branch, key, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError("A branch with this code already exists") from exc
    db.refresh(branch)
    return branch


# ---------------------------------------------------------------------------
# Student groups
# ---------------------------------------------------------------------------

def _build_group_name(
    branch: Branch, academic_year: int, batch: str, section: str | None
) -> str:
    suffix = f" - {section}" if section else ""
    return f"{branch.code} {batch} Year {academic_year}{suffix}"


def list_student_groups(
    db: Session,
    *,
    branch_id: int | None = None,
    academic_year: int | None = None,
    batch: str | None = None,
    include_inactive: bool = False,
) -> list[StudentGroup]:
    stmt = (
        select(StudentGroup)
        .options(selectinload(StudentGroup.branch))
        .order_by(StudentGroup.branch_id, StudentGroup.academic_year, StudentGroup.batch)
    )
    if branch_id is not None:
        stmt = stmt.where(StudentGroup.branch_id == branch_id)
    if academic_year is not None:
        stmt = stmt.where(StudentGroup.academic_year == academic_year)
    if batch is not None:
        stmt = stmt.where(StudentGroup.batch == batch)
    if not include_inactive:
        stmt = stmt.where(StudentGroup.is_active.is_(True))
    return list(db.scalars(stmt))


def get_student_group(db: Session, group_id: int) -> StudentGroup:
    group = db.scalar(
        select(StudentGroup)
        .where(StudentGroup.id == group_id)
        .options(selectinload(StudentGroup.branch))
    )
    if group is None:
        raise NotFoundError("Student group not found")
    return group


def create_student_group(db: Session, data: StudentGroupCreate) -> StudentGroup:
    branch = get_branch(db, data.branch_id)
    name = getattr(data, "name", None) or _build_group_name(
        branch, data.academic_year, data.batch, data.section
    )
    group = StudentGroup(
        branch_id=branch.id,
        name=name,
        academic_year=data.academic_year,
        batch=data.batch,
        section=data.section,
    )
    db.add(group)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(
            "This branch already has a group for that year, batch and section"
        ) from exc
    return get_student_group(db, group.id)


def update_student_group(
    db: Session, group: StudentGroup, data: StudentGroupUpdate
) -> StudentGroup:
    values = data.model_dump(exclude_unset=True)
    section = values.get("section")
    if section is not None:
        section = section.strip().upper()
        if section not in {"A", "B"}:
            raise ValidationError("section must be A or B")
        values["section"] = section
    for key, value in values.items():
        setattr(group, key, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(
            "This branch already has a group for that year, batch and section"
        ) from exc
    return get_student_group(db, group.id)


# ---------------------------------------------------------------------------
# Students
# ---------------------------------------------------------------------------

def _validate_group(
    db: Session,
    group_id: int | None,
    branch_id: int,
    academic_year: int,
    batch: str,
    section: str | None,
) -> None:
    if group_id is None:
        return
    group = get_student_group(db, group_id)
    if group.branch_id != branch_id:
        raise ValidationError("The student group belongs to a different branch")
    if group.academic_year != academic_year:
        raise ValidationError("The student group has a different academic year")
    if group.batch != batch:
        raise ValidationError("The student group has a different batch")
    if group.section and section and group.section != section:
        raise ValidationError("The student group has a different section")


def _student_query() -> Select:
    return (
        select(Student)
        .options(
            selectinload(Student.branch),
            selectinload(Student.group),
        )
    )


def list_students(
    db: Session,
    *,
    search: str | None = None,
    branch_id: int | None = None,
    academic_year: int | None = None,
    batch: str | None = None,
    section: str | None = None,
    group_id: int | None = None,
    include_inactive: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Student], int]:
    conditions = []
    if search:
        term = f"%{search.strip()}%"
        conditions.append(
            or_(
                Student.enrollment_number.ilike(term),
                Student.full_name.ilike(term),
                Student.email.ilike(term),
            )
        )
    if branch_id is not None:
        conditions.append(Student.branch_id == branch_id)
    if academic_year is not None:
        conditions.append(Student.academic_year == academic_year)
    if batch is not None:
        conditions.append(Student.batch == batch)
    if section is not None:
        conditions.append(Student.section == section.upper())
    if group_id is not None:
        conditions.append(Student.student_group_id == group_id)
    if not include_inactive:
        conditions.append(Student.is_active.is_(True))

    base = select(Student)
    if conditions:
        base = base.where(*conditions)

    total = db.scalar(
        select(func.count()).select_from(base.subquery())
    ) or 0
    stmt = (
        _student_query()
        .where(*conditions)
        .order_by(Student.enrollment_number)
        .limit(limit)
        .offset(offset)
    )
    return list(db.scalars(stmt)), int(total)


def get_student(db: Session, student_id: int) -> Student:
    student = db.scalar(_student_query().where(Student.id == student_id))
    if student is None:
        raise NotFoundError("Student not found")
    return student


def get_student_by_enrollment(db: Session, enrollment: str) -> Student | None:
    return db.scalar(
        _student_query().where(Student.enrollment_number == enrollment.strip())
    )


def create_student(db: Session, data: StudentCreate) -> Student:
    branch = get_branch(db, data.branch_id)
    _validate_group(
        db,
        data.student_group_id,
        branch.id,
        data.academic_year,
        data.batch,
        data.section,
    )
    student = Student(**data.model_dump())
    if student.email:
        student.email = student.email.strip().lower()
    db.add(student)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(
            "A student with this enrollment number or email already exists"
        ) from exc
    return get_student(db, student.id)


def update_student(
    db: Session, student: Student, data: StudentUpdate
) -> Student:
    values = data.model_dump(exclude_unset=True)
    branch_id = values.get("branch_id", student.branch_id)
    academic_year = values.get("academic_year", student.academic_year)
    batch = values.get("batch", student.batch)
    section = values.get("section", student.section)
    group_id = values.get("student_group_id", student.student_group_id)
    if "section" in values and values["section"] is not None:
        values["section"] = values["section"].strip().upper()
        section = values["section"]
    if "email" in values and values["email"]:
        values["email"] = values["email"].strip().lower()
    _validate_group(db, group_id, branch_id, academic_year, batch, section)
    for key, value in values.items():
        setattr(student, key, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(
            "A student with this enrollment number or email already exists"
        ) from exc
    return get_student(db, student.id)


def deactivate_student(db: Session, student: Student) -> Student:
    student.is_active = False
    db.commit()
    return get_student(db, student.id)


# ---------------------------------------------------------------------------
# Faculty (read-only - management is in faculty_service)
# ---------------------------------------------------------------------------

def _faculty_query() -> Select:
    return select(Faculty).options(selectinload(Faculty.branch))


def list_faculty(
    db: Session,
    *,
    search: str | None = None,
    department: str | None = None,
    include_inactive: bool = False,
) -> list[Faculty]:
    stmt = _faculty_query().order_by(Faculty.department, Faculty.name)
    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Faculty.name.ilike(term),
                Faculty.mobile_number.ilike(term),
            )
        )
    if department is not None:
        stmt = stmt.where(Faculty.department == department)
    if not include_inactive:
        stmt = stmt.where(Faculty.is_active.is_(True))
    return list(db.scalars(stmt))