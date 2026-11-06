"""Admin faculty management endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies import require_admin
from app.models.user import User
from app.schemas.faculty import (
    FacultyCreate,
    FacultyImportSummary,
    FacultyRead,
    FacultyUpdate,
    FacultyPasswordReset,
)
from app.services import faculty_service
from app.services.exceptions import ConflictError, NotFoundError, ValidationError

router = APIRouter(prefix="/admin/faculty", tags=["admin-faculty"])


@router.post(
    "/import",
    response_model=FacultyImportSummary,
    status_code=status.HTTP_200_OK,
)
async def import_faculty(
    file: UploadFile = File(...),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> FacultyImportSummary:
    """Import faculty from Excel file."""
    # Save uploaded file temporarily
    import tempfile
    import os

    if not file.filename or not file.filename.endswith((".xlsx", ".xlsm")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .xlsx and .xlsm files are supported",
        )

    content = await file.read()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        summary = faculty_service.import_faculty_from_excel(db, tmp_path)
        return summary
    finally:
        os.unlink(tmp_path)


@router.get("", response_model=list[FacultyRead])
def list_faculty(
    search: str | None = None,
    department: str | None = None,
    is_active: bool | None = None,
    skip: int = 0,
    limit: int = 100,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[FacultyRead]:
    """List all faculty with optional filters."""
    faculty_list = faculty_service.list_faculty(
        db, search=search, department=department, is_active=is_active, skip=skip, limit=limit
    )
    return [FacultyRead.model_validate(f) for f in faculty_list]


@router.get("/count")
def get_faculty_count(
    search: str | None = None,
    department: str | None = None,
    is_active: bool | None = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, int]:
    """Get total faculty count with optional filters."""
    count = faculty_service.get_faculty_count(
        db, search=search, department=department, is_active=is_active
    )
    return {"total": count}


@router.post(
    "",
    response_model=FacultyRead,
    status_code=status.HTTP_201_CREATED,
)
def create_faculty(
    payload: FacultyCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> FacultyRead:
    """Create a new faculty account with password."""
    try:
        faculty = faculty_service.create_faculty(db, payload)
        return FacultyRead.model_validate(faculty)
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.patch("/{mobile_number}/status", response_model=FacultyRead)
def update_faculty_status(
    mobile_number: str,
    is_active: bool,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> FacultyRead:
    """Activate or deactivate a faculty account."""
    try:
        faculty = faculty_service.set_faculty_status(db, mobile_number, is_active)
        return FacultyRead.model_validate(faculty)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post("/{mobile_number}/reset-password", response_model=FacultyRead)
def reset_faculty_password(
    mobile_number: str,
    payload: FacultyPasswordReset,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> FacultyRead:
    """Reset faculty password (admin only)."""
    try:
        faculty = faculty_service.reset_faculty_password(db, mobile_number, payload.password)
        return FacultyRead.model_validate(faculty)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.patch("/{mobile_number}", response_model=FacultyRead)
def update_faculty(
    mobile_number: str,
    payload: FacultyUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> FacultyRead:
    """Update faculty details."""
    try:
        faculty = faculty_service.update_faculty(db, mobile_number, payload, admin=admin)
        return FacultyRead.model_validate(faculty)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.delete("/{mobile_number}", status_code=status.HTTP_204_NO_CONTENT)
def delete_faculty(
    mobile_number: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    """Permanently remove a faculty member."""
    try:
        faculty_service.delete_faculty(db, mobile_number)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))