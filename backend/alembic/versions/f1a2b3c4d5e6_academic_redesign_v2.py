"""Academic redesign v2: fix enums to uppercase VARCHAR, add groups/classroom/course fields,
create professor_tags, course_tag_assignments tables, and fix semester types.

Revision ID: f1a2b3c4d5e6
Revises: d1e2f3a4b5c6
Create Date: 2026-05-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f1a2b3c4d5e6"
down_revision: str | None = "d1e2f3a4b5c6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# --------------------------------------------------------------------------- #
# Helpers                                                                       #
# --------------------------------------------------------------------------- #

def _col_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    r = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns WHERE table_name=:t AND column_name=:c"
        ),
        {"t": table, "c": column},
    )
    return r.fetchone() is not None


def _table_exists(table: str) -> bool:
    conn = op.get_bind()
    r = conn.execute(
        sa.text("SELECT 1 FROM information_schema.tables WHERE table_name=:t"),
        {"t": table},
    )
    return r.fetchone() is not None


def _enum_exists(name: str) -> bool:
    conn = op.get_bind()
    r = conn.execute(
        sa.text("SELECT 1 FROM pg_type WHERE typname=:n"),
        {"n": name},
    )
    return r.fetchone() is not None


def _col_data_type(table: str, column: str) -> str | None:
    """Return data_type from information_schema (e.g. 'integer', 'character varying', 'USER-DEFINED')."""
    conn = op.get_bind()
    r = conn.execute(
        sa.text(
            "SELECT data_type FROM information_schema.columns "
            "WHERE table_name=:t AND column_name=:c"
        ),
        {"t": table, "c": column},
    )
    row = r.fetchone()
    return row[0] if row else None


def upgrade() -> None:
    # ===================================================================== #
    # 1.  FIX SCHEDULES.day_of_week  (dayofweek enum → VARCHAR uppercase)   #
    # ===================================================================== #
    if _col_exists("schedules", "day_of_week"):
        dtype = _col_data_type("schedules", "day_of_week")
        if dtype == "USER-DEFINED":
            op.execute(
                "ALTER TABLE schedules ALTER COLUMN day_of_week "
                "TYPE VARCHAR(10) USING day_of_week::text"
            )
        op.execute("UPDATE schedules SET day_of_week = UPPER(day_of_week)")

    # ===================================================================== #
    # 2.  FIX SCHEDULES.lesson_type  (lessontype enum → VARCHAR uppercase)  #
    # ===================================================================== #
    if _col_exists("schedules", "lesson_type"):
        dtype = _col_data_type("schedules", "lesson_type")
        if dtype == "USER-DEFINED":
            op.execute(
                "ALTER TABLE schedules ALTER COLUMN lesson_type "
                "TYPE VARCHAR(10) USING lesson_type::text"
            )
        op.execute("UPDATE schedules SET lesson_type = UPPER(lesson_type) WHERE lesson_type IS NOT NULL")
    else:
        op.add_column("schedules", sa.Column("lesson_type", sa.String(10), nullable=True))
        op.execute("UPDATE schedules SET lesson_type = 'LECTURE' WHERE lesson_type IS NULL")
        op.execute("ALTER TABLE schedules ALTER COLUMN lesson_type SET NOT NULL")

    # ===================================================================== #
    # 3.  FIX SCHEDULES.semester  (INTEGER → VARCHAR FALL/WINTER/SPRING)    #
    # ===================================================================== #
    if _col_exists("schedules", "semester"):
        dtype = _col_data_type("schedules", "semester")
        if dtype == "integer":
            # Convert 1→FALL, 2→WINTER, 3→SPRING then cast column
            op.execute("ALTER TABLE schedules ALTER COLUMN semester DROP NOT NULL")
            op.execute("ALTER TABLE schedules ADD COLUMN semester_str VARCHAR(10)")
            op.execute(
                "UPDATE schedules SET semester_str = "
                "CASE semester WHEN 1 THEN 'FALL' WHEN 2 THEN 'WINTER' WHEN 3 THEN 'SPRING' ELSE 'FALL' END"
            )
            op.execute("ALTER TABLE schedules DROP COLUMN semester")
            op.execute("ALTER TABLE schedules RENAME COLUMN semester_str TO semester")
    else:
        op.add_column("schedules", sa.Column("semester", sa.String(10), nullable=True))

    # ===================================================================== #
    # 4.  ADD created_at / updated_at to schedules                           #
    # ===================================================================== #
    if not _col_exists("schedules", "created_at"):
        op.add_column(
            "schedules",
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
    if not _col_exists("schedules", "updated_at"):
        op.add_column(
            "schedules",
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )

    # Make schedules.room nullable if it isn't already
    if _col_exists("schedules", "room"):
        op.execute(
            "ALTER TABLE schedules ALTER COLUMN room DROP NOT NULL"
        )

    # ===================================================================== #
    # 5.  FIX GROUPS.major  (majorcode enum → VARCHAR, keep values)          #
    # ===================================================================== #
    if _col_exists("groups", "major"):
        dtype = _col_data_type("groups", "major")
        if dtype == "USER-DEFINED":
            op.execute(
                "ALTER TABLE groups ALTER COLUMN major "
                "TYPE VARCHAR(10) USING major::text"
            )
    if _enum_exists("majorcode"):
        op.execute("DROP TYPE IF EXISTS majorcode")

    # ===================================================================== #
    # 6.  FIX GROUPS.group_type  (grouptype enum → VARCHAR, rename values)   #
    # ===================================================================== #
    if _col_exists("groups", "group_type"):
        dtype = _col_data_type("groups", "group_type")
        if dtype == "USER-DEFINED":
            op.execute(
                "ALTER TABLE groups ALTER COLUMN group_type "
                "TYPE VARCHAR(10) USING group_type::text"
            )
        # Rename old values → new values
        op.execute("UPDATE groups SET group_type = 'MAIN' WHERE LOWER(group_type) = 'official'")
        op.execute("UPDATE groups SET group_type = 'ELECTIVE' WHERE LOWER(group_type) = 'temporary'")
        # Ensure default is correct
        op.execute(
            "UPDATE groups SET group_type = 'MAIN' "
            "WHERE group_type NOT IN ('MAIN','ELECTIVE') OR group_type IS NULL"
        )
    if _enum_exists("grouptype"):
        op.execute("DROP TYPE IF EXISTS grouptype")

    # ===================================================================== #
    # 7.  ADD new columns to groups                                           #
    # ===================================================================== #
    if not _col_exists("groups", "semester"):
        op.add_column("groups", sa.Column("semester", sa.String(10), nullable=True))
    if not _col_exists("groups", "academic_year"):
        op.add_column("groups", sa.Column("academic_year", sa.String(9), nullable=True))
    if not _col_exists("groups", "created_at"):
        op.add_column(
            "groups",
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
    if not _col_exists("groups", "updated_at"):
        op.add_column(
            "groups",
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )

    # ===================================================================== #
    # 8.  ADD new columns to classrooms                                       #
    # ===================================================================== #
    if not _col_exists("classrooms", "block"):
        op.add_column("classrooms", sa.Column("block", sa.String(10), nullable=True))
    if not _col_exists("classrooms", "floor"):
        op.add_column("classrooms", sa.Column("floor", sa.Integer(), nullable=True))
    if not _col_exists("classrooms", "room_number"):
        op.add_column("classrooms", sa.Column("room_number", sa.String(10), nullable=True))
    if not _col_exists("classrooms", "created_at"):
        op.add_column(
            "classrooms",
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
    if not _col_exists("classrooms", "updated_at"):
        op.add_column(
            "classrooms",
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
    # Ensure room_type column exists (it should, from d1e2f3a4b5c6 or original schema)
    if not _col_exists("classrooms", "room_type"):
        op.add_column("classrooms", sa.Column("room_type", sa.String(5), nullable=True))

    # ===================================================================== #
    # 9.  ADD lesson_type / group_type / updated_at to courses               #
    # ===================================================================== #
    if not _col_exists("courses", "lesson_type"):
        op.add_column("courses", sa.Column("lesson_type", sa.String(10), nullable=True))
    if not _col_exists("courses", "group_type"):
        op.add_column("courses", sa.Column("group_type", sa.String(10), nullable=True))
    if not _col_exists("courses", "updated_at"):
        op.add_column(
            "courses",
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )

    # ===================================================================== #
    # 10. FIX professor_availability.day_of_week  (enum → VARCHAR uppercase) #
    # ===================================================================== #
    if _table_exists("professor_availability") and _col_exists("professor_availability", "day_of_week"):
        dtype = _col_data_type("professor_availability", "day_of_week")
        if dtype == "USER-DEFINED":
            op.execute(
                "ALTER TABLE professor_availability ALTER COLUMN day_of_week "
                "TYPE VARCHAR(10) USING day_of_week::text"
            )
        op.execute(
            "UPDATE professor_availability SET day_of_week = UPPER(day_of_week)"
        )
    # Drop dayofweek enum after all columns are converted
    if _enum_exists("dayofweek"):
        op.execute("DROP TYPE IF EXISTS dayofweek")
    if _enum_exists("lessontype"):
        op.execute("DROP TYPE IF EXISTS lessontype")

    # ===================================================================== #
    # 11. FIX group_subjects.semester  (INTEGER → VARCHAR)                   #
    # ===================================================================== #
    if _table_exists("group_subjects") and _col_exists("group_subjects", "semester"):
        dtype = _col_data_type("group_subjects", "semester")
        if dtype == "integer":
            op.execute("ALTER TABLE group_subjects ADD COLUMN semester_str VARCHAR(10)")
            op.execute(
                "UPDATE group_subjects SET semester_str = "
                "CASE semester WHEN 1 THEN 'FALL' WHEN 2 THEN 'WINTER' WHEN 3 THEN 'SPRING' ELSE 'FALL' END"
            )
            # Drop old unique constraint, drop old column, rename new column, re-add constraint
            try:
                op.drop_constraint("uq_group_subject_semester", "group_subjects")
            except Exception:
                pass
            op.execute("ALTER TABLE group_subjects DROP COLUMN semester")
            op.execute("ALTER TABLE group_subjects RENAME COLUMN semester_str TO semester")
            op.execute("ALTER TABLE group_subjects ALTER COLUMN semester SET NOT NULL")
            op.create_unique_constraint(
                "uq_group_subject_semester",
                "group_subjects",
                ["group_id", "course_id", "semester"],
            )

    # ===================================================================== #
    # 12. CREATE professor_tags                                               #
    # ===================================================================== #
    if not _table_exists("professor_tags"):
        op.create_table(
            "professor_tags",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(100), nullable=False, unique=True),
        )

    # ===================================================================== #
    # 13. CREATE professor_tag_assignments                                    #
    # ===================================================================== #
    if not _table_exists("professor_tag_assignments"):
        op.create_table(
            "professor_tag_assignments",
            sa.Column(
                "professor_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                primary_key=True,
            ),
            sa.Column(
                "tag_id",
                sa.Integer(),
                sa.ForeignKey("professor_tags.id", ondelete="CASCADE"),
                primary_key=True,
            ),
        )

    # ===================================================================== #
    # 14. CREATE course_tag_assignments                                       #
    # ===================================================================== #
    if not _table_exists("course_tag_assignments"):
        op.create_table(
            "course_tag_assignments",
            sa.Column(
                "course_id",
                sa.Integer(),
                sa.ForeignKey("courses.id", ondelete="CASCADE"),
                primary_key=True,
            ),
            sa.Column(
                "tag_id",
                sa.Integer(),
                sa.ForeignKey("professor_tags.id", ondelete="CASCADE"),
                primary_key=True,
            ),
        )


def downgrade() -> None:
    for tbl in ("course_tag_assignments", "professor_tag_assignments", "professor_tags"):
        if _table_exists(tbl):
            op.drop_table(tbl)

    for col in ("lesson_type", "group_type", "updated_at"):
        if _col_exists("courses", col):
            op.drop_column("courses", col)

    for col in ("block", "floor", "room_number", "created_at", "updated_at"):
        if _col_exists("classrooms", col):
            op.drop_column("classrooms", col)

    for col in ("semester", "academic_year", "created_at", "updated_at"):
        if _col_exists("groups", col):
            op.drop_column("groups", col)

    for col in ("created_at", "updated_at"):
        if _col_exists("schedules", col):
            op.drop_column("schedules", col)
