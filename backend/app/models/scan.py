from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ScanJob(Base):
    __tablename__ = "scan_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(16), default="running")  # running|done|error
    root_path: Mapped[str | None] = mapped_column(String(512))
    location_id: Mapped[int | None] = mapped_column(Integer)
    trip_id: Mapped[int | None] = mapped_column(Integer)
    shoot_date: Mapped[str | None] = mapped_column(String(10))  # ISO date string YYYY-MM-DD
    files_found: Mapped[int] = mapped_column(Integer, default=0)
    files_imported: Mapped[int] = mapped_column(Integer, default=0)
    files_skipped: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text)
