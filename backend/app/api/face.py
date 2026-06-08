from __future__ import annotations

import logging

import cv2
import numpy as np
from fastapi import APIRouter, Depends, Form, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.pipeline import get_pipeline
from app.core.exceptions import BadRequestError
from app.core.rbac import require_role
from app.database import get_db
from app.models.user import Role, User
from app.schemas.face import (
    FaceCoverageOut,
    FaceEmbeddingOut,
    FaceEnrollResponse,
    FaceRegistryStudentsPage,
    FaceVerifyMatch,
    FaceVerifyResponse,
    PipelineStatusResponse,
)
from app.services.face_service import FaceService

logger = logging.getLogger(__name__)
router = APIRouter()

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


async def _read_image(photo: UploadFile) -> np.ndarray:
    if photo.content_type not in ALLOWED_TYPES:
        raise BadRequestError(f"Unsupported image type: {photo.content_type}")
    data = await photo.read()
    if len(data) > MAX_FILE_SIZE:
        raise BadRequestError("File too large (max 10 MB)")
    arr = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise BadRequestError("Cannot decode image")
    return image


@router.get("/status", response_model=PipelineStatusResponse)
async def pipeline_status(
    _: User = Depends(require_role(Role.ADMIN)),
):
    """Check whether AI models are loaded."""
    pipe = get_pipeline()
    return PipelineStatusResponse(
        insightface_loaded=pipe.recognizer.is_loaded,
        yolo_loaded=pipe.detector.is_loaded,
    )


@router.post("/enroll", response_model=FaceEnrollResponse, status_code=201)
async def enroll_face(
    photo: UploadFile,
    user_id: int = Form(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    """Upload a student photo, detect face, extract embedding, and store it."""
    image = await _read_image(photo)
    pipe = get_pipeline()

    # Strict gate so admins never seed bad reference photos
    _det, _report, embedding = FaceService.assess_and_embed(
        pipe,
        image,
        strict=True,
        strict_allowed_soft_codes=FaceService.ENROLLMENT_ALLOWED_SOFT_ISSUES,
    )

    photo_data = cv2.imencode(".jpg", image)[1].tobytes()
    photo_path = await FaceService.save_photo(photo_data, photo.filename or "face.jpg")

    record = await FaceService.enroll_face(db, user_id, embedding, photo_path)

    return FaceEnrollResponse(
        id=record.id,
        user_id=record.user_id,
        photo_path=record.photo_path,
        faces_detected=1,
        message="Face enrolled successfully",
    )


@router.get("/coverage", response_model=list[FaceCoverageOut])
async def face_coverage(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    return [FaceCoverageOut(**item) for item in await FaceService.get_coverage(db)]


@router.get("/registry-students", response_model=FaceRegistryStudentsPage)
async def face_registry_students(
    group_id: int | None = None,
    status: str = Query(default="all", pattern="^(all|missing|needs_more|complete)$"),
    search: str | None = None,
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    return await FaceService.list_registry_students(
        db,
        group_id=group_id,
        status=status,
        search=search,
        limit=limit,
        offset=offset,
    )


@router.get("/embeddings/{user_id}", response_model=list[FaceEmbeddingOut])
async def list_embeddings(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    return await FaceService.list_embeddings(db, user_id)


@router.delete("/embeddings/{embedding_id}", status_code=204)
async def delete_embedding(
    embedding_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    await FaceService.delete_embedding(db, embedding_id)


@router.delete("/embeddings/user/{user_id}", status_code=204)
async def delete_all_embeddings(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    await FaceService.delete_all_embeddings(db, user_id)


@router.post("/verify", response_model=FaceVerifyResponse)
async def verify_face(
    photo: UploadFile,
    threshold: float = Query(default=None, ge=0.0, le=1.0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    """Upload a test photo and find matching students from the database."""
    image = await _read_image(photo)
    pipe = get_pipeline()

    embedding, face_count = pipe.extract_embedding(image)
    if embedding is None:
        return FaceVerifyResponse(faces_detected=0, matches=[])

    raw_matches = await FaceService.find_matches(db, embedding, threshold=threshold)
    matches = [FaceVerifyMatch(**m) for m in raw_matches]

    return FaceVerifyResponse(faces_detected=face_count, matches=matches)
