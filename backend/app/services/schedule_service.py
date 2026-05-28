from datetime import datetime, time, timedelta
from typing import ClassVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestError, NotFoundError
from app.models.group import group_students
from app.models.schedule import Schedule, schedule_groups
from app.models.user import Role, User
from app.schemas.schedule import ScheduleCreate, ScheduleOut, ScheduleUpdate


def _compute_end_time(start: time) -> time:
    """Start + 50 minutes."""
    dt = datetime(2000, 1, 1, start.hour, start.minute)
    return (dt + timedelta(minutes=50)).time()


def _times_overlap(s1: time, e1: time, s2: time, e2: time) -> bool:
    return s1 < e2 and s2 < e1


def _build_out(schedule: Schedule) -> ScheduleOut:
    groups_info = [{"id": g.id, "name": g.name, "group_type": g.group_type} for g in (schedule.groups or [])]

    prof_name = None
    if schedule.professor:
        prof_name = f"{schedule.professor.first_name} {schedule.professor.last_name}"

    return ScheduleOut(
        id=schedule.id,
        course_id=schedule.course_id,
        course_code=schedule.course.code if schedule.course else None,
        course_name=schedule.course.name if schedule.course else None,
        professor_id=schedule.professor_id,
        professor_name=prof_name,
        classroom_id=schedule.classroom_id,
        classroom_name=schedule.classroom.name if schedule.classroom else None,
        day_of_week=schedule.day_of_week,
        start_time=schedule.start_time,
        end_time=schedule.end_time,
        room=schedule.room,
        lesson_type=schedule.lesson_type,
        semester=schedule.semester,
        academic_year=schedule.academic_year,
        groups=groups_info,
    )


