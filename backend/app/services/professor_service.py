from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestError, DuplicateError, NotFoundError
from app.core.security import hash_password
from app.models.professor_tag import ProfessorTag, professor_tag_assignments
from app.models.user import Role, User
from app.schemas.professor import ProfessorCreate, ProfessorOut, ProfessorTagOut, ProfessorUpdate


async def _get_or_create_tag(db: AsyncSession, name: str) -> ProfessorTag:
    name = name.strip()
    result = await db.execute(select(ProfessorTag).where(ProfessorTag.name == name))
    tag = result.scalar_one_or_none()
    if tag is None:
        tag = ProfessorTag(name=name)
        db.add(tag)
        await db.flush()
    return tag


async def _get_professor_tags(db: AsyncSession, professor_id: int) -> list[ProfessorTagOut]:
    result = await db.execute(
        select(ProfessorTag)
        .join(professor_tag_assignments, ProfessorTag.id == professor_tag_assignments.c.tag_id)
        .where(professor_tag_assignments.c.professor_id == professor_id)
        .order_by(ProfessorTag.name)
    )
    return [ProfessorTagOut(id=t.id, name=t.name) for t in result.scalars().all()]


async def _build_out(db: AsyncSession, professor: User) -> ProfessorOut:
    tags = await _get_professor_tags(db, professor.id)
    return ProfessorOut(
        id=professor.id,
        email=professor.email,
        first_name=professor.first_name,
        last_name=professor.last_name,
        is_active=professor.is_active,
        tags=tags,
    )


class ProfessorService:
    @staticmethod
    async def list_professors(db: AsyncSession) -> list[ProfessorOut]:
        result = await db.execute(
            select(User)
            .where(User.role == Role.PROFESSOR)
            .order_by(User.last_name, User.first_name)
        )
        professors = result.scalars().all()
        return [await _build_out(db, p) for p in professors]

    @staticmethod
    async def get_professor(db: AsyncSession, professor_id: int) -> ProfessorOut:
        p = await ProfessorService._get_or_404(db, professor_id)
        return await _build_out(db, p)

    @staticmethod
    async def create_professor(db: AsyncSession, data: ProfessorCreate) -> ProfessorOut:
        existing = await db.execute(select(User).where(User.email == data.email))
        if existing.scalar_one_or_none() is not None:
            raise DuplicateError("User with this email")

        professor = User(
            email=data.email,
            first_name=data.first_name,
            last_name=data.last_name,
            hashed_password=hash_password(data.password),
            role=Role.PROFESSOR,
        )
        db.add(professor)
        await db.flush()

        for tag_name in data.tags:
            tag = await _get_or_create_tag(db, tag_name)
            await db.execute(
                professor_tag_assignments.insert().values(
                    professor_id=professor.id, tag_id=tag.id
                )
            )

        await db.commit()
        await db.refresh(professor)
        return await _build_out(db, professor)

    @staticmethod
    async def update_professor(
        db: AsyncSession, professor_id: int, data: ProfessorUpdate
    ) -> ProfessorOut:
        professor = await ProfessorService._get_or_404(db, professor_id)

        if data.first_name is not None:
            professor.first_name = data.first_name
        if data.last_name is not None:
            professor.last_name = data.last_name
        if data.is_active is not None:
            professor.is_active = data.is_active

        if data.tags is not None:
            # Replace all tags
            await db.execute(
                professor_tag_assignments.delete().where(
                    professor_tag_assignments.c.professor_id == professor_id
                )
            )
            for tag_name in data.tags:
                tag = await _get_or_create_tag(db, tag_name)
                await db.execute(
                    professor_tag_assignments.insert().values(
                        professor_id=professor_id, tag_id=tag.id
                    )
                )

        await db.commit()
        await db.refresh(professor)
        return await _build_out(db, professor)

    @staticmethod
    async def delete_professor(db: AsyncSession, professor_id: int) -> None:
        professor = await ProfessorService._get_or_404(db, professor_id)
        professor.is_active = False
        await db.commit()

    @staticmethod
    async def list_all_tags(db: AsyncSession) -> list[ProfessorTagOut]:
        result = await db.execute(select(ProfessorTag).order_by(ProfessorTag.name))
        return [ProfessorTagOut(id=t.id, name=t.name) for t in result.scalars().all()]

    @staticmethod
    async def _get_or_404(db: AsyncSession, professor_id: int) -> User:
        result = await db.execute(
            select(User)
            .where(User.id == professor_id)
            .where(User.role == Role.PROFESSOR)
        )
        p = result.scalar_one_or_none()
        if p is None:
            raise NotFoundError("Professor")
        return p
