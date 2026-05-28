from datetime import datetime

from pydantic import BaseModel, field_validator

from app.models.group import GROUP_TYPE_VALUES, SEMESTER_VALUES
from app.models.schedule import LESSON_TYPE_VALUES


def _validate_academic_year(value: str) -> str:
    normalized = value.strip()
    parts = normalized.split("-")
    if len(parts) != 2 or not all(part.isdigit() and len(part) == 4 for part in parts):
        raise ValueError("Academic year must be in YYYY-YYYY format")
    start_year, end_year = (int(part) for part in parts)
    if end_year != start_year + 1:
        raise ValueError("Academic year must span two consecutive years, e.g. 2025-2026")
    return f"{start_year}-{end_year}"


class CourseCreate(BaseModel):
    # code is auto-generated; do not accept from user
    name: str
    description: str | None = None
    semester: str
    academic_year: str
    lesson_type: str | None = None   # LECTURE/PRACTICE
    group_type: str | None = None    # MAIN/ELECTIVE

    @field_validator("academic_year")
    @classmethod
    def validate_academic_year(cls, value: str) -> str:
        return _validate_academic_year(value)

    @field_validator("semester")
    @classmethod
    def validate_semester(cls, v: str) -> str:
        v = v.upper()
        if v not in SEMESTER_VALUES:
            raise ValueError(f"semester must be one of {SEMESTER_VALUES}")
        return v

    @field_validator("lesson_type")
    @classmethod
    def validate_lesson_type(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.upper()
        if v not in LESSON_TYPE_VALUES:
            raise ValueError(f"lesson_type must be one of {LESSON_TYPE_VALUES}")
        return v

    @field_validator("group_type")
    @classmethod
    def validate_group_type(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.upper()
        if v not in GROUP_TYPE_VALUES:
            raise ValueError(f"group_type must be one of {GROUP_TYPE_VALUES}")
        return v


class CourseUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    description: str | None = None
    semester: str | None = None
    academic_year: str | None = None
    lesson_type: str | None = None
    group_type: str | None = None

    @field_validator("academic_year")
    @classmethod
    def validate_academic_year(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return _validate_academic_year(value)

    @field_validator("semester")
    @classmethod
    def validate_semester(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.upper()
        if v not in SEMESTER_VALUES:
            raise ValueError(f"semester must be one of {SEMESTER_VALUES}")
        return v


class CourseOut(BaseModel):
    id: int
    code: str
    name: str
    description: str | None
    semester: str
    academic_year: str
    lesson_type: str | None = None
    group_type: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EnrollmentRequest(BaseModel):
    student_ids: list[int]


class ProfessorAssignRequest(BaseModel):
    professor_ids: list[int]
