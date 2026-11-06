from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies import get_current_principal
from app.schemas.common import Message
from app.schemas.personal_visibility import (
    HiddenItemCreate,
    HiddenItemRead,
    HiddenItemsSummary,
)
from app.services import personal_visibility_service

router = APIRouter(prefix="/visibility", tags=["personal-visibility"])


@router.get("/hidden", response_model=HiddenItemsSummary)
def get_hidden_items(
    principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> HiddenItemsSummary:
    return personal_visibility_service.get_hidden_summary(db, principal)


@router.post("/hide", response_model=HiddenItemRead, status_code=status.HTTP_201_CREATED)
def hide_item(
    payload: HiddenItemCreate,
    principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> HiddenItemRead:
    item = personal_visibility_service.hide_record(db, principal, payload)
    return HiddenItemRead.model_validate(item)


@router.delete("/unhide/{record_type}/{record_id}", response_model=Message)
def unhide_item(
    record_type: str,
    record_id: str,
    principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> Message:
    personal_visibility_service.unhide_record(db, principal, record_type, record_id)
    return Message(detail=f"Item {record_type}:{record_id} unhidden")
