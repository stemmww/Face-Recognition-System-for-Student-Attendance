import logging

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import BadRequestError
from app.core.security import create_reset_token, decode_token, hash_password
from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    ResetPasswordRequest,
    TokenResponse,
)
from app.services.auth_service import AuthService
from app.services.email_service import send_reset_email

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await AuthService.login(db, body.email, body.password)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    return await AuthService.refresh(db, body.refresh_token)


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.email == body.email, User.is_active == True)
    )
    user = result.scalar_one_or_none()

    # Always return success to prevent email enumeration
    if user is None:
        return {"message": "If this email is registered, a reset link has been sent."}

    token = create_reset_token(user.id)
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"

    try:
        await send_reset_email(user.email, reset_url)
    except Exception:
        logger.warning("Email sending failed for %s — returning token in response for dev", user.email)
        return {
            "message": "Email service unavailable. Use the token below (dev only).",
            "dev_token": token,
        }

    return {"message": "If this email is registered, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(body.token)
    if payload is None or payload.get("type") != "reset":
        raise BadRequestError("Invalid or expired reset token")

    user_id = int(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()

    if user is None:
        raise BadRequestError("Invalid or expired reset token")

    user.hashed_password = hash_password(body.new_password)
    await db.commit()
    return {"message": "Password has been reset successfully"}
