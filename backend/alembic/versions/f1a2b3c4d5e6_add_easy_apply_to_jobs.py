"""add easy_apply to jobs

Revision ID: f1a2b3c4d5e6
Revises: a1b2c3d4e5f6
Create Date: 2025-05-04

"""
from alembic import op
import sqlalchemy as sa

revision = 'f1a2b3c4d5e6'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('jobs', sa.Column('easy_apply', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('jobs', 'easy_apply')
