from sqlalchemy import Column, ForeignKey, Integer, String, Table
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

# Many-to-many: professor (user) ↔ tag
professor_tag_assignments = Table(
    "professor_tag_assignments",
    Base.metadata,
    Column("professor_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("professor_tags.id", ondelete="CASCADE"), primary_key=True),
)

# Many-to-many: course ↔ tag (which tags a course requires)
course_tag_assignments = Table(
    "course_tag_assignments",
    Base.metadata,
    Column("course_id", Integer, ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("professor_tags.id", ondelete="CASCADE"), primary_key=True),
)


class ProfessorTag(Base):
    __tablename__ = "professor_tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
