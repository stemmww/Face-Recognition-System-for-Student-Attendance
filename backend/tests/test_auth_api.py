"""API integration tests for auth endpoints: login, refresh, forgot/reset password."""

from httpx import AsyncClient

from app.api import auth as auth_api
from app.core.security import create_reset_token
from app.models.user import User


class TestLogin:
    async def test_login_success(self, client: AsyncClient, admin_user: User): #Группа тестов, связанных с логином пользователя.
        r = await client.post("/api/auth/login", json={ #Асинхронный тест:
            "email": "admin@test.com",
            "password": "admin123",
        })
        assert r.status_code == 200 #Закрываем JSON запрос и Проверяем успешный ответ
        data = r.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_wrong_password(self, client: AsyncClient, admin_user: User):
        r = await client.post("/api/auth/login", json={
            "email": "admin@test.com",
            "password": "wrongpassword",
        })
        assert r.status_code == 401

    async def test_login_nonexistent_email(self, client: AsyncClient):
        r = await client.post("/api/auth/login", json={
            "email": "nobody@test.com",
            "password": "anything",
        })
        assert r.status_code == 401

    async def test_login_invalid_email_format(self, client: AsyncClient):
        r = await client.post("/api/auth/login", json={
            "email": "not-an-email",
            "password": "anything",
        })
        assert r.status_code == 422  # validation error


class TestRefresh:
    async def test_refresh_success(self, client: AsyncClient, admin_user: User):
        # Login first
        login = await client.post("/api/auth/login", json={
            "email": "admin@test.com",
            "password": "admin123",
        })
        refresh_token = login.json()["refresh_token"]

        # Refresh
        r = await client.post("/api/auth/refresh", json={
            "refresh_token": refresh_token,
        })
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert "refresh_token" in data

    async def test_refresh_invalid_token(self, client: AsyncClient):
        r = await client.post("/api/auth/refresh", json={
            "refresh_token": "invalid.token.here",
        })
        assert r.status_code == 401

    async def test_access_token_rejected_as_refresh(self, client: AsyncClient, admin_user: User):
        login = await client.post("/api/auth/login", json={
            "email": "admin@test.com",
            "password": "admin123",
        })
        access_token = login.json()["access_token"]

        r = await client.post("/api/auth/refresh", json={
            "refresh_token": access_token,  # wrong token type
        })
        assert r.status_code == 401


class TestForgotPassword:
    async def test_forgot_existing_email(self, client: AsyncClient, admin_user: User):
        r = await client.post("/api/auth/forgot-password", json={
            "email": "admin@test.com",
        })
        assert r.status_code == 200
        data = r.json()
        assert "message" in data
        assert "dev_token" not in data

    async def test_forgot_nonexistent_email_no_enumeration(self, client: AsyncClient):
        """Should return 200 even for non-existent emails (prevent enumeration)."""
        r = await client.post("/api/auth/forgot-password", json={
            "email": "nobody@test.com",
        })
        assert r.status_code == 200
        data = r.json()
        assert "message" in data
        assert "dev_token" not in data  # no token for non-existent user

    async def test_forgot_existing_email_never_returns_reset_token_when_email_fails(
        self,
        client: AsyncClient,
        admin_user: User,
        monkeypatch,
    ):
        async def _fail_send(*args, **kwargs):
            raise RuntimeError("smtp down")

        monkeypatch.setattr(auth_api, "send_reset_email", _fail_send)

        r = await client.post("/api/auth/forgot-password", json={
            "email": "admin@test.com",
        })
        assert r.status_code == 200
        data = r.json()
        assert "message" in data
        assert "dev_token" not in data


class TestResetPassword:
    async def test_reset_password_success(self, client: AsyncClient, admin_user: User):
        token = create_reset_token(admin_user.id)
        r = await client.post("/api/auth/reset-password", json={
            "token": token,
            "new_password": "NewSecure1pass",
        })
        assert r.status_code == 200

        # Verify can login with new password
        login = await client.post("/api/auth/login", json={
            "email": "admin@test.com",
            "password": "NewSecure1pass",
        })
        assert login.status_code == 200

    async def test_reset_password_invalid_token(self, client: AsyncClient):
        r = await client.post("/api/auth/reset-password", json={
            "token": "invalid.token",
            "new_password": "Anything1test",
        })
        assert r.status_code == 400

    async def test_reset_password_old_password_stops_working(
        self, client: AsyncClient, student_user: User
    ):
        token = create_reset_token(student_user.id)
        await client.post("/api/auth/reset-password", json={
            "token": token,
            "new_password": "Changed123",
        })

        # Old password should fail
        r = await client.post("/api/auth/login", json={
            "email": "student@test.com",
            "password": "student123",
        })
        assert r.status_code == 401
