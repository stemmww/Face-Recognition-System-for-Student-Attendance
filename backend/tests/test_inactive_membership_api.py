from datetime import date, time

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.models.course import Course, CourseProf
from app.models.enrollment import Enrollment
from app.models.group import Group, group_students
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
    is_active: bool = True,
    first_name: str = "Test",
    last_name: str = "User",
) -> User:
    user = User(
        email=email,
        hashed_password=hash_password(password),
        first_name=first_name,
        last_name=last_name,
        role=role,
        is_active=is_active,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def _create_course(db: AsyncSession, *, code: str = "CS101") -> Course:
    course = Course(
        code=code,
        name=f"Course {code}",
        description="Test course",
        semester="TRIMESTER_1",
        academic_year="2025-2026",
    )
    db.add(course)
    await db.commit()
    await db.refresh(course)
    return course


async def _create_schedule(db: AsyncSession, course_id: int) -> Schedule:
    schedule = Schedule(
        course_id=course_id,
        day_of_week="MONDAY",
        start_time=time(9, 0),
        end_time=time(10, 0),
        room="A-101",
        lesson_type="LECTURE",
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return schedule


class TestInactiveMembershipRules:
    async def test_list_users_active_only_filters_inactive(
        self,
        client: AsyncClient,
        db: AsyncSession,
        admin_user: User,
    ):
        await _create_user(
            db,
            email="active-student@test.com",
            password="student123",
            role=Role.STUDENT,
            first_name="Active",
            last_name="Student",
        )
        inactive_student = await _create_user(
            db,
            email="inactive-student@test.com",
            password="student123",
            role=Role.STUDENT,
            is_active=False,
            first_name="Inactive",
            last_name="Student",
        )

        token = await _login(client, "admin@test.com", "admin123")
        response = await client.get(
            "/api/users",
            headers=auth_header(token),
            params={"role": "student", "active_only": "true"},
        )

        assert response.status_code == 200
        returned_ids = {user["id"] for user in response.json()}
        assert inactive_student.id not in returned_ids

    async def test_enroll_students_rejects_inactive_students_atomically(
        self,
        client: AsyncClient,
        db: AsyncSession,
        admin_user: User,
    ):
        active_student = await _create_user(
            db,
            email="active-enroll@test.com",
            password="student123",
            role=Role.STUDENT,
        )
        inactive_student = await _create_user(
            db,
            email="inactive-enroll@test.com",
            password="student123",
            role=Role.STUDENT,
            is_active=False,
        )
        course = await _create_course(db, code="ENR101")

        token = await _login(client, "admin@test.com", "admin123")
        response = await client.post(
            f"/api/courses/{course.id}/students",
            headers=auth_header(token),
            json={"student_ids": [active_student.id, inactive_student.id]},
        )

        assert response.status_code == 400
        assert "inactive students" in response.json()["detail"]

        enrollments = await db.execute(
            select(Enrollment).where(Enrollment.course_id == course.id)
        )
        assert enrollments.scalars().all() == []

    async def test_assign_professors_rejects_inactive_professors_atomically(
        self,
        client: AsyncClient,
        db: AsyncSession,
        admin_user: User,
    ):
        active_professor = await _create_user(
            db,
            email="active-prof@test.com",
            password="prof123",
            role=Role.PROFESSOR,
        )
        inactive_professor = await _create_user(
            db,
            email="inactive-prof@test.com",
            password="prof123",
            role=Role.PROFESSOR,
            is_active=False,
        )
        course = await _create_course(db, code="PROF101")

        token = await _login(client, "admin@test.com", "admin123")
        response = await client.post(
            f"/api/courses/{course.id}/professors",
            headers=auth_header(token),
            json={"professor_ids": [active_professor.id, inactive_professor.id]},
        )

        assert response.status_code == 400
        assert "inactive professors" in response.json()["detail"]

        assignments = await db.execute(
            select(CourseProf).where(CourseProf.course_id == course.id)
        )
        assert assignments.scalars().all() == []

    async def test_add_group_students_rejects_inactive_students_atomically(
        self,
        client: AsyncClient,
        db: AsyncSession,
        admin_user: User,
    ):
        active_student = await _create_user(
            db,
            email="active-group@test.com",
            password="student123",
            role=Role.STUDENT,
        )
        inactive_student = await _create_user(
            db,
            email="inactive-group@test.com",
            password="student123",
            role=Role.STUDENT,
            is_active=False,
        )
        group = Group(code="SE-2401", group_type="MAIN")
        db.add(group)
        await db.commit()
        await db.refresh(group)

        token = await _login(client, "admin@test.com", "admin123")
        response = await client.post(
            f"/api/groups/{group.id}/students",
            headers=auth_header(token),
            json={"student_ids": [active_student.id, inactive_student.id]},
        )

        assert response.status_code == 400
        assert "inactive students" in response.json()["detail"]

        members = await db.execute(
            select(group_students.c.student_id).where(group_students.c.group_id == group.id)
        )
        assert members.fetchall() == []

    async def test_inactive_students_are_hidden_from_rosters_stats_and_auto_absent(
        self,
        client: AsyncClient,
        db: AsyncSession,
        admin_user: User,
    ):
        active_student = await _create_user(
            db,
            email="roster-active@test.com",
            password="student123",
            role=Role.STUDENT,
            first_name="Active",
            last_name="Member",
        )
        inactive_student = await _create_user(
            db,
            email="roster-inactive@test.com",
            password="student123",
            role=Role.STUDENT,
            is_active=False,
            first_name="Inactive",
            last_name="Member",
        )
        course = await _create_course(db, code="STAT101")
        schedule = await _create_schedule(db, course.id)

        db.add_all(
            [
                Enrollment(course_id=course.id, student_id=active_student.id),
                Enrollment(course_id=course.id, student_id=inactive_student.id),
            ]
        )
        await db.commit()

        token = await _login(client, "admin@test.com", "admin123")
        start_response = await client.post(
            "/api/sessions",
            headers=auth_header(token),
            json={"schedule_id": schedule.id, "date": date.today().isoformat()},
        )
        assert start_response.status_code == 201, start_response.text
        session_id = start_response.json()["id"]

        course_students_response = await client.get(
            f"/api/courses/{course.id}/students",
            headers=auth_header(token),
        )
        assert course_students_response.status_code == 200
        assert [student["id"] for student in course_students_response.json()] == [active_student.id]

        roster_response = await client.get(
            f"/api/attendance/session/{session_id}/enrolled-students",
            headers=auth_header(token),
        )
        assert roster_response.status_code == 200
        assert [student["id"] for student in roster_response.json()] == [active_student.id]

        stats_response = await client.get(
            f"/api/statistics/course/{course.id}",
            headers=auth_header(token),
        )
        assert stats_response.status_code == 200
        stats = stats_response.json()
        assert stats["total_enrolled"] == 1
        assert [student["student_id"] for student in stats["students"]] == [active_student.id]

        stop_response = await client.post(
            f"/api/sessions/{session_id}/stop",
            headers=auth_header(token),
        )
        assert stop_response.status_code == 200, stop_response.text

        records_result = await db.execute(
            select(AttendanceRecord).where(AttendanceRecord.session_id == session_id)
        )
        records = records_result.scalars().all()
        assert len(records) == 1
        assert records[0].student_id == active_student.id
        assert records[0].status == AttendanceStatus.ABSENT

    async def test_csv_import_does_not_enroll_existing_inactive_student(
        self,
        client: AsyncClient,
        db: AsyncSession,
        admin_user: User,
    ):
        inactive_student = await _create_user(
            db,
            email="import-inactive@test.com",
            password="student123",
            role=Role.STUDENT,
            is_active=False,
        )
        course = await _create_course(db, code="CSV101")
        token = await _login(client, "admin@test.com", "admin123")

        csv_content = (
            "email,first_name,last_name,password,course_codes\n"
            f"{inactive_student.email},Inactive,Student,student123,{course.code}\n"
        )
        response = await client.post(
            "/api/users/import-csv",
            headers=auth_header(token),
            files={"file": ("students.csv", csv_content.encode("utf-8"), "text/csv")},
        )

        assert response.status_code == 200, response.text
        data = response.json()
        assert data["created"] == 0
        assert data["skipped"] == 1
        assert data["enrolled"] == 0
        assert any("is inactive and cannot be enrolled" in error for error in data["errors"])

        enrollment = await db.execute(
            select(Enrollment).where(
                Enrollment.course_id == course.id,
                Enrollment.student_id == inactive_student.id,
            )
        )
        assert enrollment.scalar_one_or_none() is None
