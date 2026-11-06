"""Student, branch, group and faculty endpoints."""

from __future__ import annotations

from fastapi import (
    APIRouter,
    Depends,
    File,
    Query,
    UploadFile,
    status,
)

from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies import get_current_faculty, get_current_user, require_admin, require_staff
from app.models.academic import Branch, Faculty, Student, StudentGroup
from app.models.user import User
from app.schemas.academic import (
    BranchCreate,
    BranchRead,
    BranchUpdate,
    ImportResult,
    StudentCreate,
    StudentGroupCreate,
    StudentGroupRead,
    StudentGroupUpdate,
    StudentPage,
    StudentRead,
    StudentUpdate,
)
from app.schemas.common import Message
from app.services import academic_service, import_service
from app.services.exceptions import ValidationError

router = APIRouter(tags=["academics"])

# ---------------------------------------------------------------------------
# Students
# ---------------------------------------------------------------------------

@router.get("/students", response_model=StudentPage)
def list_students(
    search: str | None = None,
    branch_id: int | None = None,
    academic_year: int | None = Query(default=None, ge=1, le=4),
    batch: str | None = None,
    section: str | None = None,
    group_id: int | None = None,
    include_inactive: bool = False,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(require_staff),
    db: Session = Depends(get_db),
) -> StudentPage:
    students, total = academic_service.list_students(
        db,
        search=search,
        branch_id=branch_id,
        academic_year=academic_year,
        batch=batch,
        section=section,
        group_id=group_id,
        include_inactive=include_inactive,
        limit=limit,
        offset=offset,
    )
    return StudentPage(
        items=[StudentRead.model_validate(item) for item in students],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/students/me", response_model=StudentRead)
def my_student_profile(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Student:
    student = db.query(Student).filter(Student.user_id == user.id).one_or_none()
    if student is None:
        raise ValidationError("No student profile is linked to this account")
    return academic_service.get_student(db, student.id)


@router.post(
    "/students",
    response_model=StudentRead,
    status_code=status.HTTP_201_CREATED,
)
def create_student(
    payload: StudentCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Student:
    return academic_service.create_student(db, payload)


@router.post("/students/import", response_model=ImportResult)
async def import_students(
    file: UploadFile = File(...),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ImportResult:
    content = await file.read()
    if not content:
        raise ValidationError("The uploaded file is empty")
    if len(content) > 10 * 1024 * 1024:
        raise ValidationError("The uploaded file must be 10 MB or smaller")
    return import_service.import_students(db, content, file.filename or "")


@router.get("/students/{student_id}", response_model=StudentRead)
def get_student(
    student_id: int,
    _: User = Depends(require_staff),
    db: Session = Depends(get_db),
) -> Student:
    return academic_service.get_student(db, student_id)


@router.patch("/students/{student_id}", response_model=StudentRead)
def update_student(
    student_id: int,
    payload: StudentUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Student:
    student = academic_service.get_student(db, student_id)
    return academic_service.update_student(db, student, payload)


@router.delete("/students/{student_id}", response_model=StudentRead)
def deactivate_student(
    student_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Student:
    student = academic_service.get_student(db, student_id)
    return academic_service.deactivate_student(db, student)


# ---------------------------------------------------------------------------
# Branches and student groups
# ---------------------------------------------------------------------------

@router.get("/branches", response_model=list[BranchRead])
def list_branches(
    include_inactive: bool = False,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Branch]:
    return academic_service.list_branches(db, include_inactive=include_inactive)


@router.post(
    "/branches",
    response_model=BranchRead,
    status_code=status.HTTP_201_CREATED,
)
def create_branch(
    payload: BranchCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Branch:
    return academic_service.create_branch(db, payload)


@router.get("/branches/{branch_id}", response_model=BranchRead)
def get_branch(
    branch_id: int,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Branch:
    return academic_service.get_branch(db, branch_id)


@router.patch("/branches/{branch_id}", response_model=BranchRead)
def update_branch(
    branch_id: int,
    payload: BranchUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Branch:
    branch = academic_service.get_branch(db, branch_id)
    return academic_service.update_branch(db, branch, payload)


@router.get("/student-groups", response_model=list[StudentGroupRead])
def list_student_groups(
    branch_id: int | None = None,
    academic_year: int | None = Query(default=None, ge=1, le=4),
    batch: str | None = None,
    include_inactive: bool = False,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[StudentGroup]:
    return academic_service.list_student_groups(
        db,
        branch_id=branch_id,
        academic_year=academic_year,
        batch=batch,
        include_inactive=include_inactive,
    )


@router.post(
    "/student-groups",
    response_model=StudentGroupRead,
    status_code=status.HTTP_201_CREATED,
)
def create_student_group(
    payload: StudentGroupCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> StudentGroup:
    return academic_service.create_student_group(db, payload)


@router.patch(
    "/student-groups/{group_id}", response_model=StudentGroupRead
)
def update_student_group(
    group_id: int,
    payload: StudentGroupUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> StudentGroup:
    group = academic_service.get_student_group(db, group_id)
    return academic_service.update_student_group(db, group, payload)


# ---------------------------------------------------------------------------
# Faculty (read-only for staff; management via /admin/faculty)
# ---------------------------------------------------------------------------

@router.get("/faculty/me", response_model=dict)
def my_faculty_profile(
    principal = Depends(get_current_faculty),
    db: Session = Depends(get_db),
):
    """Get current faculty member's profile (faculty only)."""
    return {
        "mobile_number": principal.faculty.mobile_number,
        "name": principal.faculty.name,
        "department": principal.faculty.department,
        "designation": principal.faculty.designation,
        "is_active": principal.faculty.is_active,
        "has_password": principal.faculty.has_password,
    }