"""add vagas platform

Revision ID: b2c3d4e5f6a7
Revises: e7f8a9b0c1d2
Create Date: 2026-05-04 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "e7f8a9b0c1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE jobplatform ADD VALUE IF NOT EXISTS 'vagas'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values directly.
    pass
