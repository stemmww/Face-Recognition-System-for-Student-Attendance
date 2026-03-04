from datetime import time

from pydantic import BaseModel

from app.models.schedule import ClassType, DayOfWeek


class ScheduleCreate(BaseModel):
    course_id: int
    day_of_week: DayOfWeek
    start_time: time
    end_time: time
    room: str
    class_type: ClassType = ClassType.LECTURE


class ScheduleUpdate(BaseModel):
    day_of_week: DayOfWeek | None = None
    start_time: time | None = None
    end_time: time | None = None
    room: str | None = None
    class_type: ClassType | None = None


class ScheduleOut(BaseModel):
    id: int
    course_id: int
    day_of_week: DayOfWeek
    start_time: time
    end_time: time
    room: str
    class_type: ClassType

    model_config = {"from_attributes": True}
