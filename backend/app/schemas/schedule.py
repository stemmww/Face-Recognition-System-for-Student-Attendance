from datetime import time
from typing import Literal

from pydantic import BaseModel, field_validator

from app.models.schedule import DAY_OF_WEEK_VALUES, LESSON_TYPE_VALUES, SEMESTER_VALUES

VALID_START_TIMES = {
    "08:00", "09:00", "10:00", "11:00", "12:00",
    "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00",
}


class ScheduleGroupInfo(BaseModel):
    id: int
    name: str
    group_type: str

    model_config = {"from_attributes": True}


class ScheduleCreate(BaseModel):
    course_id: int
    professor_id: int | None = None
    classroom_id: int | None = None
    day_of_week: str
    start_time: time
    end_time: time | None = None   # auto-computed as start+50min if not provided
    lesson_type: str = "LECTURE"
    semester: str | None = None
    academic_year: str | None = None
    group_ids: list[int] = []

    @field_validator("day_of_week")
    @classmethod
    def validate_day(cls, v: str) -> str:
        v = v.upper()
        if v not in DAY_OF_WEEK_VALUES:
            raise ValueError(f"day_of_week must be one of {DAY_OF_WEEK_VALUES}")
        return v

    @field_validator("lesson_type")
    @classmethod
    def validate_lesson_type(cls, v: str) -> str:
        v = v.upper()
        if v not in LESSON_TYPE_VALUES:
            raise ValueError(f"lesson_type must be one of {LESSON_TYPE_VALUES}")
        return v

    @field_validator("semester")
    @classmethod
    def validate_semester(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.upper()
        if v not in SEMESTER_VALUES:
            raise ValueError(f"semester must be one of {SEMESTER_VALUES}")
        return v


class ScheduleUpdate(BaseModel):
    course_id: int | None = None
    professor_id: int | None = None
    classroom_id: int | None = None
    day_of_week: str | None = None
    start_time: time | None = None
    end_time: time | None = None
    lesson_type: str | None = None
    semester: str | None = None
    academic_year: str | None = None
    group_ids: list[int] | None = None

    @field_validator("day_of_week")
    @classmethod
    def validate_day(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.upper()
        if v not in DAY_OF_WEEK_VALUES:
            raise ValueError(f"day_of_week must be one of {DAY_OF_WEEK_VALUES}")
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


class ScheduleOut(BaseModel):
    id: int
    course_id: int
    course_code: str | None = None
    course_name: str | None = None
    professor_id: int | None = None
    professor_name: str | None = None
    classroom_id: int | None = None
    classroom_name: str | None = None
    day_of_week: str
    start_time: time
    end_time: time
    room: str | None = None
    lesson_type: str
    semester: str | None = None
    academic_year: str | None = None
    groups: list[ScheduleGroupInfo] = []

    model_config = {"from_attributes": True}
