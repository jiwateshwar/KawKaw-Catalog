"""Add width and height columns to photos

Revision ID: 0003
Revises: 0002
Create Date: 2024-01-03 00:00:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("photos", sa.Column("width", sa.Integer, nullable=True))
    op.add_column("photos", sa.Column("height", sa.Integer, nullable=True))


def downgrade() -> None:
    op.drop_column("photos", "width")
    op.drop_column("photos", "height")
