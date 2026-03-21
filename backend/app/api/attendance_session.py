import logging
import secrets
from datetime import datetime, timedelta, timezone

import cv2
import numpy as np
from fastapi import APIRouter, Depends, Query, UploadFile
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.pipeline import get_pipeline
from app.config import settings
from app.core.exceptions import BadRequestError
from app.core.rbac import require_role
from app.database import get_db
from app.models.attendance import AttendanceStatus
from app.models.attendance_session import SessionStatus
from app.models.enrollment import Enrollment
from app.models.user import Role, User
from app.schemas.attendance import (
    FrameProcessingResponse,
    QRTokenOut,
    RecognitionResult,
    SessionCreate,
    SessionDetailOut,
    SessionOut,
)
from app.services.attendance_service import AttendanceSessionService, AttendanceRecordService
from app.services.face_service import FaceService
from sqlalchemy import select

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("", response_model=SessionOut, status_code=201)
async def start_session(
    body: SessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR)),
):
    return await AttendanceSessionService.start_session(
        db, body.schedule_id, body.date, current_user.id,
        latitude=body.latitude, longitude=body.longitude,
    )


@router.post("/{session_id}/stop", response_model=SessionOut)
async def stop_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR)),
):
    return await AttendanceSessionService.stop_session(db, session_id)


@router.get("", response_model=list[SessionOut])
async def list_sessions(
    course_id: int | None = None,
    schedule_id: int | None = None,
    status: SessionStatus | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR)),
):
    return await AttendanceSessionService.list_sessions(db, course_id, schedule_id, status)


@router.get("/{session_id}", response_model=SessionOut)
async def get_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR)),
):
    return await AttendanceSessionService.get_session(db, session_id)


@router.get("/{session_id}/qr-token", response_model=QRTokenOut)
async def get_qr_token(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR)),
):
    """Generate a short-lived QR token for the active session."""
    session = await AttendanceSessionService.get_session(db, session_id)
    if session.status != SessionStatus.ACTIVE:
        raise BadRequestError("Session is not active")

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=settings.QR_TOKEN_EXPIRE_SECONDS)
    payload = {
        "session_id": session.id,
        "nonce": secrets.token_hex(8),
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    token = jwt.encode(payload, session.qr_secret, algorithm="HS256")
    return QRTokenOut(token=token, expires_at=expires_at)


@router.post("/{session_id}/frame", response_model=FrameProcessingResponse)
async def process_frame(
    session_id: int,
    frame: UploadFile,
    db: AsyncSession = Depends(get_db),
):
    """Receive a camera frame, run face recognition, and record attendance."""
    session = await AttendanceSessionService.get_session(db, session_id)
    if session.status != SessionStatus.ACTIVE:
        raise BadRequestError("Session is not active")

    data = await frame.read()
    arr = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise BadRequestError("Cannot decode image")

    pipe = get_pipeline()
    face_results = pipe.extract_all_embeddings(image)

    # Get enrolled student IDs for this course
    from app.models.schedule import Schedule
    sched = await db.execute(select(Schedule).where(Schedule.id == session.schedule_id))
    schedule = sched.scalar_one()

    enrolled = await db.execute(
        select(Enrollment.student_id).where(Enrollment.course_id == schedule.course_id)
    )
    enrolled_ids = [row[0] for row in enrolled.fetchall()]

    recognized: list[RecognitionResult] = []
    unknown_count = 0

    for embedding, bbox, det_confidence in face_results:
        matches = await FaceService.find_matches(
            db, embedding, threshold=None, limit=1, user_ids=enrolled_ids
        )
        if matches:
            match = matches[0]
            record, is_new = await AttendanceRecordService.record_recognition(
                db, session_id, match["user_id"], match["similarity"]
            )
            recognized.append(
                RecognitionResult(
                    student_id=match["user_id"],
                    name=f"{match['first_name']} {match['last_name']}",
                    status=record.status,
                    confidence=match["similarity"],
                    is_new=is_new,
                )
            )
        else:
            unknown_count += 1

    return FrameProcessingResponse(recognized=recognized, unknown_faces=unknown_count)
