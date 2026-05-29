"""Student face self-enrollment API.

Allows privileged students (can_self_enroll_face=True) to upload a photo,
extract an embedding via the existing pipeline, and save it to face_embeddings.
Admins can grant/revoke permission and reset face data.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import cv2
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.pipeline import get_pipeline
from app.api.deps import get_current_user
from app.core.exceptions import BadRequestError
from app.core.rbac import require_role
from app.database import get_db
from app.models.user import Role, User
from app.services.face_service import FaceService

logger = logging.getLogger(__name__)
router = APIRouter()

ALLOWED_TYPES = {"image/jpeg", "image/png"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

MAX_SELF_ENROLL_PHOTOS = 5


class FaceEnrollmentStatusResponse(BaseModel):
    can_self_enroll_face: bool
    has_face_embedding: bool
    embedding_count: int
    face_enrollment_status: str | None
    face_enrolled_at: str | None
    max_photos: int = MAX_SELF_ENROLL_PHOTOS


class FaceEnrollmentUploadResponse(BaseModel):
    success: bool
    status: str
    message: str
    reason: str | None = None
    has_face_embedding: bool = False
    embedding_count: int = 0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _read_image_bytes(photo: UploadFile) -> bytes:
    if photo.content_type not in ALLOWED_TYPES:
        raise BadRequestError(f"UNSUPPORTED_FORMAT: only JPEG and PNG are accepted, got {photo.content_type}")
    data = await photo.read()
    if len(data) > MAX_FILE_SIZE:
        raise BadRequestError("FILE_TOO_LARGE: maximum allowed file size is 5 MB")
    return data


def _decode_image(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise BadRequestError("DECODE_ERROR: cannot decode image — please upload a valid JPEG or PNG file")
    return image


# ---------------------------------------------------------------------------
# Student endpoints
# ---------------------------------------------------------------------------

@router.get("/me", response_model=FaceEnrollmentStatusResponse)
async def get_enrollment_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current user's face enrollment status."""
    embeddings = await FaceService.list_embeddings(db, current_user.id)
    count = len(embeddings)
    return FaceEnrollmentStatusResponse(
        can_self_enroll_face=current_user.can_self_enroll_face,
        has_face_embedding=count > 0,
        embedding_count=count,
        face_enrollment_status=current_user.face_enrollment_status,
        face_enrolled_at=current_user.face_enrolled_at.isoformat() if current_user.face_enrolled_at else None,
    )


