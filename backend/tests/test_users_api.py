"""API integration tests for user endpoints: CRUD, RBAC, password change."""

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import Role, User
from tests.conftest import auth_header


async def _login(client: AsyncClient, email: str, password: str) -> str:
    """Login and return the access token."""
    r = await client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed for {email}: {r.text}"
    return r.json()["access_token"]


# ---------------------------------------------------------------------------
# GET /users/me
# ---------------------------------------------------------------------------


class TestGetMe:
    async def test_get_me_as_admin(self, client: AsyncClient, admin_user: User):
        token = await _login(client, "admin@test.com", "admin123")
        r = await client.get("/api/users/me", headers=auth_header(token))
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == "admin@test.com"
        assert data["role"] == "admin"

    async def test_get_me_as_student(self, client: AsyncClient, student_user: User):
        token = await _login(client, "student@test.com", "student123")
        r = await client.get("/api/users/me", headers=auth_header(token))
        assert r.status_code == 200
        assert r.json()["role"] == "student"

    async def test_get_me_no_auth(self, client: AsyncClient):
        r = await client.get("/api/users/me")
        assert r.status_code in (401, 403)


# ---------------------------------------------------------------------------
# POST /users (create user — admin only)
# ---------------------------------------------------------------------------


class TestCreateUser:
    async def test_admin_creates_student(self, client: AsyncClient, admin_user: User):
        token = await _login(client, "admin@test.com", "admin123")
        r = await client.post("/api/users", headers=auth_header(token), json={
            "email": "newstudent@test.com",
            "password": "Pass123test",
            "first_name": "New",
            "last_name": "Student",
            "role": "student",
        })
        assert r.status_code == 201
        data = r.json()
        assert data["email"] == "newstudent@test.com"
        assert data["role"] == "student"
        assert data["is_active"] is True

    async def test_student_cannot_create_user(self, client: AsyncClient, student_user: User):
        token = await _login(client, "student@test.com", "student123")
        r = await client.post("/api/users", headers=auth_header(token), json={
            "email": "hacker@test.com",
            "password": "Pass123test",
            "first_name": "Hack",
            "last_name": "Er",
            "role": "admin",
        })
        assert r.status_code == 403

    async def test_professor_cannot_create_user(self, client: AsyncClient, professor_user: User):
        token = await _login(client, "prof@test.com", "prof123")
        r = await client.post("/api/users", headers=auth_header(token), json={
            "email": "another@test.com",
            "password": "Pass123test",
            "first_name": "Some",
            "last_name": "One",
            "role": "student",
        })
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# GET /users (list — admin only)
# ---------------------------------------------------------------------------


