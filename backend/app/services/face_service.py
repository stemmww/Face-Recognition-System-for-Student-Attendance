"""Face enrollment, embedding management, and matching logic."""

import logging
import math
import uuid
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from sqlalchemy import case, delete, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.anti_spoof import AntiSpoofResult, get_anti_spoof
from app.ai.detector import Detection
from app.ai.pipeline import FacePipeline
from app.ai.quality import QualityReport, assess_face_quality
from app.ai.recognizer import align_face
from app.config import settings
from app.core.exceptions import BadRequestError, NotFoundError
from app.models.face_embedding import FaceEmbedding
from app.models.group import group_students
from app.models.user import Role, User

logger = logging.getLogger(__name__)


@dataclass
class FrameAssessment:
    """One frame's contribution to a verification batch.

    Bundles everything the verification flow needs about a single frame so
    callers don't have to re-run detection or quality checks downstream.
    """

    image: np.ndarray
    detection: Detection
    quality: QualityReport
    embedding: np.ndarray


@dataclass
class VoteResult:
    """Outcome of multi-frame majority voting against a user's stored embeddings.

    Each frame independently compares against the user's centroid; a frame
    "votes yes" when its best similarity beats the recognition threshold.
    A configurable minimum number of yes-votes is required to accept.
    """

    passed: bool
    votes: int               # number of frames whose similarity > threshold
    total: int               # number of frames considered (== len(assessments))
    threshold: float         # similarity threshold used
    similarities: list[float]  # per-frame best similarity (parallel to assessments)
    max_similarity: float    # the best similarity observed across all frames


