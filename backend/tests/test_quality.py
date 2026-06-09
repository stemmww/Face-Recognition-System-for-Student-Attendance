"""Unit tests for app.ai.quality — face image quality assessment."""

import numpy as np
import pytest

from app.ai.detector import Detection
from app.ai.quality import (
    QualityIssue,
    QualityReport,
    assess_face_quality,
    compute_brightness,
    compute_contrast,
    compute_face_ratio,
    compute_face_size_px,
    compute_pose_offsets,
    compute_sharpness,
)
from app.config import settings


# ---------------------------------------------------------------------------
# Test fixtures
# ---------------------------------------------------------------------------


def _make_landmarks(
    left_eye=(40, 50),
    right_eye=(80, 50),
    nose=(60, 70),
    left_mouth=(45, 90),
    right_mouth=(75, 90),
) -> np.ndarray:
    return np.array([left_eye, right_eye, nose, left_mouth, right_mouth], dtype=float)


def _make_detection(
    bbox=(100, 100, 300, 340),
    confidence=0.95,
    landmarks=None,
) -> Detection:
    if landmarks is None:
        x1, y1, x2, y2 = bbox
        w, h = x2 - x1, y2 - y1
        landmarks = np.array([
            [x1 + 0.3 * w, y1 + 0.35 * h],
            [x1 + 0.7 * w, y1 + 0.35 * h],
            [x1 + 0.5 * w, y1 + 0.55 * h],
            [x1 + 0.35 * w, y1 + 0.8 * h],
            [x1 + 0.65 * w, y1 + 0.8 * h],
        ], dtype=float)
    return Detection(bbox=bbox, confidence=confidence, landmarks=landmarks)


def _good_image(size=(480, 640), face_bbox=(100, 100, 300, 340)) -> np.ndarray:
    """Synthetic image with a textured 'face' region — passes all quality gates."""
    rng = np.random.default_rng(seed=42)
    img = np.full((*size, 3), 128, dtype=np.uint8)
    x1, y1, x2, y2 = face_bbox
    # Fill face region with high-variance noise so Laplacian is high (sharp)
    img[y1:y2, x1:x2] = rng.integers(80, 200, (y2 - y1, x2 - x1, 3), dtype=np.uint8)
    return img


# ---------------------------------------------------------------------------
# Individual metrics
# ---------------------------------------------------------------------------


class TestMetrics:
    def test_face_size_uses_shorter_side(self):
        # 200x100 bbox → shorter side is 100
        assert compute_face_size_px((0, 0, 200, 100)) == 100

    def test_face_ratio(self):
        # 200x200 face in 400x400 image → 200*200 / (400*400) = 0.25
        assert compute_face_ratio((0, 0, 200, 200), (400, 400)) == pytest.approx(0.25)

    def test_face_ratio_handles_zero_image(self):
        assert compute_face_ratio((0, 0, 100, 100), (0, 0)) == 0.0

    def test_sharpness_flat_image_low(self):
        flat = np.full((100, 100, 3), 128, dtype=np.uint8)
        assert compute_sharpness(flat) < 1.0

    def test_sharpness_noisy_image_high(self):
        rng = np.random.default_rng(seed=1)
        noisy = rng.integers(0, 255, (100, 100, 3), dtype=np.uint8)
        assert compute_sharpness(noisy) > 100.0

    def test_brightness_dark(self):
        dark = np.full((50, 50, 3), 10, dtype=np.uint8)
        assert compute_brightness(dark) == pytest.approx(10.0)

    def test_brightness_overexposed(self):
        bright = np.full((50, 50, 3), 250, dtype=np.uint8)
        assert compute_brightness(bright) == pytest.approx(250.0)

    def test_contrast_flat_zero(self):
        flat = np.full((50, 50, 3), 128, dtype=np.uint8)
        assert compute_contrast(flat) == 0.0

    def test_contrast_high_variance(self):
        # Uniform-random color noise → grayscale std lands around 45-50.
        # We only need it well above the low-contrast threshold (~20).
        rng = np.random.default_rng(seed=2)
        noisy = rng.integers(0, 255, (50, 50, 3), dtype=np.uint8)
        assert compute_contrast(noisy) > 40.0

    def test_pose_offsets_frontal(self):
        # Nose centered between eyes, half IOD below
        lm = np.array([[10, 0], [50, 0], [30, 20], [15, 40], [45, 40]], dtype=float)
        yaw, pitch = compute_pose_offsets(lm)
        assert yaw < 0.05
        assert pitch < 0.05

    def test_pose_offsets_yawed_right(self):
        # Nose shifted significantly to the right of eye midpoint
        lm = np.array([[10, 0], [50, 0], [45, 20], [15, 40], [45, 40]], dtype=float)
        yaw, _ = compute_pose_offsets(lm)
        assert yaw > 0.3

    def test_pose_offsets_degenerate_iod(self):
        # Eyes at the same point — undefined pose, must return safe zeros
        lm = np.array([[10, 0], [10, 0], [10, 20], [5, 40], [15, 40]], dtype=float)
        yaw, pitch = compute_pose_offsets(lm)
        assert yaw == 0.0 and pitch == 0.0


# ---------------------------------------------------------------------------
# End-to-end assess_face_quality
# ---------------------------------------------------------------------------


