"""Appeal submission and review logic."""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, NotFoundError
from app.models.appeal import Appeal, AppealStatus
from app.models.attendance import AttendanceRecord, AttendanceStatus, MarkedBy
from app.models.notification import Notification

logger = logging.getLogger(__name__)


class AppealService:
    @staticmethod
    async def create_appeal(
        db: AsyncSession, student_id: int, attendance_id: int, reason: str
    ) -> Appeal:
        record_result = await db.execute(
            select(AttendanceRecord).where(AttendanceRecord.id == attendance_id)
        )
        record = record_result.scalar_one_or_none()
        if record is None:
            raise NotFoundError("Attendance record")
        if record.student_id != student_id:
            raise BadRequestError("You can only appeal your own attendance records")

        existing = await db.execute(
            select(Appeal).where(
                Appeal.student_id == student_id,
                Appeal.attendance_id == attendance_id,
                Appeal.status == AppealStatus.PENDING,
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise BadRequestError("A pending appeal already exists for this record")

        appeal = Appeal(
            student_id=student_id,
            attendance_id=attendance_id,
            reason=reason,
        )
        db.add(appeal)
        await db.commit()
        await db.refresh(appeal)
        return appeal

    @staticmethod
    async def list_my_appeals(db: AsyncSession, student_id: int) -> list[Appeal]:
        result = await db.execute(
            select(Appeal)
            .where(Appeal.student_id == student_id)
            .order_by(Appeal.created_at.desc())
        )
        return result.scalars().all()

    @staticmethod
    async def list_appeals(
        db: AsyncSession, status: AppealStatus | None = None
    ) -> list[Appeal]:
        query = select(Appeal).order_by(Appeal.created_at.desc())
        if status is not None:
            query = query.where(Appeal.status == status)
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def review_appeal(
        db: AsyncSession, appeal_id: int, status: AppealStatus, reviewer_id: int
    ) -> Appeal:
        result = await db.execute(select(Appeal).where(Appeal.id == appeal_id))
        appeal = result.scalar_one_or_none()
        if appeal is None:
            raise NotFoundError("Appeal")
        if appeal.status != AppealStatus.PENDING:
            raise BadRequestError("Appeal has already been reviewed")

        appeal.status = status
        appeal.reviewed_by = reviewer_id

        if status == AppealStatus.APPROVED:
            record_result = await db.execute(
                select(AttendanceRecord).where(AttendanceRecord.id == appeal.attendance_id)
            )
            record = record_result.scalar_one_or_none()
            if record is not None:
                record.status = AttendanceStatus.PRESENT
                record.marked_by = MarkedBy.PROFESSOR

            db.add(Notification(
                user_id=appeal.student_id,
                message=f"Your attendance appeal has been approved.",
            ))
        elif status == AppealStatus.REJECTED:
            db.add(Notification(
                user_id=appeal.student_id,
                message=f"Your attendance appeal has been rejected.",
            ))

        await db.commit()
        await db.refresh(appeal)
        return appeal
