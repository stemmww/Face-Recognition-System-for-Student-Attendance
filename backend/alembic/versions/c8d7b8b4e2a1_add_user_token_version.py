"""add user token version

Revision ID: c8d7b8b4e2a1
Revises: 6084ce7c3961
Create Date: 2026-04-05 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "c8d7b8b4e2a1"
down_revision: str | None = "6084ce7c3961"
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
    if not _col_exists("users", "token_version"):
        op.add_column(
            "users",
            sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"),
        )
        op.alter_column("users", "token_version", server_default=None)


def downgrade() -> None:
    if _col_exists("users", "token_version"):
        op.drop_column("users", "token_version")
