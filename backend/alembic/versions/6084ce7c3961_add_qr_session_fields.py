"""Add QR attendance fields to attendance_sessions.

Adds latitude, longitude, qr_secret, and qr_interval_seconds columns
needed for QR-based attendance with GPS verification and configurable
rotation intervals.

Revision ID: 6084ce7c3961
Revises: (initial)
Create Date: 2026-03-17
"""

from alembic import op
import sqlalchemy as sa

revision = "6084ce7c3961"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("attendance_sessions", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("attendance_sessions", sa.Column("longitude", sa.Float(), nullable=True))
    op.add_column("attendance_sessions", sa.Column("qr_secret", sa.String(64), nullable=True))
    op.add_column("attendance_sessions", sa.Column("qr_interval_seconds", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("attendance_sessions", "qr_interval_seconds")
    op.drop_column("attendance_sessions", "qr_secret")
    op.drop_column("attendance_sessions", "longitude")
    op.drop_column("attendance_sessions", "latitude")
