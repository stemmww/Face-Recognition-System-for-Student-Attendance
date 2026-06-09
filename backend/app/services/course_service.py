from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, NotFoundError
from app.models.appeal import Appeal
from app.models.attendance import AttendanceRecord
from app.models.attendance_session import AttendanceSession
from app.models.course import Course, CourseProf
from app.models.enrollment import Enrollment
from app.models.group import group_students
from app.models.group_subject import GroupSubject
from app.models.professor_tag import course_tag_assignments
from app.models.schedule import Schedule, schedule_groups
from app.models.user import Role, User
from app.schemas.course import CourseCreate, CourseUpdate


async def _generate_code(db: AsyncSession) -> str:
    """Generate the next 6-digit course code, e.g. 000001, 000002."""
    result = await db.execute(select(func.count()).select_from(Course))
    count = result.scalar_one()
    # Find the next unique code by trying sequentially
    for candidate in range(count + 1, count + 1000):
        code = f"{candidate:06d}"
        existing = await db.execute(select(Course).where(Course.code == code))
        if existing.scalar_one_or_none() is None:
            return code
    raise BadRequestError("Cannot generate unique course code")


class CourseService:
    @staticmethod
    async def _validate_assignable_users(
        db: AsyncSession,
        user_ids: list[int],
        *,
        expected_role: Role,
        verb: str,
    ) -> None:
        requested_ids = list(dict.fromkeys(user_ids))
        if not requested_ids:
            return

        result = await db.execute(select(User).where(User.id.in_(requested_ids)))
        users = {user.id: user for user in result.scalars().all()}

        missing_ids = [str(uid) for uid in requested_ids if uid not in users]
        inactive_ids = [str(uid) for uid in requested_ids if uid in users and not users[uid].is_active]
        wrong_role_ids = [str(uid) for uid in requested_ids if uid in users and users[uid].role != expected_role]

        if not (missing_ids or inactive_ids or wrong_role_ids):
            return

        errors: list[str] = []
        if missing_ids:
            errors.append(f"Unknown user ids: {', '.join(missing_ids)}")
        if inactive_ids:
            errors.append(f"Cannot {verb} inactive {expected_role.value}s: {', '.join(inactive_ids)}")
        if wrong_role_ids:
            errors.append(f"Only {expected_role.value}s can be {verb}ed: {', '.join(wrong_role_ids)}")
        raise BadRequestError("; ".join(errors))

    @staticmethod
    async def create_course(db: AsyncSession, data: CourseCreate) -> Course:
        code = await _generate_code(db)
        course = Course(
            code=code,
            name=data.name,
            description=data.description,
            semester=data.semester,
            academic_year=data.academic_year,
            lesson_type=data.lesson_type,
            group_type=data.group_type,
        )
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
            course_ids = await CourseService.get_student_course_ids(db, user.id)
            if not course_ids:
                return []
            result = await db.execute(
                select(Course).where(Course.id.in_(course_ids)).order_by(Course.name)
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
        updates = data.model_dump(exclude_unset=True)
        if "code" in updates and updates["code"] != course.code:
            conflict = await db.execute(select(Course).where(Course.code == updates["code"]))
            if conflict.scalar_one_or_none() is not None:
                raise BadRequestError("Course with this code already exists")
        for field, value in updates.items():
            setattr(course, field, value)
        await db.commit()
        await db.refresh(course)
        return course

    @staticmethod
    async def delete_course(db: AsyncSession, course_id: int) -> None:
        course = await CourseService.get_course(db, course_id)
        schedule_ids = select(Schedule.id).where(Schedule.course_id == course_id)
        session_ids = select(AttendanceSession.id).where(AttendanceSession.schedule_id.in_(schedule_ids))
        record_ids = select(AttendanceRecord.id).where(AttendanceRecord.session_id.in_(session_ids))

        await db.execute(delete(Appeal).where(Appeal.attendance_id.in_(record_ids)))
        await db.execute(delete(AttendanceRecord).where(AttendanceRecord.session_id.in_(session_ids)))
        await db.execute(delete(AttendanceSession).where(AttendanceSession.schedule_id.in_(schedule_ids)))
        await db.execute(delete(schedule_groups).where(schedule_groups.c.schedule_id.in_(schedule_ids)))
        await db.execute(delete(Schedule).where(Schedule.course_id == course_id))
        await db.execute(delete(Enrollment).where(Enrollment.course_id == course_id))
        await db.execute(delete(CourseProf).where(CourseProf.course_id == course_id))
        await db.execute(delete(GroupSubject).where(GroupSubject.course_id == course_id))
        await db.execute(delete(course_tag_assignments).where(course_tag_assignments.c.course_id == course_id))
        await db.delete(course)
        await db.commit()

    @staticmethod
    async def assign_professors(db: AsyncSession, course_id: int, professor_ids: list[int]) -> None:
        await CourseService.get_course(db, course_id)
        await CourseService._validate_assignable_users(db, professor_ids, expected_role=Role.PROFESSOR, verb="assign")
        for prof_id in professor_ids:
            existing = await db.execute(
                select(CourseProf).where(CourseProf.course_id == course_id, CourseProf.professor_id == prof_id)
            )
            if existing.scalar_one_or_none() is None:
                db.add(CourseProf(course_id=course_id, professor_id=prof_id))
        await db.commit()

    @staticmethod
    async def remove_professor(db: AsyncSession, course_id: int, professor_id: int) -> None:
        await db.execute(
            delete(CourseProf).where(CourseProf.course_id == course_id, CourseProf.professor_id == professor_id)
        )
        await db.commit()

    @staticmethod
    async def get_professors(db: AsyncSession, course_id: int) -> list[User]:
        result = await db.execute(
            select(User)
            .join(CourseProf, CourseProf.professor_id == User.id)
            .where(CourseProf.course_id == course_id, User.is_active.is_(True))
            .order_by(User.last_name)
        )
        return result.scalars().all()

    @staticmethod
    async def enroll_students(db: AsyncSession, course_id: int, student_ids: list[int]) -> None:
        await CourseService.get_course(db, course_id)
        await CourseService._validate_assignable_users(db, student_ids, expected_role=Role.STUDENT, verb="enroll")
        for student_id in student_ids:
            existing = await db.execute(
                select(Enrollment).where(Enrollment.course_id == course_id, Enrollment.student_id == student_id)
            )
            if existing.scalar_one_or_none() is None:
                db.add(Enrollment(course_id=course_id, student_id=student_id))
        await db.commit()

    @staticmethod
    async def remove_student(db: AsyncSession, course_id: int, student_id: int) -> None:
        await db.execute(
            delete(Enrollment).where(Enrollment.course_id == course_id, Enrollment.student_id == student_id)
        )
        await db.commit()

    @staticmethod
    async def get_enrolled_students(db: AsyncSession, course_id: int) -> list[User]:
        student_ids = await CourseService.get_active_enrolled_student_ids(db, course_id)
        if not student_ids:
            return []
        result = await db.execute(
            select(User)
            .where(User.id.in_(student_ids), User.is_active.is_(True))
            .order_by(User.last_name, User.first_name)
        )
        return result.scalars().all()

    @staticmethod
    async def get_student_course_ids(db: AsyncSession, student_id: int) -> list[int]:
        direct = await db.execute(
            select(Enrollment.course_id).where(Enrollment.student_id == student_id)
        )
        group_based = await db.execute(
            select(GroupSubject.course_id)
            .join(group_students, group_students.c.group_id == GroupSubject.group_id)
            .where(group_students.c.student_id == student_id)
        )
        return sorted({row[0] for row in direct.fetchall()} | {row[0] for row in group_based.fetchall()})

    @staticmethod
    async def is_student_enrolled(db: AsyncSession, course_id: int, student_id: int) -> bool:
        course_ids = await CourseService.get_student_course_ids(db, student_id)
        return course_id in course_ids

    @staticmethod
    async def get_active_enrolled_student_ids(db: AsyncSession, course_id: int) -> set[int]:
        direct = await db.execute(
            select(Enrollment.student_id).where(Enrollment.course_id == course_id)
        )
        group_based = await db.execute(
            select(group_students.c.student_id)
            .join(GroupSubject, GroupSubject.group_id == group_students.c.group_id)
            .where(GroupSubject.course_id == course_id)
        )
        student_ids = {row[0] for row in direct.fetchall()} | {row[0] for row in group_based.fetchall()}
        if not student_ids:
            return set()

        active = await db.execute(
            select(User.id).where(User.id.in_(student_ids), User.is_active.is_(True))
        )
        return {row[0] for row in active.fetchall()}
