"""Student self-service attendance verification via QR + face + GPS."""

import logging

import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, Form, UploadFile
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.pipeline import get_pipeline
from app.api.deps import get_current_user
from app.config import settings
from app.core.exceptions import BadRequestError, ForbiddenError
from app.database import get_db
from app.models.attendance_session import AttendanceSession, SessionStatus
from app.models.enrollment import Enrollment
from app.models.user import Role, User
from app.schemas.attendance import VerifyAttendanceResponse
from app.services.attendance_service import AttendanceRecordService, AttendanceSessionService
from app.services.face_service import FaceService
from app.utils.geo import haversine_distance
from app.utils.liveness import is_live

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/verify", response_model=VerifyAttendanceResponse)
async def verify_attendance(
    token: str = Form(...),
    frames: list[UploadFile] = File(...),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Verify a student's attendance using QR token, face, GPS, and liveness."""
    if current_user.role != Role.STUDENT:
        raise ForbiddenError("Only students can verify attendance")

    # --- 1. Decode QR token to get session_id ---
    session_id = _decode_qr_token(token)

    # --- 2. Load session and ensure it's active ---
    session = await AttendanceSessionService.get_session(db, session_id)
    if session.status != SessionStatus.ACTIVE:
        raise BadRequestError("Session is not active")

    try:
        jwt.decode(token, session.qr_secret, algorithms=["HS256"])
    except JWTError:
        raise BadRequestError("Invalid or expired QR token")

    # --- 3. Verify student is enrolled in this course ---
    from app.models.schedule import Schedule
    sched_result = await db.execute(
        select(Schedule).where(Schedule.id == session.schedule_id)
    )
    schedule = sched_result.scalar_one()

    enrolled = await db.execute(
        select(Enrollment).where(
            Enrollment.student_id == current_user.id,
            Enrollment.course_id == schedule.course_id,
        )
    )
    if enrolled.scalar_one_or_none() is None:
        raise ForbiddenError("You are not enrolled in this course")

    # --- 4. Validate GPS (only when both sides provided coords) ---
    has_session_gps = session.latitude is not None and session.longitude is not None
    has_student_gps = latitude is not None and longitude is not None
    if has_session_gps and has_student_gps:
        distance = haversine_distance(
            session.latitude, session.longitude, latitude, longitude
        )
        if distance > settings.GPS_RADIUS_METERS:
            raise BadRequestError(
                f"You are too far from the classroom ({int(distance)}m away, max {settings.GPS_RADIUS_METERS}m)"
            )

    # --- 5. Decode all frames ---
    images = []
    for f in frames:
        data = await f.read()
        arr = np.frombuffer(data, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise BadRequestError("Cannot decode one of the uploaded images")
        images.append(img)

    pipe = get_pipeline()

    # --- 6. Liveness check (multi-frame landmark analysis) ---
    if len(images) >= 2:
        frame_landmarks = []
        for img in images:
            dets = pipe.detector.detect(img)
            if not dets:
                raise BadRequestError("No face detected in one of the frames. Please try again.")
            largest = max(dets, key=lambda d: (d.bbox[2] - d.bbox[0]) * (d.bbox[3] - d.bbox[1]))
            if largest.landmarks is None:
                raise BadRequestError("Could not detect facial landmarks. Please try again.")
            frame_landmarks.append(largest.landmarks)

        live, score = is_live(frame_landmarks, threshold=settings.LIVENESS_THRESHOLD)
        if not live:
            raise BadRequestError(
                "Liveness check failed — a live face is required. "
                "Photos and screens are not accepted."
            )

    # --- 7. Face recognition on the last frame ---
    image = images[-1]
    embedding, face_count = pipe.extract_embedding(image)
    if embedding is None:
        raise BadRequestError("No face detected in the image. Please try again.")

    matches = await FaceService.find_matches(
        db, embedding, threshold=None, limit=1,
        user_ids=[current_user.id],
    )
    if not matches:
        raise BadRequestError("Face verification failed. Your face was not recognized.")

    similarity = matches[0]["similarity"]

    # --- 8. Record attendance ---
    record, is_new = await AttendanceRecordService.record_recognition(
        db, session.id, current_user.id, similarity
    )

    if not is_new:
        return VerifyAttendanceResponse(
            success=True,
            status=record.status,
            message="Your attendance was already recorded for this session.",
        )

    return VerifyAttendanceResponse(
        success=True,
        status=record.status,
        message=f"Attendance recorded successfully. Status: {record.status.value}.",
    )


def _decode_qr_token(token: str) -> int:
    """Extract session_id from the QR JWT without full verification
    (signature is verified later against the session's own secret)."""
    try:
        payload = jwt.decode(
            token, "", algorithms=["HS256"],
            options={"verify_signature": False, "verify_exp": False},
        )
        session_id = payload.get("session_id")
        if session_id is None:
            raise BadRequestError("Invalid QR token: missing session_id")
        return int(session_id)
    except JWTError:
        raise BadRequestError("Invalid QR token")
