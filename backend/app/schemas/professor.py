from pydantic import BaseModel, EmailStr


class ProfessorTagOut(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class ProfessorCreate(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    password: str
    tags: list[str] = []     # tag names


class ProfessorUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    is_active: bool | None = None
    tags: list[str] | None = None   # replace all tags


class ProfessorOut(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    is_active: bool
    tags: list[ProfessorTagOut] = []

    model_config = {"from_attributes": True}


class GroupSubjectCreate(BaseModel):
    course_id: int
    semester: str   # FALL/WINTER/SPRING


class GroupSubjectOut(BaseModel):
    id: int
    group_id: int
    course_id: int
    course_code: str
    course_name: str
    semester: str

    model_config = {"from_attributes": True}