@router.post("/me", response_model=FaceEnrollmentUploadResponse, status_code=200)
async def self_enroll_face(
    photo: UploadFile,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Student uploads a face photo; backend validates, extracts embedding, and saves it."""
    if current_user.role != Role.STUDENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students can use face self-enrollment")

    if not current_user.can_self_enroll_face:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Face self-enrollment is not enabled for your account. Contact an administrator.",
        )

    # --- Validate and decode image ---
    try:
        data = await _read_image_bytes(photo)
    except BadRequestError as exc:
        reason = str(exc.detail) if hasattr(exc, "detail") else str(exc)
        _update_status(current_user, "FAILED")
        await db.commit()
        return FaceEnrollmentUploadResponse(
            success=False,
            status="FAILED",
            message="Image validation failed",
            reason=reason,
        )

    try:
        image = _decode_image(data)
    except BadRequestError as exc:
        reason = str(exc.detail) if hasattr(exc, "detail") else str(exc)
        return FaceEnrollmentUploadResponse(
            success=False,
            status="FAILED",
            message="Image decoding failed",
            reason=reason,
        )

    # --- Face detection and embedding ---
    pipe = get_pipeline()

    detections = pipe.detector.detect(image)
    if not detections:
        _update_status(current_user, "REJECTED")
        await db.commit()
        return FaceEnrollmentUploadResponse(
            success=False,
            status="REJECTED",
            reason="NO_FACE_DETECTED",
            message="No face was detected in the image. Please upload a clear photo showing your face.",
        )

    if len(detections) > 1:
        _update_status(current_user, "REJECTED")
        await db.commit()
        return FaceEnrollmentUploadResponse(
            success=False,
            status="REJECTED",
            reason="MULTIPLE_FACES_DETECTED",
            message="Multiple faces were detected. Please upload a photo with only your face.",
        )

    det = detections[0]
    if det.landmarks is None:
        _update_status(current_user, "REJECTED")
        await db.commit()
        return FaceEnrollmentUploadResponse(
            success=False,
            status="REJECTED",
            reason="LANDMARKS_FAILED",
            message="Could not detect facial landmarks. Try a clearer, more frontal photo.",
        )

    # Quality check (strict gate — same as admin enrollment)
    try:
        _det, _report, embedding = FaceService.assess_and_embed(pipe, image, strict=True)
    except BadRequestError as exc:
        detail = str(exc.detail) if hasattr(exc, "detail") else str(exc)
        reason = _map_quality_reason(detail)
        _update_status(current_user, "REJECTED")
        await db.commit()
        return FaceEnrollmentUploadResponse(
            success=False,
            status="REJECTED",
            reason=reason,
            message=detail,
        )
    except Exception as exc:
        logger.exception("Face pipeline error during self-enrollment for user %d", current_user.id)
        _update_status(current_user, "FAILED")
        await db.commit()
        return FaceEnrollmentUploadResponse(
            success=False,
            status="FAILED",
            reason="PIPELINE_ERROR",
            message="Face recognition pipeline encountered an error. Please try again.",
        )

    if embedding is None or len(embedding) != 512:
        _update_status(current_user, "FAILED")
        await db.commit()
        return FaceEnrollmentUploadResponse(
            success=False,
            status="FAILED",
            reason="EMBEDDING_FAILED",
            message="Failed to extract face embedding. Please try a different photo.",
        )

    # --- Check cap before saving ---
    existing = await FaceService.list_embeddings(db, current_user.id)
    if len(existing) >= MAX_SELF_ENROLL_PHOTOS:
        return FaceEnrollmentUploadResponse(
            success=False,
            status="REJECTED",
            reason="MAX_PHOTOS_REACHED",
            message=f"Maximum number of face photos ({MAX_SELF_ENROLL_PHOTOS}) already registered. Delete some before adding more.",
            has_face_embedding=True,
            embedding_count=len(existing),
        )

    # --- Save new embedding (accumulate, do not replace) ---
    try:
        photo_path = await FaceService.save_photo(cv2.imencode(".jpg", image)[1].tobytes(), photo.filename or "enrollment.jpg")
        await FaceService.enroll_face(db, current_user.id, embedding, photo_path)
    except Exception:
        logger.exception("Failed to save face embedding for user %d", current_user.id)
        _update_status(current_user, "FAILED")
        await db.commit()
        return FaceEnrollmentUploadResponse(
            success=False,
            status="FAILED",
            reason="SAVE_FAILED",
            message="Failed to save face data. Please try again.",
        )

    # --- Update enrollment metadata ---
    now = datetime.now(timezone.utc)
    current_user.face_enrollment_status = "APPROVED"
    current_user.face_enrolled_at = now
    await db.commit()

    new_count = len(existing) + 1
    logger.info("Student %d self-enrolled face photo %d/%d", current_user.id, new_count, MAX_SELF_ENROLL_PHOTOS)
    return FaceEnrollmentUploadResponse(
        success=True,
        status="APPROVED",
        message="Face photo added successfully.",
        has_face_embedding=True,
        embedding_count=new_count,
    )


@router.delete("/me", status_code=204)
async def self_delete_face(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Student deletes all their own face embeddings and resets enrollment status."""
    if current_user.role != Role.STUDENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students can use this endpoint")
    if not current_user.can_self_enroll_face:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Face self-enrollment is not enabled for your account")

    await FaceService.delete_all_embeddings(db, current_user.id)
    current_user.face_enrollment_status = "NOT_STARTED"
    current_user.face_enrolled_at = None
    current_user.face_enrollment_consent_at = None
    await db.commit()
    logger.info("Student %d deleted their own face data", current_user.id)


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------

@router.delete("/users/{user_id}", status_code=204)
async def admin_reset_face_data(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    """Admin: delete all face embeddings and reset enrollment status for a student."""
    from sqlalchemy import select
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")

    await FaceService.delete_all_embeddings(db, user_id)

    target.face_enrollment_status = "NOT_STARTED"
    target.face_enrolled_at = None
    target.face_enrollment_consent_at = None
    await db.commit()
    logger.info("Admin reset face data for user %d", user_id)


@router.patch("/users/{user_id}/permission", status_code=200)
async def admin_set_enrollment_permission(
    user_id: int,
    body: dict,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    """Admin: enable or disable face self-enrollment permission for a student."""
    from sqlalchemy import select
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")

    allowed = body.get("can_self_enroll_face")
    if not isinstance(allowed, bool):
        raise HTTPException(status_code=422, detail="Field 'can_self_enroll_face' must be a boolean")

    target.can_self_enroll_face = allowed
    await db.commit()
    await db.refresh(target)
    logger.info("Admin set can_self_enroll_face=%s for user %d", allowed, user_id)
    return {"user_id": user_id, "can_self_enroll_face": target.can_self_enroll_face}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _update_status(user: User, status_val: str) -> None:
    user.face_enrollment_status = status_val


def _map_quality_reason(detail: str) -> str:
    detail_lower = detail.lower()
    if "no face" in detail_lower:
        return "NO_FACE_DETECTED"
    if "blur" in detail_lower or "sharp" in detail_lower:
        return "FACE_TOO_BLURRY"
    if "small" in detail_lower or "size" in detail_lower:
        return "FACE_TOO_SMALL"
    if "bright" in detail_lower or "dark" in detail_lower:
        return "POOR_LIGHTING"
    if "landmark" in detail_lower:
        return "LANDMARKS_FAILED"
    return "QUALITY_TOO_LOW"
