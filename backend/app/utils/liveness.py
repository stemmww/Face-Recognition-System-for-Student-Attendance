"""Liveness detection: passive landmark analysis + active challenge validation.

Passive check: multi-frame landmark stability analysis.
Active challenges: blink, head turn (left/right), nod — validated via
5-point SCRFD landmarks [left_eye, right_eye, nose, left_mouth, right_mouth].
"""

import enum
import logging
import random

import numpy as np

logger = logging.getLogger(__name__)

_PAIRS = [(i, j) for i in range(5) for j in range(i + 1, 5)]  # 10 pairs


# ---------------------------------------------------------------------------
# Challenge types
# ---------------------------------------------------------------------------

class ChallengeType(str, enum.Enum):
    BLINK = "blink"
    TURN_LEFT = "turn_left"
    TURN_RIGHT = "turn_right"
    NOD = "nod"


_CHALLENGE_INSTRUCTIONS = {
    ChallengeType.BLINK: "Please blink your eyes twice",
    ChallengeType.TURN_LEFT: "Please slowly turn your head to the left",
    ChallengeType.TURN_RIGHT: "Please slowly turn your head to the right",
    ChallengeType.NOD: "Please nod your head up and down",
}


def generate_challenge() -> ChallengeType:
    return random.choice(list(ChallengeType))


def get_challenge_instruction(challenge: ChallengeType) -> str:
    return _CHALLENGE_INSTRUCTIONS[challenge]


# ---------------------------------------------------------------------------
# Passive liveness (existing)
# ---------------------------------------------------------------------------

def compute_liveness_score(landmark_sets: list[np.ndarray]) -> float:
    """Mean variance of IOD-normalised inter-landmark distance ratios."""
    if len(landmark_sets) < 2:
        return 999.0

    all_ratios: list[list[float]] = []
    for lm in landmark_sets:
        iod = float(np.linalg.norm(lm[0] - lm[1]))
        if iod < 5.0:
            continue
        ratios = [
            float(np.linalg.norm(lm[i] - lm[j]) / iod) for i, j in _PAIRS
        ]
        all_ratios.append(ratios)

    if len(all_ratios) < 2:
        return 999.0

    arr = np.array(all_ratios)
    return float(np.mean(np.var(arr, axis=0)))


def is_live(
    landmark_sets: list[np.ndarray], threshold: float = 0.001
) -> tuple[bool, float]:
    """Return (passed, score).  score >= threshold means live."""
    score = compute_liveness_score(landmark_sets)
    passed = score >= threshold
    logger.info(
        "Liveness check — score: %.8f, threshold: %.8f → %s",
        score,
        threshold,
        "PASS" if passed else "FAIL",
    )
    return passed, score


# ---------------------------------------------------------------------------
# Active challenge validators
# ---------------------------------------------------------------------------

def _get_iod(lm: np.ndarray) -> float:
    return float(np.linalg.norm(lm[0] - lm[1]))


def validate_blink(
    landmark_sets: list[np.ndarray], threshold: float = 0.15
) -> bool:
    """Detect blink via eye-to-nose vertical distance ratio changes.

    With 5-point landmarks the classic EAR is not possible, so we track
    the normalised vertical distance from eye midpoint to nose tip.
    A blink causes a dip-and-recovery in this ratio.
    """
    if len(landmark_sets) < 4:
        return False

    ratios: list[float] = []
    for lm in landmark_sets:
        iod = _get_iod(lm)
        if iod < 5.0:
            continue
        eye_mid_y = (lm[0][1] + lm[1][1]) / 2.0
        vert_dist = float(lm[2][1] - eye_mid_y) / iod
        ratios.append(vert_dist)

    if len(ratios) < 4:
        return False

    # Look for dip-and-recovery pattern
    diffs = [ratios[i + 1] - ratios[i] for i in range(len(ratios) - 1)]
    half_thresh = threshold * 0.5
    for i in range(len(diffs) - 1):
        if diffs[i] < -half_thresh and diffs[i + 1] > half_thresh:
            return True

    # Fallback: sufficient variance in the ratios
    return float(np.var(ratios)) > threshold * 0.01


def validate_head_turn(
    landmark_sets: list[np.ndarray],
    direction: str = "left",
    threshold: float = 0.15,
) -> bool:
    """Detect head turn by tracking nose horizontal position relative to eyes."""
    if len(landmark_sets) < 3:
        return False

    nose_offsets: list[float] = []
    for lm in landmark_sets:
        iod = _get_iod(lm)
        if iod < 5.0:
            continue
        eye_mid_x = (lm[0][0] + lm[1][0]) / 2.0
        offset = (lm[2][0] - eye_mid_x) / iod
        nose_offsets.append(offset)

    if len(nose_offsets) < 3:
        return False

    displacement = max(nose_offsets) - min(nose_offsets)
    if displacement < threshold:
        return False

    half = threshold * 0.5
    if direction == "left":
        return max(nose_offsets) > nose_offsets[0] + half
    else:
        return min(nose_offsets) < nose_offsets[0] - half


def validate_nod(
    landmark_sets: list[np.ndarray], threshold: float = 0.1
) -> bool:
    """Detect nod by tracking nose vertical position relative to eyes."""
    if len(landmark_sets) < 3:
        return False

    nose_vert: list[float] = []
    for lm in landmark_sets:
        iod = _get_iod(lm)
        if iod < 5.0:
            continue
        eye_mid_y = (lm[0][1] + lm[1][1]) / 2.0
        offset = (lm[2][1] - eye_mid_y) / iod
        nose_vert.append(offset)

    if len(nose_vert) < 3:
        return False

    return (max(nose_vert) - min(nose_vert)) > threshold


def validate_challenge(
    challenge: ChallengeType,
    landmark_sets: list[np.ndarray],
) -> tuple[bool, str]:
    """Validate that the given liveness challenge was performed."""
    if challenge == ChallengeType.BLINK:
        ok = validate_blink(landmark_sets)
        return ok, "Blink detected" if ok else "No blink detected — please try again"
    elif challenge == ChallengeType.TURN_LEFT:
        ok = validate_head_turn(landmark_sets, direction="left")
        return ok, "Head turn detected" if ok else "Head turn not detected — please try again"
    elif challenge == ChallengeType.TURN_RIGHT:
        ok = validate_head_turn(landmark_sets, direction="right")
        return ok, "Head turn detected" if ok else "Head turn not detected — please try again"
    elif challenge == ChallengeType.NOD:
        ok = validate_nod(landmark_sets)
        return ok, "Nod detected" if ok else "Nod not detected — please try again"
    return False, "Unknown challenge type"
