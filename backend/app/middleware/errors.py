"""Translate domain and database errors into consistent JSON responses."""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.services.exceptions import AppError

logger = logging.getLogger("app.errors")


def error_body(
    code: str,
    message: str,
    *,
    request_id: str | None = None,
    detail: object | None = None,
) -> dict:
    body: dict = {"error": {"code": code, "message": message}}
    if detail is not None:
        body["error"]["detail"] = detail
    if request_id:
        body["error"]["request_id"] = request_id
    return body


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        headers = None
        if isinstance(exc.detail, dict) and "headers" in exc.detail:
            headers = exc.detail["headers"]
        return JSONResponse(
            status_code=exc.status_code,
            content=error_body(
                exc.code,
                exc.message,
                request_id=getattr(request.state, "request_id", None),
                detail=exc.detail,
            ),
            headers=headers,
        )

    @app.exception_handler(IntegrityError)
    async def handle_integrity_error(
        request: Request, exc: IntegrityError
    ) -> JSONResponse:
        logger.warning("Database integrity error: %s", exc.orig)
        return JSONResponse(
            status_code=409,
            content=error_body(
                "conflict",
                "The request conflicts with existing data",
                request_id=getattr(request.state, "request_id", None),
            ),
        )
