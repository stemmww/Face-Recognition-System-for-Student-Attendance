from datetime import date, datetime

from pydantic import BaseModel

from app.models.attendance import AttendanceStatus, MarkedBy
from app.models.attendance_session import SessionStatus


class SessionCreate(BaseModel):
    schedule_id: int
    date: date
    latitude: float | None = None
    longitude: float | None = None


class SessionOut(BaseModel):
    id: int
    schedule_id: int
    date: date
    started_at: datetime
    ended_at: datetime | None
    started_by: int
    status: SessionStatus

    model_config = {"from_attributes": True}


class AttendanceRecordOut(BaseModel):
    id: int
    student_id: int
    session_id: int
    status: AttendanceStatus
    recognized_at: datetime | None
    marked_by: MarkedBy
    updated_at: datetime
    student_name: str | None = None
    student_email: str | None = None

    model_config = {"from_attributes": True}


class StudentCourseRecordOut(BaseModel):
    id: int
    student_id: int
    session_id: int
    status: AttendanceStatus
    recognized_at: datetime | None
    marked_by: MarkedBy
    updated_at: datetime
    student_name: str | None = None
    student_email: str | None = None
    session_date: str | None = None

    model_config = {"from_attributes": True}


class AttendanceStatusUpdate(BaseModel):
    status: AttendanceStatus


class RecognitionResult(BaseModel):
    student_id: int
    name: str
    status: AttendanceStatus
    confidence: float
    is_new: bool = True


class FrameProcessingResponse(BaseModel):
    recognized: list[RecognitionResult]
    unknown_faces: int


class CourseAttendanceSummary(BaseModel):
    course_id: int
    course_code: str
    course_name: str
    total_sessions: int
    present_count: int
    late_count: int
    absent_count: int
    attendance_rate: float


class SessionDetailOut(BaseModel):
    id: int
    schedule_id: int
    date: date
    started_at: datetime
    ended_at: datetime | None
    started_by: int
    status: SessionStatus
    course_code: str | None = None
    course_name: str | None = None
    room: str | None = None
    records_count: int = 0

    model_config = {"from_attributes": True}


class QRTokenOut(BaseModel):
    token: str
    expires_at: datetime


class VerifyAttendanceResponse(BaseModel):
    success: bool
    status: AttendanceStatus | None = None
    message: str
