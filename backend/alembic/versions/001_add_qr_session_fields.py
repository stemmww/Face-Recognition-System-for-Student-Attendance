"""Add latitude, longitude, qr_secret to attendance_sessions

Revision ID: 001_qr_fields
Revises:
Create Date: 2026-03-17
"""

from alembic import op
import sqlalchemy as sa

revision = "001_qr_fields"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("attendance_sessions", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("attendance_sessions", sa.Column("longitude", sa.Float(), nullable=True))
    op.add_column("attendance_sessions", sa.Column("qr_secret", sa.String(64), nullable=True))


def downgrade() -> None:
    op.drop_column("attendance_sessions", "qr_secret")
    op.drop_column("attendance_sessions", "longitude")
    op.drop_column("attendance_sessions", "latitude")
