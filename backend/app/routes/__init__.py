from fastapi import APIRouter

from app.routes import (
    academics,
    admin_faculty,
    auth,
    availability,
    bookings,
    campus,
    conflicts,
    content,
    personal_visibility,
    seats,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(academics.router)
api_router.include_router(campus.router)
api_router.include_router(availability.router)
api_router.include_router(bookings.router)
api_router.include_router(content.router)
api_router.include_router(admin_faculty.router)
api_router.include_router(conflicts.router)
api_router.include_router(seats.router)
api_router.include_router(personal_visibility.router)

__all__ = ["api_router"]