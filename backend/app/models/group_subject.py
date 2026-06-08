from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class GroupSubject(Base):
    """Curriculum mapping: which course belongs to a group in which trimester."""

    __tablename__ = "group_subjects"
    __table_args__ = (
        UniqueConstraint("group_id", "course_id", "semester", name="uq_group_subject_semester"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    semester: Mapped[str] = mapped_column(String(20), nullable=False)   # TRIMESTER_1/2/3

    group = relationship("Group", backref="group_subjects")
    course = relationship("Course", backref="group_subjects")
