"""Student self-service attendance verification via QR + face + GPS."""

import logging
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone

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
from app.models.attendance import AttendanceRecord
from app.models.attendance_session import AttendanceSession, SessionStatus
from app.models.enrollment import Enrollment
from app.models.user import Role, User
from app.schemas.attendance import LivenessChallengeOut, VerifyAttendanceResponse
from app.services.attendance_service import AttendanceRecordService, AttendanceSessionService
from app.services.face_service import FaceService
from app.utils.geo import haversine_distance
from app.utils.liveness import (
    ChallengeType,
    generate_challenge,
    get_challenge_instruction,
    is_live,
    validate_challenge,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# --- In-memory nonce tracking (one-time-use QR tokens) ---
_used_nonces: dict[int, set[str]] = defaultdict(set)
_nonce_timestamps: dict[int, float] = {}
_NONCE_CACHE_TTL = 3600 * 4  # 4 hours

# --- Rate limiting per (student_id, session_id) ---
_rate_limit: dict[tuple[int, int], float] = {}
_RATE_LIMIT_SECONDS = 15


def _cleanup_expired_nonces() -> None:
    now = time.time()
    expired = [sid for sid, ts in _nonce_timestamps.items() if now - ts > _NONCE_CACHE_TTL]
    for sid in expired:
        _used_nonces.pop(sid, None)
        _nonce_timestamps.pop(sid, None)


@router.post("/challenge", response_model=LivenessChallengeOut)
async def get_liveness_challenge(
    token: str = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a random liveness challenge tied to the session + student."""
    if current_user.role != Role.STUDENT:
        raise ForbiddenError("Only students can request challenges")

    session_id = _decode_qr_token(token)
    session = await AttendanceSessionService.get_session(db, session_id)
    if session.status != SessionStatus.ACTIVE:
        raise BadRequestError("Session is not active")

    challenge = generate_challenge()
    instruction = get_challenge_instruction(challenge)

    challenge_token = jwt.encode(
        {
            "challenge": challenge.value,
            "student_id": current_user.id,
            "session_id": session_id,
            "exp": int((datetime.now(timezone.utc) + timedelta(seconds=120)).timestamp()),
        },
        settings.JWT_SECRET_KEY,
        algorithm="HS256",
    )

    return LivenessChallengeOut(
        challenge_type=challenge.value,
        instruction=instruction,
        token=challenge_token,
    )


@router.post("/verify", response_model=VerifyAttendanceResponse)
async def verify_attendance(
    token: str = Form(...),
    frames: list[UploadFile] = File(...),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    challenge_token: str | None = Form(None),
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
        payload = jwt.decode(token, session.qr_secret, algorithms=["HS256"])
    except JWTError:
        raise BadRequestError("Invalid or expired QR token")

    # --- 2.5. One-time nonce check (consume only after successful verification) ---
    _cleanup_expired_nonces()
    nonce = payload.get("nonce")
    if nonce and nonce in _used_nonces[session.id]:
        raise BadRequestError(
            "This QR code has already been used. Please scan the current QR code."
        )

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

    # --- 3.5. Early duplicate check (skip expensive ops if already recorded) ---
    existing_result = await db.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.session_id == session.id,
            AttendanceRecord.student_id == current_user.id,
        )
    )
    existing_record = existing_result.scalar_one_or_none()
    if existing_record is not None:
        return VerifyAttendanceResponse(
            success=True,
            status=existing_record.status,
            message="Your attendance was already recorded for this session.",
        )

    # --- 3.6. Rate limiting (checked here, set after successful verification) ---
    rate_key = (current_user.id, session.id)
    now_ts = time.time()
    last_attempt = _rate_limit.get(rate_key, 0)
    if now_ts - last_attempt < _RATE_LIMIT_SECONDS:
        remaining = int(_RATE_LIMIT_SECONDS - (now_ts - last_attempt))
        raise BadRequestError(f"Please wait {remaining} seconds before trying again.")

    # --- 4. Validate GPS ---
    has_session_gps = session.latitude is not None and session.longitude is not None
    has_student_gps = latitude is not None and longitude is not None

    if has_session_gps and not has_student_gps:
        raise BadRequestError(
            "GPS location is required for this session. "
            "Please enable location services and try again."
        )

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

        # --- 6.5. Active challenge validation ---
        if challenge_token:
            try:
                ch_payload = jwt.decode(
                    challenge_token, settings.JWT_SECRET_KEY, algorithms=["HS256"]
                )
                if ch_payload.get("student_id") != current_user.id:
                    raise BadRequestError("Challenge token does not match current user")
                if ch_payload.get("session_id") != session_id:
                    raise BadRequestError("Challenge token does not match session")

                challenge_type = ChallengeType(ch_payload["challenge"])
                passed, reason = validate_challenge(challenge_type, frame_landmarks)
                if not passed:
                    raise BadRequestError(f"Liveness challenge failed: {reason}")
            except JWTError:
                raise BadRequestError("Invalid or expired challenge token")

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

    # --- 9. Consume nonce + set rate limit only after success ---
    if nonce:
        _used_nonces[session.id].add(nonce)
        _nonce_timestamps[session.id] = time.time()
    _rate_limit[rate_key] = time.time()

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
