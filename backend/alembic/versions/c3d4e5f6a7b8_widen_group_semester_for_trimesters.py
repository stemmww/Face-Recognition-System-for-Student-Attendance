"""Widen group semester for trimester values.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-08
"""

from collections.abc import Sequence

from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: str | None = "b2c3d4e5f6a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE groups ALTER COLUMN semester TYPE VARCHAR(20)")


def downgrade() -> None:
    op.execute("ALTER TABLE groups ALTER COLUMN semester TYPE VARCHAR(10)")
