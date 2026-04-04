import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import BadRequestError
from app.core.rbac import require_role
from app.database import get_db
from app.models.attendance_session import SessionStatus
from app.models.user import Role, User
from app.schemas.attendance import (
    QRTokenOut,
    SessionCreate,
    SessionOut,
)
from app.services.access_service import AccessService
from app.services.attendance_service import AttendanceSessionService

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("", response_model=SessionOut, status_code=201)
async def start_session(
    body: SessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR)),
):
    await AccessService.ensure_schedule_access(db, current_user, body.schedule_id)
    return await AttendanceSessionService.start_session(
        db, body.schedule_id, body.date, current_user.id,
        latitude=body.latitude, longitude=body.longitude,
        qr_interval_seconds=body.qr_interval_seconds,
    )


@router.post("/{session_id}/stop", response_model=SessionOut)
async def stop_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR)),
):
    await AccessService.ensure_session_access(db, current_user, session_id)
    return await AttendanceSessionService.stop_session(db, session_id)


@router.get("", response_model=list[SessionOut])
async def list_sessions(
    course_id: int | None = None,
    schedule_id: int | None = None,
    status: SessionStatus | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR)),
):
    if course_id is not None:
        await AccessService.ensure_course_access(db, current_user, course_id)
    if schedule_id is not None:
        await AccessService.ensure_schedule_access(db, current_user, schedule_id)

    allowed_course_ids = None
    if current_user.role == Role.PROFESSOR:
        allowed_course_ids = await AccessService.get_professor_course_ids(db, current_user.id)

    return await AttendanceSessionService.list_sessions(
        db,
        course_id,
        schedule_id,
        status,
        allowed_course_ids=allowed_course_ids,
    )


@router.get("/{session_id}", response_model=SessionOut)
async def get_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR)),
):
    await AccessService.ensure_session_access(db, current_user, session_id)
    return await AttendanceSessionService.get_session(db, session_id)


@router.get("/{session_id}/qr-token", response_model=QRTokenOut)
async def get_qr_token(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR)),
):
    """Generate a short-lived QR token for the active session."""
    await AccessService.ensure_session_access(db, current_user, session_id)
    session = await AttendanceSessionService.get_session(db, session_id)
    if session.status != SessionStatus.ACTIVE:
        raise BadRequestError("Session is not active")

    interval = session.qr_interval_seconds or settings.QR_TOKEN_EXPIRE_SECONDS
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=interval)
    payload = {
        "session_id": session.id,
        "nonce": secrets.token_hex(8),
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    token = jwt.encode(payload, session.qr_secret, algorithm="HS256")
    return QRTokenOut(token=token, expires_at=expires_at, interval_seconds=interval)
