"""Unit tests for app.ai.anti_spoof — MiniFASNet ensemble logic.

We don't load real ONNX weights here (they're not in the test environment),
so we stub _SingleModel.predict directly to drive the ensemble through its
decision branches.
"""

import numpy as np
import pytest

from app.ai.anti_spoof import (
    AntiSpoofEnsemble,
    AntiSpoofResult,
    crop_face_for_antispoof,
)


# ---------------------------------------------------------------------------
# crop_face_for_antispoof
# ---------------------------------------------------------------------------


class TestCropFace:
    def test_output_is_80x80_rgb(self):
        img = np.zeros((480, 640, 3), dtype=np.uint8)
        crop = crop_face_for_antispoof(img, (100, 100, 200, 240), scale=2.7)
        assert crop.shape == (80, 80, 3)

    def test_scale_expands_bbox(self):
        # With a 100x140 face at the centre, scale 2.7 should grab a much
        # larger area than the bbox itself.
        img = np.zeros((1000, 1000, 3), dtype=np.uint8)
        # Paint a colourful patch only inside the original bbox so we can
        # detect whether the crop pulled in surrounding pixels too.
        img[400:540, 450:550] = 200
        crop = crop_face_for_antispoof(img, (450, 400, 550, 540), scale=2.7)
        # Border padding from outside the painted region must be present —
        # the crop must contain pixels that were NOT inside the bbox.
        assert crop.shape == (80, 80, 3)
        assert (crop < 50).any()  # zero-region from outside the painted patch

    def test_bbox_near_edge_uses_replicated_border(self):
        # Bbox flush with the image edge — should not crash, padding kicks in.
        img = np.ones((100, 100, 3), dtype=np.uint8) * 128
        crop = crop_face_for_antispoof(img, (0, 0, 50, 70), scale=4.0)
        assert crop.shape == (80, 80, 3)


# ---------------------------------------------------------------------------
# Ensemble decision logic — stubbed inference
# ---------------------------------------------------------------------------


def _stub_predict(probs: np.ndarray):
    """Build a function that ignores its input and returns the given softmax."""

    def _impl(_crop):
        return probs

    return _impl


class TestEnsembleDecision:
    def _build(self, model_outputs: list[np.ndarray | None]) -> AntiSpoofEnsemble:
        """Construct an ensemble with both models present but stubbed."""
        ens = AntiSpoofEnsemble("dummy_v1.onnx", "dummy_v2.onnx")
        # Force `is_loaded` so the ensemble considers them present
        for model, probs in zip(ens._models, model_outputs, strict=True):
            model._session = "stub"  # truthy
            model._load_attempted = True
            model.predict = _stub_predict(probs) if probs is not None else lambda _: None
        return ens

    def test_both_models_real(self):
        # Strong live prediction from both models → REAL
        probs = np.array([0.05, 0.90, 0.05])
        ens = self._build([probs, probs])
        result = ens.predict(np.zeros((200, 200, 3), dtype=np.uint8), (50, 50, 150, 150), threshold=0.7)
        assert isinstance(result, AntiSpoofResult)
        assert result.is_real is True
        assert result.live_score == pytest.approx(0.90)
        assert len(result.per_model_scores) == 2

    def test_both_models_spoof(self):
        # Low live probability from both → SPOOF
        probs = np.array([0.80, 0.10, 0.10])
        ens = self._build([probs, probs])
        result = ens.predict(np.zeros((200, 200, 3), dtype=np.uint8), (50, 50, 150, 150), threshold=0.7)
        assert result.is_real is False
        assert result.live_score == pytest.approx(0.10)

    def test_ensemble_averaging(self):
        # 0.6 + 0.9 → mean 0.75 → above 0.7 threshold → REAL
        ens = self._build([
            np.array([0.30, 0.60, 0.10]),
            np.array([0.05, 0.90, 0.05]),
        ])
        result = ens.predict(np.zeros((200, 200, 3), dtype=np.uint8), (50, 50, 150, 150), threshold=0.7)
        assert result.is_real is True
        assert result.live_score == pytest.approx(0.75)

    def test_threshold_boundary_uses_ge(self):
        # live_score == threshold should still be accepted (>= semantics)
        probs = np.array([0.30, 0.70, 0.0])
        ens = self._build([probs, probs])
        result = ens.predict(np.zeros((200, 200, 3), dtype=np.uint8), (50, 50, 150, 150), threshold=0.7)
        assert result.is_real is True

    def test_one_model_missing_uses_the_other(self):
        # If one ONNX is absent, the ensemble degrades gracefully.
        ens = self._build([
            np.array([0.05, 0.90, 0.05]),
            None,  # this model failed to load → predict returns None
        ])
        result = ens.predict(np.zeros((200, 200, 3), dtype=np.uint8), (50, 50, 150, 150), threshold=0.7)
        assert result is not None
        assert result.is_real is True
        assert len(result.per_model_scores) == 1

    def test_both_models_missing_returns_none(self):
        # No models available → caller should treat as "skip", not "reject"
        ens = self._build([None, None])
        result = ens.predict(np.zeros((200, 200, 3), dtype=np.uint8), (50, 50, 150, 150), threshold=0.7)
        assert result is None


# ---------------------------------------------------------------------------
# is_available
# ---------------------------------------------------------------------------


class TestIsAvailable:
    def test_no_weights_means_unavailable(self):
        ens = AntiSpoofEnsemble("/no/such/file_v1.onnx", "/no/such/file_v2.onnx")
        assert ens.is_available is False
