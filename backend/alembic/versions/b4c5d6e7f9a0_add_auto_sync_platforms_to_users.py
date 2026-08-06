"""add_auto_sync_platforms_to_users

Revision ID: b4c5d6e7f9a0
Revises: a3b4c5d6e7f8
Create Date: 2026-08-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b4c5d6e7f9a0"
down_revision: Union[str, None] = "b5c6d7e8f9a0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ALL_PLATFORMS_JSON = '["linkedin", "gupy", "vagas", "catho", "infojobs"]'


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "auto_sync_platforms",
            sa.JSON(),
            nullable=False,
            server_default=sa.text(f"'{ALL_PLATFORMS_JSON}'::json"),
        ),
    )
    op.alter_column("users", "auto_sync_platforms", existing_type=sa.JSON(), server_default=None)


def downgrade() -> None:
    op.drop_column("users", "auto_sync_platforms")
