"""Shared test fixtures: async SQLite engine, DB session, and FastAPI test client."""

import asyncio
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

# Compile pgvector's Vector type as BLOB for SQLite
from pgvector.sqlalchemy import Vector


@compiles(Vector, "sqlite")
def _compile_vector_sqlite(type_, compiler, **kw):
    return "BLOB"


from app.core.security import hash_password
from app.database import Base, get_db
from app.main import app
from app.models.user import Role, User

TEST_DATABASE_URL = "sqlite+aiosqlite://"


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def _test_db():
    """Function-scoped: creates a fresh in-memory SQLite DB per test."""
    eng = create_async_engine(TEST_DATABASE_URL, echo=False)

    @event.listens_for(eng.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    factory = async_sessionmaker(eng, class_=AsyncSession, expire_on_commit=False)

    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield eng, factory

    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await eng.dispose()


@pytest_asyncio.fixture
async def db(_test_db) -> AsyncGenerator[AsyncSession, None]:
    _, factory = _test_db
    async with factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(_test_db) -> AsyncGenerator[AsyncClient, None]:
    """FastAPI test client with DB dependency overridden to use test SQLite."""
    _, factory = _test_db

    async def _override_get_db():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Seed users via the same DB the client uses
# ---------------------------------------------------------------------------


async def _create_user(factory, *, email, password, first_name, last_name, role) -> User:
    async with factory() as session:
        user = User(
            email=email,
            hashed_password=hash_password(password),
            first_name=first_name,
            last_name=last_name,
            role=role,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


@pytest_asyncio.fixture
async def admin_user(_test_db) -> User:
    _, factory = _test_db
    return await _create_user(
        factory, email="admin@test.com", password="admin123",
        first_name="Test", last_name="Admin", role=Role.ADMIN,
    )


@pytest_asyncio.fixture
async def professor_user(_test_db) -> User:
    _, factory = _test_db
    return await _create_user(
        factory, email="prof@test.com", password="prof123",
        first_name="Test", last_name="Professor", role=Role.PROFESSOR,
    )


@pytest_asyncio.fixture
async def student_user(_test_db) -> User:
    _, factory = _test_db
    return await _create_user(
        factory, email="student@test.com", password="student123",
        first_name="Test", last_name="Student", role=Role.STUDENT,
    )


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
