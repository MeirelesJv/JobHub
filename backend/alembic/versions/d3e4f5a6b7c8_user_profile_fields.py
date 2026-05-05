"""user_profile_fields

Revision ID: d3e4f5a6b7c8
Revises: c9d2e4f1a3b8
Create Date: 2026-05-01 00:01:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd3e4f5a6b7c8'
down_revision: Union[str, None] = 'c9d2e4f1a3b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('desired_role', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('location_preference', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('job_type_preference', sa.String(length=50), nullable=True))
    op.add_column('users', sa.Column('level_preference', sa.String(length=50), nullable=True))
    op.add_column('users', sa.Column('remote_preference', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('users', sa.Column('salary_expectation_min', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('onboarding_completed', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column('users', 'onboarding_completed')
    op.drop_column('users', 'salary_expectation_min')
    op.drop_column('users', 'remote_preference')
    op.drop_column('users', 'level_preference')
    op.drop_column('users', 'job_type_preference')
    op.drop_column('users', 'location_preference')
    op.drop_column('users', 'desired_role')
