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

from app.database import Base
from app.models import *  # noqa: F403 - load all models before create_all

revision = "6084ce7c3961"
down_revision = None
branch_labels = None
depends_on = None


def _table_exists(table: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = :table"
        ),
        {"table": table},
    )
    return result.fetchone() is not None


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
    if not _table_exists("attendance_sessions"):
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
        Base.metadata.create_all(bind=op.get_bind())
        return

    if not _col_exists("attendance_sessions", "latitude"):
        op.add_column("attendance_sessions", sa.Column("latitude", sa.Float(), nullable=True))
    if not _col_exists("attendance_sessions", "longitude"):
        op.add_column("attendance_sessions", sa.Column("longitude", sa.Float(), nullable=True))
    if not _col_exists("attendance_sessions", "qr_secret"):
        op.add_column("attendance_sessions", sa.Column("qr_secret", sa.String(64), nullable=True))
    if not _col_exists("attendance_sessions", "qr_interval_seconds"):
        op.add_column("attendance_sessions", sa.Column("qr_interval_seconds", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("attendance_sessions", "qr_interval_seconds")
    op.drop_column("attendance_sessions", "qr_secret")
    op.drop_column("attendance_sessions", "longitude")
    op.drop_column("attendance_sessions", "latitude")
