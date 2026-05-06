"""add_blocked_companies_to_users

Revision ID: 9a8b7c6d5e4f
Revises: f1a2b3c4d5e6
Create Date: 2026-05-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9a8b7c6d5e4f"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("blocked_companies", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
    )
    op.alter_column("users", "blocked_companies", existing_type=sa.JSON(), server_default=None)


def downgrade() -> None:
    op.drop_column("users", "blocked_companies")
