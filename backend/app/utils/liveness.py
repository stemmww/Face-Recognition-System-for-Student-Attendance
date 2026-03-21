"""Passive liveness detection via multi-frame landmark stability.

A flat photo (on a screen or printed) only undergoes rigid 2D motion,
so IOD-normalised inter-landmark distance ratios stay constant.  A real
3D face produces non-rigid variation from parallax, micro-expressions,
and breathing — raising the ratio variance above a threshold.
"""

import logging

import numpy as np

logger = logging.getLogger(__name__)

_PAIRS = [(i, j) for i in range(5) for j in range(i + 1, 5)]  # 10 pairs


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

    arr = np.array(all_ratios)  # (n_frames, 10)
    return float(np.mean(np.var(arr, axis=0)))


def is_live(
    landmark_sets: list[np.ndarray], threshold: float = 0.0001
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
