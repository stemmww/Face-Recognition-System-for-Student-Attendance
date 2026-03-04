"""Attendance session management and attendance recording logic.

Time-based status rules:
  - Present:  recognized within 5 minutes of schedule start_time
  - Late:     recognized between 5–15 minutes after start_time
  - Absent:   not recognized, or recognized >15 minutes after start_time
"""

import logging
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestError, NotFoundError
from app.models.attendance import AttendanceRecord, AttendanceStatus, MarkedBy
from app.models.attendance_session import AttendanceSession, SessionStatus
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.notification import Notification
from app.models.schedule import Schedule
from app.models.user import User

logger = logging.getLogger(__name__)

PRESENT_THRESHOLD_MINUTES = 5
LATE_THRESHOLD_MINUTES = 15


def determine_status(recognized_at: datetime, schedule_start: time, session_date: date) -> AttendanceStatus:
    """Determine attendance status based on recognition time vs schedule start."""
    start_dt = datetime.combine(session_date, schedule_start, tzinfo=recognized_at.tzinfo or timezone.utc)
    delta = (recognized_at - start_dt).total_seconds() / 60.0

    if delta <= PRESENT_THRESHOLD_MINUTES:
        return AttendanceStatus.PRESENT
    elif delta <= LATE_THRESHOLD_MINUTES:
        return AttendanceStatus.LATE
    else:
        return AttendanceStatus.ABSENT


