import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_role
from app.database import get_db
from app.models.enrollment import Enrollment
from app.models.schedule import Schedule
from app.models.user import Role, User
from app.schemas.attendance import (
    AttendanceRecordOut,
    AttendanceStatusUpdate,
    CourseAttendanceSummary,
    ManualAttendanceBatchCreate,
    StudentCourseRecordOut,
)
from app.services.access_service import AccessService
from app.services.attendance_service import AttendanceRecordService, AttendanceSessionService

router = APIRouter()


@router.get("/session/{session_id}", response_model=list[AttendanceRecordOut])
async def get_session_attendance(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR)),
):
    await AccessService.ensure_session_access(db, current_user, session_id)
    return await AttendanceRecordService.get_session_records(db, session_id)


@router.get("/course/{course_id}", response_model=list[AttendanceRecordOut])
async def get_course_attendance(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR)),
):
    await AccessService.ensure_course_access(db, current_user, course_id)
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
    current_user: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR)),
):
    await AccessService.ensure_attendance_record_access(db, current_user, record_id)
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


@router.get("/session/{session_id}/enrolled-students")
async def get_enrolled_students_for_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR)),
):
    """Get all enrolled students for the course associated with this session."""
    await AccessService.ensure_session_access(db, current_user, session_id)
    session = await AttendanceSessionService.get_session(db, session_id)
    sched = await db.execute(select(Schedule).where(Schedule.id == session.schedule_id))
    schedule = sched.scalar_one()

    enrolled = await db.execute(
        select(User)
        .join(Enrollment, Enrollment.student_id == User.id)
        .where(Enrollment.course_id == schedule.course_id, User.is_active == True)
        .order_by(User.last_name, User.first_name)
    )
    students = enrolled.scalars().all()
    return [
        {
            "id": s.id,
            "first_name": s.first_name,
            "last_name": s.last_name,
            "email": s.email,
        }
        for s in students
    ]


@router.post("/session/{session_id}/manual-batch", response_model=list[AttendanceRecordOut])
async def manual_batch_attendance(
    session_id: int,
    body: ManualAttendanceBatchCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR)),
):
    """Manually record attendance for multiple students (roll call fallback)."""
    await AccessService.ensure_session_access(db, current_user, session_id)
    records = await AttendanceRecordService.batch_manual_record(
        db, session_id, [e.model_dump() for e in body.entries]
    )
    result = []
    for record in records:
        user_result = await db.execute(select(User).where(User.id == record.student_id))
        user = user_result.scalar_one_or_none()
        result.append({
            "id": record.id,
            "student_id": record.student_id,
            "session_id": record.session_id,
            "status": record.status,
            "recognized_at": record.recognized_at,
            "marked_by": record.marked_by,
            "updated_at": record.updated_at,
            "student_name": f"{user.first_name} {user.last_name}" if user else None,
            "student_email": user.email if user else None,
        })
    return result


@router.get("/session/{session_id}/export")
async def export_session_attendance(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR)),
):
    """Export session attendance as CSV."""
    await AccessService.ensure_session_access(db, current_user, session_id)
    records = await AttendanceRecordService.get_session_records(db, session_id)
    session = await AttendanceSessionService.get_session(db, session_id)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Student Name", "Email", "Status", "Recognized At", "Marked By"])
    for r in records:
        writer.writerow([
            r.get("student_name", ""),
            r.get("student_email", ""),
            r.get("status", ""),
            str(r.get("recognized_at", "")) if r.get("recognized_at") else "",
            r.get("marked_by", ""),
        ])

    buf.seek(0)
    filename = f"attendance_session_{session_id}_{session.date}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/course/{course_id}/export")
async def export_course_attendance(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR)),
):
    """Export all attendance records for a course as CSV."""
    await AccessService.ensure_course_access(db, current_user, course_id)
    records = await AttendanceRecordService.get_course_records(db, course_id)

    from app.models.course import Course
    course_result = await db.execute(select(Course).where(Course.id == course_id))
    course = course_result.scalar_one_or_none()
    course_code = course.code if course else str(course_id)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Student Name", "Email", "Session ID", "Status", "Recognized At", "Marked By"])
    for r in records:
        writer.writerow([
            r.get("student_name", ""),
            r.get("student_email", ""),
            r.get("session_id", ""),
            r.get("status", ""),
            str(r.get("recognized_at", "")) if r.get("recognized_at") else "",
            r.get("marked_by", ""),
        ])

    buf.seek(0)
    filename = f"attendance_{course_code}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
