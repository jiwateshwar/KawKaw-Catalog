"""Initial schema

Revision ID: 0001
Revises:
Create Date: 2024-01-01 00:00:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("username", sa.String(64), unique=True, nullable=False),
        sa.Column("email", sa.String(255), unique=True, nullable=True),
        sa.Column("hashed_pw", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # locations
    op.create_table(
        "locations",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("country", sa.String(128)),
        sa.Column("region", sa.String(128)),
        sa.Column("latitude", sa.Numeric(9, 6)),
        sa.Column("longitude", sa.Numeric(9, 6)),
        sa.Column("photo_count", sa.Integer, default=0),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # trips (before photos to avoid circular FK)
    op.create_table(
        "trips",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("start_date", sa.Date),
        sa.Column("end_date", sa.Date),
        sa.Column("location_id", sa.Integer, sa.ForeignKey("locations.id", ondelete="SET NULL")),
        sa.Column("cover_photo_id", sa.Integer),  # FK added after photos table
        sa.Column("is_published", sa.Boolean, default=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # albums
    op.create_table(
        "albums",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("slug", sa.String(128), unique=True, nullable=False),
        sa.Column("cover_photo_id", sa.Integer),  # FK added after photos table
        sa.Column("sort_order", sa.SmallInteger, default=0),
        sa.Column("is_published", sa.Boolean, default=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # species (before photos for cover_photo_id)
    op.create_table(
        "species",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("common_name", sa.String(255), nullable=False),
        sa.Column("scientific_name", sa.String(255), unique=True),
        sa.Column("family", sa.String(128)),
        sa.Column("order_name", sa.String(128)),
        sa.Column("notes", sa.Text),
        sa.Column("cover_photo_id", sa.Integer),  # FK added after photos table
        sa.Column("photo_count", sa.Integer, default=0),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # photos (core table)
    op.create_table(
        "photos",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("filename", sa.String(512), nullable=False),
        sa.Column("relative_path", sa.String(1024), unique=True, nullable=False),
        sa.Column("file_type", sa.String(16), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger),
        sa.Column("sha256", sa.String(64), index=True),
        sa.Column("thumb_sm_path", sa.String(512)),
        sa.Column("thumb_md_path", sa.String(512)),
        sa.Column("thumb_lg_path", sa.String(512)),
        sa.Column("thumb_status", sa.String(16), default="pending"),
        sa.Column("captured_at", sa.DateTime(timezone=True)),
        sa.Column("camera_make", sa.String(64)),
        sa.Column("camera_model", sa.String(64)),
        sa.Column("lens_model", sa.String(128)),
        sa.Column("focal_length_mm", sa.Numeric(6, 1)),
        sa.Column("aperture", sa.Numeric(5, 2)),
        sa.Column("shutter_speed", sa.String(32)),
        sa.Column("iso", sa.Integer),
        sa.Column("exif_raw", postgresql.JSONB),
        sa.Column("title", sa.String(255)),
        sa.Column("caption", sa.Text),
        sa.Column("is_published", sa.Boolean, default=False),
        sa.Column("is_featured", sa.Boolean, default=False),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column("location_id", sa.Integer, sa.ForeignKey("locations.id", ondelete="SET NULL")),
        sa.Column("trip_id", sa.Integer, sa.ForeignKey("trips.id", ondelete="SET NULL")),
        sa.Column("imported_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Indexes on photos
    op.create_index("idx_photos_published", "photos", ["is_published", "published_at"])
    op.create_index("idx_photos_location", "photos", ["location_id"])
    op.create_index("idx_photos_trip", "photos", ["trip_id"])
    op.create_index("idx_photos_captured_at", "photos", ["captured_at"])
    op.create_index(
        "idx_photos_thumb_pending",
        "photos",
        ["thumb_status"],
        postgresql_where=sa.text("thumb_status != 'done'"),
    )

    # Now add deferred FKs from trips/albums/species → photos
    op.create_foreign_key(None, "trips", "photos", ["cover_photo_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key(None, "albums", "photos", ["cover_photo_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key(None, "species", "photos", ["cover_photo_id"], ["id"], ondelete="SET NULL")

    # photo_species (many-to-many)
    op.create_table(
        "photo_species",
        sa.Column("photo_id", sa.BigInteger, sa.ForeignKey("photos.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("species_id", sa.Integer, sa.ForeignKey("species.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_index("idx_photo_species_species", "photo_species", ["species_id"])

    # album_photos (many-to-many, ordered)
    op.create_table(
        "album_photos",
        sa.Column("album_id", sa.Integer, sa.ForeignKey("albums.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("photo_id", sa.BigInteger, sa.ForeignKey("photos.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("sort_order", sa.Integer, default=0),
    )
    op.create_index("idx_album_photos_album", "album_photos", ["album_id", "sort_order"])

    # scan_jobs
    op.create_table(
        "scan_jobs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(16), default="running"),
        sa.Column("root_path", sa.String(512)),
        sa.Column("location_id", sa.Integer),
        sa.Column("trip_id", sa.Integer),
        sa.Column("shoot_date", sa.String(10)),
        sa.Column("files_found", sa.Integer, default=0),
        sa.Column("files_imported", sa.Integer, default=0),
        sa.Column("files_skipped", sa.Integer, default=0),
        sa.Column("error_message", sa.Text),
    )


def downgrade() -> None:
    op.drop_table("scan_jobs")
    op.drop_table("album_photos")
    op.drop_table("photo_species")
    op.drop_table("photos")
    op.drop_table("species")
    op.drop_table("albums")
    op.drop_table("trips")
    op.drop_table("locations")
    op.drop_table("users")
