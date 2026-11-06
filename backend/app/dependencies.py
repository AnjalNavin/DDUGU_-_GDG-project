"""Request-scoped authentication and role dependencies."""

from __future__ import annotations

from collections.abc import Callable
from typing import TYPE_CHECKING, Union

import jwt
from fastapi import Depends, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database.session import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.security import decode_access_token
from app.services.exceptions import ForbiddenError, UnauthorizedError

if TYPE_CHECKING:
    from app.models.academic import Faculty

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.api_v1_prefix}/auth/token",
    auto_error=False,
)


class CurrentPrincipal:
    """Unified principal for users and faculty."""

    def __init__(self, user: User | None = None, faculty: "Faculty | None" = None):
        self.user = user
        self.faculty = faculty

    @property
    def is_faculty(self) -> bool:
        return self.faculty is not None or (self.user is not None and self.user.role == UserRole.faculty)

    @property
    def is_user(self) -> bool:
        return self.user is not None

    @property
    def id(self) -> Union[int, str]:
        if self.faculty is not None:
            return self.faculty.mobile_number
        if self.user is not None:
            return self.user.id
        return ""

    @property
    def role(self) -> UserRole:
        if self.faculty is not None:
            return UserRole.faculty
        if self.user is not None:
            return self.user.role
        return UserRole.student

    @property
    def full_name(self) -> str:
        if self.faculty is not None:
            return self.faculty.name
        if self.user is not None:
            return self.user.full_name
        return ""


def get_current_principal(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> CurrentPrincipal:
    """Get current authenticated principal (user or faculty)."""
    if not token:
        raise UnauthorizedError("Not authenticated")
    try:
        payload = decode_access_token(token)
        sub = payload["sub"]
        role = payload["role"]
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        raise UnauthorizedError(
            "Invalid or expired token",
            detail={"headers": {"WWW-Authenticate": "Bearer"}},
        ) from None

    if role == "faculty":
        from app.models.academic import Faculty
        faculty = db.get(Faculty, sub)
        if faculty is not None and faculty.is_active:
            return CurrentPrincipal(faculty=faculty)
        try:
            user_id = int(sub)
            user = db.get(User, user_id)
            if user is not None and user.is_active:
                return CurrentPrincipal(user=user)
        except ValueError:
            pass
        raise UnauthorizedError("Faculty not found or disabled")
    else:
        try:
            user_id = int(sub)
        except ValueError:
            raise UnauthorizedError("Invalid token subject")
        user = db.get(User, user_id)
        if user is None or not user.is_active:
            raise UnauthorizedError("User not found or disabled")
        return CurrentPrincipal(user=user)


def get_optional_principal(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> CurrentPrincipal | None:
    """Get current principal if authenticated, else None."""
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        sub = payload["sub"]
        role = payload["role"]
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        return None

    if role == "faculty":
        from app.models.academic import Faculty
        faculty = db.get(Faculty, sub)
        if faculty and faculty.is_active:
            return CurrentPrincipal(faculty=faculty)
        return None
    else:
        try:
            user_id = int(sub)
        except ValueError:
            return None
        user = db.get(User, user_id)
        return CurrentPrincipal(user=user) if user and user.is_active else None


def require_roles(*roles: UserRole) -> Callable[..., CurrentPrincipal]:
    allowed = set(roles)

    def dependency(principal: CurrentPrincipal = Depends(get_current_principal)) -> CurrentPrincipal:
        if principal.role not in allowed:
            raise ForbiddenError(
                "You do not have permission to perform this action"
            )
        return principal

    return dependency


def get_current_user(
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> User:
    """Dependency that requires a User (not faculty)."""
    if principal.is_faculty:
        raise ForbiddenError("This endpoint requires a user account")
    return principal.user


def get_current_faculty(
    principal: CurrentPrincipal = Depends(get_current_principal),
):
    """Dependency that requires a Faculty account."""
    if principal.is_user:
        raise ForbiddenError("This endpoint requires a faculty account")
    return principal.faculty


require_admin = require_roles(UserRole.admin)
require_staff = require_roles(UserRole.admin, UserRole.faculty)
require_authenticated = get_current_principal
require_user = get_current_user
require_faculty = get_current_faculty

__all__ = [
    "get_current_principal",
    "get_optional_principal",
    "get_current_user",
    "get_current_faculty",
    "require_admin",
    "require_authenticated",
    "require_roles",
    "require_staff",
    "require_user",
    "require_faculty",
]