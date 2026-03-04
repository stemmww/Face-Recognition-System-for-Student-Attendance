from datetime import datetime

from pydantic import BaseModel


class CourseCreate(BaseModel):
    code: str
    name: str
    description: str | None = None
    semester: str
    academic_year: str


class CourseUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    semester: str | None = None
    academic_year: str | None = None


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