class AttendanceSessionService:
    @staticmethod
    async def start_session(
        db: AsyncSession, schedule_id: int, session_date: date, started_by: int
    ) -> AttendanceSession:
        schedule = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
        if schedule.scalar_one_or_none() is None:
            raise NotFoundError("Schedule")

        existing = await db.execute(
            select(AttendanceSession).where(
                AttendanceSession.schedule_id == schedule_id,
                AttendanceSession.date == session_date,
                AttendanceSession.status == SessionStatus.ACTIVE,
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise BadRequestError("An active session already exists for this schedule and date")

        session = AttendanceSession(
            schedule_id=schedule_id,
            date=session_date,
            started_by=started_by,
            status=SessionStatus.ACTIVE,
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return session

    @staticmethod
    async def stop_session(db: AsyncSession, session_id: int) -> AttendanceSession:
        session = await AttendanceSessionService.get_session(db, session_id)
        if session.status != SessionStatus.ACTIVE:
            raise BadRequestError("Session is not active")

        await AttendanceSessionService._mark_absent_students(db, session)

        session.status = SessionStatus.COMPLETED
        session.ended_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(session)
        return session

    @staticmethod
    async def get_session(db: AsyncSession, session_id: int) -> AttendanceSession:
        result = await db.execute(
            select(AttendanceSession).where(AttendanceSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        if session is None:
            raise NotFoundError("Session")
        return session

    @staticmethod
    async def list_sessions(
        db: AsyncSession,
        course_id: int | None = None,
        schedule_id: int | None = None,
        status: SessionStatus | None = None,
    ) -> list[AttendanceSession]:
        query = select(AttendanceSession)
        if schedule_id is not None:
            query = query.where(AttendanceSession.schedule_id == schedule_id)
        if course_id is not None:
            query = query.join(Schedule).where(Schedule.course_id == course_id)
        if status is not None:
            query = query.where(AttendanceSession.status == status)
        query = query.order_by(AttendanceSession.date.desc(), AttendanceSession.started_at.desc())
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def _mark_absent_students(db: AsyncSession, session: AttendanceSession) -> int:
        """Mark all enrolled students without an attendance record as absent."""
        schedule = await db.execute(
            select(Schedule).where(Schedule.id == session.schedule_id)
        )
        sched = schedule.scalar_one()

        enrolled = await db.execute(
            select(Enrollment.student_id).where(Enrollment.course_id == sched.course_id)
        )
        enrolled_ids = {row[0] for row in enrolled.fetchall()}

        recorded = await db.execute(
            select(AttendanceRecord.student_id).where(
                AttendanceRecord.session_id == session.id
            )
        )
        recorded_ids = {row[0] for row in recorded.fetchall()}

        missing = enrolled_ids - recorded_ids
        count = 0

        course_result = await db.execute(
            select(Course).where(Course.id == sched.course_id)
        )
        course = course_result.scalar_one()

        for student_id in missing:
            record = AttendanceRecord(
                student_id=student_id,
                session_id=session.id,
                status=AttendanceStatus.ABSENT,
                marked_by=MarkedBy.SYSTEM,
            )
            db.add(record)

            db.add(Notification(
                user_id=student_id,
                message=f"You were marked absent for {course.code} — {course.name} on {session.date}.",
            ))
            count += 1

        if count > 0:
            await db.commit()
            logger.info("Auto-marked %d students absent for session %d", count, session.id)
        return count


class AttendanceRecordService:
    @staticmethod
    async def record_recognition(
        db: AsyncSession,
        session_id: int,
        student_id: int,
        confidence: float,
    ) -> tuple[AttendanceRecord, bool]:
        """Record a face recognition event. Returns (record, is_new)."""
        session = await AttendanceSessionService.get_session(db, session_id)
        if session.status != SessionStatus.ACTIVE:
            raise BadRequestError("Session is not active")

        existing = await db.execute(
            select(AttendanceRecord).where(
                AttendanceRecord.session_id == session_id,
                AttendanceRecord.student_id == student_id,
            )
        )
        record = existing.scalar_one_or_none()
        if record is not None:
            return record, False

        schedule = await db.execute(
            select(Schedule).where(Schedule.id == session.schedule_id)
        )
        sched = schedule.scalar_one()

        now = datetime.now(timezone.utc)
        status = determine_status(now, sched.start_time, session.date)

        record = AttendanceRecord(
            student_id=student_id,
            session_id=session_id,
            status=status,
            recognized_at=now,
            marked_by=MarkedBy.SYSTEM,
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)
        return record, True

    @staticmethod
    async def get_session_records(db: AsyncSession, session_id: int) -> list[dict]:
        result = await db.execute(
            select(AttendanceRecord, User)
            .join(User, AttendanceRecord.student_id == User.id)
            .where(AttendanceRecord.session_id == session_id)
            .order_by(User.last_name)
        )
        rows = result.all()
        records = []
        for record, user in rows:
            records.append({
                "id": record.id,
                "student_id": record.student_id,
                "session_id": record.session_id,
                "status": record.status,
                "recognized_at": record.recognized_at,
                "marked_by": record.marked_by,
                "updated_at": record.updated_at,
                "student_name": f"{user.first_name} {user.last_name}",
                "student_email": user.email,
            })
        return records

    @staticmethod
    async def get_course_records(db: AsyncSession, course_id: int) -> list[dict]:
        result = await db.execute(
            select(AttendanceRecord, User)
            .join(User, AttendanceRecord.student_id == User.id)
            .join(AttendanceSession, AttendanceRecord.session_id == AttendanceSession.id)
            .join(Schedule, AttendanceSession.schedule_id == Schedule.id)
            .where(Schedule.course_id == course_id)
            .order_by(AttendanceSession.date.desc(), User.last_name)
        )
        rows = result.all()
        records = []
        for record, user in rows:
            records.append({
                "id": record.id,
                "student_id": record.student_id,
                "session_id": record.session_id,
                "status": record.status,
                "recognized_at": record.recognized_at,
                "marked_by": record.marked_by,
                "updated_at": record.updated_at,
                "student_name": f"{user.first_name} {user.last_name}",
                "student_email": user.email,
            })
        return records

    @staticmethod
    async def get_student_records(db: AsyncSession, student_id: int) -> list[dict]:
        result = await db.execute(
            select(AttendanceRecord)
            .where(AttendanceRecord.student_id == student_id)
            .order_by(AttendanceRecord.updated_at.desc())
        )
        rows = result.scalars().all()
        return [
            {
                "id": r.id,
                "student_id": r.student_id,
                "session_id": r.session_id,
                "status": r.status,
                "recognized_at": r.recognized_at,
                "marked_by": r.marked_by,
                "updated_at": r.updated_at,
                "student_name": None,
                "student_email": None,
            }
            for r in rows
        ]

    @staticmethod
    async def get_student_course_records(
        db: AsyncSession, student_id: int, course_id: int
    ) -> list[dict]:
        """Get a student's attendance records for a specific course."""
        result = await db.execute(
            select(AttendanceRecord, AttendanceSession)
            .join(AttendanceSession, AttendanceRecord.session_id == AttendanceSession.id)
            .join(Schedule, AttendanceSession.schedule_id == Schedule.id)
            .where(
                Schedule.course_id == course_id,
                AttendanceRecord.student_id == student_id,
            )
            .order_by(AttendanceSession.date.desc())
        )
        rows = result.all()
        return [
            {
                "id": record.id,
                "student_id": record.student_id,
                "session_id": record.session_id,
                "status": record.status,
                "recognized_at": record.recognized_at,
                "marked_by": record.marked_by,
                "updated_at": record.updated_at,
                "student_name": None,
                "student_email": None,
                "session_date": str(session.date),
            }
            for record, session in rows
        ]

    @staticmethod
    async def get_student_summary(db: AsyncSession, student_id: int) -> list[dict]:
        """Per-course attendance summary for a student."""
        enrolled = await db.execute(
            select(Enrollment.course_id).where(Enrollment.student_id == student_id)
        )
        course_ids = [row[0] for row in enrolled.fetchall()]

        summaries = []
        for cid in course_ids:
            course_result = await db.execute(select(Course).where(Course.id == cid))
            course = course_result.scalar_one_or_none()
            if course is None:
                continue

            records = await db.execute(
                select(AttendanceRecord)
                .join(AttendanceSession, AttendanceRecord.session_id == AttendanceSession.id)
                .join(Schedule, AttendanceSession.schedule_id == Schedule.id)
                .where(
                    Schedule.course_id == cid,
                    AttendanceRecord.student_id == student_id,
                )
            )
            rows = records.scalars().all()
            total = len(rows)
            present = sum(1 for r in rows if r.status == AttendanceStatus.PRESENT)
            late = sum(1 for r in rows if r.status == AttendanceStatus.LATE)
            absent = sum(1 for r in rows if r.status == AttendanceStatus.ABSENT)
            rate = ((present + late) / total * 100) if total > 0 else 100.0

            summaries.append({
                "course_id": cid,
                "course_code": course.code,
                "course_name": course.name,
                "total_sessions": total,
                "present_count": present,
                "late_count": late,
                "absent_count": absent,
                "attendance_rate": round(rate, 1),
            })
        return summaries

    @staticmethod
    async def update_status(
        db: AsyncSession, record_id: int, status: AttendanceStatus
    ) -> AttendanceRecord:
        result = await db.execute(
            select(AttendanceRecord).where(AttendanceRecord.id == record_id)
        )
        record = result.scalar_one_or_none()
        if record is None:
            raise NotFoundError("Attendance record")

        record.status = status
        record.marked_by = MarkedBy.PROFESSOR
        await db.commit()
        await db.refresh(record)
        return record
