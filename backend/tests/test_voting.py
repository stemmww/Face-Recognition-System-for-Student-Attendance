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
    async def test_all_frames_pass(self):
        # 5 frames, all above the 0.22 threshold → unanimous accept
        db = _mock_db_returning([0.7, 0.6, 0.65, 0.55, 0.72])
        assessments = [_make_assessment() for _ in range(5)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22, min_votes=3,
        )
        assert result.passed is True
        assert result.votes == 5
        assert result.total == 5
        assert result.max_similarity == pytest.approx(0.72)

    @pytest.mark.asyncio
    async def test_majority_passes(self):
        # 3 of 5 above threshold — exactly meets min_votes=3
        db = _mock_db_returning([0.5, 0.6, 0.1, 0.05, 0.4])
        assessments = [_make_assessment() for _ in range(5)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22, min_votes=3,
        )
        assert result.passed is True
        assert result.votes == 3

    @pytest.mark.asyncio
    async def test_minority_fails(self):
        # Only 2 of 5 — below min_votes=3, reject
        db = _mock_db_returning([0.5, 0.6, 0.1, 0.05, 0.15])
        assessments = [_make_assessment() for _ in range(5)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22, min_votes=3,
        )
        assert result.passed is False
        assert result.votes == 2
        # max_similarity still returned even on fail, for diagnostics
        assert result.max_similarity == pytest.approx(0.6)

    @pytest.mark.asyncio
    async def test_one_bad_frame_outvoted(self):
        """Core win: 4 good frames overrule 1 noisy frame.

        With old averaging, a single low-similarity frame would drag the mean
        toward the threshold. Voting outvotes it directly.
        """
        db = _mock_db_returning([0.6, 0.65, 0.05, 0.55, 0.7])
        assessments = [_make_assessment() for _ in range(5)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22, min_votes=3,
        )
        assert result.passed is True
        assert result.votes == 4

    @pytest.mark.asyncio
    async def test_few_frames_min_votes_capped(self):
        # User submitted only 2 frames; demanding 3 votes would be impossible.
        # min_votes should cap at len(assessments).
        db = _mock_db_returning([0.5, 0.6])
        assessments = [_make_assessment() for _ in range(2)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22, min_votes=3,
        )
        assert result.passed is True  # both passed, cap=2, votes=2
        assert result.votes == 2

    @pytest.mark.asyncio
    async def test_no_stored_embeddings(self):
        # User has no enrolled faces — every DB query returns None → similarity 0
        db = _mock_db_returning([None, None, None, None, None])
        assessments = [_make_assessment() for _ in range(5)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22, min_votes=3,
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
            db, assessments, user_id=1, threshold=0.22, min_votes=2,
        )
        assert result.passed is False
        assert result.votes == 0

    @pytest.mark.asyncio
    async def test_uses_settings_defaults(self):
        # When threshold/min_votes not passed, falls back to app settings
        db = _mock_db_returning([0.5, 0.5, 0.5])
        assessments = [_make_assessment() for _ in range(3)]
        result = await FaceService.vote_frames(db, assessments, user_id=1)
        # Default SELF_RECOGNITION_THRESHOLD = 0.22, all 0.5 should pass
        assert result.passed is True
        assert result.votes == 3


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
