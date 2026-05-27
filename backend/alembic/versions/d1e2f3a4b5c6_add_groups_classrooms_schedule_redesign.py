"""Add groups, classrooms, and schedule redesign

Creates:
  - classrooms table
  - groups table (with MajorCode / GroupType enums)
  - group_students junction table
  - schedule_groups junction table
  - group_subjects table
  - professor_availability table

Alters schedules:
  - Adds professor_id, classroom_id, room, lesson_type, semester, academic_year
  - Drops old class_type column (if it exists)
  - Creates lessontype enum

Revision ID: d1e2f3a4b5c6
Revises: a3f1d2e4b5c6
Create Date: 2026-05-19
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d1e2f3a4b5c6"
down_revision: str | None = "a3f1d2e4b5c6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# --------------------------------------------------------------------------- #
# Helper: check if a column exists in a table (works on PostgreSQL)           #
# --------------------------------------------------------------------------- #
def _column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = :t AND column_name = :c"
        ),
        {"t": table, "c": column},
    )
    return result.fetchone() is not None


def _table_exists(table: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_name = :t"
        ),
        {"t": table},
    )
    return result.fetchone() is not None


def _enum_exists(name: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT 1 FROM pg_type WHERE typname = :n"),
        {"n": name},
    )
    return result.fetchone() is not None


def upgrade() -> None:
    # ------------------------------------------------------------------ #
    # 1. Create PostgreSQL enum types (if they don't exist)               #
    # ------------------------------------------------------------------ #
    if not _enum_exists("majorcode"):
        op.execute(
            "CREATE TYPE majorcode AS ENUM "
            "('SE','CS','BDA','MCS','CB','SST','IIT','EE','ST','DTNPE','ITM','ITE','AIB','MT','DJ')"
        )

    if not _enum_exists("grouptype"):
        op.execute("CREATE TYPE grouptype AS ENUM ('official','temporary')")

    if not _enum_exists("lessontype"):
        op.execute("CREATE TYPE lessontype AS ENUM ('lecture','practice')")

    # dayofweek may already exist from the original schedules table
    if not _enum_exists("dayofweek"):
        op.execute(
            "CREATE TYPE dayofweek AS ENUM "
            "('monday','tuesday','wednesday','thursday','friday','saturday')"
        )

    # ------------------------------------------------------------------ #
    # 2. classrooms                                                        #
    # ------------------------------------------------------------------ #
    if not _table_exists("classrooms"):
        op.create_table(
            "classrooms",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(50), nullable=False, unique=True),
            sa.Column("capacity", sa.Integer(), nullable=True),
            sa.Column("room_type", sa.String(50), nullable=True),
            sa.Column("building", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        )

    # ------------------------------------------------------------------ #
    # 3. groups                                                            #
    # ------------------------------------------------------------------ #
    if not _table_exists("groups"):
        op.create_table(
            "groups",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "major",
                postgresql.ENUM(
                    "SE","CS","BDA","MCS","CB","SST","IIT","EE","ST",
                    "DTNPE","ITM","ITE","AIB","MT","DJ",
                    name="majorcode", create_type=False,
                ),
                nullable=False,
            ),
            sa.Column("enrollment_year_short", sa.Integer(), nullable=False),
            sa.Column("group_number", sa.Integer(), nullable=False),
            sa.Column(
                "group_type",
                postgresql.ENUM("official", "temporary", name="grouptype", create_type=False),
                nullable=False,
                server_default="official",
            ),
            sa.Column("parent_group_id", sa.Integer(), sa.ForeignKey("groups.id", ondelete="SET NULL"), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        )

    # ------------------------------------------------------------------ #
    # 4. group_students junction                                           #
    # ------------------------------------------------------------------ #
    if not _table_exists("group_students"):
        op.create_table(
            "group_students",
            sa.Column("group_id", sa.Integer(), sa.ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        )

    # ------------------------------------------------------------------ #
    # 5. schedule_groups junction                                          #
    # ------------------------------------------------------------------ #
    if not _table_exists("schedule_groups"):
        op.create_table(
            "schedule_groups",
            sa.Column("schedule_id", sa.Integer(), sa.ForeignKey("schedules.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("group_id", sa.Integer(), sa.ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True),
        )

    # ------------------------------------------------------------------ #
    # 6. group_subjects                                                    #
    # ------------------------------------------------------------------ #
    if not _table_exists("group_subjects"):
        op.create_table(
            "group_subjects",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("group_id", sa.Integer(), sa.ForeignKey("groups.id", ondelete="CASCADE"), nullable=False),
            sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
            sa.Column("semester", sa.Integer(), nullable=False),
            sa.UniqueConstraint("group_id", "course_id", "semester", name="uq_group_subject_semester"),
        )

    # ------------------------------------------------------------------ #
    # 7. professor_availability                                            #
    # ------------------------------------------------------------------ #
    if not _table_exists("professor_availability"):
        op.create_table(
            "professor_availability",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("professor_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column(
                "day_of_week",
                postgresql.ENUM(
                    "monday","tuesday","wednesday","thursday","friday","saturday",
                    name="dayofweek", create_type=False,
                ),
                nullable=False,
            ),
            sa.Column("start_time", sa.Time(), nullable=False),
            sa.Column("end_time", sa.Time(), nullable=False),
        )

    # ------------------------------------------------------------------ #
    # 8. Alter schedules table                                             #
    # ------------------------------------------------------------------ #
    if not _column_exists("schedules", "professor_id"):
        op.add_column(
            "schedules",
            sa.Column("professor_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        )

    if not _column_exists("schedules", "classroom_id"):
        op.add_column(
            "schedules",
            sa.Column("classroom_id", sa.Integer(), sa.ForeignKey("classrooms.id", ondelete="SET NULL"), nullable=True),
        )

    if not _column_exists("schedules", "room"):
        op.add_column(
            "schedules",
            sa.Column("room", sa.String(50), nullable=True),
        )

    if not _column_exists("schedules", "lesson_type"):
        # asyncpg can't handle enum DEFAULT in ADD COLUMN; add nullable, fill, then constrain
        op.execute("ALTER TABLE schedules ADD COLUMN lesson_type lessontype")
        op.execute("UPDATE schedules SET lesson_type = 'lecture'::lessontype WHERE lesson_type IS NULL")
        op.execute("ALTER TABLE schedules ALTER COLUMN lesson_type SET NOT NULL")

    if not _column_exists("schedules", "semester"):
        op.execute("ALTER TABLE schedules ADD COLUMN semester INTEGER")
        op.execute("UPDATE schedules SET semester = 1 WHERE semester IS NULL")
        op.execute("ALTER TABLE schedules ALTER COLUMN semester SET NOT NULL")

    if not _column_exists("schedules", "academic_year"):
        op.add_column(
            "schedules",
            sa.Column("academic_year", sa.String(9), nullable=True),
        )

    # Drop old class_type column if it exists
    if _column_exists("schedules", "class_type"):
        op.drop_column("schedules", "class_type")


def downgrade() -> None:
    # Restore class_type (best effort, data is lost)
    if not _column_exists("schedules", "class_type"):
        op.execute(
            "DO $$ BEGIN "
            "IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'classtype') THEN "
            "CREATE TYPE classtype AS ENUM ('lecture','lab','seminar'); "
            "END IF; END $$"
        )
        op.add_column(
            "schedules",
            sa.Column("class_type", sa.Enum("lecture", "lab", "seminar", name="classtype"), nullable=True),
        )

    for col in ("academic_year", "semester", "lesson_type", "room", "classroom_id", "professor_id"):
        if _column_exists("schedules", col):
            op.drop_column("schedules", col)

    for tbl in ("professor_availability", "group_subjects", "schedule_groups", "group_students", "groups", "classrooms"):
        if _table_exists(tbl):
            op.drop_table(tbl)

    for enum in ("lessontype", "grouptype", "majorcode"):
        op.execute(f"DROP TYPE IF EXISTS {enum}")
