"""Unit tests for app.utils.liveness — passive liveness and active challenges."""

import numpy as np
import pytest

from app.utils.liveness import (
    ChallengeType,
    compute_liveness_score,
    generate_challenge,
    generate_challenge_sequence,
    get_challenge_instruction,
    get_challenge_sequence_instruction,
    is_live,
    validate_blink,
    validate_challenge,
    validate_challenge_sequence,
    validate_head_turn,
    validate_nod,
)


def _make_landmarks(
    left_eye=(30, 40),
    right_eye=(70, 40),
    nose=(50, 60),
    left_mouth=(35, 80),
    right_mouth=(65, 80),
) -> np.ndarray:
    """Create a 5-point landmark array."""
    return np.array([left_eye, right_eye, nose, left_mouth, right_mouth], dtype=float)


def _jitter(lm: np.ndarray, amount: float = 1.0) -> np.ndarray:
    """Add random jitter to landmarks (simulates real face movement)."""
    return lm + np.random.uniform(-amount, amount, lm.shape)


# ---------------------------------------------------------------------------
# Passive liveness
# ---------------------------------------------------------------------------


class TestPassiveLiveness:
    def test_single_frame_returns_high_score(self):
        score = compute_liveness_score([_make_landmarks()])
        assert score == 999.0

    def test_identical_frames_zero_variance(self):
        lm = _make_landmarks()
        score = compute_liveness_score([lm, lm, lm])
        assert score == pytest.approx(0.0, abs=1e-10)

    def test_jittered_frames_have_nonzero_score(self):
        base = _make_landmarks()
        frames = [_jitter(base, 2.0) for _ in range(5)]
        score = compute_liveness_score(frames)
        assert score > 0

    def test_is_live_with_moving_face(self):
        base = _make_landmarks()
        frames = [_jitter(base, 3.0) for _ in range(5)]
        passed, score = is_live(frames, threshold=0.0001)
        assert passed

    def test_is_live_fails_with_static_face(self):
        lm = _make_landmarks()
        passed, score = is_live([lm, lm, lm], threshold=0.001)
        assert not passed

    def test_too_small_iod_skipped(self):
        # Eyes very close together — IOD < 5
        lm = _make_landmarks(left_eye=(49, 40), right_eye=(51, 40))
        score = compute_liveness_score([lm, lm])
        assert score == 999.0


# ---------------------------------------------------------------------------
# Challenge generation
# ---------------------------------------------------------------------------


class TestChallengeGeneration:
    def test_generate_returns_valid_type(self):
        for _ in range(20):
            c = generate_challenge()
            assert isinstance(c, ChallengeType)

    def test_generate_sequence_returns_distinct_types(self):
        sequence = generate_challenge_sequence(2)
        assert len(sequence) == 2
        assert len(set(sequence)) == 2

    def test_all_types_have_instructions(self):
        for ct in ChallengeType:
            instr = get_challenge_instruction(ct)
            assert isinstance(instr, str)
            assert len(instr) > 5

    def test_sequence_instruction_mentions_steps(self):
        instr = get_challenge_sequence_instruction(
            [ChallengeType.TURN_LEFT, ChallengeType.NOD]
        )
        assert "Step 1" in instr
        assert "Step 2" in instr


# ---------------------------------------------------------------------------
# Blink validation
# ---------------------------------------------------------------------------


class TestBlinkValidation:
    def test_too_few_frames_fails(self):
        frames = [_make_landmarks() for _ in range(3)]
        assert not validate_blink(frames)

    def test_blink_detected_with_dip_pattern(self):
        """Simulate blink: nose-eye vertical distance dips then recovers."""
        frames = []
        for nose_y in [60, 58, 55, 58, 60]:  # dip at frame 2, recovery at 4
            frames.append(_make_landmarks(nose=(50, nose_y)))
        assert validate_blink(frames, threshold=0.05)

    def test_no_blink_with_static_face(self):
        lm = _make_landmarks()
        assert not validate_blink([lm, lm, lm, lm, lm], threshold=0.1)


