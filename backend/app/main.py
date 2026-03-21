import logging
from contextlib import asynccontextmanager
from pathlib import Path

import sqlalchemy as sa
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from app.config import settings
from app.core.security import hash_password
from app.database import async_session, engine, Base
from app.models.user import Role, User

logger = logging.getLogger(__name__)


async def seed_admin() -> None:
    async with async_session() as db:
        result = await db.execute(select(User).where(User.role == Role.ADMIN).limit(1))
        if result.scalar_one_or_none() is not None:
            return

        admin = User(
            email=settings.ADMIN_EMAIL,
            hashed_password=hash_password(settings.ADMIN_PASSWORD),
            first_name="System",
            last_name="Admin",
            role=Role.ADMIN,
        )
        db.add(admin)
        await db.commit()
        logger.info("Default admin account created: %s", settings.ADMIN_EMAIL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Import all models so Base.metadata is complete
    import app.models  # noqa: F401
    async with engine.begin() as conn:
        try:
            await conn.execute(sa.text("CREATE EXTENSION IF NOT EXISTS vector"))
        except Exception:
            pass
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_admin()
    yield


app = FastAPI(
    title="Face Recognition Attendance System",
    description="AI-powered student attendance tracking using face recognition",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


# --- Phase 1 routers ---
from app.api import auth, users  # noqa: E402

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])

# --- Phase 2 routers ---
from app.api import courses, schedules  # noqa: E402

app.include_router(courses.router, prefix="/api/courses", tags=["Courses"])
app.include_router(schedules.router, prefix="/api/schedules", tags=["Schedules"])

# --- Phase 3 routers ---
from app.api import face  # noqa: E402

app.include_router(face.router, prefix="/api/face", tags=["Face Registry"])

# Serve uploaded files (photos)
uploads_path = Path(settings.UPLOAD_DIR)
uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")

# --- Phase 4 routers ---
from app.api import attendance, attendance_session, attend  # noqa: E402

app.include_router(attendance_session.router, prefix="/api/sessions", tags=["Sessions"])
app.include_router(attendance.router, prefix="/api/attendance", tags=["Attendance"])
app.include_router(attend.router, prefix="/api/attend", tags=["Student Attend"])

# --- Phase 5 routers ---
from app.api import notifications  # noqa: E402

app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])

# --- Phase 6 routers ---
from app.api import appeals, statistics  # noqa: E402

app.include_router(appeals.router, prefix="/api/appeals", tags=["Appeals"])
app.include_router(statistics.router, prefix="/api/statistics", tags=["Statistics"])
