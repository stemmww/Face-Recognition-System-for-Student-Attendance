from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Table, Time, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

DAY_OF_WEEK_VALUES = ("MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY")
LESSON_TYPE_VALUES = ("LECTURE", "PRACTICE")
SEMESTER_VALUES = ("FALL", "WINTER", "SPRING")

# Many-to-many: schedule ↔ group
schedule_groups = Table(
    "schedule_groups",
    Base.metadata,
    Column("schedule_id", Integer, ForeignKey("schedules.id", ondelete="CASCADE"), primary_key=True),
    Column("group_id", Integer, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True),
)


class Schedule(Base):
    __tablename__ = "schedules"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    professor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    classroom_id: Mapped[int | None] = mapped_column(ForeignKey("classrooms.id", ondelete="SET NULL"), nullable=True)
    day_of_week: Mapped[str] = mapped_column(String(10), nullable=False)           # MONDAY-SUNDAY uppercase
    start_time: Mapped[str] = mapped_column(Time, nullable=False)
    end_time: Mapped[str] = mapped_column(Time, nullable=False)
    room: Mapped[str | None] = mapped_column(String(50), nullable=True)            # kept for backward compat
    lesson_type: Mapped[str] = mapped_column(String(10), nullable=False, default="LECTURE")  # LECTURE/PRACTICE
    semester: Mapped[str | None] = mapped_column(String(10), nullable=True)        # FALL/WINTER/SPRING
    academic_year: Mapped[str | None] = mapped_column(String(9), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=func.now(), onupdate=func.now())

    course = relationship("Course", back_populates="schedules")
    professor = relationship("User", foreign_keys=[professor_id])
    classroom = relationship("Classroom", back_populates="schedules")
    sessions = relationship("AttendanceSession", back_populates="schedule")
    groups = relationship("Group", secondary="schedule_groups", lazy="selectin")
