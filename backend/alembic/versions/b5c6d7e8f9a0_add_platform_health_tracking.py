"""add_platform_health_tracking

Revision ID: b5c6d7e8f9a0
Revises: a3b4c5d6e7f8
Create Date: 2026-08-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b5c6d7e8f9a0"
down_revision: Union[str, None] = "a3b4c5d6e7f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "platforms",
        sa.Column("is_healthy", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column("platforms", sa.Column("broken_step", sa.String(255), nullable=True))
    op.add_column("platforms", sa.Column("broken_detail", sa.Text(), nullable=True))
    op.add_column("platforms", sa.Column("broken_since", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("platforms", "broken_since")
    op.drop_column("platforms", "broken_detail")
    op.drop_column("platforms", "broken_step")
    op.drop_column("platforms", "is_healthy")