class TestListUsers:
    async def test_admin_lists_users(self, client: AsyncClient, admin_user: User):
        token = await _login(client, "admin@test.com", "admin123")
        r = await client.get("/api/users", headers=auth_header(token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_student_cannot_list_users(self, client: AsyncClient, student_user: User):
        token = await _login(client, "student@test.com", "student123")
        r = await client.get("/api/users", headers=auth_header(token))
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# POST /users/import-csv
# ---------------------------------------------------------------------------


class TestImportUsersCsv:
    async def test_import_uses_role_column_for_new_users(
        self, client: AsyncClient, db: AsyncSession, admin_user: User
    ):
        token = await _login(client, "admin@test.com", "admin123")
        csv_content = (
            "email,first_name,last_name,password,role,course_codes\n"
            "csv-prof@test.com,Csv,Professor,admin123,professor,\n"
            "csv-student@test.com,Csv,Student,admin123,student,\n"
        )

        r = await client.post(
            "/api/users/import-csv",
            headers=auth_header(token),
            files={"file": ("users.csv", csv_content.encode("utf-8"), "text/csv")},
        )

        assert r.status_code == 200, r.text
        data = r.json()
        assert data["created"] == 2
        assert data["updated_roles"] == 0

        users = await db.execute(
            select(User).where(User.email.in_(["csv-prof@test.com", "csv-student@test.com"]))
        )
        roles = {user.email: user.role for user in users.scalars().all()}
        assert roles["csv-prof@test.com"] == Role.PROFESSOR
        assert roles["csv-student@test.com"] == Role.STUDENT

    async def test_import_updates_existing_user_role(
        self, client: AsyncClient, db: AsyncSession, admin_user: User, student_user: User
    ):
        token = await _login(client, "admin@test.com", "admin123")
        csv_content = (
            "email,first_name,last_name,password,role,course_codes\n"
            f"{student_user.email},Test,Student,student123,professor,\n"
        )

        r = await client.post(
            "/api/users/import-csv",
            headers=auth_header(token),
            files={"file": ("users.csv", csv_content.encode("utf-8"), "text/csv")},
        )

        assert r.status_code == 200, r.text
        data = r.json()
        assert data["created"] == 0
        assert data["skipped"] == 1
        assert data["updated_roles"] == 1

        user = await db.scalar(select(User).where(User.email == student_user.email))
        assert user is not None
        assert user.role == Role.PROFESSOR


# ---------------------------------------------------------------------------
# PUT /users/me/password
# ---------------------------------------------------------------------------


class TestChangePassword:
    async def test_change_password_success(self, client: AsyncClient, student_user: User):
        token = await _login(client, "student@test.com", "student123")
        r = await client.put("/api/users/me/password", headers=auth_header(token), json={
            "old_password": "student123",
            "new_password": "NewPass1test",
        })
        assert r.status_code == 200

        # Login with new password works
        r2 = await client.post("/api/auth/login", json={
            "email": "student@test.com",
            "password": "NewPass1test",
        })
        assert r2.status_code == 200

    async def test_change_password_wrong_old(self, client: AsyncClient, professor_user: User):
        token = await _login(client, "prof@test.com", "prof123")
        r = await client.put("/api/users/me/password", headers=auth_header(token), json={
            "old_password": "wrong_old_password",
            "new_password": "Anything1test",
        })
        assert r.status_code == 400

    async def test_change_password_no_auth(self, client: AsyncClient):
        r = await client.put("/api/users/me/password", json={
            "old_password": "a",
            "new_password": "b",
        })
        assert r.status_code in (401, 403)


# ---------------------------------------------------------------------------
# PUT /users/{id} (update — admin only)
# ---------------------------------------------------------------------------


class TestUpdateUser:
    async def test_admin_updates_user(
        self, client: AsyncClient, admin_user: User, student_user: User
    ):
        token = await _login(client, "admin@test.com", "admin123")
        r = await client.put(
            f"/api/users/{student_user.id}",
            headers=auth_header(token),
            json={"first_name": "Updated"},
        )
        assert r.status_code == 200
        assert r.json()["first_name"] == "Updated"

    async def test_student_cannot_update_other(
        self, client: AsyncClient, admin_user: User, student_user: User
    ):
        token = await _login(client, "student@test.com", "student123")
        r = await client.put(
            f"/api/users/{admin_user.id}",
            headers=auth_header(token),
            json={"first_name": "Hacked"},
        )
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# DELETE /users/{id} (deactivate — admin only)
# ---------------------------------------------------------------------------


class TestDeactivateUser:
    async def test_admin_deactivates_user(
        self, client: AsyncClient, admin_user: User, student_user: User
    ):
        token = await _login(client, "admin@test.com", "admin123")
        r = await client.delete(
            f"/api/users/{student_user.id}",
            headers=auth_header(token),
        )
        assert r.status_code == 204

        # Deactivated user can't login
        r2 = await client.post("/api/auth/login", json={
            "email": "student@test.com",
            "password": "student123",
        })
        assert r2.status_code == 401

    async def test_student_cannot_deactivate(
        self, client: AsyncClient, admin_user: User, student_user: User
    ):
        token = await _login(client, "student@test.com", "student123")
        r = await client.delete(
            f"/api/users/{admin_user.id}",
            headers=auth_header(token),
        )
        assert r.status_code == 403
