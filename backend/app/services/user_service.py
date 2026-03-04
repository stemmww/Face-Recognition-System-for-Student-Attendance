from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DuplicateError, NotFoundError
from app.core.security import hash_password
from app.models.user import Role, User
from app.schemas.user import UserCreate, UserUpdate


class UserService:
    @staticmethod
    async def list_users(db: AsyncSession, role: Role | None = None) -> list[User]:
        query = select(User)
        if role:
            query = query.where(User.role == role)
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
