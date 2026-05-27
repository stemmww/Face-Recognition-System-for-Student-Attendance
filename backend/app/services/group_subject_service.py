from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundError
from app.models.group_subject import GroupSubject
from app.schemas.group_subject import GroupSubjectAdd, GroupSubjectOut


class GroupSubjectService:
    @staticmethod
    async def list(db: AsyncSession, group_id: int) -> list[GroupSubjectOut]:
        result = await db.execute(
            select(GroupSubject)
            .options(selectinload(GroupSubject.course))
            .where(GroupSubject.group_id == group_id)
            .order_by(GroupSubject.semester)
        )
        items = result.scalars().all()
        return [
            GroupSubjectOut(
                id=gs.id,
                group_id=gs.group_id,
                course_id=gs.course_id,
                course_code=gs.course.code if gs.course else "",
                course_name=gs.course.name if gs.course else "",
                semester=gs.semester,
            )
            for gs in items
        ]

    @staticmethod
    async def add(db: AsyncSession, group_id: int, data: GroupSubjectAdd) -> GroupSubjectOut:
        gs = GroupSubject(group_id=group_id, course_id=data.course_id, semester=data.semester)
        db.add(gs)
        await db.commit()
        await db.refresh(gs)
        # reload with course
        result = await db.execute(
            select(GroupSubject)
            .options(selectinload(GroupSubject.course))
            .where(GroupSubject.id == gs.id)
        )
        gs = result.scalar_one()
        return GroupSubjectOut(
            id=gs.id,
            group_id=gs.group_id,
            course_id=gs.course_id,
            course_code=gs.course.code if gs.course else "",
            course_name=gs.course.name if gs.course else "",
            semester=gs.semester,
        )

    @staticmethod
    async def remove(db: AsyncSession, group_id: int, gs_id: int) -> None:
        result = await db.execute(
            select(GroupSubject).where(GroupSubject.id == gs_id, GroupSubject.group_id == group_id)
        )
        gs = result.scalar_one_or_none()
        if gs is None:
            raise NotFoundError("GroupSubject")
        await db.delete(gs)
        await db.commit()
