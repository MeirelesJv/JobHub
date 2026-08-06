"""add_sync_interval_to_users

Revision ID: a3b4c5d6e7f8
Revises: f8a9b0c1d3e4
Create Date: 2026-08-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a3b4c5d6e7f8"
down_revision: Union[str, None] = "f8a9b0c1d3e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("sync_interval_minutes", sa.Integer(), server_default="120", nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("last_auto_sync_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "last_auto_sync_at")
    op.drop_column("users", "sync_interval_minutes")
