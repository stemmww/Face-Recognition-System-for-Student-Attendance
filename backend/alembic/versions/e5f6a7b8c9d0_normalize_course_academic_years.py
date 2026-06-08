"""Normalize legacy course academic years.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-06-08 00:00:00.000000
"""

from alembic import op


revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE courses
        SET academic_year = academic_year || '-' || ((academic_year::integer + 1)::text)
        WHERE academic_year ~ '^[0-9]{4}$'
        """
    )


def downgrade() -> None:
    pass
