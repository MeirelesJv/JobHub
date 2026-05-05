"""add_resume_summary

Revision ID: c9d2e4f1a3b8
Revises: fb96e190df47
Create Date: 2026-05-01 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c9d2e4f1a3b8'
down_revision: Union[str, None] = 'fb96e190df47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('resumes', sa.Column('summary', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('resumes', 'summary')
