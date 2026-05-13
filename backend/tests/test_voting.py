"""Unit tests for FaceService.vote_frames — multi-frame majority voting."""

from unittest.mock import AsyncMock

import numpy as np
import pytest

from app.ai.detector import Detection
from app.ai.quality import QualityReport
from app.services.face_service import FrameAssessment, FaceService, VoteResult


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_assessment(embedding: np.ndarray | None = None) -> FrameAssessment:
    if embedding is None:
        embedding = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    det = Detection(
        bbox=(0, 0, 200, 200),
        confidence=0.95,
        landmarks=np.zeros((5, 2), dtype=float),
    )
    quality = QualityReport(passed=True, issues=[], metrics={"sharpness": 100.0})
    return FrameAssessment(
        image=np.zeros((100, 100, 3), dtype=np.uint8),
        detection=det,
        quality=quality,
        embedding=embedding,
    )


def _mock_db_returning(similarities: list[float]):
    """Build a fake AsyncSession.execute that yields the given similarities
    in order, one per call. Each call returns an object with .fetchone()."""
    calls = iter(similarities)

    class _Row:
        def __init__(self, sim):
            self._sim = sim

        def __getitem__(self, idx):
            assert idx == 0
            return self._sim

    class _Result:
        def __init__(self, sim):
            self._sim = sim

        def fetchone(self):
            return _Row(self._sim) if self._sim is not None else None

    async def _execute(_query, _params):
        return _Result(next(calls))

    db = AsyncMock()
    db.execute = _execute
    return db


# ---------------------------------------------------------------------------
# Voting outcomes
# ---------------------------------------------------------------------------


class TestVoteFrames:
    @pytest.mark.asyncio
    async def test_unanimous_pass(self):
        # 5 frames, all above the 0.22 threshold → unanimous accept
        db = _mock_db_returning([0.7, 0.6, 0.65, 0.55, 0.72])
        assessments = [_make_assessment() for _ in range(5)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22,
            min_ratio=0.6, min_floor=2,
        )
        assert result.passed is True
        assert result.votes == 5
        assert result.total == 5
        assert result.max_similarity == pytest.approx(0.72)

    @pytest.mark.asyncio
    async def test_supermajority_passes_at_60_percent(self):
        # 3 of 5 = 60% — ceil(0.6 * 5) = 3 → exactly meets threshold
        db = _mock_db_returning([0.5, 0.6, 0.1, 0.05, 0.4])
        assessments = [_make_assessment() for _ in range(5)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22,
            min_ratio=0.6, min_floor=2,
        )
        assert result.passed is True
        assert result.votes == 3

    @pytest.mark.asyncio
    async def test_below_ratio_fails(self):
        # 2 of 5 = 40% < required 60% → reject
        db = _mock_db_returning([0.5, 0.6, 0.1, 0.05, 0.15])
        assessments = [_make_assessment() for _ in range(5)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22,
            min_ratio=0.6, min_floor=2,
        )
        assert result.passed is False
        assert result.votes == 2
        assert result.max_similarity == pytest.approx(0.6)

    @pytest.mark.asyncio
    async def test_twelve_frames_scales_with_ratio(self):
        """Critical: with 12 frames (current frontend), 60 % = 8 required.

        Old absolute-count voting accepted 3/12 (25 %) which is unsafe.
        The ratio formulation keeps the security budget constant.
        """
        # 7 yes / 5 no = below 8 required → reject
        sims = [0.5] * 7 + [0.0] * 5
        db = _mock_db_returning(sims)
        assessments = [_make_assessment() for _ in range(12)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22,
            min_ratio=0.6, min_floor=2,
        )
        assert result.passed is False
        assert result.votes == 7

        # 8 yes / 4 no = meets 60 % → accept
        sims = [0.5] * 8 + [0.0] * 4
        db = _mock_db_returning(sims)
        assessments = [_make_assessment() for _ in range(12)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22,
            min_ratio=0.6, min_floor=2,
        )
        assert result.passed is True
        assert result.votes == 8

    @pytest.mark.asyncio
    async def test_one_bad_frame_outvoted(self):
        """Core win of voting: one shaky frame loses to the rest.

        With averaging, a single low-similarity frame drags the mean toward
        the threshold. Voting outvotes it directly.
        """
        db = _mock_db_returning([0.6, 0.65, 0.05, 0.55, 0.7])
        assessments = [_make_assessment() for _ in range(5)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22,
            min_ratio=0.6, min_floor=2,
        )
        assert result.passed is True
        assert result.votes == 4

    @pytest.mark.asyncio
    async def test_floor_protects_tiny_batches(self):
        """Two frames: ceil(0.6 * 2) = 2, floor 2 — must be unanimous."""
        db = _mock_db_returning([0.5, 0.05])
        assessments = [_make_assessment() for _ in range(2)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22,
            min_ratio=0.6, min_floor=2,
        )
        # 1 of 2 passed but floor is 2 → reject
        assert result.passed is False
        assert result.votes == 1

    @pytest.mark.asyncio
    async def test_no_stored_embeddings(self):
        # User has no enrolled faces — every DB query returns None → similarity 0
        db = _mock_db_returning([None] * 5)
        assessments = [_make_assessment() for _ in range(5)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22,
            min_ratio=0.6, min_floor=2,
        )
        assert result.passed is False
        assert result.votes == 0
        assert result.max_similarity == 0.0
        assert all(s == 0.0 for s in result.similarities)

    @pytest.mark.asyncio
    async def test_threshold_exactly_at_boundary(self):
        # similarity == threshold should NOT vote yes (strict >)
        db = _mock_db_returning([0.22, 0.22, 0.22])
        assessments = [_make_assessment() for _ in range(3)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22,
            min_ratio=0.6, min_floor=2,
        )
        assert result.passed is False
        assert result.votes == 0

    @pytest.mark.asyncio
    async def test_uses_settings_defaults(self):
        # When threshold/ratio/floor not passed, falls back to app settings
        db = _mock_db_returning([0.5] * 12)
        assessments = [_make_assessment() for _ in range(12)]
        result = await FaceService.vote_frames(db, assessments, user_id=1)
        # All 12 above 0.22, well above 60 % required → pass
        assert result.passed is True
        assert result.votes == 12


# ---------------------------------------------------------------------------
# VoteResult shape
# ---------------------------------------------------------------------------


class TestVoteResult:
    def test_fields_present(self):
        r = VoteResult(
            passed=True,
            votes=3,
            total=5,
            threshold=0.22,
            similarities=[0.5, 0.6, 0.4, 0.1, 0.3],
            max_similarity=0.6,
        )
        assert r.passed
        assert r.votes == 3
        assert r.total == 5
        assert r.threshold == 0.22
        assert r.similarities == [0.5, 0.6, 0.4, 0.1, 0.3]
        assert r.max_similarity == 0.6
