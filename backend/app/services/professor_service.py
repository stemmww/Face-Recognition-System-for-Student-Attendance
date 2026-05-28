from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DuplicateError, NotFoundError
from app.core.security import hash_password
from app.models.course import Course, CourseProf
from app.models.user import Role, User
from app.schemas.professor import CourseSummaryOut, ProfessorCreate, ProfessorOut, ProfessorUpdate


async def _get_professor_courses(db: AsyncSession, professor_id: int) -> list[CourseSummaryOut]:
    result = await db.execute(
        select(Course)
        .join(CourseProf, Course.id == CourseProf.course_id)
        .where(CourseProf.professor_id == professor_id)
        .order_by(Course.name)
    )
    return [CourseSummaryOut(id=c.id, code=c.code, name=c.name) for c in result.scalars().all()]


async def _build_out(db: AsyncSession, professor: User) -> ProfessorOut:
    courses = await _get_professor_courses(db, professor.id)
    return ProfessorOut(
        id=professor.id,
        email=professor.email,
        first_name=professor.first_name,
        last_name=professor.last_name,
        is_active=professor.is_active,
        courses=courses,
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

        await db.commit()
        await db.refresh(professor)
        return await _build_out(db, professor)

    @staticmethod
    async def delete_professor(db: AsyncSession, professor_id: int) -> None:
        professor = await ProfessorService._get_or_404(db, professor_id)
        professor.is_active = False
        await db.commit()

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
