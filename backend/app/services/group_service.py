from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, NotFoundError
from app.models.group import Group, group_students
from app.models.user import Role, User
from app.schemas.group import GroupCreate, GroupOut, GroupUpdate


class GroupService:
    @staticmethod
    async def create_group(db: AsyncSession, data: GroupCreate) -> GroupOut:
        group = Group(
            major=data.major,
            enrollment_year_short=data.enrollment_year_short,
            group_number=data.group_number,
            group_type=data.group_type,
            semester=data.semester,
            academic_year=data.academic_year,
        )
        db.add(group)
        await db.commit()
        await db.refresh(group)
        return GroupOut.from_orm_with_count(group, 0)

    @staticmethod
    async def list_groups(
        db: AsyncSession,
        active_only: bool = True,
        group_type: str | None = None,
    ) -> list[GroupOut]:
        query = select(Group)
        if active_only:
            query = query.where(Group.is_active == True)
        if group_type:
            query = query.where(Group.group_type == group_type.upper())
        query = query.order_by(Group.major, Group.enrollment_year_short, Group.group_number)
        result = await db.execute(query)
        groups = result.scalars().all()
        counts = await GroupService._student_counts(db, [g.id for g in groups])
        return [GroupOut.from_orm_with_count(g, counts.get(g.id, 0)) for g in groups]

    @staticmethod
    async def get_group(db: AsyncSession, group_id: int) -> GroupOut:
        group = await GroupService._get_or_404(db, group_id)
        count = await GroupService._student_count(db, group_id)
        return GroupOut.from_orm_with_count(group, count)

    @staticmethod
    async def update_group(db: AsyncSession, group_id: int, data: GroupUpdate) -> GroupOut:
        group = await GroupService._get_or_404(db, group_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(group, field, value)
        await db.commit()
        await db.refresh(group)
        count = await GroupService._student_count(db, group_id)
        return GroupOut.from_orm_with_count(group, count)

    @staticmethod
    async def delete_group(db: AsyncSession, group_id: int) -> None:
        group = await GroupService._get_or_404(db, group_id)
        await db.delete(group)
        await db.commit()

    @staticmethod
    async def add_students(db: AsyncSession, group_id: int, student_ids: list[int]) -> None:
        group = await GroupService._get_or_404(db, group_id)

        result = await db.execute(
            select(User)
            .where(User.id.in_(student_ids))
            .where(User.role == Role.STUDENT)
        )
        students = result.scalars().all()
        if not students:
            raise NotFoundError("Students")

        # MAIN group: student can only be in ONE active MAIN group
        if group.group_type == "MAIN":
            for student in students:
                existing = await db.execute(
                    select(group_students.c.group_id)
                    .join(Group, Group.id == group_students.c.group_id)
                    .where(group_students.c.student_id == student.id)
                    .where(Group.group_type == "MAIN")
                    .where(Group.is_active == True)
                    .where(Group.id != group_id)
                )
                if existing.fetchone() is not None:
                    raise BadRequestError(
                        f"Student {student.email} is already in another active MAIN group"
                    )

        # Load existing members to avoid duplicates
        existing_result = await db.execute(
            select(group_students.c.student_id).where(group_students.c.group_id == group_id)
        )
        existing_ids = {row[0] for row in existing_result}

        for student in students:
            if student.id not in existing_ids:
                await db.execute(
                    group_students.insert().values(group_id=group_id, student_id=student.id)
                )
        await db.commit()

    @staticmethod
    async def remove_student(db: AsyncSession, group_id: int, student_id: int) -> None:
        await GroupService._get_or_404(db, group_id)
        await db.execute(
            group_students.delete()
            .where(group_students.c.group_id == group_id)
            .where(group_students.c.student_id == student_id)
        )
        await db.commit()

    @staticmethod
    async def list_students(db: AsyncSession, group_id: int) -> list[User]:
        await GroupService._get_or_404(db, group_id)
        result = await db.execute(
            select(User)
            .join(group_students, User.id == group_students.c.student_id)
            .where(group_students.c.group_id == group_id)
            .order_by(User.last_name, User.first_name)
        )
        return result.scalars().all()

    # --- helpers ---

    @staticmethod
    async def _get_or_404(db: AsyncSession, group_id: int) -> Group:
        result = await db.execute(select(Group).where(Group.id == group_id))
        group = result.scalar_one_or_none()
        if group is None:
            raise NotFoundError("Group")
        return group

    @staticmethod
    async def _student_count(db: AsyncSession, group_id: int) -> int:
        result = await db.execute(
            select(func.count()).select_from(group_students).where(group_students.c.group_id == group_id)
        )
        return result.scalar_one()

    @staticmethod
    async def _student_counts(db: AsyncSession, group_ids: list[int]) -> dict[int, int]:
        if not group_ids:
            return {}
        result = await db.execute(
            select(group_students.c.group_id, func.count(group_students.c.student_id))
            .where(group_students.c.group_id.in_(group_ids))
            .group_by(group_students.c.group_id)
        )
        return {row[0]: row[1] for row in result}
