"""Face image quality assessment.

Runs a set of cheap quality checks on a detected face before extracting an
embedding. The goal is to keep low-quality faces (too small, too blurry,
too dark, badly posed) out of the recognition pipeline — both when admins
enroll a student photo and when verification auto-saves a frame.

A low-quality embedding hurts in two ways:
  1. It misses on the legitimate user (false reject).
  2. It can drift the user's stored centroid toward a noisy direction,
     dragging down all *future* matches for that user (database poisoning).

Each check returns a numeric measurement plus a severity:
  - "hard": photo is rejected, recognition will not run
  - "soft": photo is accepted but a warning is surfaced to the UI

Thresholds are configurable via app.config.settings to allow per-deployment
tuning without code changes.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

import cv2
import numpy as np

from app.config import settings

if TYPE_CHECKING:
    from app.ai.detector import Detection

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class QualityIssue:
    """A single problem found with a face image."""

    code: str  # machine-readable id, e.g. "face_too_small"
    message: str  # human-readable message
    severity: str  # "hard" or "soft"
    value: float  # measured value
    threshold: float  # threshold that was crossed


@dataclass
class QualityReport:
    """Aggregated quality result for one face."""

    passed: bool  # True when no hard issues were found
    issues: list[QualityIssue] = field(default_factory=list)
    metrics: dict[str, float] = field(default_factory=dict)

    @property
    def hard_issues(self) -> list[QualityIssue]:
        return [i for i in self.issues if i.severity == "hard"]

    @property
    def soft_issues(self) -> list[QualityIssue]:
        return [i for i in self.issues if i.severity == "soft"]

    @property
    def hard_messages(self) -> list[str]:
        return [i.message for i in self.hard_issues]

    @property
    def soft_messages(self) -> list[str]:
        return [i.message for i in self.soft_issues]


# ---------------------------------------------------------------------------
# Individual metric helpers (pure functions, easy to unit-test)
# ---------------------------------------------------------------------------


def _crop_with_pad(image: np.ndarray, bbox: tuple[int, int, int, int], pad_ratio: float = 0.05) -> np.ndarray:
    """Return the face crop with a small padding around it (clamped to image)."""
    x1, y1, x2, y2 = bbox
    h, w = image.shape[:2]
    pad = int(max(x2 - x1, y2 - y1) * pad_ratio)
    cx1, cy1 = max(0, x1 - pad), max(0, y1 - pad)
    cx2, cy2 = min(w, x2 + pad), min(h, y2 + pad)
    return image[cy1:cy2, cx1:cx2]


def compute_face_size_px(bbox: tuple[int, int, int, int]) -> int:
    """Shortest side of the face bounding box, in pixels.

    Using the shortest side (not area) makes the metric independent of
    bbox aspect ratio — a wide-but-short face still fails the gate.
    """
    x1, y1, x2, y2 = bbox
    return int(min(x2 - x1, y2 - y1))


def compute_face_ratio(bbox: tuple[int, int, int, int], image_shape: tuple[int, int]) -> float:
    """Fraction of the image area occupied by the face bbox."""
    h, w = image_shape[:2]
    img_area = h * w
    if img_area <= 0:
        return 0.0
    x1, y1, x2, y2 = bbox
    return ((x2 - x1) * (y2 - y1)) / img_area


def compute_sharpness(face_crop: np.ndarray) -> float:
    """Variance of the Laplacian — classic blur metric.

    Higher = sharper. Typical ranges seen in practice:
      < 30     very blurry (motion / out-of-focus)
      30-80    soft but usable
      80+      sharp
    """
    if face_crop.size == 0:
        return 0.0
    gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY) if face_crop.ndim == 3 else face_crop
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def compute_brightness(face_crop: np.ndarray) -> float:
    """Mean grayscale intensity of the face region (0-255)."""
    if face_crop.size == 0:
        return 0.0
    gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY) if face_crop.ndim == 3 else face_crop
    return float(gray.mean())


def compute_contrast(face_crop: np.ndarray) -> float:
    """Standard deviation of grayscale intensities — proxy for dynamic range.

    A flat (low-contrast) crop often means heavy shadow, fog, or a face
    washed out by direct light — all of which break recognition.
    """
    if face_crop.size == 0:
        return 0.0
    gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY) if face_crop.ndim == 3 else face_crop
    return float(gray.std())


def compute_pose_offsets(landmarks: np.ndarray) -> tuple[float, float]:
    """Rough yaw/pitch estimate from 5-point landmarks.

    Returns (yaw_ratio, pitch_ratio):
      yaw_ratio   = |nose_x - eye_mid_x|  / inter-ocular distance
      pitch_ratio = (nose_y - eye_mid_y - expected) / inter-ocular distance

    Both are dimensionless and scale-invariant. ArcFace's reference template
    has the nose roughly centred between the eyes and ~0.5 IOD below them;
    deviations indicate the face is turned (yaw) or tilted (pitch).
    """
    iod = float(np.linalg.norm(landmarks[0] - landmarks[1]))
    if iod < 1.0:
        return 0.0, 0.0
    eye_mid_x = (landmarks[0][0] + landmarks[1][0]) / 2.0
    eye_mid_y = (landmarks[0][1] + landmarks[1][1]) / 2.0
    yaw = abs(float(landmarks[2][0]) - eye_mid_x) / iod
    # ArcFace template has nose ~0.5 * IOD below eye line; deviation = pitch proxy
    pitch = abs((float(landmarks[2][1]) - eye_mid_y) / iod - 0.5)
    return yaw, pitch


# ---------------------------------------------------------------------------
# Main assessor
# ---------------------------------------------------------------------------


def assess_face_quality(
    image: np.ndarray,
    det: Detection,
    *,
    strict: bool = False,
) -> QualityReport:
    """Run all quality checks on a single detected face.

    Parameters
    ----------
    image : np.ndarray
        Full source image (BGR).
    det : Detection
        Output of FaceDetector.detect() for this face.
    strict : bool, default False
        When True, soft thresholds are also promoted to hard rejections.
        Use strict=True for auto-enrollment (where a borderline photo
        would silently poison the user's stored embeddings) and strict=False
        for verification (where a borderline photo can still match an
        existing high-quality embedding).
    """
    issues: list[QualityIssue] = []
    metrics: dict[str, float] = {}

    face_px = compute_face_size_px(det.bbox)
    face_ratio = compute_face_ratio(det.bbox, image.shape[:2])
    metrics["face_size_px"] = float(face_px)
    metrics["face_ratio"] = face_ratio

    # 1. Absolute size in pixels — embeddings of tiny faces are unreliable
    #    regardless of how much of the frame they fill.
    if face_px < settings.QUALITY_MIN_FACE_PX:
        issues.append(QualityIssue(
            code="face_too_small",
            message=f"Face is too small ({face_px}px) — move closer to the camera",
            severity="hard",
            value=face_px,
            threshold=settings.QUALITY_MIN_FACE_PX,
        ))
    elif face_px < settings.QUALITY_SOFT_FACE_PX:
        issues.append(QualityIssue(
            code="face_smallish",
            message="Face is a bit small — moving closer would improve recognition",
            severity="soft",
            value=face_px,
            threshold=settings.QUALITY_SOFT_FACE_PX,
        ))

    # Compute crop once for the remaining pixel-based metrics
    crop = _crop_with_pad(image, det.bbox)

    # 2. Sharpness (Laplacian variance) — rejects motion blur and out-of-focus
    sharpness = compute_sharpness(crop)
    metrics["sharpness"] = sharpness
    if sharpness < settings.QUALITY_MIN_SHARPNESS:
        issues.append(QualityIssue(
            code="too_blurry",
            message="Photo is too blurry — hold the camera steady",
            severity="hard",
            value=sharpness,
            threshold=settings.QUALITY_MIN_SHARPNESS,
        ))
    elif sharpness < settings.QUALITY_SOFT_SHARPNESS:
        issues.append(QualityIssue(
            code="slightly_blurry",
            message="Photo is slightly blurry — a sharper image would improve recognition",
            severity="soft",
            value=sharpness,
            threshold=settings.QUALITY_SOFT_SHARPNESS,
        ))

    # 3. Brightness — rejects pitch-dark and blown-out exposures
    brightness = compute_brightness(crop)
    metrics["brightness"] = brightness
    if brightness < settings.QUALITY_MIN_BRIGHTNESS:
        issues.append(QualityIssue(
            code="too_dark",
            message="Photo is too dark — use better lighting",
            severity="hard",
            value=brightness,
            threshold=settings.QUALITY_MIN_BRIGHTNESS,
        ))
    elif brightness > settings.QUALITY_MAX_BRIGHTNESS:
        issues.append(QualityIssue(
            code="overexposed",
            message="Photo is overexposed — reduce lighting or avoid direct light",
            severity="hard",
            value=brightness,
            threshold=settings.QUALITY_MAX_BRIGHTNESS,
        ))

    # 4. Contrast — flat tones usually mean heavy shadow / washed-out skin
    contrast = compute_contrast(crop)
    metrics["contrast"] = contrast
    if contrast < settings.QUALITY_MIN_CONTRAST:
        issues.append(QualityIssue(
            code="low_contrast",
            message="Photo has very low contrast — improve lighting and avoid heavy shadow",
            severity="soft",
            value=contrast,
            threshold=settings.QUALITY_MIN_CONTRAST,
        ))

    # 5. Pose — only meaningful if SCRFD returned landmarks
    if det.landmarks is not None:
        yaw, pitch = compute_pose_offsets(det.landmarks)
        metrics["pose_yaw"] = yaw
        metrics["pose_pitch"] = pitch
        if yaw > settings.QUALITY_MAX_YAW:
            issues.append(QualityIssue(
                code="bad_yaw",
                message="Face is turned too far to the side — look directly at the camera",
                severity="hard",
                value=yaw,
                threshold=settings.QUALITY_MAX_YAW,
            ))
        elif yaw > settings.QUALITY_SOFT_YAW:
            issues.append(QualityIssue(
                code="soft_yaw",
                message="Face is slightly angled — looking straight ahead works best",
                severity="soft",
                value=yaw,
                threshold=settings.QUALITY_SOFT_YAW,
            ))
        if pitch > settings.QUALITY_MAX_PITCH:
            issues.append(QualityIssue(
                code="bad_pitch",
                message="Face is tilted up or down too much — keep your head level",
                severity="hard",
                value=pitch,
                threshold=settings.QUALITY_MAX_PITCH,
            ))

    # In strict mode, promote any soft issues to hard rejections so that the
    # caller (typically auto-enrollment) refuses to store a borderline embedding.
    if strict:
        for issue in issues:
            if issue.severity == "soft":
                issue.severity = "hard"

    report = QualityReport(
        passed=not any(i.severity == "hard" for i in issues),
        issues=issues,
        metrics=metrics,
    )

    logger.debug(
        "Quality assessment — passed=%s metrics=%s hard=%s soft=%s",
        report.passed, metrics,
        [i.code for i in report.hard_issues],
        [i.code for i in report.soft_issues],
    )
    return report
