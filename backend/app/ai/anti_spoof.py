"""MiniFASNet face anti-spoofing inference.

Wraps two ONNX models (V1SE and V2, both from Minivision's Silent-Face-
Anti-Spoofing project) in an ensemble. Each model predicts whether a face
crop is `live`, `2D-fake` (printed photo / screen) or `3D-fake` (mask).
We average the per-model softmax outputs and accept the face as real only
when the live-class probability exceeds a configurable threshold.

This complements the existing heuristic checks (`detect_screen_spoof`,
`detect_video_replay`) — it does not replace them. The heuristics catch
obvious moiré / pixel-grid artefacts cheaply; MiniFASNet catches subtle
attacks (good-quality 4K screens, professional prints) that the heuristics
miss.

Each model expects an 80×80 RGB crop produced by `crop_face_for_antispoof`
with the model's specific `scale` parameter (V1SE → 4.0, V2 → 2.7).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from app.config import settings

logger = logging.getLogger(__name__)

# Model input is 80x80 RGB. The ONNX weights from yakhyo's repack embed the
# normalisation (BatchNorm) inside the graph, so the only preprocessing we
# need on the Python side is BGR→RGB, HWC→CHW and astype(float32).
_INPUT_SIZE = 80


@dataclass
class AntiSpoofResult:
    """Outcome of the anti-spoofing check for a single face crop."""

    is_real: bool
    live_score: float                  # ensembled softmax probability of "live"
    per_model_scores: list[float]      # individual model live-scores (for logs)


def crop_face_for_antispoof(
    image: np.ndarray,
    bbox: tuple[int, int, int, int],
    scale: float,
) -> np.ndarray:
    """Reproduce Minivision's CropImage.crop with `scale` parameter.

    The face bbox is expanded by `scale` (relative to bbox size, not image
    size) so the network sees context around the face. This is essential —
    MiniFASNet was trained on these specific crops, and a tight crop hurts
    accuracy significantly.
    """
    x1, y1, x2, y2 = bbox
    bw, bh = x2 - x1, y2 - y1
    cx, cy = x1 + bw / 2.0, y1 + bh / 2.0

    new_w = bw * scale
    new_h = bh * scale
    nx1 = round(cx - new_w / 2.0)
    ny1 = round(cy - new_h / 2.0)
    nx2 = round(cx + new_w / 2.0)
    ny2 = round(cy + new_h / 2.0)

    h, w = image.shape[:2]
    # Pad with replicated border if expanded crop falls outside the image
    pad_left = max(0, -nx1)
    pad_top = max(0, -ny1)
    pad_right = max(0, nx2 - w)
    pad_bot = max(0, ny2 - h)
    if pad_left or pad_top or pad_right or pad_bot:
        image = cv2.copyMakeBorder(
            image, pad_top, pad_bot, pad_left, pad_right, cv2.BORDER_REPLICATE,
        )
        nx1 += pad_left
        nx2 += pad_left
        ny1 += pad_top
        ny2 += pad_top

    crop = image[ny1:ny2, nx1:nx2]
    return cv2.resize(crop, (_INPUT_SIZE, _INPUT_SIZE))


def _softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - np.max(x))
    return e / e.sum()


class _SingleModel:
    """One MiniFASNet ONNX session. Lazy-loaded on first call."""

    def __init__(self, model_path: str | None, scale: float):
        self._session = None
        self._model_path = model_path
        self._scale = scale
        self._load_attempted = False

    @property
    def is_loaded(self) -> bool:
        return self._session is not None

    @property
    def scale(self) -> float:
        return self._scale

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
                logger.warning(
                    "Anti-spoof model not found at %s — model disabled", path,
                )
                return False
            options = ort.SessionOptions()
            options.intra_op_num_threads = 1
            options.inter_op_num_threads = 1
            self._session = ort.InferenceSession(
                path,
                sess_options=options,
                providers=["CPUExecutionProvider"],
            )
            logger.info("Anti-spoof model loaded from %s", path)
            return True
        except Exception:
            logger.exception("Failed to load anti-spoof model")
            return False

    def predict(self, face_crop: np.ndarray) -> np.ndarray | None:
        """Return softmax over [live, 2D-fake, 3D-fake] for one 80×80 crop."""
        if not self._ensure_loaded():
            return None
        # BGR (OpenCV) → RGB → CHW float32 with no further normalisation;
        # Minivision's preprocessing is just np.transpose + astype, matching
        # how the original model was exported to ONNX.
        rgb = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
        blob = np.transpose(rgb, (2, 0, 1)).astype(np.float32)
        blob = np.expand_dims(blob, 0)

        outputs = self._session.run(None, {self._session.get_inputs()[0].name: blob})
        logits = outputs[0][0]
        return _softmax(logits)


class AntiSpoofEnsemble:
    """Ensemble of MiniFASNetV1SE (scale=4.0) + MiniFASNetV2 (scale=2.7).

    Mirrors the original Minivision evaluation pipeline: each model gets its
    own scale-specific crop, predictions are averaged, and the face is real
    when the live-class probability is above `threshold`.

    Both models are optional — if a weight file is missing the model is
    silently skipped and the ensemble falls back to the remaining one.
    Anti-spoofing is disabled entirely only when both files are absent.
    """

    def __init__(
        self,
        v1se_model_path: str | None = None,
        v2_model_path: str | None = None,
    ):
        self._models = [
            _SingleModel(v1se_model_path, scale=4.0),
            _SingleModel(v2_model_path, scale=2.7),
        ]

    @property
    def is_available(self) -> bool:
        """True when at least one of the two models can be loaded."""
        return any(m._ensure_loaded() for m in self._models)

    def predict(
        self,
        image: np.ndarray,
        bbox: tuple[int, int, int, int],
        threshold: float,
    ) -> AntiSpoofResult | None:
        """Run the ensemble against a face bbox in `image`.

        Returns None when no model is available — callers should treat that
        as "skip the check" rather than "reject the face", since failing
        closed would block every login when the weights are missing.
        """
        per_model: list[float] = []
        for m in self._models:
            crop = crop_face_for_antispoof(image, bbox, m.scale)
            probs = m.predict(crop)
            if probs is None:
                continue
            # Class 1 is "live" in Minivision's label mapping; classes 0 and 2
            # are 2D-fake (print/screen) and 3D-fake (mask) respectively.
            per_model.append(float(probs[1]))

        if not per_model:
            return None

        live_score = float(np.mean(per_model))
        is_real = live_score >= threshold
        logger.info(
            "Anti-spoof ensemble — per_model_live=%s, mean=%.3f, threshold=%.3f → %s",
            [f"{s:.3f}" for s in per_model],
            live_score, threshold, "REAL" if is_real else "SPOOF",
        )
        return AntiSpoofResult(
            is_real=is_real,
            live_score=live_score,
            per_model_scores=per_model,
        )


_ensemble: AntiSpoofEnsemble | None = None


def get_anti_spoof() -> AntiSpoofEnsemble:
    """Lazily build and return the process-wide anti-spoof ensemble."""
    global _ensemble
    if _ensemble is None:
        _ensemble = AntiSpoofEnsemble(
            v1se_model_path=f"{settings.AI_MODEL_PATH}/MiniFASNetV1SE.onnx",
            v2_model_path=f"{settings.AI_MODEL_PATH}/MiniFASNetV2.onnx",
        )
    return _ensemble
