from datetime import datetime

from pydantic import BaseModel, field_validator


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
    code: str
    name: str
    description: str | None = None
    semester: str
    academic_year: str

    @field_validator("academic_year")
    @classmethod
    def validate_academic_year(cls, value: str) -> str:
        return _validate_academic_year(value)


class CourseUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    semester: str | None = None
    academic_year: str | None = None

    @field_validator("academic_year")
    @classmethod
    def validate_academic_year(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return _validate_academic_year(value)


class CourseOut(BaseModel):
    id: int
    code: str
    name: str
    description: str | None
    semester: str
    academic_year: str
    created_at: datetime

    model_config = {"from_attributes": True}


class EnrollmentRequest(BaseModel):
    student_ids: list[int]


class ProfessorAssignRequest(BaseModel):
    professor_ids: list[int]
