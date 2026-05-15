"""Unit tests for FaceService.vote_frames — multi-frame majority voting."""

from unittest.mock import AsyncMock

import numpy as np
import pytest

from app.ai.detector import Detection
from app.ai.quality import QualityReport
from app.services.face_service import FaceService, FrameAssessment, VoteResult


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


def _mock_db(self_sims: list[float | None], other_sims: list[float | None] | None = None):
    """Mock AsyncSession.execute that yields self/other similarities in order.

    `vote_frames` makes two queries per frame: first the self-match (same
    user_id), then the impostor match (user_id != target). We yield results
    in that interleaved order. When `other_sims` is None it defaults to
    all-zero (i.e. nobody else enrolled).
    """
    if other_sims is None:
        other_sims = [0.0] * len(self_sims)
    assert len(self_sims) == len(other_sims), "self/other lists must align"

    sequence: list[float | None] = []
    for s, o in zip(self_sims, other_sims, strict=True):
        sequence.append(s)
        sequence.append(o)
    calls = iter(sequence)

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
# Basic voting (no cross-user collisions — margin always satisfied)
# ---------------------------------------------------------------------------


class TestVoteFrames:
    @pytest.mark.asyncio
    async def test_unanimous_pass(self):
        db = _mock_db([0.7, 0.6, 0.65, 0.55, 0.72])
        assessments = [_make_assessment() for _ in range(5)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22,
            min_ratio=0.6, min_floor=2, hard_negative_margin=0.05,
        )
        assert result.passed is True
        assert result.votes == 5
        assert result.total == 5
        assert result.max_similarity == pytest.approx(0.72)

    @pytest.mark.asyncio
    async def test_supermajority_passes_at_60_percent(self):
        db = _mock_db([0.5, 0.6, 0.1, 0.05, 0.4])
        assessments = [_make_assessment() for _ in range(5)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22,
            min_ratio=0.6, min_floor=2, hard_negative_margin=0.05,
        )
        assert result.passed is True
        assert result.votes == 3

    @pytest.mark.asyncio
    async def test_below_ratio_fails(self):
        db = _mock_db([0.5, 0.6, 0.1, 0.05, 0.15])
        assessments = [_make_assessment() for _ in range(5)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22,
            min_ratio=0.6, min_floor=2, hard_negative_margin=0.05,
        )
        assert result.passed is False
        assert result.votes == 2
        assert result.max_similarity == pytest.approx(0.6)

    @pytest.mark.asyncio
    async def test_twelve_frames_scales_with_ratio(self):
        sims = [0.5] * 7 + [0.0] * 5
        db = _mock_db(sims)
        assessments = [_make_assessment() for _ in range(12)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22,
            min_ratio=0.6, min_floor=2, hard_negative_margin=0.05,
        )
        assert result.passed is False
        assert result.votes == 7

        sims = [0.5] * 8 + [0.0] * 4
        db = _mock_db(sims)
        assessments = [_make_assessment() for _ in range(12)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22,
            min_ratio=0.6, min_floor=2, hard_negative_margin=0.05,
        )
        assert result.passed is True
        assert result.votes == 8

    @pytest.mark.asyncio
    async def test_one_bad_frame_outvoted(self):
        db = _mock_db([0.6, 0.65, 0.05, 0.55, 0.7])
        assessments = [_make_assessment() for _ in range(5)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22,
            min_ratio=0.6, min_floor=2, hard_negative_margin=0.05,
        )
        assert result.passed is True
        assert result.votes == 4

    @pytest.mark.asyncio
    async def test_floor_protects_tiny_batches(self):
        db = _mock_db([0.5, 0.05])
        assessments = [_make_assessment() for _ in range(2)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22,
            min_ratio=0.6, min_floor=2, hard_negative_margin=0.05,
        )
        assert result.passed is False
        assert result.votes == 1

    @pytest.mark.asyncio
    async def test_no_stored_embeddings(self):
        # User has no enrolled faces and no other users either —
        # every query returns None → similarity 0
        db = _mock_db([None] * 5, [None] * 5)
        assessments = [_make_assessment() for _ in range(5)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22,
            min_ratio=0.6, min_floor=2, hard_negative_margin=0.05,
        )
        assert result.passed is False
        assert result.votes == 0
        assert result.max_similarity == 0.0

    @pytest.mark.asyncio
    async def test_threshold_exactly_at_boundary(self):
        # similarity == threshold must NOT vote yes (strict >)
        db = _mock_db([0.22, 0.22, 0.22])
        assessments = [_make_assessment() for _ in range(3)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22,
            min_ratio=0.6, min_floor=2, hard_negative_margin=0.05,
        )
        assert result.passed is False
        assert result.votes == 0

    @pytest.mark.asyncio
    async def test_uses_settings_defaults(self):
        db = _mock_db([0.5] * 12)
        assessments = [_make_assessment() for _ in range(12)]
        result = await FaceService.vote_frames(db, assessments, user_id=1)
        assert result.passed is True
        assert result.votes == 12


