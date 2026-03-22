"""Add qr_interval_seconds column to attendance_sessions.

Revision ID: 002
Revises: 001
"""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "attendance_sessions",
        sa.Column("qr_interval_seconds", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("attendance_sessions", "qr_interval_seconds")
