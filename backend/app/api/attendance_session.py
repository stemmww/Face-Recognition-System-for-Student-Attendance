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
from app.services.attendance_service import AttendanceSessionService

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
        qr_interval_seconds=body.qr_interval_seconds,
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
