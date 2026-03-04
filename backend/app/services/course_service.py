from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import DuplicateError, NotFoundError
from app.models.course import Course, CourseProf
from app.models.enrollment import Enrollment
from app.models.user import Role, User
from app.schemas.course import CourseCreate, CourseUpdate


class CourseService:
    @staticmethod
    async def create_course(db: AsyncSession, data: CourseCreate) -> Course:
        existing = await db.execute(select(Course).where(Course.code == data.code))
        if existing.scalar_one_or_none():
            raise DuplicateError("Course with this code")
        course = Course(**data.model_dump())
        db.add(course)
        await db.commit()
        await db.refresh(course)
        return course

    @staticmethod
    async def list_courses(db: AsyncSession, user: User) -> list[Course]:
        if user.role == Role.ADMIN:
            result = await db.execute(select(Course).order_by(Course.name))
        elif user.role == Role.PROFESSOR:
            result = await db.execute(
                select(Course)
                .join(CourseProf)
                .where(CourseProf.professor_id == user.id)
                .order_by(Course.name)
            )
        else:
            result = await db.execute(
                select(Course)
                .join(Enrollment)
                .where(Enrollment.student_id == user.id)
                .order_by(Course.name)
            )
        return result.scalars().all()

    @staticmethod
    async def get_course(db: AsyncSession, course_id: int) -> Course:
        result = await db.execute(select(Course).where(Course.id == course_id))
        course = result.scalar_one_or_none()
        if course is None:
            raise NotFoundError("Course")
        return course

    @staticmethod
    async def update_course(db: AsyncSession, course_id: int, data: CourseUpdate) -> Course:
        course = await CourseService.get_course(db, course_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(course, field, value)
        await db.commit()
        await db.refresh(course)
        return course

    @staticmethod
    async def delete_course(db: AsyncSession, course_id: int) -> None:
        course = await CourseService.get_course(db, course_id)
        await db.delete(course)
        await db.commit()

    @staticmethod
    async def assign_professors(db: AsyncSession, course_id: int, professor_ids: list[int]) -> None:
        await CourseService.get_course(db, course_id)
        for prof_id in professor_ids:
            existing = await db.execute(
                select(CourseProf).where(
                    CourseProf.course_id == course_id,
                    CourseProf.professor_id == prof_id,
                )
            )
            if existing.scalar_one_or_none() is None:
                db.add(CourseProf(course_id=course_id, professor_id=prof_id))
        await db.commit()

    @staticmethod
    async def remove_professor(db: AsyncSession, course_id: int, professor_id: int) -> None:
        await db.execute(
            delete(CourseProf).where(
                CourseProf.course_id == course_id,
                CourseProf.professor_id == professor_id,
            )
        )
        await db.commit()

    @staticmethod
    async def get_professors(db: AsyncSession, course_id: int) -> list[User]:
        result = await db.execute(
            select(User)
            .join(CourseProf, CourseProf.professor_id == User.id)
            .where(CourseProf.course_id == course_id)
            .order_by(User.last_name)
        )
        return result.scalars().all()

    @staticmethod
    async def enroll_students(db: AsyncSession, course_id: int, student_ids: list[int]) -> None:
        await CourseService.get_course(db, course_id)
        for student_id in student_ids:
            existing = await db.execute(
                select(Enrollment).where(
                    Enrollment.course_id == course_id,
                    Enrollment.student_id == student_id,
                )
            )
            if existing.scalar_one_or_none() is None:
                db.add(Enrollment(course_id=course_id, student_id=student_id))
        await db.commit()

    @staticmethod
    async def remove_student(db: AsyncSession, course_id: int, student_id: int) -> None:
        await db.execute(
            delete(Enrollment).where(
                Enrollment.course_id == course_id,
                Enrollment.student_id == student_id,
            )
        )
        await db.commit()

    @staticmethod
    async def get_enrolled_students(db: AsyncSession, course_id: int) -> list[User]:
        result = await db.execute(
            select(User)
            .join(Enrollment)
            .where(Enrollment.course_id == course_id)
            .order_by(User.last_name)
        )
        return result.scalars().all()
