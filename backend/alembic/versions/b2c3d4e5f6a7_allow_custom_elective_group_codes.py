"""Allow custom elective group codes.

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-08
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: str | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _col_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name=:table AND column_name=:column"
        ),
        {"table": table, "column": column},
    )
    return result.fetchone() is not None


def upgrade() -> None:
    if not _col_exists("groups", "code"):
        op.add_column("groups", sa.Column("code", sa.String(50), nullable=True))

    op.execute(
        """
        UPDATE groups
        SET code = major || '-' || LPAD(enrollment_year_short::text, 2, '0') || LPAD(group_number::text, 2, '0')
        WHERE code IS NULL
          AND major IS NOT NULL
          AND enrollment_year_short IS NOT NULL
          AND group_number IS NOT NULL
        """
    )

    op.alter_column("groups", "major", existing_type=sa.String(10), nullable=True)
    op.alter_column("groups", "enrollment_year_short", existing_type=sa.Integer(), nullable=True)
    op.alter_column("groups", "group_number", existing_type=sa.Integer(), nullable=True)
    op.alter_column("groups", "semester", existing_type=sa.String(10), type_=sa.String(20), nullable=True)

    op.execute(
        """
        UPDATE groups
        SET semester = CASE semester
            WHEN 'FALL' THEN 'TRIMESTER_1'
            WHEN 'WINTER' THEN 'TRIMESTER_2'
            WHEN 'SPRING' THEN 'TRIMESTER_3'
            ELSE semester
        END
        WHERE semester IN ('FALL', 'WINTER', 'SPRING')
        """
    )


def downgrade() -> None:
    op.execute("UPDATE groups SET major = COALESCE(major, 'SE') WHERE major IS NULL")
    op.execute("UPDATE groups SET enrollment_year_short = COALESCE(enrollment_year_short, 0) WHERE enrollment_year_short IS NULL")
    op.execute("UPDATE groups SET group_number = COALESCE(group_number, id) WHERE group_number IS NULL")

    op.alter_column("groups", "group_number", existing_type=sa.Integer(), nullable=False)
    op.alter_column("groups", "enrollment_year_short", existing_type=sa.Integer(), nullable=False)
    op.alter_column("groups", "major", existing_type=sa.String(10), nullable=False)
    op.execute(
        """
        UPDATE groups
        SET semester = CASE semester
            WHEN 'TRIMESTER_1' THEN 'FALL'
            WHEN 'TRIMESTER_2' THEN 'WINTER'
            WHEN 'TRIMESTER_3' THEN 'SPRING'
            ELSE semester
        END
        WHERE semester IN ('TRIMESTER_1', 'TRIMESTER_2', 'TRIMESTER_3')
        """
    )
    op.alter_column("groups", "semester", existing_type=sa.String(20), type_=sa.String(10), nullable=True)

    if _col_exists("groups", "code"):
        op.drop_column("groups", "code")
