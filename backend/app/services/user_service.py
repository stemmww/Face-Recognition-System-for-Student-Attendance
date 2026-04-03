from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DuplicateError, NotFoundError
from app.core.security import hash_password
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.user import Role, User
from app.schemas.user import UserCreate, UserUpdate


class UserService:
    @staticmethod
    async def list_users(
        db: AsyncSession,
        role: Role | None = None,
        active_only: bool | None = None,
    ) -> list[User]:
        query = select(User)
        if role:
            query = query.where(User.role == role)
        if active_only:
            query = query.where(User.is_active.is_(True))
        result = await db.execute(query.order_by(User.created_at.desc()))
        return result.scalars().all()

    @staticmethod
    async def create_user(db: AsyncSession, data: UserCreate) -> User:
        existing = await db.execute(select(User).where(User.email == data.email))
        if existing.scalar_one_or_none():
            raise DuplicateError("User with this email")

        user = User(
            email=data.email,
            hashed_password=hash_password(data.password),
            first_name=data.first_name,
            last_name=data.last_name,
            role=data.role,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def get_user(db: AsyncSession, user_id: int) -> User:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            raise NotFoundError("User")
        return user

    @staticmethod
    async def update_user(db: AsyncSession, user_id: int, data: UserUpdate) -> User:
        user = await UserService.get_user(db, user_id)
        update_data = data.model_dump(exclude_unset=True)

        if "password" in update_data:
            raw_pw = update_data.pop("password")
            if raw_pw:
                user.hashed_password = hash_password(raw_pw)

        for field, value in update_data.items():
            setattr(user, field, value)

        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def deactivate_user(db: AsyncSession, user_id: int) -> None:
        user = await UserService.get_user(db, user_id)
        user.is_active = False
        await db.commit()

    @staticmethod
    async def bulk_import_students(
        db: AsyncSession, rows: list[dict]
    ) -> dict:
        created = 0
        skipped = 0
        enrolled = 0
        errors: list[str] = []

        for i, row in enumerate(rows, start=2):
            email = row.get("email", "").strip()
            first_name = row.get("first_name", "").strip()
            last_name = row.get("last_name", "").strip()
            password = row.get("password", "").strip()
            course_codes_raw = row.get("course_codes", "").strip()

            if not email or not first_name or not last_name or not password:
                errors.append(f"Row {i}: missing required fields")
                continue

            # Find or create user
            existing = await db.execute(select(User).where(User.email == email))
            user = existing.scalar_one_or_none()

            if user is not None:
                skipped += 1
            else:
                user = User(
                    email=email,
                    hashed_password=hash_password(password),
                    first_name=first_name,
                    last_name=last_name,
                    role=Role.STUDENT,
                )
                db.add(user)
                await db.flush()
                created += 1

            # Enroll in courses
            if course_codes_raw:
                if user is not None and not user.is_active:
                    errors.append(
                        f"Row {i}: existing user '{email}' is inactive and cannot be enrolled"
                    )
                    continue

                codes = [c.strip() for c in course_codes_raw.replace(";", ",").split(",") if c.strip()]
                for code in codes:
                    course_result = await db.execute(
                        select(Course).where(Course.code == code)
                    )
                    course = course_result.scalar_one_or_none()
                    if course is None:
                        errors.append(f"Row {i}: course '{code}' not found")
                        continue

                    enrollment_exists = await db.execute(
                        select(Enrollment).where(
                            Enrollment.student_id == user.id,
                            Enrollment.course_id == course.id,
                        )
                    )
                    if enrollment_exists.scalar_one_or_none() is None:
                        db.add(Enrollment(student_id=user.id, course_id=course.id))
                        enrolled += 1

        await db.commit()
        return {
            "created": created,
            "skipped": skipped,
            "enrolled": enrolled,
            "errors": errors,
        }
