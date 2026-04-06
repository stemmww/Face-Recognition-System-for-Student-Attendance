from datetime import date, datetime

from pydantic import BaseModel

from app.models.attendance import AttendanceStatus, MarkedBy
from app.models.attendance_session import SessionStatus


class SessionCreate(BaseModel):
    schedule_id: int
    date: date
    latitude: float | None = None
    longitude: float | None = None
    qr_interval_seconds: int | None = None


class SessionOut(BaseModel):
    id: int
    schedule_id: int
    date: date
    started_at: datetime
    ended_at: datetime | None
    started_by: int
    status: SessionStatus
    qr_interval_seconds: int | None = None

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


class CourseAttendanceSummary(BaseModel):
    course_id: int
    course_code: str
    course_name: str
    total_sessions: int
    present_count: int
    late_count: int
    absent_count: int
    attendance_rate: float
    current_streak: int
    longest_streak: int


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
    interval_seconds: int


class LivenessChallengeOut(BaseModel):
    challenge_type: str
    challenge_types: list[str]
    instruction: str
    token: str


class ManualAttendanceEntry(BaseModel):
    student_id: int
    status: AttendanceStatus


class ManualAttendanceBatchCreate(BaseModel):
    entries: list[ManualAttendanceEntry]


class VerifyAttendanceResponse(BaseModel):
    success: bool
    status: AttendanceStatus | None = None
    message: str
