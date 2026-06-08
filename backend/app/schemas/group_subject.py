from pydantic import BaseModel, field_validator

from app.models.group import SEMESTER_VALUES


class GroupSubjectAdd(BaseModel):
    course_id: int
    semester: str   # TRIMESTER_1/2/3

    @field_validator("semester")
    @classmethod
    def validate_semester(cls, v: str) -> str:
        v = v.upper()
        if v not in SEMESTER_VALUES:
            raise ValueError(f"trimester must be one of {SEMESTER_VALUES}")
        return v


class GroupSubjectOut(BaseModel):
    id: int
    group_id: int
    course_id: int
    course_code: str = ""
    course_name: str = ""
    semester: str

    model_config = {"from_attributes": True}
