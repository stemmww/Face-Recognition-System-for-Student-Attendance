from datetime import date, datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Table, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

MAJOR_NAMES: dict[str, str] = {
    "SE": "Software Engineering",
    "CS": "Computer Science",
    "BDA": "Big Data Analysis",
    "MCS": "Mathematical and Computational Science",
    "CB": "Cybersecurity",
    "SST": "Smart Security Technologies",
    "IIT": "Industrial Internet of Things",
    "EE": "Electronic Engineering",
    "ST": "Smart Technologies",
    "DTNPE": "Digital Technologies in Nuclear Power Engineering",
    "ITM": "IT Management",
    "ITE": "IT Entrepreneurship",
    "AIB": "AI Business",
    "MT": "Media Technologies",
    "DJ": "Digital Journalism",
}

VALID_MAJORS = set(MAJOR_NAMES.keys())
GROUP_TYPE_VALUES = ("MAIN", "ELECTIVE")
SEMESTER_VALUES = ("FALL", "WINTER", "SPRING")

# Many-to-many: group ↔ student (users)
group_students = Table(
    "group_students",
    Base.metadata,
    Column("group_id", Integer, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True),
    Column("student_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    major: Mapped[str] = mapped_column(String(10), nullable=False)        # SE/CS/etc — plain VARCHAR, not enum
    enrollment_year_short: Mapped[int] = mapped_column(Integer, nullable=False)
    group_number: Mapped[int] = mapped_column(Integer, nullable=False)
    group_type: Mapped[str] = mapped_column(String(10), nullable=False, default="MAIN")  # MAIN/ELECTIVE
    semester: Mapped[str | None] = mapped_column(String(10), nullable=True)   # FALL/WINTER/SPRING (ELECTIVE only)
    academic_year: Mapped[str | None] = mapped_column(String(9), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=func.now(), onupdate=func.now())

    students = relationship("User", secondary="group_students", lazy="selectin")

    @property
    def name(self) -> str:
        return f"{self.major}-{self.enrollment_year_short:02d}{self.group_number:02d}"

    @property
    def enrollment_year_full(self) -> int:
        return 2000 + self.enrollment_year_short

    @property
    def current_study_year(self) -> int:
        today = date.today()
        academic_year_start = today.year if today.month >= 9 else today.year - 1
        return academic_year_start - self.enrollment_year_full + 1
