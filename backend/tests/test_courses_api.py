from httpx import AsyncClient

from app.models.user import User
from tests.conftest import auth_header


async def _login(client: AsyncClient, email: str, password: str) -> str:
    response = await client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


class TestCoursesApi:
    async def test_admin_can_create_course_with_valid_academic_year(
        self,
        client: AsyncClient,
        admin_user: User,
    ):
        token = await _login(client, admin_user.email, "admin123")
        response = await client.post(
            "/api/courses",
            headers=auth_header(token),
            json={
                "code": "CS101",
                "name": "Intro to CS",
                "description": "Basics",
                "semester": "Fall",
                "academic_year": "2025-2026",
            },
        )

        assert response.status_code == 201, response.text
        assert response.json()["academic_year"] == "2025-2026"

    async def test_admin_cannot_create_course_with_non_consecutive_academic_year(
        self,
        client: AsyncClient,
        admin_user: User,
    ):
        token = await _login(client, admin_user.email, "admin123")
        response = await client.post(
            "/api/courses",
            headers=auth_header(token),
            json={
                "code": "CS102",
                "name": "Broken Year",
                "description": "Invalid year",
                "semester": "Fall",
                "academic_year": "2025-2027",
            },
        )

        assert response.status_code == 422, response.text
        assert "two consecutive years" in response.text

    async def test_admin_cannot_update_course_with_text_academic_year(
        self,
        client: AsyncClient,
        admin_user: User,
    ):
        token = await _login(client, admin_user.email, "admin123")
        create_response = await client.post(
            "/api/courses",
            headers=auth_header(token),
            json={
                "code": "CS103",
                "name": "Algorithms",
                "description": "Core course",
                "semester": "Spring",
                "academic_year": "2025-2026",
            },
        )
        assert create_response.status_code == 201, create_response.text

        course_id = create_response.json()["id"]
        update_response = await client.put(
            f"/api/courses/{course_id}",
            headers=auth_header(token),
            json={"academic_year": "hello"},
        )

        assert update_response.status_code == 422, update_response.text
        assert "YYYY-YYYY format" in update_response.text
