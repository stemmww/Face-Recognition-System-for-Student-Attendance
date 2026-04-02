"""Face enrollment, embedding management, and matching logic."""

import logging
import uuid
from pathlib import Path

import numpy as np
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import NotFoundError
from app.models.face_embedding import FaceEmbedding
from app.models.user import User

logger = logging.getLogger(__name__)


class FaceService:
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
