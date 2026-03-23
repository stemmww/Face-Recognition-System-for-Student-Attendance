from app.models.user import User
from app.models.course import Course, CourseProf
from app.models.enrollment import Enrollment
from app.models.schedule import Schedule
from app.models.attendance_session import AttendanceSession
from app.models.attendance import AttendanceRecord
from app.models.face_embedding import FaceEmbedding
from app.models.appeal import Appeal
from app.models.notification import Notification

__all__ = [
    "User",
    "Course",
    "CourseProf",
    "Enrollment",
    "Schedule",
    "AttendanceSession",
    "AttendanceRecord",
    "FaceEmbedding",
    "Appeal",
    "Notification",
]
