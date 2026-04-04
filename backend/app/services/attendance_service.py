"""Attendance session management and attendance recording logic.

Time-based status rules (relative to when the professor started the session):
  - Present:  recognized within 5 minutes of session start
  - Late:     recognized between 5–15 minutes after session start
  - Absent:   not recognized, or recognized >15 minutes after session start
"""

import logging
import secrets
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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


def determine_status(recognized_at: datetime, session_started_at: datetime) -> AttendanceStatus:
    """Determine attendance status based on recognition time vs when the session was started."""
    if session_started_at.tzinfo is None:
        session_started_at = session_started_at.replace(tzinfo=timezone.utc)
    if recognized_at.tzinfo is None:
        recognized_at = recognized_at.replace(tzinfo=timezone.utc)

    delta = (recognized_at - session_started_at).total_seconds() / 60.0

    if delta <= PRESENT_THRESHOLD_MINUTES:
        return AttendanceStatus.PRESENT
    elif delta <= LATE_THRESHOLD_MINUTES:
        return AttendanceStatus.LATE
    else:
        return AttendanceStatus.ABSENT


class AttendanceSessionService:
    @staticmethod
    async def start_session(
        db: AsyncSession,
        schedule_id: int,
        session_date: date,
        started_by: int,
        latitude: float | None = None,
        longitude: float | None = None,
        qr_interval_seconds: int | None = None,
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
            latitude=latitude,
            longitude=longitude,
            qr_secret=secrets.token_hex(32),
            qr_interval_seconds=qr_interval_seconds,
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
        allowed_course_ids: list[int] | None = None,
    ) -> list[AttendanceSession]:
        query = select(AttendanceSession)
        join_schedule = course_id is not None or allowed_course_ids is not None
        if join_schedule:
            query = query.join(Schedule)
        if schedule_id is not None:
            query = query.where(AttendanceSession.schedule_id == schedule_id)
        if course_id is not None:
            query = query.where(Schedule.course_id == course_id)
        if allowed_course_ids is not None:
            if not allowed_course_ids:
                return []
            query = query.where(Schedule.course_id.in_(allowed_course_ids))
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
            select(User.id)
            .join(Enrollment, Enrollment.student_id == User.id)
            .where(
                Enrollment.course_id == sched.course_id,
                User.is_active == True,
            )
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
    async def _get_active_enrolled_student_ids_for_session(
        db: AsyncSession,
        session_id: int,
    ) -> set[int]:
        session = await AttendanceSessionService.get_session(db, session_id)
        schedule_result = await db.execute(
            select(Schedule).where(Schedule.id == session.schedule_id)
        )
        schedule = schedule_result.scalar_one()

        enrolled = await db.execute(
            select(User.id)
            .join(Enrollment, Enrollment.student_id == User.id)
            .where(
                Enrollment.course_id == schedule.course_id,
                User.is_active == True,
            )
        )
        return {row[0] for row in enrolled.fetchall()}

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

        now = datetime.now(timezone.utc)
        status = determine_status(now, session.started_at)

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
    async def batch_manual_record(
        db: AsyncSession,
        session_id: int,
        entries: list[dict],
    ) -> list[AttendanceRecord]:
        """Create or update attendance records manually (professor roll call)."""
        valid_student_ids = await AttendanceRecordService._get_active_enrolled_student_ids_for_session(
            db, session_id
        )
        invalid_ids = sorted(
            {
                entry["student_id"]
                for entry in entries
                if entry["student_id"] not in valid_student_ids
            }
        )
        if invalid_ids:
            raise BadRequestError(
                "Manual attendance is only allowed for active enrolled students. "
                f"Invalid student ids: {', '.join(str(student_id) for student_id in invalid_ids)}"
            )

        records = []
        for entry in entries:
            student_id = entry["student_id"]
            status = entry["status"]

            existing = await db.execute(
                select(AttendanceRecord).where(
                    AttendanceRecord.session_id == session_id,
                    AttendanceRecord.student_id == student_id,
                )
            )
            record = existing.scalar_one_or_none()

            if record is not None:
                record.status = status
                record.marked_by = MarkedBy.PROFESSOR
            else:
                record = AttendanceRecord(
                    student_id=student_id,
                    session_id=session_id,
                    status=status,
                    marked_by=MarkedBy.PROFESSOR,
                )
                db.add(record)
            records.append(record)

        await db.commit()
        for r in records:
            await db.refresh(r)
        return records

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