# ---------------------------------------------------------------------------
# Head turn validation
# ---------------------------------------------------------------------------


class TestHeadTurnValidation:
    def test_too_few_frames_fails(self):
        frames = [_make_landmarks(), _make_landmarks()]
        assert not validate_head_turn(frames)

    def test_left_turn_detected(self):
        """Simulate head turning left: nose moves right relative to eye midpoint."""
        frames = []
        for nose_x in [50, 55, 60, 62]:
            frames.append(_make_landmarks(nose=(nose_x, 60)))
        assert validate_head_turn(frames, direction="left", threshold=0.1)

    def test_right_turn_detected(self):
        """Simulate head turning right: nose moves left relative to eye midpoint."""
        frames = []
        for nose_x in [50, 45, 40, 38]:
            frames.append(_make_landmarks(nose=(nose_x, 60)))
        assert validate_head_turn(frames, direction="right", threshold=0.1)

    def test_no_turn_with_static_face(self):
        lm = _make_landmarks()
        assert not validate_head_turn([lm, lm, lm, lm], threshold=0.1)


# ---------------------------------------------------------------------------
# Nod validation
# ---------------------------------------------------------------------------


class TestNodValidation:
    def test_too_few_frames_fails(self):
        frames = [_make_landmarks(), _make_landmarks()]
        assert not validate_nod(frames)

    def test_nod_detected(self):
        """Simulate nod: nose moves down then back up."""
        frames = []
        for nose_y in [60, 65, 70, 65, 60]:
            frames.append(_make_landmarks(nose=(50, nose_y)))
        assert validate_nod(frames, threshold=0.05)

    def test_no_nod_with_static_face(self):
        lm = _make_landmarks()
        assert not validate_nod([lm, lm, lm, lm], threshold=0.1)


# ---------------------------------------------------------------------------
# validate_challenge dispatcher
# ---------------------------------------------------------------------------


class TestValidateChallenge:
    def test_blink_dispatches(self):
        frames = [_make_landmarks(nose=(50, ny)) for ny in [60, 58, 55, 58, 60]]
        ok, msg = validate_challenge(ChallengeType.BLINK, frames)
        assert bool(ok) == ok  # works for both bool and np.bool_
        assert isinstance(msg, str)

    def test_turn_left_dispatches(self):
        frames = [_make_landmarks(nose=(nx, 60)) for nx in [50, 55, 60, 62]]
        ok, msg = validate_challenge(ChallengeType.TURN_LEFT, frames)
        assert bool(ok) == ok
        assert isinstance(msg, str)

    def test_turn_right_dispatches(self):
        frames = [_make_landmarks(nose=(nx, 60)) for nx in [50, 45, 40, 38]]
        ok, msg = validate_challenge(ChallengeType.TURN_RIGHT, frames)
        assert bool(ok) == ok
        assert isinstance(msg, str)

    def test_nod_dispatches(self):
        frames = [_make_landmarks(nose=(50, ny)) for ny in [60, 65, 70, 65, 60]]
        ok, msg = validate_challenge(ChallengeType.NOD, frames)
        assert bool(ok) == ok
        assert isinstance(msg, str)


class TestValidateChallengeSequence:
    def test_sequence_passes_when_both_steps_are_present(self):
        turn_frames = [_make_landmarks(nose=(nx, 60)) for nx in [50, 54, 58, 61, 63]]
        nod_frames = [_make_landmarks(nose=(50, ny)) for ny in [60, 64, 68, 64, 60]]
        ok, msg = validate_challenge_sequence(
            [ChallengeType.TURN_LEFT, ChallengeType.NOD],
            turn_frames + nod_frames,
        )
        assert ok
        assert "completed" in msg.lower()

    def test_sequence_fails_when_second_step_is_missing(self):
        turn_frames = [_make_landmarks(nose=(nx, 60)) for nx in [50, 54, 58, 61, 63]]
        ok, msg = validate_challenge_sequence(
            [ChallengeType.TURN_LEFT, ChallengeType.NOD],
            turn_frames + turn_frames,
        )
        assert not ok
        assert "Step 2" in msg
