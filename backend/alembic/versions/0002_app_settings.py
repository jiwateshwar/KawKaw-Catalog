"""Add app_settings table for first-run setup wizard

Revision ID: 0002
Revises: 0001
Create Date: 2024-01-02 00:00:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("setup_complete", sa.Boolean, default=False, nullable=False, server_default="false"),
        sa.Column("app_title", sa.String(128), default="KawKaw Catalog", server_default="KawKaw Catalog"),
        sa.Column("app_description", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("app_settings")
