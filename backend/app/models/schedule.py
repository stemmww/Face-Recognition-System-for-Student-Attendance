import enum

from sqlalchemy import Enum, ForeignKey, String, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DayOfWeek(str, enum.Enum):
    MONDAY = "monday"
    TUESDAY = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY = "thursday"
    FRIDAY = "friday"
    SATURDAY = "saturday"


class ClassType(str, enum.Enum):
    LECTURE = "lecture"
    LAB = "lab"
    SEMINAR = "seminar"


class Schedule(Base):
    __tablename__ = "schedules"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    day_of_week: Mapped[DayOfWeek] = mapped_column(Enum(DayOfWeek), nullable=False)
    start_time: Mapped[str] = mapped_column(Time, nullable=False)
    end_time: Mapped[str] = mapped_column(Time, nullable=False)
    room: Mapped[str] = mapped_column(String(50), nullable=False)
    class_type: Mapped[ClassType] = mapped_column(Enum(ClassType), default=ClassType.LECTURE)

    course = relationship("Course", back_populates="schedules")
    sessions = relationship("AttendanceSession", back_populates="schedule")
