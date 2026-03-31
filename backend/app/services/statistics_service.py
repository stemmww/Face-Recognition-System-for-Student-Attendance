"""Statistics service — per-course attendance stats for professors."""

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.models.attendance_session import AttendanceSession
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.schedule import Schedule
from app.models.user import User


class StatisticsService:
    @staticmethod
    async def get_course_statistics(db: AsyncSession, course_id: int) -> dict:
        course_result = await db.execute(select(Course).where(Course.id == course_id))
        course = course_result.scalar_one()

        sessions_result = await db.execute(
            select(func.count(AttendanceSession.id))
            .join(Schedule, AttendanceSession.schedule_id == Schedule.id)
            .where(Schedule.course_id == course_id)
        )
        total_sessions = sessions_result.scalar() or 0

        enrolled_result = await db.execute(
            select(User)
            .join(Enrollment, Enrollment.student_id == User.id)
            .where(
                Enrollment.course_id == course_id,
                User.is_active == True,
            )
        )
        enrolled_users = enrolled_result.scalars().all()

        students_stats = []
        for user in enrolled_users:
            sid = user.id
            records_result = await db.execute(
                select(AttendanceRecord)
                .join(AttendanceSession, AttendanceRecord.session_id == AttendanceSession.id)
                .join(Schedule, AttendanceSession.schedule_id == Schedule.id)
                .where(
                    Schedule.course_id == course_id,
                    AttendanceRecord.student_id == sid,
                )
            )
            records = records_result.scalars().all()

            present = sum(1 for r in records if r.status == AttendanceStatus.PRESENT)
            late = sum(1 for r in records if r.status == AttendanceStatus.LATE)
            absent = sum(1 for r in records if r.status == AttendanceStatus.ABSENT)
            total = len(records)
            rate = round(((present + late) / total * 100), 1) if total > 0 else 100.0

            students_stats.append({
                "student_id": sid,
                "student_name": f"{user.first_name} {user.last_name}",
                "present_count": present,
                "late_count": late,
                "absent_count": absent,
                "total_sessions": total,
                "attendance_rate": rate,
            })

        avg_rate = 0.0
        if students_stats:
            avg_rate = round(sum(s["attendance_rate"] for s in students_stats) / len(students_stats), 1)

        return {
            "course_id": course_id,
            "course_code": course.code,
            "course_name": course.name,
            "total_sessions": total_sessions,
            "total_enrolled": len(enrolled_users),
            "avg_attendance_rate": avg_rate,
            "students": students_stats,
        }

    @staticmethod
    async def get_course_trends(db: AsyncSession, course_id: int) -> list[dict]:
        """Per-session attendance counts for a course, ordered by date."""
        sessions_result = await db.execute(
            select(AttendanceSession)
            .join(Schedule, AttendanceSession.schedule_id == Schedule.id)
            .where(Schedule.course_id == course_id)
            .order_by(AttendanceSession.date.asc())
        )
        sessions = sessions_result.scalars().all()

        trend_points = []
        for session in sessions:
            records_result = await db.execute(
                select(AttendanceRecord).where(AttendanceRecord.session_id == session.id)
            )
            records = records_result.scalars().all()
            present = sum(1 for r in records if r.status == AttendanceStatus.PRESENT)
            late = sum(1 for r in records if r.status == AttendanceStatus.LATE)
            absent = sum(1 for r in records if r.status == AttendanceStatus.ABSENT)
            trend_points.append({
                "date": session.date,
                "session_id": session.id,
                "present": present,
                "late": late,
                "absent": absent,
                "total": present + late + absent,
            })
        return trend_points

    @staticmethod
    async def get_student_trends(db: AsyncSession, student_id: int) -> list[dict]:
        """Per-session attendance records for a student across all courses."""
        result = await db.execute(
            select(AttendanceRecord, AttendanceSession, Course)
            .join(AttendanceSession, AttendanceRecord.session_id == AttendanceSession.id)
            .join(Schedule, AttendanceSession.schedule_id == Schedule.id)
            .join(Course, Schedule.course_id == Course.id)
            .where(AttendanceRecord.student_id == student_id)
            .order_by(AttendanceSession.date.asc())
        )
        rows = result.all()
        return [
            {
                "date": session.date,
                "course_code": course.code,
                "course_name": course.name,
                "status": record.status.value,
            }
            for record, session, course in rows
        ]
