from datetime import date, time

import numpy as np
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import attend as attend_api
from app.core.security import hash_password
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.schedule import ClassType, DayOfWeek, Schedule
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
        description="Test course",
        semester="Fall",
        academic_year="2025-2026",
    )
    db.add(course)
    await db.commit()
    await db.refresh(course)
    return course


async def _create_schedule(db: AsyncSession, course_id: int) -> Schedule:
    schedule = Schedule(
        course_id=course_id,
        day_of_week=DayOfWeek.MONDAY,
        start_time=time(9, 0),
        end_time=time(10, 0),
        room="A-101",
        class_type=ClassType.LECTURE,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return schedule


class _FakeDetection:
    bbox = (0, 0, 8, 8)
    landmarks = np.array(
        [[1.0, 1.0], [7.0, 1.0], [4.0, 4.0], [2.0, 7.0], [6.0, 7.0]],
        dtype=float,
    )


class _FakeDetector:
    def detect(self, image):
        return [_FakeDetection()]


class _FakePipeline:
    detector = _FakeDetector()

    def extract_embedding(self, image):
        return np.array([1.0, 0.0, 0.0], dtype=float), 1


class TestAttendApi:
    async def test_shared_qr_token_can_be_used_by_multiple_students(
        self,
        client: AsyncClient,
        db: AsyncSession,
        admin_user: User,
        monkeypatch,
    ):
        attend_api._used_nonces.clear()
        attend_api._nonce_timestamps.clear()
        attend_api._rate_limit.clear()

        course = await _create_course(db, code="QR101")
        schedule = await _create_schedule(db, course.id)
        student_one = await _create_user(
            db,
            email="student-one@test.com",
            password="student123",
            role=Role.STUDENT,
            first_name="Student",
            last_name="One",
        )
        student_two = await _create_user(
            db,
            email="student-two@test.com",
            password="student123",
            role=Role.STUDENT,
            first_name="Student",
            last_name="Two",
        )

        db.add_all(
            [
                Enrollment(course_id=course.id, student_id=student_one.id),
                Enrollment(course_id=course.id, student_id=student_two.id),
            ]
        )
        await db.commit()

        monkeypatch.setattr(attend_api, "get_pipeline", lambda: _FakePipeline())
        monkeypatch.setattr(attend_api, "is_live", lambda *args, **kwargs: (True, 1.0))
        monkeypatch.setattr(attend_api, "validate_challenge", lambda *args, **kwargs: (True, "ok"))
        monkeypatch.setattr(attend_api, "detect_screen_spoof", lambda *args, **kwargs: (True, 0.0))
        monkeypatch.setattr(attend_api, "detect_video_replay", lambda *args, **kwargs: (True, 0.0))
        monkeypatch.setattr(
            attend_api.cv2,
            "imdecode",
            lambda *args, **kwargs: np.zeros((8, 8, 3), dtype=np.uint8),
        )

        async def _fake_find_matches(*args, **kwargs):
            user_ids = kwargs.get("user_ids") or []
            return [{
                "user_id": user_ids[0] if user_ids else student_one.id,
                "first_name": "Student",
                "last_name": "Test",
                "email": "student@test.com",
                "similarity": 0.99,
            }]

        async def _skip_auto_enroll(*args, **kwargs):
            return [object()] * 20

        monkeypatch.setattr(attend_api.FaceService, "find_matches", _fake_find_matches)
        monkeypatch.setattr(attend_api.FaceService, "list_embeddings", _skip_auto_enroll)

        admin_token = await _login(client, admin_user.email, "admin123")
        session_response = await client.post(
            "/api/sessions",
            headers=auth_header(admin_token),
            json={"schedule_id": schedule.id, "date": date.today().isoformat()},
        )
        assert session_response.status_code == 201, session_response.text
        session_id = session_response.json()["id"]

        qr_response = await client.get(
            f"/api/sessions/{session_id}/qr-token",
            headers=auth_header(admin_token),
        )
        assert qr_response.status_code == 200, qr_response.text
        qr_token = qr_response.json()["token"]

        async def _challenge_and_verify(student: User) -> None:
            student_token = await _login(client, student.email, "student123")
            challenge_response = await client.post(
                "/api/attend/challenge",
                headers=auth_header(student_token),
                files={"token": (None, qr_token)},
            )
            assert challenge_response.status_code == 200, challenge_response.text
            challenge_token = challenge_response.json()["token"]

            verify_response = await client.post(
                "/api/attend/verify",
                headers=auth_header(student_token),
                data={
                    "token": qr_token,
                    "challenge_token": challenge_token,
                },
                files=[
                    ("frames", ("frame-1.jpg", b"frame-1", "image/jpeg")),
                    ("frames", ("frame-2.jpg", b"frame-2", "image/jpeg")),
                ],
            )
            assert verify_response.status_code == 200, verify_response.text
            assert verify_response.json()["success"] is True

        await _challenge_and_verify(student_one)
        await _challenge_and_verify(student_two)

    async def test_failed_attempt_is_rate_limited_on_immediate_retry(
        self,
        client: AsyncClient,
        db: AsyncSession,
        admin_user: User,
        monkeypatch,
    ):
        attend_api._used_nonces.clear()
        attend_api._nonce_timestamps.clear()
        attend_api._rate_limit.clear()

        course = await _create_course(db, code="QR201")
        schedule = await _create_schedule(db, course.id)
        student = await _create_user(
            db,
            email="student-rate@test.com",
            password="student123",
            role=Role.STUDENT,
            first_name="Student",
            last_name="Rate",
        )
        db.add(Enrollment(course_id=course.id, student_id=student.id))
        await db.commit()

        monkeypatch.setattr(attend_api, "get_pipeline", lambda: _FakePipeline())
        monkeypatch.setattr(attend_api, "is_live", lambda *args, **kwargs: (False, 0.0))
        monkeypatch.setattr(attend_api, "validate_challenge", lambda *args, **kwargs: (True, "ok"))
        monkeypatch.setattr(attend_api, "detect_screen_spoof", lambda *args, **kwargs: (True, 0.0))
        monkeypatch.setattr(attend_api, "detect_video_replay", lambda *args, **kwargs: (True, 0.0))
        monkeypatch.setattr(
            attend_api.cv2,
            "imdecode",
            lambda *args, **kwargs: np.zeros((8, 8, 3), dtype=np.uint8),
        )

        admin_token = await _login(client, admin_user.email, "admin123")
        session_response = await client.post(
            "/api/sessions",
            headers=auth_header(admin_token),
            json={"schedule_id": schedule.id, "date": date.today().isoformat()},
        )
        assert session_response.status_code == 201, session_response.text
        session_id = session_response.json()["id"]

        qr_response = await client.get(
            f"/api/sessions/{session_id}/qr-token",
            headers=auth_header(admin_token),
        )
        assert qr_response.status_code == 200, qr_response.text
        qr_token = qr_response.json()["token"]

        student_token = await _login(client, student.email, "student123")
        challenge_response = await client.post(
            "/api/attend/challenge",
            headers=auth_header(student_token),
            files={"token": (None, qr_token)},
        )
        assert challenge_response.status_code == 200, challenge_response.text
        challenge_token = challenge_response.json()["token"]

        first_attempt = await client.post(
            "/api/attend/verify",
            headers=auth_header(student_token),
            data={
                "token": qr_token,
                "challenge_token": challenge_token,
            },
            files=[
                ("frames", ("frame-1.jpg", b"frame-1", "image/jpeg")),
                ("frames", ("frame-2.jpg", b"frame-2", "image/jpeg")),
            ],
        )
        assert first_attempt.status_code == 400, first_attempt.text
        assert "Liveness check failed" in first_attempt.json()["detail"]

        second_attempt = await client.post(
            "/api/attend/verify",
            headers=auth_header(student_token),
            data={
                "token": qr_token,
                "challenge_token": challenge_token,
            },
            files=[
                ("frames", ("frame-1.jpg", b"frame-1", "image/jpeg")),
                ("frames", ("frame-2.jpg", b"frame-2", "image/jpeg")),
            ],
        )
        assert second_attempt.status_code == 400, second_attempt.text
        assert "Please wait" in second_attempt.json()["detail"]
