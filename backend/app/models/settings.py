from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AppSettings(Base):
    """Single-row table for app-wide configuration set during the setup wizard."""
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    setup_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    app_title: Mapped[str] = mapped_column(String(128), default="KawKaw Catalog")
    app_description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
