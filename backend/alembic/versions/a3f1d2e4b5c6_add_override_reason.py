"""add override_reason to attendance_records

Revision ID: a3f1d2e4b5c6
Revises: c8d7b8b4e2a1
Create Date: 2026-04-06 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "a3f1d2e4b5c6"
down_revision: Union[str, None] = "c8d7b8b4e2a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "attendance_records",
        sa.Column("override_reason", sa.String(500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("attendance_records", "override_reason")
