"""Use trimesters for academic terms.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-08
"""

from collections.abc import Sequence

from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: str | None = "c3d4e5f6a7b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _convert_to_trimesters(table: str) -> None:
    op.execute(
        f"""
        UPDATE {table}
        SET semester = CASE UPPER(semester)
            WHEN 'FALL' THEN 'TRIMESTER_1'
            WHEN 'WINTER' THEN 'TRIMESTER_2'
            WHEN 'SPRING' THEN 'TRIMESTER_3'
            WHEN 'SUMMER' THEN 'TRIMESTER_3'
            WHEN '1' THEN 'TRIMESTER_1'
            WHEN '2' THEN 'TRIMESTER_2'
            WHEN '3' THEN 'TRIMESTER_3'
            ELSE semester
        END
        WHERE semester IS NOT NULL
        """
    )


def _convert_to_semesters(table: str) -> None:
    op.execute(
        f"""
        UPDATE {table}
        SET semester = CASE semester
            WHEN 'TRIMESTER_1' THEN 'FALL'
            WHEN 'TRIMESTER_2' THEN 'WINTER'
            WHEN 'TRIMESTER_3' THEN 'SPRING'
            ELSE semester
        END
        WHERE semester IS NOT NULL
        """
    )


def upgrade() -> None:
    op.execute("ALTER TABLE schedules ALTER COLUMN semester TYPE VARCHAR(20)")
    op.execute("ALTER TABLE group_subjects ALTER COLUMN semester TYPE VARCHAR(20)")

    for table in ("courses", "schedules", "group_subjects"):
        _convert_to_trimesters(table)


def downgrade() -> None:
    for table in ("courses", "schedules", "group_subjects"):
        _convert_to_semesters(table)

    op.execute("ALTER TABLE group_subjects ALTER COLUMN semester TYPE VARCHAR(10)")
    op.execute("ALTER TABLE schedules ALTER COLUMN semester TYPE VARCHAR(10)")
