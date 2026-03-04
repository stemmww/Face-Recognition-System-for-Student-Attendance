"""Image preprocessing utilities for face recognition pipeline."""

import numpy as np


def crop_face(frame: np.ndarray, bbox: tuple[int, int, int, int]) -> np.ndarray:
    """Crop a face region from a frame given a bounding box (x1, y1, x2, y2)."""
    x1, y1, x2, y2 = bbox
    return frame[y1:y2, x1:x2]


def cosine_distance(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine distance between two embeddings. 0 = identical."""
    dot = np.dot(a, b)
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    if norm == 0:
        return 1.0
    return 1.0 - (dot / norm)
