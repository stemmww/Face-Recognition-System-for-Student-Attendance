"""Liveness detection: passive landmark analysis + active challenge validation
+ screen/print spoof detection.

Passive check: multi-frame landmark stability analysis.
Active challenges: blink, head turn (left/right), nod — validated via
5-point SCRFD landmarks [left_eye, right_eye, nose, left_mouth, right_mouth].
Screen detection: high-frequency texture analysis (moire patterns, pixel grids).
"""

import enum
import logging
import random

import cv2
import numpy as np

from app.config import settings

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


def generate_challenge_sequence(step_count: int = 2) -> list[ChallengeType]:
    choices = list(ChallengeType)
    if step_count <= 1:
        return [generate_challenge()]
    return random.sample(choices, k=min(step_count, len(choices)))


def get_challenge_instruction(challenge: ChallengeType) -> str:
    return _CHALLENGE_INSTRUCTIONS[challenge]


def get_challenge_sequence_instruction(challenges: list[ChallengeType]) -> str:
    if not challenges:
        return "Please follow the liveness instructions shown on screen"
    if len(challenges) == 1:
        return get_challenge_instruction(challenges[0])

    parts = [
        f"Step {index + 1}: {_CHALLENGE_INSTRUCTIONS[challenge]}"
        for index, challenge in enumerate(challenges)
    ]
    return "Complete these actions in order. " + " Then ".join(parts)


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
    landmark_sets: list[np.ndarray], threshold: float | None = None,
) -> bool:
    """Detect blink via eye-to-nose vertical distance ratio changes.

    With 5-point landmarks the classic EAR is not possible, so we track
    the normalised vertical distance from eye midpoint to nose tip.
    A blink causes a dip-and-recovery in this ratio.
    """
    if threshold is None:
        threshold = settings.LIVENESS_BLINK_THRESHOLD
    if len(landmark_sets) < 3:
        return False

    ratios: list[float] = []
    for lm in landmark_sets:
        iod = _get_iod(lm)
        if iod < 5.0:
            continue
        eye_mid_y = (lm[0][1] + lm[1][1]) / 2.0
        vert_dist = float(lm[2][1] - eye_mid_y) / iod
        ratios.append(vert_dist)

    if len(ratios) < 3:
        return False

    # Look for dip-and-recovery pattern
    diffs = [ratios[i + 1] - ratios[i] for i in range(len(ratios) - 1)]
    half_thresh = threshold * 0.4
    for i in range(len(diffs) - 1):
        if diffs[i] < -half_thresh and diffs[i + 1] > half_thresh:
            return True

    # Fallback: sufficient variance in the ratios (any eye movement)
    return float(np.var(ratios)) > threshold * 0.005


def validate_head_turn(
    landmark_sets: list[np.ndarray],
    direction: str = "left",
    threshold: float | None = None,
) -> bool:
    """Detect head turn by tracking nose horizontal position relative to eyes."""
    if threshold is None:
        threshold = settings.LIVENESS_HEAD_TURN_THRESHOLD
    if len(landmark_sets) < 2:
        return False

    nose_offsets: list[float] = []
    for lm in landmark_sets:
        iod = _get_iod(lm)
        if iod < 5.0:
            continue
        eye_mid_x = (lm[0][0] + lm[1][0]) / 2.0
        offset = (lm[2][0] - eye_mid_x) / iod
        nose_offsets.append(offset)

    if len(nose_offsets) < 2:
        return False

    displacement = max(nose_offsets) - min(nose_offsets)
    if displacement < threshold:
        return False

    half = threshold * 0.4
    if direction == "left":
        return bool(max(nose_offsets) > nose_offsets[0] + half)
    else:
        return bool(min(nose_offsets) < nose_offsets[0] - half)


