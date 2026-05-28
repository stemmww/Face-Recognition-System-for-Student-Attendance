from datetime import date, datetime, time, timezone

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.appeal import Appeal, AppealStatus
from app.models.attendance import AttendanceRecord, AttendanceStatus, MarkedBy
from app.models.attendance_session import AttendanceSession, SessionStatus
from app.models.course import Course, CourseProf
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
        description="Professor access test course",
        semester="Fall",
        academic_year="2025-2026",
    )
    db.add(course)
    await db.commit()
    await db.refresh(course)
    return course


async def _create_schedule(db: AsyncSession, course_id: int, room: str) -> Schedule:
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


async def _create_session(
    db: AsyncSession,
    *,
    schedule_id: int,
    started_by: int,
    session_date: date,
    status: SessionStatus = SessionStatus.ACTIVE,
) -> AttendanceSession:
    session = AttendanceSession(
        schedule_id=schedule_id,
        date=session_date,
        started_by=started_by,
        status=status,
        started_at=datetime.now(timezone.utc),
        qr_secret="test-secret",
        qr_interval_seconds=45,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def _create_attendance_record(
    db: AsyncSession,
    *,
    student_id: int,
    session_id: int,
    status: AttendanceStatus,
) -> AttendanceRecord:
    record = AttendanceRecord(
        student_id=student_id,
        session_id=session_id,
        status=status,
        marked_by=MarkedBy.SYSTEM,
        recognized_at=datetime.now(timezone.utc),
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


async def _create_appeal(db: AsyncSession, *, student_id: int, attendance_id: int) -> Appeal:
    appeal = Appeal(
        student_id=student_id,
        attendance_id=attendance_id,
        reason="I was present",
        status=AppealStatus.PENDING,
    )
    db.add(appeal)
    await db.commit()
    await db.refresh(appeal)
    return appeal


class TestProfessorAuthorization:
    async def test_professor_list_sessions_only_includes_owned_courses(
        self,
        client: AsyncClient,
        db: AsyncSession,
    ):
        professor_one = await _create_user(
            db,
            email="prof-one@test.com",
            password="prof123",
            role=Role.PROFESSOR,
            first_name="Prof",
            last_name="One",
        )
        professor_two = await _create_user(
            db,
            email="prof-two@test.com",
            password="prof123",
            role=Role.PROFESSOR,
            first_name="Prof",
            last_name="Two",
        )
        course_one = await _create_course(db, code="OWN101")
        course_two = await _create_course(db, code="OTH101")
        db.add_all(
            [
                CourseProf(course_id=course_one.id, professor_id=professor_one.id),
                CourseProf(course_id=course_two.id, professor_id=professor_two.id),
            ]
        )
        await db.commit()
        schedule_one = await _create_schedule(db, course_one.id, "A-101")
        schedule_two = await _create_schedule(db, course_two.id, "B-101")
        session_one = await _create_session(
            db,
            schedule_id=schedule_one.id,
            started_by=professor_one.id,
            session_date=date.today(),
        )
        await _create_session(
            db,
            schedule_id=schedule_two.id,
            started_by=professor_two.id,
            session_date=date.today(),
        )

        token = await _login(client, professor_one.email, "prof123")
        response = await client.get(
            "/api/sessions",
            headers=auth_header(token),
            params={"status": "active"},
        )

        assert response.status_code == 200, response.text
        assert [session["id"] for session in response.json()] == [session_one.id]

    async def test_professor_cannot_stop_other_professor_session(
        self,
        client: AsyncClient,
        db: AsyncSession,
    ):
        professor_one = await _create_user(
            db,
            email="prof-stop-one@test.com",
            password="prof123",
            role=Role.PROFESSOR,
            first_name="Prof",
            last_name="StopOne",
        )
        professor_two = await _create_user(
            db,
            email="prof-stop-two@test.com",
            password="prof123",
            role=Role.PROFESSOR,
            first_name="Prof",
            last_name="StopTwo",
        )
        course_two = await _create_course(db, code="STOP201")
        db.add(CourseProf(course_id=course_two.id, professor_id=professor_two.id))
        await db.commit()
        schedule_two = await _create_schedule(db, course_two.id, "B-201")
        session_two = await _create_session(
            db,
            schedule_id=schedule_two.id,
            started_by=professor_two.id,
            session_date=date.today(),
        )

        token = await _login(client, professor_one.email, "prof123")
        response = await client.post(
            f"/api/sessions/{session_two.id}/stop",
            headers=auth_header(token),
        )

        assert response.status_code == 403

    async def test_professor_cannot_access_other_course_attendance_or_statistics(
        self,
        client: AsyncClient,
        db: AsyncSession,
    ):
        professor_one = await _create_user(
            db,
            email="prof-att-one@test.com",
            password="prof123",
            role=Role.PROFESSOR,
            first_name="Prof",
            last_name="AttendOne",
        )
        professor_two = await _create_user(
            db,
            email="prof-att-two@test.com",
            password="prof123",
            role=Role.PROFESSOR,
            first_name="Prof",
            last_name="AttendTwo",
        )
        student = await _create_user(
            db,
            email="student-att@test.com",
            password="student123",
            role=Role.STUDENT,
            first_name="Student",
            last_name="Attend",
        )
        course_two = await _create_course(db, code="STAT201")
        db.add_all(
            [
                CourseProf(course_id=course_two.id, professor_id=professor_two.id),
                Enrollment(course_id=course_two.id, student_id=student.id),
            ]
        )
        await db.commit()
        schedule_two = await _create_schedule(db, course_two.id, "C-201")
        session_two = await _create_session(
            db,
            schedule_id=schedule_two.id,
            started_by=professor_two.id,
            session_date=date.today(),
        )
        await _create_attendance_record(
            db,
            student_id=student.id,
            session_id=session_two.id,
            status=AttendanceStatus.PRESENT,
        )

        token = await _login(client, professor_one.email, "prof123")
        attendance_response = await client.get(
            f"/api/attendance/course/{course_two.id}",
            headers=auth_header(token),
        )
        stats_response = await client.get(
            f"/api/statistics/course/{course_two.id}",
            headers=auth_header(token),
        )

        assert attendance_response.status_code == 403
        assert stats_response.status_code == 403

    async def test_professor_cannot_view_or_review_other_course_appeals(
        self,
        client: AsyncClient,
        db: AsyncSession,
    ):
        professor_one = await _create_user(
            db,
            email="prof-app-one@test.com",
            password="prof123",
            role=Role.PROFESSOR,
            first_name="Prof",
            last_name="AppealOne",
        )
        professor_two = await _create_user(
            db,
            email="prof-app-two@test.com",
            password="prof123",
            role=Role.PROFESSOR,
            first_name="Prof",
            last_name="AppealTwo",
        )
        student = await _create_user(
            db,
            email="student-app@test.com",
            password="student123",
            role=Role.STUDENT,
            first_name="Student",
            last_name="Appeal",
        )
        course_two = await _create_course(db, code="APL201")
        db.add_all(
            [
                CourseProf(course_id=course_two.id, professor_id=professor_two.id),
                Enrollment(course_id=course_two.id, student_id=student.id),
            ]
        )
        await db.commit()
        schedule_two = await _create_schedule(db, course_two.id, "D-201")
        session_two = await _create_session(
            db,
            schedule_id=schedule_two.id,
            started_by=professor_two.id,
            session_date=date.today(),
        )
        record = await _create_attendance_record(
            db,
            student_id=student.id,
            session_id=session_two.id,
            status=AttendanceStatus.ABSENT,
        )
        appeal = await _create_appeal(db, student_id=student.id, attendance_id=record.id)

        token = await _login(client, professor_one.email, "prof123")
        list_response = await client.get(
            "/api/appeals",
            headers=auth_header(token),
        )
        review_response = await client.patch(
            f"/api/appeals/{appeal.id}",
            headers=auth_header(token),
            json={"status": "approved"},
        )

        assert list_response.status_code == 200, list_response.text
        assert list_response.json() == []
        assert review_response.status_code == 403

    async def test_professor_schedules_and_rosters_are_scoped_to_owned_courses(
        self,
        client: AsyncClient,
        db: AsyncSession,
    ):
        professor_one = await _create_user(
            db,
            email="prof-scope-one@test.com",
            password="prof123",
            role=Role.PROFESSOR,
            first_name="Prof",
            last_name="ScopeOne",
        )
        professor_two = await _create_user(
            db,
            email="prof-scope-two@test.com",
            password="prof123",
            role=Role.PROFESSOR,
            first_name="Prof",
            last_name="ScopeTwo",
        )
        student = await _create_user(
            db,
            email="student-scope@test.com",
            password="student123",
            role=Role.STUDENT,
            first_name="Student",
            last_name="Scope",
        )
        course_one = await _create_course(db, code="SCH101")
        course_two = await _create_course(db, code="SCH201")
        db.add_all(
            [
                CourseProf(course_id=course_one.id, professor_id=professor_one.id),
                CourseProf(course_id=course_two.id, professor_id=professor_two.id),
                Enrollment(course_id=course_two.id, student_id=student.id),
            ]
        )
        await db.commit()
        schedule_one = await _create_schedule(db, course_one.id, "E-101")
        await _create_schedule(db, course_two.id, "E-201")

        token = await _login(client, professor_one.email, "prof123")
        list_response = await client.get(
            "/api/schedules",
            headers=auth_header(token),
        )
        roster_response = await client.get(
            f"/api/courses/{course_two.id}/students",
            headers=auth_header(token),
        )

        assert list_response.status_code == 200, list_response.text
        assert [schedule["id"] for schedule in list_response.json()] == [schedule_one.id]
        assert roster_response.status_code == 403
