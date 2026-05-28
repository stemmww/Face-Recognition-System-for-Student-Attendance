from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.classroom import Classroom
from app.schemas.classroom import ClassroomCreate, ClassroomOut, ClassroomUpdate


class ClassroomService:
    @staticmethod
    async def create(db: AsyncSession, data: ClassroomCreate) -> ClassroomOut:
        classroom = Classroom(
            name=data.name,
            capacity=data.capacity,
            room_type=data.room_type,
            block=data.block,
            floor=data.floor,
            room_number=data.room_number,
            is_active=data.is_active,
        )
        db.add(classroom)
        await db.commit()
        await db.refresh(classroom)
        return ClassroomOut.from_orm(classroom)

    @staticmethod
    async def list(db: AsyncSession, active_only: bool = True) -> list[ClassroomOut]:
        query = select(Classroom)
        if active_only:
            query = query.where(Classroom.is_active == True)
        query = query.order_by(Classroom.name)
        result = await db.execute(query)
        return [ClassroomOut.from_orm(c) for c in result.scalars().all()]

    @staticmethod
    async def get(db: AsyncSession, classroom_id: int) -> ClassroomOut:
        c = await ClassroomService._get_or_404(db, classroom_id)
        return ClassroomOut.from_orm(c)

    @staticmethod
    async def update(db: AsyncSession, classroom_id: int, data: ClassroomUpdate) -> ClassroomOut:
        c = await ClassroomService._get_or_404(db, classroom_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(c, field, value)
        await db.commit()
        await db.refresh(c)
        return ClassroomOut.from_orm(c)

    @staticmethod
    async def delete(db: AsyncSession, classroom_id: int) -> None:
        c = await ClassroomService._get_or_404(db, classroom_id)
        await db.delete(c)
        await db.commit()

    @staticmethod
    async def _get_or_404(db: AsyncSession, classroom_id: int) -> Classroom:
        result = await db.execute(select(Classroom).where(Classroom.id == classroom_id))
        c = result.scalar_one_or_none()
        if c is None:
            raise NotFoundError("Classroom")
        return c
