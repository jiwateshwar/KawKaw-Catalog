from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    location_id: Mapped[int | None] = mapped_column(ForeignKey("locations.id", ondelete="SET NULL"))
    cover_photo_id: Mapped[int | None] = mapped_column(ForeignKey("photos.id", use_alter=True, ondelete="SET NULL"))
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    location: Mapped["Location | None"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Location", back_populates="trips", lazy="select"
    )
    cover_photo: Mapped["Photo | None"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Photo", foreign_keys=[cover_photo_id], lazy="select"
    )
    photos: Mapped[list] = relationship("Photo", back_populates="trip", foreign_keys="Photo.trip_id", lazy="select")
