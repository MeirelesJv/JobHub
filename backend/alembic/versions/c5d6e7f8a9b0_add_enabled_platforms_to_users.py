"""add_enabled_platforms_to_users

Revision ID: c5d6e7f8a9b0
Revises: b4c5d6e7f8a9
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c5d6e7f8a9b0"
down_revision: Union[str, None] = "b4c5d6e7f8a9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ALL_PLATFORMS_JSON = '["linkedin", "gupy", "vagas", "catho", "infojobs"]'


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "enabled_platforms",
            sa.JSON(),
            nullable=False,
            server_default=sa.text(f"'{ALL_PLATFORMS_JSON}'::json"),
        ),
    )
    op.alter_column("users", "enabled_platforms", existing_type=sa.JSON(), server_default=None)


def downgrade() -> None:
    op.drop_column("users", "enabled_platforms")