class FaceService:
    ENROLLMENT_ALLOWED_SOFT_ISSUES = frozenset({
        "face_smallish",
        "slightly_blurry",
        "soft_yaw",
        "low_contrast",
    })

    @staticmethod
    def _ensure_upload_dir() -> Path:
        upload_dir = Path(settings.UPLOAD_DIR) / "faces"
        upload_dir.mkdir(parents=True, exist_ok=True)
        return upload_dir

    @staticmethod
    async def save_photo(photo_bytes: bytes, filename: str) -> str:
        upload_dir = FaceService._ensure_upload_dir()
        ext = Path(filename).suffix or ".jpg"
        unique_name = f"{uuid.uuid4().hex}{ext}"
        path = upload_dir / unique_name
        path.write_bytes(photo_bytes)
        return f"faces/{unique_name}"

    @staticmethod
    async def enroll_face(
        db: AsyncSession,
        user_id: int,
        embedding: np.ndarray,
        photo_path: str,
    ) -> FaceEmbedding:
        user = await db.execute(select(User).where(User.id == user_id))
        if user.scalar_one_or_none() is None:
            raise NotFoundError("User")

        record = FaceEmbedding(
            user_id=user_id,
            embedding=embedding.tolist(),
            photo_path=photo_path,
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)
        return record

    @staticmethod
    async def list_embeddings(db: AsyncSession, user_id: int) -> list[FaceEmbedding]:
        result = await db.execute(
            select(FaceEmbedding)
            .where(FaceEmbedding.user_id == user_id)
            .order_by(FaceEmbedding.created_at.desc())
        )
        return result.scalars().all()

    @staticmethod
    async def get_coverage(db: AsyncSession) -> list[dict]:
        result = await db.execute(
            select(
                FaceEmbedding.user_id,
                func.count(FaceEmbedding.id),
                func.max(FaceEmbedding.created_at),
            ).group_by(FaceEmbedding.user_id)
        )
        return [
            {
                "user_id": user_id,
                "embedding_count": embedding_count,
                "latest_embedding_at": latest_embedding_at,
            }
            for user_id, embedding_count, latest_embedding_at in result.all()
        ]

    @staticmethod
    async def list_registry_students(
        db: AsyncSession,
        *,
        group_id: int | None = None,
        status: str = "all",
        search: str | None = None,
        limit: int = 200,
        offset: int = 0,
        min_recommended_photos: int = 3,
    ) -> dict:
        coverage_sq = (
            select(
                FaceEmbedding.user_id.label("user_id"),
                func.count(FaceEmbedding.id).label("embedding_count"),
                func.max(FaceEmbedding.created_at).label("latest_embedding_at"),
            )
            .group_by(FaceEmbedding.user_id)
            .subquery()
        )
        count_expr = func.coalesce(coverage_sq.c.embedding_count, 0)

        base_count_query = (
            select(count_expr.label("embedding_count"))
            .select_from(User)
            .outerjoin(coverage_sq, coverage_sq.c.user_id == User.id)
            .where(User.role == Role.STUDENT)
        )
        if group_id is not None:
            base_count_query = base_count_query.join(
                group_students,
                group_students.c.student_id == User.id,
            ).where(group_students.c.group_id == group_id)

        base_counts_sq = base_count_query.subquery()
        counts_result = await db.execute(
            select(
                func.count().label("all"),
                func.coalesce(func.sum(case((base_counts_sq.c.embedding_count == 0, 1), else_=0)), 0).label("missing"),
                func.coalesce(
                    func.sum(
                        case(
                            (
                                (base_counts_sq.c.embedding_count > 0)
                                & (base_counts_sq.c.embedding_count < min_recommended_photos),
                                1,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ).label("needs_more"),
                func.coalesce(
                    func.sum(case((base_counts_sq.c.embedding_count >= min_recommended_photos, 1), else_=0)),
                    0,
                ).label("complete"),
            ).select_from(base_counts_sq)
        )
        counts = counts_result.one()._mapping

        query = (
            select(
                User,
                count_expr.label("embedding_count"),
                coverage_sq.c.latest_embedding_at,
            )
            .outerjoin(coverage_sq, coverage_sq.c.user_id == User.id)
            .where(User.role == Role.STUDENT)
        )
        if group_id is not None:
            query = query.join(
                group_students,
                group_students.c.student_id == User.id,
            ).where(group_students.c.group_id == group_id)

        trimmed_search = (search or "").strip()
        if trimmed_search:
            pattern = f"%{trimmed_search}%"
            query = query.where(
                or_(
                    User.first_name.ilike(pattern),
                    User.last_name.ilike(pattern),
                    User.email.ilike(pattern),
                )
            )

        if status == "missing":
            query = query.where(count_expr == 0)
        elif status == "needs_more":
            query = query.where((count_expr > 0) & (count_expr < min_recommended_photos))
        elif status == "complete":
            query = query.where(count_expr >= min_recommended_photos)

        filtered_total_result = await db.execute(
            select(func.count()).select_from(query.order_by(None).subquery())
        )
        filtered_total = filtered_total_result.scalar_one()

        status_order = case(
            (count_expr == 0, 0),
            (count_expr < min_recommended_photos, 1),
            else_=2,
        )
        rows = await db.execute(
            query.order_by(status_order, count_expr, User.last_name, User.first_name)
            .offset(offset)
            .limit(limit)
        )

        return {
            "items": [
                {
                    "id": user.id,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "photo_url": user.photo_url,
                    "is_active": user.is_active,
                    "created_at": user.created_at,
                    "embedding_count": int(embedding_count or 0),
                    "latest_embedding_at": latest_embedding_at,
                }
                for user, embedding_count, latest_embedding_at in rows.all()
            ],
            "counts": {
                "all": int(counts["all"] or 0),
                "missing": int(counts["missing"] or 0),
                "needs_more": int(counts["needs_more"] or 0),
                "complete": int(counts["complete"] or 0),
            },
            "filtered_total": int(filtered_total or 0),
            "limit": limit,
            "offset": offset,
        }

    @staticmethod
    async def delete_embedding(db: AsyncSession, embedding_id: int) -> None:
        result = await db.execute(
            select(FaceEmbedding).where(FaceEmbedding.id == embedding_id)
        )
        record = result.scalar_one_or_none()
        if record is None:
            raise NotFoundError("Face embedding")

        photo_full = Path(settings.UPLOAD_DIR) / record.photo_path
        if photo_full.exists():
            photo_full.unlink()

        await db.delete(record)
        await db.commit()

    @staticmethod
    async def delete_all_embeddings(db: AsyncSession, user_id: int) -> int:
        embeddings = await FaceService.list_embeddings(db, user_id)
        for emb in embeddings:
            photo_full = Path(settings.UPLOAD_DIR) / emb.photo_path
            if photo_full.exists():
                photo_full.unlink()

        result = await db.execute(
            delete(FaceEmbedding).where(FaceEmbedding.user_id == user_id)
        )
        await db.commit()
        return result.rowcount

    @staticmethod
    def assess_and_embed(
        pipeline: FacePipeline,
        image: np.ndarray,
        *,
        strict: bool,
        strict_allowed_soft_codes: frozenset[str] | set[str] | None = None,
    ) -> tuple[Detection, QualityReport, np.ndarray]:
        """Detect, quality-check, align, and embed the largest face in one image.

        Raises BadRequestError with a user-facing message on any failure. Used
        by admin enrollment where a single high-quality photo is required.
        """
        detections = pipeline.detector.detect(image)
        if not detections:
            raise BadRequestError("No face detected in the uploaded image")

        det = max(
            detections,
            key=lambda d: (d.bbox[2] - d.bbox[0]) * (d.bbox[3] - d.bbox[1]),
        )
        if det.landmarks is None:
            raise BadRequestError("Could not detect facial landmarks — try a clearer photo")

        report = assess_face_quality(
            image,
            det,
            strict=strict,
            strict_allowed_soft_codes=strict_allowed_soft_codes,
        )
        if not report.passed:
            logger.warning(
                "Enrollment quality rejected: metrics=%s hard=%s soft=%s",
                report.metrics,
                [(i.code, i.value, i.threshold) for i in report.hard_issues],
                [(i.code, i.value, i.threshold) for i in report.soft_issues],
            )
            raise BadRequestError("Photo quality too low: " + report.hard_messages[0])

        if hasattr(pipeline.detector, "unload"):
            pipeline.detector.unload()

        aligned = align_face(image, det.landmarks)
        embedding = pipeline.recognizer.get_embedding(aligned)
        if embedding is None:
            raise BadRequestError("Failed to extract face embedding — try a different photo")

        return det, report, embedding

    @staticmethod
    def process_verification_frames(
        pipeline: FacePipeline,
        images: list[np.ndarray],
    ) -> tuple[list[FrameAssessment], int | None, str | None]:
        """Run detect + quality + embed on every frame; keep only those that pass.

        Returns (assessments, best_idx, last_reject_reason). `best_idx` points
        into `assessments` at the sharpest accepted frame (or None if empty).
        """
        assessments: list[FrameAssessment] = []
        best_idx: int | None = None
        best_sharpness = -1.0
        last_reject: str | None = None

        for img in images:
            dets = pipeline.detector.detect(img)
            if not dets:
                continue
            det = max(dets, key=lambda d: (d.bbox[2] - d.bbox[0]) * (d.bbox[3] - d.bbox[1]))
            if det.landmarks is None:
                continue

            report = assess_face_quality(img, det, strict=False)
            if not report.passed:
                last_reject = report.hard_messages[0]
                continue

            aligned = align_face(img, det.landmarks)
            emb = pipeline.recognizer.get_embedding(aligned)
            if emb is None:
                continue

            assessments.append(FrameAssessment(image=img, detection=det, quality=report, embedding=emb))
            sharpness = report.metrics.get("sharpness", 0.0)
            if sharpness > best_sharpness:
                best_sharpness = sharpness
                best_idx = len(assessments) - 1

        return assessments, best_idx, last_reject

    @staticmethod
    def check_spoof(
        images: list[np.ndarray],
        detections: list[Detection],
    ) -> AntiSpoofResult | None:
        """Run the MiniFASNet ensemble against the middle frame's bbox.

        Returns:
          - AntiSpoofResult when the model ran (caller checks `is_real`)
          - None when anti-spoof is disabled in settings OR no model is
            available (treat as "skip the check", not "reject")

        Middle frame is chosen on purpose: the start of the capture window
        is usually adjusting/looking down, the end is wrapping up the
        challenge — the middle has the most stable pose.
        """
        if not settings.ANTI_SPOOF_ENABLED:
            return None
        ensemble = get_anti_spoof()
        if not ensemble.is_available:
            return None
        mid = len(images) // 2
        return ensemble.predict(
            images[mid],
            detections[mid].bbox,
            threshold=settings.ANTI_SPOOF_THRESHOLD,
        )

    @staticmethod
    async def auto_enroll_if_strict(
        db: AsyncSession,
        user_id: int,
        assessment: FrameAssessment,
        embedding: np.ndarray,
        max_embeddings: int = 20,
    ) -> bool:
        """Persist `embedding` as a new reference for `user_id` only when the
        frame survives a strict re-assessment. Returns True if stored.

        Hard cap of `max_embeddings` per user prevents the stored centroid
        from drifting unboundedly as more frames are auto-enrolled.
        """
        existing = await FaceService.list_embeddings(db, user_id)
        if len(existing) >= max_embeddings:
            return False

        strict_report = assess_face_quality(assessment.image, assessment.detection, strict=True)
        if not strict_report.passed:
            logger.info(
                "Skipping auto-enroll for user %d: best frame failed strict gate (%s)",
                user_id,
                strict_report.hard_messages[0] if strict_report.hard_messages else "?",
            )
            return False

        try:
            photo_data = cv2.imencode(".jpg", assessment.image)[1].tobytes()
            photo_path = await FaceService.save_photo(photo_data, "auto.jpg")
            await FaceService.enroll_face(db, user_id, embedding, photo_path)
            logger.info(
                "Auto-enrolled embedding for user %d (now %d total, sharpness=%.1f)",
                user_id, len(existing) + 1,
                assessment.quality.metrics.get("sharpness", 0.0),
            )
            return True
        except Exception:  # noqa: BLE001 — auto-enroll is best-effort, must not break verification
            logger.warning("Auto-enrollment failed for user %d, skipping", user_id)
            return False

    @staticmethod
    async def vote_frames(
        db: AsyncSession,
        assessments: list[FrameAssessment],
        user_id: int,
        threshold: float | None = None,
        min_ratio: float | None = None,
        min_floor: int | None = None,
    ) -> VoteResult:
        """Multi-frame majority voting against one user's stored embeddings.

        Each frame's embedding is compared against the user's centroid; a
        frame "votes yes" when its best similarity exceeds `threshold`.
        Acceptance requires at least `ceil(min_ratio * n)` yes-votes (with
        a floor to avoid collapsing to a single vote on tiny batches). Using
        a ratio rather than an absolute count keeps the security budget
        constant when the frontend changes how many frames it captures.
        """
        if threshold is None:
            threshold = settings.SELF_RECOGNITION_THRESHOLD
        if min_ratio is None:
            min_ratio = settings.VOTING_MIN_RATIO
        if min_floor is None:
            min_floor = settings.VOTING_MIN_FLOOR

        n = len(assessments)
        # Required votes = ceil(ratio * n), bounded by [floor, n]
        required = max(min_floor, math.ceil(min_ratio * n))
        effective_min_votes = min(required, n)

        similarities: list[float] = []
        votes = 0
        for a in assessments:
            emb_str = str(a.embedding.tolist())
            result = await db.execute(
                text("""
                    SELECT 1 - (embedding <=> CAST(:emb AS vector)) AS sim
                    FROM face_embeddings
                    WHERE user_id = :uid
                    ORDER BY embedding <=> CAST(:emb AS vector)
                    LIMIT 1
                """),
                {"emb": emb_str, "uid": user_id},
            )
            row = result.fetchone()
            sim = float(row[0]) if row is not None else 0.0
            similarities.append(round(sim, 4))
            if sim > threshold:
                votes += 1

        passed = votes >= effective_min_votes
        max_sim = max(similarities) if similarities else 0.0
        logger.info(
            "Voting for user %d: %d/%d frames voted yes "
            "(threshold=%.3f, required=%d, ratio=%.2f, max_sim=%.3f) → %s",
            user_id, votes, n, threshold, effective_min_votes, min_ratio,
            max_sim, "PASS" if passed else "FAIL",
        )
        return VoteResult(
            passed=passed,
            votes=votes,
            total=len(assessments),
            threshold=threshold,
            similarities=similarities,
            max_similarity=max_sim,
        )

    @staticmethod
    async def find_matches(
        db: AsyncSession,
        embedding: np.ndarray,
        threshold: float | None = None,
        limit: int = 5,
        user_ids: list[int] | None = None,
    ) -> list[dict]:
        """Find nearest face matches using pgvector cosine distance.

        Returns list of {user_id, first_name, last_name, email, similarity}.
        """
        if threshold is None:
            threshold = settings.RECOGNITION_THRESHOLD

        emb_list = embedding.tolist()

        # pgvector cosine distance: 1 - cosine_similarity
        # so similarity = 1 - distance; we want distance < (1 - threshold)
        max_distance = 1.0 - threshold

        emb_str = str(emb_list)

        query = """
            SELECT fe.user_id, u.first_name, u.last_name, u.email,
                   1 - (fe.embedding <=> CAST(:emb AS vector)) AS similarity
            FROM face_embeddings fe
            JOIN users u ON u.id = fe.user_id
            WHERE (fe.embedding <=> CAST(:emb AS vector)) < :max_dist
        """
        params: dict = {"emb": emb_str, "max_dist": max_distance}

        if user_ids:
            query += " AND fe.user_id = ANY(:user_ids)"
            params["user_ids"] = user_ids

        query += " ORDER BY fe.embedding <=> CAST(:emb AS vector) LIMIT :lim"
        params["lim"] = limit

        result = await db.execute(text(query), params)
        rows = result.fetchall()

        matches: list[dict] = []
        seen_users: set[int] = set()
        for row in rows:
            uid = row[0]
            if uid in seen_users:
                continue
            seen_users.add(uid)
            matches.append({
                "user_id": uid,
                "first_name": row[1],
                "last_name": row[2],
                "email": row[3],
                "similarity": round(float(row[4]), 4),
            })
        return matches
