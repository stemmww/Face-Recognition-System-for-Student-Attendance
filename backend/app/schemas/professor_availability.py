from datetime import time

from pydantic import BaseModel, field_validator

from app.models.schedule import DAY_OF_WEEK_VALUES


class AvailabilityCreate(BaseModel):
    day_of_week: str
    start_time: time
    end_time: time

    @field_validator("day_of_week")
    @classmethod
    def validate_day(cls, v: str) -> str:
        v = v.upper()
        if v not in DAY_OF_WEEK_VALUES:
            raise ValueError(f"day_of_week must be one of {DAY_OF_WEEK_VALUES}")
        return v


class AvailabilityOut(BaseModel):
    id: int
    professor_id: int
    day_of_week: str
    start_time: time
    end_time: time

    model_config = {"from_attributes": True}
