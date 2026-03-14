from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Species(Base):
    __tablename__ = "species"

    id: Mapped[int] = mapped_column(primary_key=True)
    common_name: Mapped[str] = mapped_column(String(255), nullable=False)
    scientific_name: Mapped[str | None] = mapped_column(String(255), unique=True)
    family: Mapped[str | None] = mapped_column(String(128))
    order_name: Mapped[str | None] = mapped_column(String(128))
    notes: Mapped[str | None] = mapped_column(Text)
    cover_photo_id: Mapped[int | None] = mapped_column(ForeignKey("photos.id", use_alter=True, ondelete="SET NULL"))
    photo_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    cover_photo: Mapped["Photo | None"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Photo", foreign_keys=[cover_photo_id], lazy="select"
    )
    photo_links: Mapped[list["PhotoSpecies"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "PhotoSpecies", back_populates="species", lazy="select"
    )
