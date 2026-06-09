"""add override_reason to attendance_records

Revision ID: a3f1d2e4b5c6
Revises: c8d7b8b4e2a1
Create Date: 2026-04-06 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "a3f1d2e4b5c6"
down_revision: str | None = "c8d7b8b4e2a1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _col_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :table AND column_name = :column"
        ),
        {"table": table, "column": column},
    )
    return result.fetchone() is not None


def upgrade() -> None:
    if not _col_exists("attendance_records", "override_reason"):
        op.add_column(
            "attendance_records",
            sa.Column("override_reason", sa.String(500), nullable=True),
        )


def downgrade() -> None:
    if _col_exists("attendance_records", "override_reason"):
        op.drop_column("attendance_records", "override_reason")
