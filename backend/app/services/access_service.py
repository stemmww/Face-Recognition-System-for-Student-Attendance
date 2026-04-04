from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.appeal import Appeal
from app.models.attendance import AttendanceRecord
from app.models.attendance_session import AttendanceSession
from app.models.course import Course
from app.models.course import CourseProf
from app.models.enrollment import Enrollment
from app.models.schedule import Schedule
from app.models.user import Role, User


class AccessService:
    @staticmethod
    async def get_professor_course_ids(db: AsyncSession, professor_id: int) -> list[int]:
        result = await db.execute(
            select(CourseProf.course_id).where(CourseProf.professor_id == professor_id)
        )
        return [row[0] for row in result.fetchall()]

    @staticmethod
    async def get_student_course_ids(db: AsyncSession, student_id: int) -> list[int]:
        result = await db.execute(
            select(Enrollment.course_id).where(Enrollment.student_id == student_id)
        )
        return [row[0] for row in result.fetchall()]

    @staticmethod
    async def ensure_course_access(
        db: AsyncSession,
        current_user: User,
        course_id: int,
    ) -> None:
        course_exists = await db.execute(select(Course.id).where(Course.id == course_id))
        if course_exists.scalar_one_or_none() is None:
            raise NotFoundError("Course")

        if current_user.role == Role.ADMIN:
            return

        if current_user.role == Role.PROFESSOR:
            result = await db.execute(
                select(CourseProf).where(
                    CourseProf.course_id == course_id,
                    CourseProf.professor_id == current_user.id,
                )
            )
            if result.scalar_one_or_none() is None:
                raise ForbiddenError("You do not have access to this course")
            return

        if current_user.role == Role.STUDENT:
            result = await db.execute(
                select(Enrollment).where(
                    Enrollment.course_id == course_id,
                    Enrollment.student_id == current_user.id,
                )
            )
            if result.scalar_one_or_none() is None:
                raise ForbiddenError("You do not have access to this course")
            return

        raise ForbiddenError("You do not have access to this course")

    @staticmethod
    async def ensure_schedule_access(
        db: AsyncSession,
        current_user: User,
        schedule_id: int,
    ) -> int:
        result = await db.execute(
            select(Schedule.course_id).where(Schedule.id == schedule_id)
        )
        course_id = result.scalar_one_or_none()
        if course_id is None:
            raise NotFoundError("Schedule")

        await AccessService.ensure_course_access(db, current_user, course_id)
        return course_id

    @staticmethod
    async def ensure_session_access(
        db: AsyncSession,
        current_user: User,
        session_id: int,
    ) -> int:
        result = await db.execute(
            select(Schedule.course_id)
            .join(AttendanceSession, AttendanceSession.schedule_id == Schedule.id)
            .where(AttendanceSession.id == session_id)
        )
        course_id = result.scalar_one_or_none()
        if course_id is None:
            raise NotFoundError("Session")

        await AccessService.ensure_course_access(db, current_user, course_id)
        return course_id

    @staticmethod
    async def ensure_attendance_record_access(
        db: AsyncSession,
        current_user: User,
        record_id: int,
    ) -> int:
        result = await db.execute(
            select(Schedule.course_id)
            .join(AttendanceSession, AttendanceSession.schedule_id == Schedule.id)
            .join(AttendanceRecord, AttendanceRecord.session_id == AttendanceSession.id)
            .where(AttendanceRecord.id == record_id)
        )
        course_id = result.scalar_one_or_none()
        if course_id is None:
            raise NotFoundError("Attendance record")

        await AccessService.ensure_course_access(db, current_user, course_id)
        return course_id

    @staticmethod
    async def ensure_appeal_access(
        db: AsyncSession,
        current_user: User,
        appeal_id: int,
    ) -> int:
        result = await db.execute(
            select(Schedule.course_id)
            .join(AttendanceSession, AttendanceSession.schedule_id == Schedule.id)
            .join(AttendanceRecord, AttendanceRecord.session_id == AttendanceSession.id)
            .join(Appeal, Appeal.attendance_id == AttendanceRecord.id)
            .where(Appeal.id == appeal_id)
        )
        course_id = result.scalar_one_or_none()
        if course_id is None:
            raise NotFoundError("Appeal")

        await AccessService.ensure_course_access(db, current_user, course_id)
        return course_id
