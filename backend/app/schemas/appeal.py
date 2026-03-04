from datetime import datetime

from pydantic import BaseModel

from app.models.appeal import AppealStatus


class AppealCreate(BaseModel):
    attendance_id: int
    reason: str


class AppealReview(BaseModel):
    status: AppealStatus


class AppealOut(BaseModel):
    id: int
    student_id: int
    attendance_id: int
    reason: str
    status: AppealStatus
    reviewed_by: int | None
    created_at: datetime

    model_config = {"from_attributes": True}
