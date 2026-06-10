"""ArcFace recognition model using ONNX Runtime.

Extracts 512-dimensional face embeddings from aligned face crops.
Face alignment uses the standard 5-point landmarks -> 112x112 affine
transform used by InsightFace/ArcFace models.
"""

import logging
from pathlib import Path

import cv2
import numpy as np

logger = logging.getLogger(__name__)

EMBEDDING_DIM = 512

# Standard ArcFace alignment reference points for 112x112 crop
ARCFACE_DST = np.array(
    [
        [38.2946, 51.6963],
        [73.5318, 51.5014],
        [56.0252, 71.7366],
        [41.5493, 92.3655],
        [70.7299, 92.2041],
    ],
    dtype=np.float32,
)


def align_face(image: np.ndarray, landmarks: np.ndarray) -> np.ndarray:
    """Align face using 5-point landmarks to 112x112 crop."""
    src = landmarks.astype(np.float32)
    dst = ARCFACE_DST.copy()

    tform = cv2.estimateAffinePartial2D(src, dst, method=cv2.LMEDS)[0]
    if tform is None:
        tform = cv2.estimateAffinePartial2D(src, dst)[0]
    aligned = cv2.warpAffine(image, tform, (112, 112), borderValue=0.0)
    return aligned


class FaceRecognizer:
    """ArcFace embedding extractor via ONNX Runtime."""

    def __init__(self, model_path: str | None = None):
        self._session = None
        self._model_path = model_path
        self._load_attempted = False

    def _ensure_loaded(self) -> bool:
        if self._session is not None:
            return True
        if self._load_attempted:
            return False
        self._load_attempted = True
        try:
            import onnxruntime as ort

            path = self._model_path
            if path is None or not Path(path).exists():
                logger.warning("ArcFace model not found at %s — recognizer disabled", path)
                return False
            options = ort.SessionOptions()
            options.intra_op_num_threads = 1
            options.inter_op_num_threads = 1
            options.enable_cpu_mem_arena = False
            options.enable_mem_pattern = False
            options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
            self._session = ort.InferenceSession(
                path,
                sess_options=options,
                providers=["CPUExecutionProvider"],
            )
            logger.info("ArcFace model loaded from %s", path)
            return True
        except Exception:
            logger.exception("Failed to load ArcFace model")
            return False

    @property
    def is_loaded(self) -> bool:
        return self._session is not None

    def get_embedding(self, face_crop: np.ndarray) -> np.ndarray | None:
        """Extract 512-d embedding from a 112x112 aligned face crop (BGR)."""
        if not self._ensure_loaded():
            return None

        img = cv2.resize(face_crop, (112, 112))
        # CLAHE histogram equalization per channel for lighting normalization
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(4, 4))
        lab[:, :, 0] = clahe.apply(lab[:, :, 0])
        img = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = np.transpose(img, (2, 0, 1)).astype(np.float32)
        img = (img - 127.5) / 127.5
        img = np.expand_dims(img, axis=0)

        input_name = self._session.get_inputs()[0].name
        outputs = self._session.run(None, {input_name: img})
        embedding = outputs[0][0]

        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        return embedding