class TestAssessFaceQuality:
    def test_good_face_passes(self):
        img = _good_image()
        det = _make_detection(bbox=(100, 100, 300, 340))
        report = assess_face_quality(img, det)
        assert report.passed is True
        assert report.hard_issues == []

    def test_tiny_face_rejected(self):
        # 30px face is below QUALITY_MIN_FACE_PX (80 default)
        img = _good_image()
        det = _make_detection(bbox=(100, 100, 130, 130))
        report = assess_face_quality(img, det)
        assert report.passed is False
        assert any(i.code == "face_too_small" for i in report.hard_issues)

    def test_blurry_face_rejected(self, monkeypatch):
        # Flat image → Laplacian variance ~0 → rejected as blurry
        monkeypatch.setattr(settings, "QUALITY_MIN_SHARPNESS", 30.0)
        img = np.full((480, 640, 3), 128, dtype=np.uint8)
        det = _make_detection(bbox=(100, 100, 300, 340))
        report = assess_face_quality(img, det)
        assert any(i.code == "too_blurry" for i in report.hard_issues)

    def test_dark_face_rejected(self):
        # Mean brightness ~5 < QUALITY_MIN_BRIGHTNESS (40)
        rng = np.random.default_rng(seed=7)
        img = np.full((480, 640, 3), 128, dtype=np.uint8)
        img[100:340, 100:300] = rng.integers(0, 10, (240, 200, 3), dtype=np.uint8)
        det = _make_detection(bbox=(100, 100, 300, 340))
        report = assess_face_quality(img, det)
        assert any(i.code == "too_dark" for i in report.hard_issues)

    def test_overexposed_face_rejected(self):
        img = np.full((480, 640, 3), 128, dtype=np.uint8)
        img[100:340, 100:300] = 250
        det = _make_detection(bbox=(100, 100, 300, 340))
        report = assess_face_quality(img, det)
        assert any(i.code == "overexposed" for i in report.hard_issues)

    def test_extreme_yaw_rejected(self):
        img = _good_image()
        # Nose pushed far to the right within the face bbox
        bbox = (100, 100, 300, 340)
        lm = np.array([
            [160, 170],  # left eye
            [240, 170],  # right eye
            [260, 220],  # nose far right of eye midpoint (200) → yaw ratio ~ 0.75
            [180, 300],
            [220, 300],
        ], dtype=float)
        det = _make_detection(bbox=bbox, landmarks=lm)
        report = assess_face_quality(img, det)
        assert any(i.code == "bad_yaw" for i in report.hard_issues)

    def test_strict_mode_promotes_soft_issues(self):
        # Build a face just above the hard size threshold but below the soft one
        img = _good_image(face_bbox=(100, 100, 200, 200))  # 100px shorter side
        det = _make_detection(bbox=(100, 100, 200, 200))

        soft = assess_face_quality(img, det, strict=False)
        strict = assess_face_quality(img, det, strict=True)

        # 100px is between MIN (80) and SOFT (120) — soft issue in normal mode
        assert any(i.code == "face_smallish" and i.severity == "soft" for i in soft.issues)
        # In strict mode the same issue is promoted to hard
        assert any(i.code == "face_smallish" and i.severity == "hard" for i in strict.issues)
        assert strict.passed is False

    def test_strict_mode_can_allow_selected_soft_issues(self):
        img = _good_image()
        bbox = (100, 100, 300, 340)
        lm = np.array([
            [160, 170],
            [240, 170],
            [220, 220],  # mild yaw: above soft threshold, below hard threshold
            [180, 300],
            [220, 300],
        ], dtype=float)
        det = _make_detection(bbox=bbox, landmarks=lm)

        strict = assess_face_quality(img, det, strict=True)
        allowed = assess_face_quality(
            img,
            det,
            strict=True,
            strict_allowed_soft_codes=frozenset({"soft_yaw"}),
        )

        assert any(i.code == "soft_yaw" and i.severity == "hard" for i in strict.issues)
        assert strict.passed is False
        assert any(i.code == "soft_yaw" and i.severity == "soft" for i in allowed.issues)
        assert allowed.passed is True

    def test_metrics_populated(self):
        img = _good_image()
        det = _make_detection(bbox=(100, 100, 300, 340))
        report = assess_face_quality(img, det)
        for key in ("face_size_px", "face_ratio", "sharpness", "brightness", "contrast"):
            assert key in report.metrics

    def test_no_landmarks_skips_pose_check(self):
        img = _good_image()
        det = _make_detection(bbox=(100, 100, 300, 340))
        det.landmarks = None
        report = assess_face_quality(img, det)
        # Pose-related codes must not appear when landmarks are missing
        assert not any(i.code in {"bad_yaw", "soft_yaw", "bad_pitch"} for i in report.issues)


# ---------------------------------------------------------------------------
# QualityReport convenience properties
# ---------------------------------------------------------------------------


class TestQualityReport:
    def test_hard_and_soft_filters(self):
        report = QualityReport(
            passed=False,
            issues=[
                QualityIssue("a", "hard1", "hard", 0, 1),
                QualityIssue("b", "soft1", "soft", 0, 1),
                QualityIssue("c", "hard2", "hard", 0, 1),
            ],
        )
        assert [i.code for i in report.hard_issues] == ["a", "c"]
        assert [i.code for i in report.soft_issues] == ["b"]
        assert report.hard_messages == ["hard1", "hard2"]
        assert report.soft_messages == ["soft1"]
