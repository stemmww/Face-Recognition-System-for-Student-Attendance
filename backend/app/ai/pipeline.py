"""High-level face recognition pipeline.

Combines SCRFD (face detection with landmarks) and ArcFace (embedding
extraction) ONNX models, connected via face alignment.

Pipeline flow:
  image → SCRFD detect → landmarks → align → ArcFace embed → 512-d vector
"""

import logging
from dataclasses import dataclass

import numpy as np

from app.ai.detector import FaceDetector
from app.ai.recognizer import FaceRecognizer, align_face
from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class FaceResult:
    bbox: tuple[int, int, int, int]
    embedding: np.ndarray
    confidence: float


@dataclass
class MatchResult:
    user_id: int
    confidence: float
    bbox: tuple[int, int, int, int]


class FacePipeline:
    """Singleton-style pipeline — create once at app startup."""

    def __init__(
        self,
        detector_model_path: str | None = None,
        recognizer_model_path: str | None = None,
    ):
        self.detector = FaceDetector(model_path=detector_model_path)
        self.recognizer = FaceRecognizer(model_path=recognizer_model_path)

    @property
    def is_ready(self) -> bool:
        return self.detector.is_loaded and self.recognizer.is_loaded

    def process_image(self, image: np.ndarray) -> list[FaceResult]:
        """Detect all faces, align them, and extract embeddings."""
        detections = self.detector.detect(image)
        results: list[FaceResult] = []

        for det in detections:
            if det.landmarks is None:
                continue
            aligned = align_face(image, det.landmarks)
            embedding = self.recognizer.get_embedding(aligned)
            if embedding is not None:
                results.append(
                    FaceResult(
                        bbox=det.bbox,
                        embedding=embedding,
                        confidence=det.confidence,
                    )
                )
        return results

    def extract_embedding(self, image: np.ndarray) -> tuple[np.ndarray | None, int]:
        """Extract embedding from the largest face in the image.

        Returns (embedding, face_count).
        """
        faces = self.process_image(image)
        if not faces:
            return None, 0
        largest = max(
            faces,
            key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]),
        )
        return largest.embedding, len(faces)

    @staticmethod
    def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8))


_pipeline: FacePipeline | None = None


def get_pipeline() -> FacePipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = FacePipeline(
            detector_model_path=f"{settings.AI_MODEL_PATH}/det_10g.onnx",
            recognizer_model_path=f"{settings.AI_MODEL_PATH}/w600k_r50.onnx",
        )
    return _pipeline
