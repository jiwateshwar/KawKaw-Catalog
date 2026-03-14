from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)

    # File identity
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    relative_path: Mapped[str] = mapped_column(String(1024), unique=True, nullable=False)
    file_type: Mapped[str] = mapped_column(String(16), nullable=False)  # raw | jpeg | video
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    sha256: Mapped[str | None] = mapped_column(String(64), index=True)

    # Thumbnails
    thumb_sm_path: Mapped[str | None] = mapped_column(String(512))   # 400px
    thumb_md_path: Mapped[str | None] = mapped_column(String(512))   # 1200px
    thumb_lg_path: Mapped[str | None] = mapped_column(String(512))   # 2400px
    thumb_status: Mapped[str] = mapped_column(String(16), default="pending")  # pending|processing|done|error
    width: Mapped[int | None] = mapped_column(Integer)               # source image width (px)
    height: Mapped[int | None] = mapped_column(Integer)              # source image height (px)

    # EXIF / Camera metadata
    captured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    camera_make: Mapped[str | None] = mapped_column(String(64))
    camera_model: Mapped[str | None] = mapped_column(String(64))
    lens_model: Mapped[str | None] = mapped_column(String(128))
    focal_length_mm: Mapped[float | None] = mapped_column(Numeric(6, 1))
    aperture: Mapped[float | None] = mapped_column(Numeric(5, 2))
    shutter_speed: Mapped[str | None] = mapped_column(String(32))
    iso: Mapped[int | None] = mapped_column(Integer)
    exif_raw: Mapped[dict | None] = mapped_column(JSONB)

    # Editorial
    title: Mapped[str | None] = mapped_column(String(255))
    caption: Mapped[str | None] = mapped_column(Text)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relations
    location_id: Mapped[int | None] = mapped_column(ForeignKey("locations.id", ondelete="SET NULL"))
    trip_id: Mapped[int | None] = mapped_column(ForeignKey("trips.id", ondelete="SET NULL"))

    # Audit
    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    location: Mapped["Location | None"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Location", back_populates="photos", lazy="select"
    )
    trip: Mapped["Trip | None"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Trip", back_populates="photos", foreign_keys=[trip_id], lazy="select"
    )
    species_links: Mapped[list["PhotoSpecies"]] = relationship(
        "PhotoSpecies", back_populates="photo", cascade="all, delete-orphan", lazy="select"
    )
    album_links: Mapped[list["AlbumPhoto"]] = relationship(
        "AlbumPhoto", back_populates="photo", cascade="all, delete-orphan", lazy="select"
    )

    __table_args__ = (
        Index("idx_photos_published", "is_published", "published_at"),
        Index("idx_photos_featured", "is_featured", postgresql_where="is_featured = TRUE"),
        Index("idx_photos_location", "location_id"),
        Index("idx_photos_trip", "trip_id"),
        Index("idx_photos_captured_at", "captured_at"),
        Index("idx_photos_thumb_status", "thumb_status", postgresql_where="thumb_status != 'done'"),
    )


class PhotoSpecies(Base):
    __tablename__ = "photo_species"

    photo_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("photos.id", ondelete="CASCADE"), primary_key=True)
    species_id: Mapped[int] = mapped_column(ForeignKey("species.id", ondelete="CASCADE"), primary_key=True)

    photo: Mapped[Photo] = relationship("Photo", back_populates="species_links")
    species: Mapped["Species"] = relationship("Species", back_populates="photo_links")  # type: ignore[name-defined]  # noqa: F821

    __table_args__ = (Index("idx_photo_species_species", "species_id"),)


class AlbumPhoto(Base):
    __tablename__ = "album_photos"

    album_id: Mapped[int] = mapped_column(ForeignKey("albums.id", ondelete="CASCADE"), primary_key=True)
    photo_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("photos.id", ondelete="CASCADE"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    album: Mapped["Album"] = relationship("Album", back_populates="photo_links")  # type: ignore[name-defined]  # noqa: F821
    photo: Mapped[Photo] = relationship("Photo", back_populates="album_links")

    __table_args__ = (Index("idx_album_photos_album", "album_id", "sort_order"),)
