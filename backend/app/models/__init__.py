from app.models.user import User
from app.models.course import Course, CourseProf
from app.models.enrollment import Enrollment
from app.models.schedule import Schedule, schedule_groups
from app.models.attendance_session import AttendanceSession
from app.models.attendance import AttendanceRecord
from app.models.face_embedding import FaceEmbedding
from app.models.appeal import Appeal
from app.models.notification import Notification
from app.models.audit_log import AuditLog
from app.models.classroom import Classroom
from app.models.group import Group, group_students
from app.models.group_subject import GroupSubject
from app.models.professor_availability import ProfessorAvailability
from app.models.professor_tag import ProfessorTag, professor_tag_assignments, course_tag_assignments

__all__ = [
    "Appeal",
    "AttendanceRecord",
    "AttendanceSession",
    "AuditLog",
    "Classroom",
    "Course",
    "CourseProf",
    "Enrollment",
    "FaceEmbedding",
    "Group",
    "GroupSubject",
    "Notification",
    "ProfessorAvailability",
    "ProfessorTag",
    "Schedule",
    "User",
    "course_tag_assignments",
    "group_students",
    "professor_tag_assignments",
    "schedule_groups",
]
