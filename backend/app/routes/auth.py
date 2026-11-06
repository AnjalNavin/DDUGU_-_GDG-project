"""Authentication and user-management endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies import get_current_user, require_admin
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.common import Message
from app.schemas.faculty import FacultyLoginRequest, FacultyRead, FacultyTokenResponse
from app.schemas.user import (
    CredentialsChange,
    LoginRequest,
    PasswordChange,
    TokenResponse,
    UserCreate,
    UserRead,
    UserUpdate,
)
from app.security import create_access_token
from app.services import auth_service, faculty_service
from app.services.exceptions import ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_response(user: User) -> TokenResponse:
    token, expires_in = create_access_token(str(user.id), user.role.value)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=expires_in,
        user=UserRead.model_validate(user),
    )


def _faculty_token_response(faculty) -> FacultyTokenResponse:
    """Create token response for faculty login."""
    token, expires_in = create_access_token(faculty.mobile_number, "faculty")
    return FacultyTokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=expires_in,
        user=FacultyRead.model_validate(faculty),
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = auth_service.authenticate(db, payload.email, payload.password)
    return _token_response(user)


@router.post("/faculty/login", response_model=FacultyTokenResponse)
def faculty_login(payload: FacultyLoginRequest, db: Session = Depends(get_db)) -> FacultyTokenResponse:
    """Faculty login using mobile number and password."""
    faculty = faculty_service.authenticate_faculty(db, payload.mobile_number, payload.password)
    return _faculty_token_response(faculty)


@router.post("/token", response_model=TokenResponse)
def token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> TokenResponse:
    """OAuth2 password-flow endpoint used by Swagger UI."""
    user = auth_service.authenticate(db, form_data.username, form_data.password)
    return _token_response(user)


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.post("/change-password", response_model=Message)
def change_password(
    payload: PasswordChange,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Message:
    auth_service.change_password(
        db, user, payload.current_password, payload.new_password
    )
    return Message(detail="Password updated")


@router.post("/change-credentials", response_model=UserRead)
def change_credentials(
    payload: CredentialsChange,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Change registered Gmail/email and/or password for Admin or Student profiles."""
    if user.role not in (UserRole.admin, UserRole.student):
        raise ForbiddenError("Credential management is available for Admin and Student profiles only.")
    updated_user = auth_service.change_credentials(
        db,
        user,
        current_password=payload.current_password,
        new_email=str(payload.new_email) if payload.new_email else None,
        new_password=payload.new_password,
    )
    return updated_user


@router.get("/users", response_model=list[UserRead])
def list_users(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[User]:
    return list(db.scalars(select(User).order_by(User.full_name)))


@router.post(
    "/users",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    payload: UserCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> User:
    return auth_service.create_user(db, payload)


@router.patch("/users/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    payload: UserUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError("User not found")
    values = payload.model_dump(exclude_unset=True)
    if user.id == admin.id and values.get("is_active") is False:
        raise ValidationError("You cannot deactivate your own account")
    if "email" in values and values["email"]:
        values["email"] = str(values["email"]).strip().lower()
    for key, value in values.items():
        setattr(user, key, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError("A user with this email already exists") from exc
    db.refresh(user)
    return user