"""Add trip_id to albums; add crop fields to photos

Revision ID: 0004
Revises: 0003
Create Date: 2024-01-04 00:00:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "albums",
        sa.Column("trip_id", sa.Integer, sa.ForeignKey("trips.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("idx_albums_trip", "albums", ["trip_id"])

    op.add_column("photos", sa.Column("crop_x", sa.Numeric(5, 4), nullable=True))
    op.add_column("photos", sa.Column("crop_y", sa.Numeric(5, 4), nullable=True))
    op.add_column("photos", sa.Column("crop_w", sa.Numeric(5, 4), nullable=True))
    op.add_column("photos", sa.Column("crop_h", sa.Numeric(5, 4), nullable=True))


def downgrade() -> None:
    op.drop_index("idx_albums_trip", table_name="albums")
    op.drop_column("albums", "trip_id")
    op.drop_column("photos", "crop_x")
    op.drop_column("photos", "crop_y")
    op.drop_column("photos", "crop_w")
    op.drop_column("photos", "crop_h")
