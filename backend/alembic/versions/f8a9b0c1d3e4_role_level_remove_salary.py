"""role_level_remove_salary

Revision ID: f8a9b0c1d3e4
Revises: e7f8a9b0c1d3
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f8a9b0c1d3e4"
down_revision: Union[str, None] = "e7f8a9b0c1d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user_desired_roles", sa.Column("level", sa.String(50), nullable=True))

    # Best-effort carry-over: seed each existing role's level from the old global preference
    op.execute(
        "UPDATE user_desired_roles ur SET level = u.level_preference "
        "FROM users u WHERE ur.user_id = u.id AND u.level_preference IS NOT NULL"
    )

    op.drop_column("users", "level_preference")
    op.drop_column("users", "salary_expectation_min")


def downgrade() -> None:
    op.add_column("users", sa.Column("salary_expectation_min", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("level_preference", sa.String(50), nullable=True))

    op.execute(
        "UPDATE users u SET level_preference = ur.level "
        "FROM user_desired_roles ur "
        "WHERE ur.user_id = u.id AND ur.is_primary IS TRUE AND ur.level IS NOT NULL"
    )

    op.drop_column("user_desired_roles", "level")
