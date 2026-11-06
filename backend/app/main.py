"""FastAPI application factory."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app import __version__
from app.config import settings
from app.database.session import engine
from app.middleware import RequestContextMiddleware, register_exception_handlers
from app.routes import api_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "Starting %s v%s (env=%s)",
        settings.app_name,
        __version__,
        settings.environment,
    )
    try:
        from app.database.base import Base
        import app.models  # noqa: F401
        Base.metadata.create_all(bind=engine)
    except Exception as exc:
        logger.warning("Could not auto-create tables: %s", exc)
    yield
    engine.dispose()
    logger.info("Shutdown complete")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        description=(
            "Database-backed API for campus room availability, bookings, "
            "students, faculty, timetables and announcements."
        ),
        lifespan=lifespan,
    )

    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )
    register_exception_handlers(app)
    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.get("/", tags=["system"])
    def root() -> dict:
        return {
            "name": settings.app_name,
            "version": __version__,
            "docs": "/docs",
            "health": "/health",
            "api": settings.api_v1_prefix,
        }

    @app.get("/health", tags=["system"])
    def health() -> JSONResponse:
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
                version = connection.execute(
                    text("SHOW server_version")
                ).scalar_one()
        except Exception as exc:  # pragma: no cover - infrastructure failure
            logger.error("Health check failed: %s", exc)
            return JSONResponse(
                status_code=503,
                content={
                    "status": "unhealthy",
                    "database": "unavailable",
                    "version": __version__,
                },
            )
        return JSONResponse(
            content={
                "status": "ok",
                "database": "ok",
                "postgres_version": version,
                "version": __version__,
            }
        )

    return app


app = create_app()
