"""Fix users.created_at missing DEFAULT now()

Revision ID: e9f0a1b2c3d4
Revises: f1a2b3c4d5e6
Create Date: 2026-05-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e9f0a1b2c3d4"
down_revision: str | None = "f1a2b3c4d5e6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ALTER COLUMN created_at SET DEFAULT now()")
    op.execute("UPDATE users SET created_at = now() WHERE created_at IS NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE users ALTER COLUMN created_at DROP DEFAULT")
