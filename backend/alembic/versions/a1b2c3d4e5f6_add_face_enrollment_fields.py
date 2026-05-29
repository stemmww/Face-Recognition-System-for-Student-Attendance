"""Add face self-enrollment fields to users table.

Revision ID: a1b2c3d4e5f6
Revises: f1a2b3c4d5e6
Create Date: 2026-05-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "e9f0a1b2c3d4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _col_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    r = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns WHERE table_name=:t AND column_name=:c"
        ),
        {"t": table, "c": column},
    )
    return r.fetchone() is not None


def upgrade() -> None:
    if not _col_exists("users", "can_self_enroll_face"):
        op.add_column(
            "users",
            sa.Column("can_self_enroll_face", sa.Boolean(), nullable=False, server_default="false"),
        )
    if not _col_exists("users", "face_enrollment_status"):
        op.add_column(
            "users",
            sa.Column("face_enrollment_status", sa.String(30), nullable=True, server_default="NOT_STARTED"),
        )
    if not _col_exists("users", "face_enrolled_at"):
        op.add_column(
            "users",
            sa.Column("face_enrolled_at", sa.DateTime(timezone=True), nullable=True),
        )
    if not _col_exists("users", "face_enrollment_consent_at"):
        op.add_column(
            "users",
            sa.Column("face_enrollment_consent_at", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    for col in ("face_enrollment_consent_at", "face_enrolled_at", "face_enrollment_status", "can_self_enroll_face"):
        if _col_exists("users", col):
            op.drop_column("users", col)
