"""Authentication and user-management services."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserCreate
from app.security import hash_password, verify_password
from app.services.exceptions import ConflictError, UnauthorizedError, ValidationError


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(
        select(User).where(func.lower(User.email) == email.strip().lower())
    )


def create_user(db: Session, data: UserCreate) -> User:
    email = data.email.strip().lower()
    if get_user_by_email(db, email):
        raise ConflictError("A user with this email already exists")
    user = User(
        email=email,
        password_hash=hash_password(data.password),
        full_name=data.full_name.strip(),
        role=data.role,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError("A user with this email already exists") from exc
    db.refresh(user)
    return user


def authenticate(db: Session, email: str, password: str) -> User:
    user = get_user_by_email(db, email)
    if user is None or not verify_password(password, user.password_hash):
        raise UnauthorizedError("Invalid email or password")
    if not user.is_active:
        raise UnauthorizedError("This account is disabled")
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user: User, current: str, new: str) -> None:
    if not verify_password(current, user.password_hash):
        raise ValidationError("Current password is incorrect")
    if current == new:
        raise ValidationError("New password must be different")
    user.password_hash = hash_password(new)
    db.commit()


def change_credentials(
    db: Session,
    user: User,
    current_password: str,
    new_email: str | None = None,
    new_password: str | None = None,
) -> User:
    """Change email and/or password for Student or Admin users."""
    if not verify_password(current_password, user.password_hash):
        raise ValidationError("Current password is incorrect.")

    if not new_email and not new_password:
        raise ValidationError("Please provide a new email address or a new password.")

    if new_email:
        clean_email = new_email.strip().lower()
        if clean_email == user.email.lower():
            raise ValidationError("New email must be different from your current email.")
        existing = get_user_by_email(db, clean_email)
        if existing and existing.id != user.id:
            raise ConflictError("A user with this email address is already registered.")
        user.email = clean_email

    if new_password:
        if len(new_password) < 6:
            raise ValidationError("New password must be at least 6 characters long.")
        if current_password == new_password:
            raise ValidationError("New password must be different from your current password.")
        user.password_hash = hash_password(new_password)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError("A user with this email address is already registered.") from exc

    db.refresh(user)
    return user


def bootstrap_admin(db: Session, email: str, password: str, full_name: str) -> User | None:
    """Create the bootstrap admin if it does not already exist."""
    existing = get_user_by_email(db, email)
    if existing:
        return existing
    return create_user(
        db,
        UserCreate(
            email=email,
            password=password,
            full_name=full_name,
            role="admin",  # type: ignore[arg-type]
        ),
    )
