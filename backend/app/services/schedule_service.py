from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.schedule import Schedule
from app.schemas.schedule import ScheduleCreate, ScheduleUpdate


class ScheduleService:
    @staticmethod
    async def create_schedule(db: AsyncSession, data: ScheduleCreate) -> Schedule:
        schedule = Schedule(**data.model_dump())
        db.add(schedule)
        await db.commit()
        await db.refresh(schedule)
        return schedule

    @staticmethod
    async def list_schedules(db: AsyncSession, course_id: int | None = None) -> list[Schedule]:
        query = select(Schedule)
        if course_id is not None:
            query = query.where(Schedule.course_id == course_id)
        query = query.order_by(Schedule.day_of_week, Schedule.start_time)
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def get_schedule(db: AsyncSession, schedule_id: int) -> Schedule:
        result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
        schedule = result.scalar_one_or_none()
        if schedule is None:
            raise NotFoundError("Schedule")
        return schedule

    @staticmethod
    async def update_schedule(db: AsyncSession, schedule_id: int, data: ScheduleUpdate) -> Schedule:
        schedule = await ScheduleService.get_schedule(db, schedule_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(schedule, field, value)
        await db.commit()
        await db.refresh(schedule)
        return schedule

    @staticmethod
    async def delete_schedule(db: AsyncSession, schedule_id: int) -> None:
        schedule = await ScheduleService.get_schedule(db, schedule_id)
        await db.delete(schedule)
        await db.commit()
