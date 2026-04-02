from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import cv2
import numpy as np
from fastapi import APIRouter, Depends, Form, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.pipeline import get_pipeline
from app.core.exceptions import BadRequestError
from app.core.rbac import require_role

if TYPE_CHECKING:
    from app.ai.detector import Detection
from app.database import get_db
from app.models.user import Role, User
from app.schemas.face import (
    FaceEmbeddingOut,
    FaceEnrollResponse,
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


def _check_face_quality(
    image: np.ndarray,
    det: "Detection",
) -> list[str]:
    """Run quality checks on a detected face. Returns list of warning/rejection messages."""

    issues: list[str] = []
    img_h, img_w = image.shape[:2]

    # 1. Face size — bounding box should cover at least 5% of image area
    x1, y1, x2, y2 = det.bbox
    face_area = (x2 - x1) * (y2 - y1)
    img_area = img_h * img_w
    face_ratio = face_area / img_area if img_area > 0 else 0
    if face_ratio < 0.03:
        issues.append("Face is too small — move closer to the camera")
    elif face_ratio < 0.05:
        issues.append("Face is a bit small — try moving closer for better results")

    # 2. Blur detection — Laplacian variance on face crop
    pad = int(max(x2 - x1, y2 - y1) * 0.05)
    cx1, cy1 = max(0, x1 - pad), max(0, y1 - pad)
    cx2, cy2 = min(img_w, x2 + pad), min(img_h, y2 + pad)
    face_crop = image[cy1:cy2, cx1:cx2]
    gray_crop = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
    lap_var = cv2.Laplacian(gray_crop, cv2.CV_64F).var()
    if lap_var < 30:
        issues.append("Photo is too blurry — hold the camera steady")
    elif lap_var < 60:
        issues.append("Photo is slightly blurry — a sharper image would improve recognition")

    # 3. Brightness — mean pixel value of face region
    mean_brightness = float(gray_crop.mean())
    if mean_brightness < 40:
        issues.append("Photo is too dark — use better lighting")
    elif mean_brightness > 220:
        issues.append("Photo is overexposed — reduce lighting or avoid direct light")

    # 4. Frontality — nose should be roughly centered between eyes
    if det.landmarks is not None:
        lm = det.landmarks
        eye_mid_x = (lm[0][0] + lm[1][0]) / 2.0
        iod = float(np.linalg.norm(lm[0] - lm[1]))
        if iod > 5:
            nose_offset = abs(lm[2][0] - eye_mid_x) / iod
            if nose_offset > 0.35:
                issues.append("Face is turned too far to the side — look directly at the camera")
            elif nose_offset > 0.2:
                issues.append("Face is slightly angled — looking straight ahead works best")

    return issues


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

    # Detect face
    detections = pipe.detector.detect(image)
    if not detections:
        raise BadRequestError("No face detected in the uploaded image")

    largest = max(detections, key=lambda d: (d.bbox[2] - d.bbox[0]) * (d.bbox[3] - d.bbox[1]))

    # Quality gate
    quality_issues = _check_face_quality(image, largest)
    hard_issues = [i for i in quality_issues if not i.startswith("Face is slightly") and not i.startswith("Photo is slightly") and not i.startswith("Face is a bit")]
    if hard_issues:
        raise BadRequestError("Photo quality too low: " + hard_issues[0])

    # Extract embedding from the largest face
    from app.ai.recognizer import align_face
    if largest.landmarks is None:
        raise BadRequestError("Could not detect facial landmarks — try a clearer photo")
    aligned = align_face(image, largest.landmarks)
    embedding = pipe.recognizer.get_embedding(aligned)
    if embedding is None:
        raise BadRequestError("Failed to extract face embedding — try a different photo")

    photo_data = cv2.imencode(".jpg", image)[1].tobytes()
    photo_path = await FaceService.save_photo(photo_data, photo.filename or "face.jpg")

    record = await FaceService.enroll_face(db, user_id, embedding, photo_path)

    # Include soft warnings in the success message
    soft_warnings = [i for i in quality_issues if i not in hard_issues]
    base_msg = f"Face enrolled successfully ({len(detections)} face(s) detected, largest used)"
    if soft_warnings:
        base_msg += ". Tip: " + soft_warnings[0]

    return FaceEnrollResponse(
        id=record.id,
        user_id=record.user_id,
        photo_path=record.photo_path,
        faces_detected=len(detections),
        message=base_msg,
        quality_warnings=soft_warnings,
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
