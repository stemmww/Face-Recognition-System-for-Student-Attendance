from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.rbac import require_role
from app.database import get_db
from app.models.user import Role, User
from app.schemas.attendance import AttendanceRecordOut, AttendanceStatusUpdate, CourseAttendanceSummary, StudentCourseRecordOut
from app.services.attendance_service import AttendanceRecordService

router = APIRouter()


@router.get("/session/{session_id}", response_model=list[AttendanceRecordOut])
async def get_session_attendance(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR)),
):
    return await AttendanceRecordService.get_session_records(db, session_id)


@router.get("/course/{course_id}", response_model=list[AttendanceRecordOut])
async def get_course_attendance(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR)),
):
    return await AttendanceRecordService.get_course_records(db, course_id)


@router.get("/student/me", response_model=list[AttendanceRecordOut])
async def get_my_attendance(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.STUDENT)),
):
    return await AttendanceRecordService.get_student_records(db, current_user.id)


@router.get("/student/me/course/{course_id}", response_model=list[StudentCourseRecordOut])
async def get_my_course_attendance(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.STUDENT)),
):
    return await AttendanceRecordService.get_student_course_records(db, current_user.id, course_id)


@router.get("/student/me/summary", response_model=list[CourseAttendanceSummary])
async def get_my_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.STUDENT)),
):
    return await AttendanceRecordService.get_student_summary(db, current_user.id)


@router.patch("/{record_id}", response_model=AttendanceRecordOut)
async def update_attendance_status(
    record_id: int,
    body: AttendanceStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR)),
):
    record = await AttendanceRecordService.update_status(db, record_id, body.status)
    return {
        "id": record.id,
        "student_id": record.student_id,
        "session_id": record.session_id,
        "status": record.status,
        "recognized_at": record.recognized_at,
        "marked_by": record.marked_by,
        "updated_at": record.updated_at,
        "student_name": None,
        "student_email": None,
    }
