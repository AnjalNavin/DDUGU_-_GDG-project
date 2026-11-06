"""Personal visibility / hidden records tracking."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class UserHiddenItem(Base):
    __tablename__ = "user_hidden_items"
    __table_args__ = (
        UniqueConstraint("user_id", "record_type", "record_id", name="uq_user_record_hidden"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    record_type: Mapped[str] = mapped_column(String(30), index=True, nullable=False)  # 'announcement' | 'booking'
    record_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    hidden_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