def validate_nod(
    landmark_sets: list[np.ndarray], threshold: float | None = None,
) -> bool:
    """Detect nod by tracking nose vertical position relative to eyes."""
    if threshold is None:
        threshold = settings.LIVENESS_NOD_THRESHOLD
    if len(landmark_sets) < 2:
        return False

    nose_vert: list[float] = []
    for lm in landmark_sets:
        iod = _get_iod(lm)
        if iod < 5.0:
            continue
        eye_mid_y = (lm[0][1] + lm[1][1]) / 2.0
        offset = (lm[2][1] - eye_mid_y) / iod
        nose_vert.append(offset)

    if len(nose_vert) < 2:
        return False

    return bool((max(nose_vert) - min(nose_vert)) > threshold)


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


def validate_challenge_sequence(
    challenges: list[ChallengeType],
    landmark_sets: list[np.ndarray],
) -> tuple[bool, str]:
    """Validate a short ordered sequence of liveness challenges."""
    if not challenges:
        return False, "No liveness challenge provided"
    if len(challenges) == 1:
        return validate_challenge(challenges[0], landmark_sets)

    segment_size = max(3, len(landmark_sets) // len(challenges))
    for index, challenge in enumerate(challenges):
        start = max(0, index * segment_size - (1 if index > 0 else 0))
        end = len(landmark_sets) if index == len(challenges) - 1 else min(
            len(landmark_sets), (index + 1) * segment_size + 1,
        )
        ok, reason = validate_challenge(challenge, landmark_sets[start:end])
        if not ok:
            return False, f"Step {index + 1} failed: {reason}"
    return True, "Challenge sequence completed"


# ---------------------------------------------------------------------------
# Screen / print spoof detection
# ---------------------------------------------------------------------------

def detect_screen_spoof(
    face_crop: np.ndarray,
    threshold: float | None = None,
) -> tuple[bool, float]:
    """Detect whether a face image is captured from a screen or printed photo.

    Uses high-frequency energy analysis in the face region:
    - Screens emit moire patterns and pixel grids that create abnormal
      high-frequency energy compared to real skin.
    - Printed photos show halftone dot patterns with similar characteristics.

    The Laplacian operator highlights edges and high-freq texture. We compute
    the ratio of high-frequency energy to total energy in the frequency domain
    of the Laplacian-filtered face crop. A real face has mostly low-frequency
    (smooth skin), while screens/prints have elevated high-freq content.

    Returns (is_real, score). Higher score = more high-freq content = more
    likely a spoof. is_real is True when score < threshold.
    """
    if threshold is None:
        threshold = settings.SCREEN_SPOOF_THRESHOLD

    # Convert to grayscale and resize to standard size
    if len(face_crop.shape) == 3:
        gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
    else:
        gray = face_crop
    gray = cv2.resize(gray, (128, 128))

    # Method 1: Laplacian variance (screens/prints have sharper micro-edges)
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    lap_var = float(laplacian.var())

    # Method 2: High-frequency energy ratio via DCT
    gray_f = gray.astype(np.float32)
    dct = cv2.dct(gray_f)
    total_energy = float(np.sum(dct ** 2)) + 1e-8
    # High-freq = bottom-right quadrant of DCT
    h, w = dct.shape
    hf_energy = float(np.sum(dct[h // 2:, w // 2:] ** 2))
    hf_ratio = hf_energy / total_energy

    # Method 3: Color channel correlation (screens have highly correlated RGB)
    color_score = 0.0
    if len(face_crop.shape) == 3 and face_crop.shape[2] == 3:
        b, g, r = cv2.split(face_crop.astype(np.float32))
        b_flat, g_flat, r_flat = b.flatten(), g.flatten(), r.flatten()
        rg_corr = float(np.corrcoef(r_flat, g_flat)[0, 1])
        rb_corr = float(np.corrcoef(r_flat, b_flat)[0, 1])
        # Real skin has moderate channel correlation; screens have very high
        avg_corr = (abs(rg_corr) + abs(rb_corr)) / 2.0
        # Score contribution: high correlation -> more likely screen
        color_score = max(0.0, avg_corr - 0.85) * 10  # 0 for natural, up to ~1.5 for screens

    # Combined score (weighted)
    # Normalize lap_var: typical real face ~50-200, screen ~300-1000+
    lap_score = min(lap_var / 500.0, 2.0)
    score = 0.4 * lap_score + 0.4 * (hf_ratio * 20) + 0.2 * color_score

    is_real = score < threshold
    logger.info(
        "Screen spoof check — lap_var: %.1f, hf_ratio: %.4f, color: %.3f, "
        "combined: %.4f, threshold: %.4f → %s",
        lap_var, hf_ratio, color_score, score, threshold, "REAL" if is_real else "SPOOF",
    )
    return is_real, score


def _extract_texture_descriptor(gray_128: np.ndarray) -> np.ndarray:
    """Extract a compact high-frequency texture descriptor from a 128x128 grayscale face.

    Uses a band-pass filter (Laplacian of Gaussian) to isolate micro-texture,
    then divides the face into a grid and computes local energy in each cell.
    The resulting vector captures the spatial distribution of fine texture.
    """
    # Band-pass: blur slightly then Laplacian to get mid-high freq texture
    blurred = cv2.GaussianBlur(gray_128, (3, 3), 0.8)
    texture = cv2.Laplacian(blurred, cv2.CV_64F)

    # Divide into 8x8 grid and compute energy per cell
    cell_size = 16  # 128 / 8 = 16
    descriptor = []
    for row in range(0, 128, cell_size):
        for col in range(0, 128, cell_size):
            cell = texture[row:row + cell_size, col:col + cell_size]
            descriptor.append(float(np.mean(cell ** 2)))
    return np.array(descriptor, dtype=np.float64)


def detect_video_replay(
    face_crops: list[np.ndarray],
    threshold: float | None = None,
) -> tuple[bool, float]:
    """Detect video replay attacks via micro-texture temporal analysis.

    Real skin: as the face moves between frames, micro-texture (pores, fine
    wrinkles) shifts naturally, causing the texture descriptor to vary
    significantly across frames.

    Screen replay: the underlying pixel grid is static — even when the
    displayed face moves, the captured micro-texture pattern from the screen
    stays suspiciously consistent because the webcam re-samples the same
    pixel grid each frame.

    Computes pairwise cosine similarity of texture descriptors across frames.
    Real faces show lower similarity (more variation); screens show higher
    similarity (static pixel grid).

    Returns (is_real, avg_similarity). is_real is True when avg_similarity
    is below the threshold (enough texture variation detected).
    """
    if threshold is None:
        threshold = settings.VIDEO_REPLAY_THRESHOLD

    if len(face_crops) < 3:
        # Not enough frames for reliable analysis — assume real
        return True, 0.0

    # Extract texture descriptors from each frame
    descriptors = []
    for crop in face_crops:
        if len(crop.shape) == 3:
            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        else:
            gray = crop
        gray = cv2.resize(gray, (128, 128))
        descriptors.append(_extract_texture_descriptor(gray))

    # Compute pairwise cosine similarity between consecutive frames
    similarities = []
    for i in range(len(descriptors) - 1):
        a, b = descriptors[i], descriptors[i + 1]
        norm_a, norm_b = np.linalg.norm(a), np.linalg.norm(b)
        if norm_a < 1e-8 or norm_b < 1e-8:
            continue
        sim = float(np.dot(a, b) / (norm_a * norm_b))
        similarities.append(sim)

    if not similarities:
        return True, 0.0

    avg_sim = float(np.mean(similarities))

    # Also check non-consecutive pairs for extra signal
    if len(descriptors) >= 4:
        skip_sims = []
        for i in range(len(descriptors) - 2):
            a, b = descriptors[i], descriptors[i + 2]
            norm_a, norm_b = np.linalg.norm(a), np.linalg.norm(b)
            if norm_a < 1e-8 or norm_b < 1e-8:
                continue
            skip_sims.append(float(np.dot(a, b) / (norm_a * norm_b)))
        if skip_sims:
            # Screens stay consistent even with larger frame gaps
            avg_sim = max(avg_sim, float(np.mean(skip_sims)))

    is_real = avg_sim < threshold
    logger.info(
        "Video replay check — avg_texture_similarity: %.4f, threshold: %.4f → %s",
        avg_sim, threshold, "REAL" if is_real else "REPLAY",
    )
    return is_real, avg_sim
