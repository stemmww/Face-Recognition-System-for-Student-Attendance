from pydantic import BaseModel, EmailStr


class CourseSummaryOut(BaseModel):
    id: int
    code: str
    name: str

    model_config = {"from_attributes": True}


class ProfessorCreate(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    password: str


class ProfessorUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    is_active: bool | None = None


class ProfessorOut(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    is_active: bool
    courses: list[CourseSummaryOut] = []

    model_config = {"from_attributes": True}


# kept for backward compat (CSV import uses it)
class ProfessorTagOut(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class GroupSubjectCreate(BaseModel):
    course_id: int
    semester: str   # TRIMESTER_1/2/3


class GroupSubjectOut(BaseModel):
    id: int
    group_id: int
    course_id: int
    course_code: str
    course_name: str
    semester: str

    model_config = {"from_attributes": True}
