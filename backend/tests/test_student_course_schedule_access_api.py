from datetime import time

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.schedule import Schedule
from app.models.user import Role, User
from tests.conftest import auth_header


async def _login(client: AsyncClient, email: str, password: str) -> str:
    response = await client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


async def _create_user(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    role: Role,
    first_name: str,
    last_name: str,
) -> User:
    user = User(
        email=email,
        hashed_password=hash_password(password),
        first_name=first_name,
        last_name=last_name,
        role=role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def _create_course(db: AsyncSession, *, code: str) -> Course:
    course = Course(
        code=code,
        name=f"Course {code}",
        description="Student access control test course",
        semester="TRIMESTER_1",
        academic_year="2025-2026",
    )
    db.add(course)
    await db.commit()
    await db.refresh(course)
    return course


async def _create_schedule(db: AsyncSession, *, course_id: int, room: str) -> Schedule:
    schedule = Schedule(
        course_id=course_id,
        day_of_week="MONDAY",
        start_time=time(9, 0),
        end_time=time(10, 0),
        room=room,
        lesson_type="LECTURE",
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return schedule


class TestStudentCourseScheduleAccess:
    async def test_student_can_only_read_enrolled_course_metadata(
        self,
        client: AsyncClient,
        db: AsyncSession,
    ):
        student = await _create_user(
            db,
            email="student-meta@test.com",
            password="student123",
            role=Role.STUDENT,
            first_name="Student",
            last_name="Meta",
        )
        enrolled_course = await _create_course(db, code="STU101")
        other_course = await _create_course(db, code="STU201")
        db.add(Enrollment(course_id=enrolled_course.id, student_id=student.id))
        await db.commit()

        token = await _login(client, student.email, "student123")
        allowed_response = await client.get(
            f"/api/courses/{enrolled_course.id}",
            headers=auth_header(token),
        )
        blocked_response = await client.get(
            f"/api/courses/{other_course.id}",
            headers=auth_header(token),
        )

        assert allowed_response.status_code == 200, allowed_response.text
        assert allowed_response.json()["id"] == enrolled_course.id
        assert blocked_response.status_code == 403

    async def test_student_schedule_listing_and_lookup_are_scoped_to_enrollment(
        self,
        client: AsyncClient,
        db: AsyncSession,
    ):
        student = await _create_user(
            db,
            email="student-sched@test.com",
            password="student123",
            role=Role.STUDENT,
            first_name="Student",
            last_name="Schedule",
        )
        enrolled_course = await _create_course(db, code="SCH101")
        other_course = await _create_course(db, code="SCH201")
        enrolled_schedule = await _create_schedule(db, course_id=enrolled_course.id, room="A-101")
        other_schedule = await _create_schedule(db, course_id=other_course.id, room="B-101")
        db.add(Enrollment(course_id=enrolled_course.id, student_id=student.id))
        await db.commit()

        token = await _login(client, student.email, "student123")
        list_response = await client.get(
            "/api/schedules",
            headers=auth_header(token),
        )
        filtered_allowed_response = await client.get(
            "/api/schedules",
            headers=auth_header(token),
            params={"course_id": enrolled_course.id},
        )
        filtered_blocked_response = await client.get(
            "/api/schedules",
            headers=auth_header(token),
            params={"course_id": other_course.id},
        )
        allowed_schedule_response = await client.get(
            f"/api/schedules/{enrolled_schedule.id}",
            headers=auth_header(token),
        )
        blocked_schedule_response = await client.get(
            f"/api/schedules/{other_schedule.id}",
            headers=auth_header(token),
        )

        assert list_response.status_code == 200, list_response.text
        assert [schedule["id"] for schedule in list_response.json()] == [enrolled_schedule.id]

        assert filtered_allowed_response.status_code == 200, filtered_allowed_response.text
        assert [schedule["id"] for schedule in filtered_allowed_response.json()] == [enrolled_schedule.id]

        assert filtered_blocked_response.status_code == 403

        assert allowed_schedule_response.status_code == 200, allowed_schedule_response.text
        assert allowed_schedule_response.json()["id"] == enrolled_schedule.id
        assert blocked_schedule_response.status_code == 403