class ScheduleService:
    _LOAD: ClassVar[list] = [
        selectinload(Schedule.course),
        selectinload(Schedule.professor),
        selectinload(Schedule.classroom),
        selectinload(Schedule.groups),
    ]

    @staticmethod
    async def _get_or_404(db: AsyncSession, schedule_id: int) -> Schedule:
        result = await db.execute(
            select(Schedule).options(*ScheduleService._LOAD).where(Schedule.id == schedule_id)
        )
        s = result.scalar_one_or_none()
        if s is None:
            raise NotFoundError("Schedule")
        return s

    @staticmethod
    async def _check_conflicts(
        db: AsyncSession,
        day: str,
        start: time,
        end: time,
        professor_id: int | None,
        classroom_id: int | None,
        group_ids: list[int],
        exclude_id: int | None = None,
    ) -> None:
        """Raise BadRequestError if there is a scheduling conflict."""
        result = await db.execute(
            select(Schedule).options(selectinload(Schedule.groups))
            .where(Schedule.day_of_week == day)
        )
        existing = result.scalars().all()

        for s in existing:
            if exclude_id and s.id == exclude_id:
                continue
            s_start = s.start_time
            s_end = s.end_time
            if not _times_overlap(start, end, s_start, s_end):
                continue
            # Overlapping time slot — check conflicts
            if professor_id and s.professor_id == professor_id:
                raise BadRequestError(
                    f"Professor conflict: professor is already scheduled at this time (schedule #{s.id})"
                )
            if classroom_id and s.classroom_id == classroom_id:
                raise BadRequestError(
                    f"Classroom conflict: classroom is already in use at this time (schedule #{s.id})"
                )
            existing_group_ids = {g.id for g in (s.groups or [])}
            conflict_groups = existing_group_ids & set(group_ids)
            if conflict_groups:
                raise BadRequestError(
                    f"Group conflict: group(s) {conflict_groups} are already scheduled at this time (schedule #{s.id})"
                )

    @staticmethod
    async def create_schedule(db: AsyncSession, data: ScheduleCreate) -> ScheduleOut:
        start = data.start_time
        end = data.end_time or _compute_end_time(start)

        await ScheduleService._check_conflicts(
            db, data.day_of_week, start, end,
            data.professor_id, data.classroom_id, data.group_ids,
        )

        schedule = Schedule(
            course_id=data.course_id,
            professor_id=data.professor_id,
            classroom_id=data.classroom_id,
            day_of_week=data.day_of_week,
            start_time=start,
            end_time=end,
            lesson_type=data.lesson_type,
            semester=data.semester,
            academic_year=data.academic_year,
        )
        db.add(schedule)
        await db.flush()  # get ID without committing

        # Attach groups
        for gid in data.group_ids:
            await db.execute(schedule_groups.insert().values(schedule_id=schedule.id, group_id=gid))

        await db.commit()
        return await ScheduleService._get_or_404(db, schedule.id)

    @staticmethod
    async def list_schedules(
        db: AsyncSession,
        *,
        semester: str | None = None,
        academic_year: str | None = None,
        professor_id: int | None = None,
        group_id: int | None = None,
        allowed_schedule_ids: list[int] | None = None,
    ) -> list[ScheduleOut]:
        query = select(Schedule).options(*ScheduleService._LOAD)
        if semester:
            query = query.where(Schedule.semester == semester)
        if academic_year:
            query = query.where(Schedule.academic_year == academic_year)
        if professor_id is not None:
            query = query.where(Schedule.professor_id == professor_id)
        if group_id is not None:
            query = query.join(schedule_groups, Schedule.id == schedule_groups.c.schedule_id).where(
                schedule_groups.c.group_id == group_id
            )
        if allowed_schedule_ids is not None:
            if not allowed_schedule_ids:
                return []
            query = query.where(Schedule.id.in_(allowed_schedule_ids))
        query = query.order_by(Schedule.day_of_week, Schedule.start_time)
        result = await db.execute(query)
        return [_build_out(s) for s in result.scalars().unique().all()]

    @staticmethod
    async def get_schedule(db: AsyncSession, schedule_id: int) -> ScheduleOut:
        s = await ScheduleService._get_or_404(db, schedule_id)
        return _build_out(s)

    @staticmethod
    async def update_schedule(
        db: AsyncSession, schedule_id: int, data: ScheduleUpdate
    ) -> ScheduleOut:
        s = await ScheduleService._get_or_404(db, schedule_id)

        update_data = data.model_dump(exclude_unset=True, exclude={"group_ids"})
        for field, value in update_data.items():
            setattr(s, field, value)

        # Recompute end_time if only start_time changed
        if "start_time" in update_data and "end_time" not in update_data:
            s.end_time = _compute_end_time(s.start_time)

        day = s.day_of_week
        start = s.start_time
        end = s.end_time

        await ScheduleService._check_conflicts(
            db, day, start, end,
            s.professor_id, s.classroom_id,
            data.group_ids if data.group_ids is not None else [g.id for g in s.groups],
            exclude_id=schedule_id,
        )

        if data.group_ids is not None:
            await db.execute(
                schedule_groups.delete().where(schedule_groups.c.schedule_id == schedule_id)
            )
            for gid in data.group_ids:
                await db.execute(
                    schedule_groups.insert().values(schedule_id=schedule_id, group_id=gid)
                )

        await db.commit()
        return await ScheduleService._get_or_404(db, schedule_id)

    @staticmethod
    async def delete_schedule(db: AsyncSession, schedule_id: int) -> None:
        s = await ScheduleService._get_or_404(db, schedule_id)
        await db.delete(s)
        await db.commit()

    @staticmethod
    async def get_my_schedules(db: AsyncSession, user: User) -> list[ScheduleOut]:
        """Return schedules visible to the current user by role."""
        if user.role == Role.PROFESSOR:
            return await ScheduleService.list_schedules(db, professor_id=user.id)

        if user.role == Role.STUDENT:
            # Find groups where student is a member
            result = await db.execute(
                select(group_students.c.group_id).where(group_students.c.student_id == user.id)
            )
            gids = [r[0] for r in result]
            if not gids:
                return []

            # Get schedule IDs linked to any of those groups
            sched_result = await db.execute(
                select(schedule_groups.c.schedule_id).where(
                    schedule_groups.c.group_id.in_(gids)
                )
            )
            schedule_ids = list({r[0] for r in sched_result})
            return await ScheduleService.list_schedules(db, allowed_schedule_ids=schedule_ids)

        # Admin — return all
        return await ScheduleService.list_schedules(db)
