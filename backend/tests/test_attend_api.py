from datetime import date, time

import numpy as np
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.quality import QualityReport
from app.api import attend as attend_api
from app.core.security import hash_password
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.schedule import Schedule
from app.models.user import Role, User
from app.services.face_service import FrameAssessment
from tests.conftest import auth_header


def _make_passing_quality_report() -> QualityReport:
    return QualityReport(passed=True, issues=[], metrics={"sharpness": 200.0})


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


class _FakeDetection:
    # Realistic bbox / landmarks so quality-gate metrics are well-defined.
    bbox = (50, 50, 250, 290)
    landmarks = np.array(
        [[100.0, 130.0], [200.0, 130.0], [150.0, 180.0], [115.0, 240.0], [185.0, 240.0]],
        dtype=float,
    )
    confidence = 0.95


class _FakeDetector:
    def detect(self, image):
        return [_FakeDetection()]


class _FakeRecognizer:
    def get_embedding(self, aligned):
        return np.array([1.0, 0.0, 0.0], dtype=float)


class _FakePipeline:
    detector = _FakeDetector()
    recognizer = _FakeRecognizer()

    def extract_embedding(self, image):
        return np.array([1.0, 0.0, 0.0], dtype=float), 1


class TestAttendApi:
    async def test_challenge_endpoint_returns_multi_step_sequence(
        self,
        client: AsyncClient,
        db: AsyncSession,
        admin_user: User,
        monkeypatch,
    ):
        attend_api._used_nonces.clear()
        attend_api._nonce_timestamps.clear()

        course = await _create_course(db, code="QR050")
        schedule = await _create_schedule(db, course.id)
        student = await _create_user(
            db,
            email="student-sequence@test.com",
            password="student123",
            role=Role.STUDENT,
            first_name="Sequence",
            last_name="Student",
        )
        db.add(Enrollment(course_id=course.id, student_id=student.id))
        await db.commit()

        monkeypatch.setattr(
            attend_api,
            "generate_challenge_sequence",
            lambda step_count: [
                attend_api.ChallengeType.TURN_LEFT,
                attend_api.ChallengeType.NOD,
            ],
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
        payload = challenge_response.json()
        assert payload["challenge_type"] == "turn_left"
        assert payload["challenge_types"] == ["turn_left", "nod"]

    async def test_shared_qr_token_can_be_used_by_multiple_students(
        self,
        client: AsyncClient,
        db: AsyncSession,
        admin_user: User,
        monkeypatch,
    ):
        attend_api._used_nonces.clear()
        attend_api._nonce_timestamps.clear()

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
        monkeypatch.setattr(attend_api, "validate_challenge_sequence", lambda *args, **kwargs: (True, "ok"))
        monkeypatch.setattr(attend_api, "detect_screen_spoof", lambda *args, **kwargs: (True, 0.0))
        monkeypatch.setattr(attend_api, "detect_video_replay", lambda *args, **kwargs: (True, 0.0))
        # Stub anti-spoof at the service layer — returning None mirrors the
        # "model not available" branch and causes the check to be skipped,
        # which is what we want for routing-level tests.
        monkeypatch.setattr(
            attend_api.FaceService, "check_spoof", staticmethod(lambda *a, **kw: None),
        )
        # Replace the AI-heavy service call with a stub returning a single
        # passing frame, so the test exercises routing/auth/db, not the pipeline.
        def _fake_process_frames(pipeline, images):
            det = _FakeDetection()
            emb = np.array([1.0, 0.0, 0.0], dtype=float)
            assessment = FrameAssessment(
                image=images[0],
                detection=det,
                quality=_make_passing_quality_report(),
                embedding=emb,
            )
            return [assessment], 0, None

        async def _skip_auto_enroll_call(*args, **kwargs):
            return False

        monkeypatch.setattr(
            attend_api.FaceService, "process_verification_frames", staticmethod(_fake_process_frames),
        )
        monkeypatch.setattr(
            attend_api.FaceService, "auto_enroll_if_strict", staticmethod(_skip_auto_enroll_call),
        )
        monkeypatch.setattr(
            attend_api.cv2,
            "imdecode",
            lambda *args, **kwargs: np.zeros((8, 8, 3), dtype=np.uint8),
        )

        async def _fake_vote_frames(_db, assessments, _user_id, **_kwargs):
            from app.services.face_service import VoteResult
            n = len(assessments)
            return VoteResult(
                passed=True, votes=n, total=n, threshold=0.22,
                similarities=[0.99] * n, max_similarity=0.99,
            )

        monkeypatch.setattr(
            attend_api.FaceService, "vote_frames", staticmethod(_fake_vote_frames),
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

