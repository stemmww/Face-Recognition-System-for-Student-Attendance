from datetime import date

from pydantic import BaseModel


class StudentAttendanceStat(BaseModel):
    student_id: int
    student_name: str
    present_count: int
    late_count: int
    absent_count: int
    total_sessions: int
    attendance_rate: float


class CourseStatistics(BaseModel):
    course_id: int
    course_code: str
    course_name: str
    total_sessions: int
    total_enrolled: int
    avg_attendance_rate: float
    students: list[StudentAttendanceStat]


class SessionTrendPoint(BaseModel):
    date: date
    session_id: int
    present: int
    late: int
    absent: int
    total: int


class StudentTrendPoint(BaseModel):
    date: date
    course_code: str
    course_name: str
    status: str
