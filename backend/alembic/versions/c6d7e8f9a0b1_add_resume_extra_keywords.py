"""add resume extra_keywords

Revision ID: c6d7e8f9a0b1
Revises: b4c5d6e7f9a0
Create Date: 2026-08-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c6d7e8f9a0b1"
down_revision: Union[str, None] = "b4c5d6e7f9a0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "resumes",
        sa.Column("extra_keywords", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
    )
    op.alter_column("resumes", "extra_keywords", server_default=None)


def downgrade() -> None:
    op.drop_column("resumes", "extra_keywords")
