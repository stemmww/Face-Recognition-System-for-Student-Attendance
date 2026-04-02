from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CourseProf(Base):
    """Association table linking courses to professors."""

    __tablename__ = "course_professors"

    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True)
    professor_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    semester: Mapped[str] = mapped_column(String(20), nullable=False)
    academic_year: Mapped[str] = mapped_column(String(9), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    professors = relationship("User", secondary="course_professors", backref="taught_courses")
    enrollments = relationship("Enrollment", back_populates="course")
    schedules = relationship("Schedule", back_populates="course")