# ---------------------------------------------------------------------------
# Cross-user hard-negative check
# ---------------------------------------------------------------------------


class TestHardNegativeCheck:
    @pytest.mark.asyncio
    async def test_twin_outscores_self_rejected(self):
        """The look-alike scenario: self sim is OK (above threshold) but a
        different enrolled user matches the frame *more strongly*. Without
        the margin check we'd accept; with it we must reject."""
        self_sims = [0.45] * 5     # above 0.22 threshold
        other_sims = [0.60] * 5    # but somebody else matches better
        db = _mock_db(self_sims, other_sims)
        assessments = [_make_assessment() for _ in range(5)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22,
            min_ratio=0.6, min_floor=2, hard_negative_margin=0.05,
        )
        assert result.passed is False
        assert result.votes == 0
        assert result.hard_negative_rejections == 5

    @pytest.mark.asyncio
    async def test_margin_zero_disables_check(self):
        """With margin=0 the cross-user comparison is skipped; the user
        passes as long as self_sim > threshold even if other_sim is higher."""
        self_sims = [0.45] * 5
        other_sims = [0.60] * 5
        db = _mock_db(self_sims, other_sims)
        assessments = [_make_assessment() for _ in range(5)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22,
            min_ratio=0.6, min_floor=2, hard_negative_margin=0.0,
        )
        # self_sim > other_sim + 0  means self_sim > other_sim strictly.
        # 0.45 > 0.60 is false, so still rejected — but as hard-negative,
        # not as "below threshold".
        assert result.passed is False
        assert result.hard_negative_rejections == 5

    @pytest.mark.asyncio
    async def test_self_clearly_wins_passes(self):
        # Self 0.6, other 0.4, margin 0.05 → 0.6 > 0.45 → accept
        self_sims = [0.6] * 5
        other_sims = [0.4] * 5
        db = _mock_db(self_sims, other_sims)
        assessments = [_make_assessment() for _ in range(5)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22,
            min_ratio=0.6, min_floor=2, hard_negative_margin=0.05,
        )
        assert result.passed is True
        assert result.votes == 5
        assert result.hard_negative_rejections == 0

    @pytest.mark.asyncio
    async def test_margin_boundary_strict_inequality(self):
        # self_sim exactly == other_sim + margin → does NOT pass (strict >)
        self_sims = [0.50] * 5     # 0.50
        other_sims = [0.45] * 5    # 0.45 + 0.05 = 0.50 — equal to self
        db = _mock_db(self_sims, other_sims)
        assessments = [_make_assessment() for _ in range(5)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22,
            min_ratio=0.6, min_floor=2, hard_negative_margin=0.05,
        )
        assert result.passed is False
        assert result.hard_negative_rejections == 5

    @pytest.mark.asyncio
    async def test_no_other_users_enrolled_collapses_check(self):
        """When the DB has no impostors (other_sim = 0 from None row), the
        margin check effectively becomes self_sim > 0 + margin, which
        evaluates to true for any reasonable self_sim. New deployments with
        one enrolled student must still work."""
        self_sims = [0.4] * 5
        other_sims = [None] * 5    # no other users in DB
        db = _mock_db(self_sims, other_sims)
        assessments = [_make_assessment() for _ in range(5)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22,
            min_ratio=0.6, min_floor=2, hard_negative_margin=0.05,
        )
        assert result.passed is True
        assert result.votes == 5
        assert result.hard_negative_rejections == 0

    @pytest.mark.asyncio
    async def test_mixed_per_frame_decisions(self):
        # Frame 1: self wins clearly        → vote yes
        # Frame 2: tie within margin        → hard-neg rejection
        # Frame 3: self wins clearly        → vote yes
        # Frame 4: below threshold          → reject (no margin issue)
        # Frame 5: tie within margin        → hard-neg rejection
        self_sims = [0.7, 0.5, 0.65, 0.10, 0.4]
        other_sims = [0.3, 0.5, 0.4, 0.05, 0.42]
        db = _mock_db(self_sims, other_sims)
        assessments = [_make_assessment() for _ in range(5)]
        result = await FaceService.vote_frames(
            db, assessments, user_id=1, threshold=0.22,
            min_ratio=0.6, min_floor=2, hard_negative_margin=0.05,
        )
        assert result.votes == 2                    # frames 1 + 3
        assert result.hard_negative_rejections == 2  # frames 2 + 5
        assert result.passed is False               # 2 < 3 required


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
            other_similarities=[0.1, 0.2, 0.0, 0.05, 0.0],
            max_similarity=0.6,
            hard_negative_rejections=0,
        )
        assert r.passed
        assert r.votes == 3
        assert r.total == 5
        assert r.threshold == 0.22
        assert r.similarities == [0.5, 0.6, 0.4, 0.1, 0.3]
        assert r.other_similarities == [0.1, 0.2, 0.0, 0.05, 0.0]
        assert r.max_similarity == 0.6
        assert r.hard_negative_rejections == 0
