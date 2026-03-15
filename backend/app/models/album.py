from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Album(Base):
    __tablename__ = "albums"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    slug: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    cover_photo_id: Mapped[int | None] = mapped_column(ForeignKey("photos.id", use_alter=True, ondelete="SET NULL"))
    trip_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("trips.id", ondelete="SET NULL"))
    location_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("locations.id", ondelete="SET NULL"))
    shoot_date: Mapped[date | None] = mapped_column(Date)
    sort_order: Mapped[int] = mapped_column(SmallInteger, default=0)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    cover_photo: Mapped["Photo | None"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Photo", foreign_keys=[cover_photo_id], lazy="select"
    )
    trip: Mapped["Trip | None"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Trip", back_populates="albums", lazy="select"
    )
    location: Mapped["Location | None"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Location", lazy="select"
    )
    photo_links: Mapped[list["AlbumPhoto"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "AlbumPhoto", back_populates="album", order_by="AlbumPhoto.sort_order", lazy="select"
    )
