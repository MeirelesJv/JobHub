"""resume_match_fields

Revision ID: e7f8a9b0c1d3
Revises: d6e7f8a9b0c1
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e7f8a9b0c1d3"
down_revision: Union[str, None] = "d6e7f8a9b0c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # resumes: gender + PCD
    op.add_column("resumes", sa.Column("gender", sa.String(50), nullable=True))
    op.add_column(
        "resumes",
        sa.Column("is_pcd", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.alter_column("resumes", "is_pcd", server_default=None)

    # resume_experiences: keywords
    op.add_column(
        "resume_experiences",
        sa.Column("keywords", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
    )
    op.alter_column("resume_experiences", "keywords", server_default=None)

    # resume_educations: type/status/expected completion, institution now optional
    op.add_column(
        "resume_educations",
        sa.Column("education_type", sa.String(50), nullable=False, server_default="graduacao"),
    )
    op.alter_column("resume_educations", "education_type", server_default=None)
    op.add_column(
        "resume_educations",
        sa.Column("status", sa.String(50), nullable=False, server_default="concluido"),
    )
    op.alter_column("resume_educations", "status", server_default=None)
    op.add_column("resume_educations", sa.Column("expected_completion_date", sa.Date(), nullable=True))

    op.execute("UPDATE resume_educations SET status = 'cursando' WHERE is_current IS TRUE")
    op.drop_column("resume_educations", "is_current")
    op.alter_column("resume_educations", "institution", existing_type=sa.String(255), nullable=True)


def downgrade() -> None:
    op.alter_column("resume_educations", "institution", existing_type=sa.String(255), nullable=False)
    op.add_column(
        "resume_educations",
        sa.Column("is_current", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.execute("UPDATE resume_educations SET is_current = TRUE WHERE status = 'cursando'")
    op.alter_column("resume_educations", "is_current", server_default=None)
    op.drop_column("resume_educations", "expected_completion_date")
    op.drop_column("resume_educations", "status")
    op.drop_column("resume_educations", "education_type")

    op.drop_column("resume_experiences", "keywords")

    op.drop_column("resumes", "is_pcd")
    op.drop_column("resumes", "gender")
