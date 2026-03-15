"""Add location_id and shoot_date to albums

Revision ID: 0005
Revises: 0004
Create Date: 2024-01-05 00:00:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "albums",
        sa.Column(
            "location_id",
            sa.Integer,
            sa.ForeignKey("locations.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column("albums", sa.Column("shoot_date", sa.Date, nullable=True))
    op.create_index("idx_albums_location", "albums", ["location_id"])
    op.create_index("idx_albums_shoot_date", "albums", ["shoot_date"])


def downgrade() -> None:
    op.drop_index("idx_albums_shoot_date", table_name="albums")
    op.drop_index("idx_albums_location", table_name="albums")
    op.drop_column("albums", "shoot_date")
    op.drop_column("albums", "location_id")
