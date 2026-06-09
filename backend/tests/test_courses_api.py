from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.course import CourseProf
from app.models.group import Group, group_students
from app.models.group_subject import GroupSubject
from app.models.user import Role, User
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
                "semester": "TRIMESTER_1",
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
                "semester": "TRIMESTER_1",
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
                "semester": "TRIMESTER_3",
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

    async def test_professor_sees_students_from_assigned_course_groups(
        self,
        client: AsyncClient,
        db: AsyncSession,
        admin_user: User,
    ):
        admin_token = await _login(client, admin_user.email, "admin123")
        create_response = await client.post(
            "/api/courses",
            headers=auth_header(admin_token),
            json={
                "name": "Calculus 1",
                "description": "Group-based enrollment",
                "semester": "TRIMESTER_1",
                "academic_year": "2025-2026",
            },
        )
        assert create_response.status_code == 201, create_response.text
        course_id = create_response.json()["id"]

        professor = User(
            email="prof-groups@test.com",
            hashed_password=hash_password("prof123"),
            first_name="Prof",
            last_name="Groups",
            role=Role.PROFESSOR,
        )
        student_one = User(
            email="student-one-groups@test.com",
            hashed_password=hash_password("student123"),
            first_name="Student",
            last_name="One",
            role=Role.STUDENT,
        )
        student_two = User(
            email="student-two-groups@test.com",
            hashed_password=hash_password("student123"),
            first_name="Student",
            last_name="Two",
            role=Role.STUDENT,
        )
        group = Group(code="SE-2322", group_type="MAIN")
        db.add_all([professor, student_one, student_two, group])
        await db.commit()
        await db.refresh(professor)
        await db.refresh(student_one)
        await db.refresh(student_two)
        await db.refresh(group)

        db.add(CourseProf(course_id=course_id, professor_id=professor.id))
        db.add(GroupSubject(course_id=course_id, group_id=group.id, semester="TRIMESTER_1"))
        await db.execute(
            group_students.insert().values(
                [
                    {"group_id": group.id, "student_id": student_one.id},
                    {"group_id": group.id, "student_id": student_two.id},
                ]
            )
        )
        await db.commit()

        professor_token = await _login(client, professor.email, "prof123")
        students_response = await client.get(
            f"/api/courses/{course_id}/students",
            headers=auth_header(professor_token),
        )

        assert students_response.status_code == 200, students_response.text
        assert {student["email"] for student in students_response.json()} == {
            student_one.email,
            student_two.email,
        }
