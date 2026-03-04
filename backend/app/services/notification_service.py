"""Notification service — create, list, mark read."""

import logging

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.notification import Notification

logger = logging.getLogger(__name__)


class NotificationService:
    @staticmethod
    async def create(db: AsyncSession, user_id: int, message: str) -> Notification:
        notification = Notification(user_id=user_id, message=message)
        db.add(notification)
        await db.commit()
        await db.refresh(notification)
        return notification

    @staticmethod
    async def create_bulk(db: AsyncSession, entries: list[tuple[int, str]]) -> int:
        """Create multiple notifications. entries = [(user_id, message), ...]"""
        for user_id, message in entries:
            db.add(Notification(user_id=user_id, message=message))
        await db.commit()
        return len(entries)

    @staticmethod
    async def list_for_user(db: AsyncSession, user_id: int) -> list[Notification]:
        result = await db.execute(
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(100)
        )
        return result.scalars().all()

    @staticmethod
    async def unread_count(db: AsyncSession, user_id: int) -> int:
        from sqlalchemy import func
        result = await db.execute(
            select(func.count())
            .where(Notification.user_id == user_id, Notification.is_read == False)
        )
        return result.scalar() or 0

    @staticmethod
    async def mark_read(db: AsyncSession, notification_id: int, user_id: int) -> Notification:
        result = await db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
        )
        notification = result.scalar_one_or_none()
        if notification is None:
            raise NotFoundError("Notification")
        notification.is_read = True
        await db.commit()
        await db.refresh(notification)
        return notification

    @staticmethod
    async def mark_all_read(db: AsyncSession, user_id: int) -> int:
        result = await db.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read == False)
            .values(is_read=True)
        )
        await db.commit()
        return result.rowcount
