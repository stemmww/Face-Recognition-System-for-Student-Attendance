from pathlib import Path

from pydantic_settings import BaseSettings

# Locate .env: check current dir first, then parent (so running from backend/ or root both work)
_env_candidates = [Path(".env"), Path("../.env")]
_env_file = next((str(p) for p in _env_candidates if p.is_file()), None)


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://app:changeme@localhost:5433/attendance"

    JWT_SECRET_KEY: str = "dev_secret_change_in_production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    AI_MODEL_PATH: str = "./models"
    RECOGNITION_THRESHOLD: float = 0.5
    # Tuned via ROC calibration on LFW (n=500 subjects, 2476 embeddings):
    # AUC=0.988, EER=2.1%. τ=0.22 yields FAR ≤ 0.1% at TAR ≈ 97.9%.
    SELF_RECOGNITION_THRESHOLD: float = 0.22

    # Multi-frame majority voting: a frame "votes yes" when its similarity
    # exceeds SELF_RECOGNITION_THRESHOLD; verification passes when at least
    # this *fraction* of frames agree. A ratio (not absolute count) keeps the
    # security budget constant regardless of how many frames the frontend
    # captures (currently 12). 0.6 ≈ supermajority.
    VOTING_MIN_RATIO: float = 0.6
    # Lower floor on required votes — protects against the ratio collapsing
    # to 1 when only one or two frames survive the quality gate.
    VOTING_MIN_FLOOR: int = 2

    # Anti-spoofing: CNN-based liveness via the MiniFASNet ensemble from
    # Minivision's Silent-Face-Anti-Spoofing project. Set ENABLED=False to
    # fall back to the legacy heuristics only (detect_screen_spoof + replay).
    ANTI_SPOOF_ENABLED: bool = True
    # Minimum live-class probability (averaged across the V1SE + V2 models)
    # to accept the face as real. 0.7 is the authors' recommended balance.
    ANTI_SPOOF_THRESHOLD: float = 0.7

    # --- Face quality gate ---
    # Hard thresholds (reject the photo) and soft thresholds (warn only).
    # Tuned for a typical 720p webcam at ~50 cm distance.
    QUALITY_MIN_FACE_PX: int = 80          # hard: face shorter side in pixels
    QUALITY_SOFT_FACE_PX: int = 120        # soft: ideal minimum size
    QUALITY_MIN_SHARPNESS: float = 30.0    # hard: Laplacian variance below = blurry
    QUALITY_SOFT_SHARPNESS: float = 80.0   # soft: below = mild blur
    QUALITY_MIN_BRIGHTNESS: float = 40.0   # hard: too dark
    QUALITY_MAX_BRIGHTNESS: float = 220.0  # hard: overexposed
    QUALITY_MIN_CONTRAST: float = 20.0     # soft: standard deviation of pixels
    QUALITY_MAX_YAW: float = 0.35          # hard: nose offset / IOD (≈ 30°+)
    QUALITY_SOFT_YAW: float = 0.20         # soft: mild side angle
    QUALITY_MAX_PITCH: float = 0.40        # hard: deviation from template pitch

    UPLOAD_DIR: str = "./uploads"

    QR_TOKEN_EXPIRE_SECONDS: int = 45
    GPS_RADIUS_METERS: int = 200
    LIVENESS_THRESHOLD: float = 0.0008
    LIVENESS_BLINK_THRESHOLD: float = 0.05
    LIVENESS_HEAD_TURN_THRESHOLD: float = 0.07
    LIVENESS_NOD_THRESHOLD: float = 0.05
    LIVENESS_CHALLENGE_STEPS: int = 1
    SCREEN_SPOOF_THRESHOLD: float = 1.0
    VIDEO_REPLAY_THRESHOLD: float = 0.96

    ADMIN_EMAIL: str = "admin@attendance.edu"
    ADMIN_PASSWORD: str = "admin123"

    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@attendance.edu"
    PASSWORD_RESET_EXPIRE_MINUTES: int = 15
    FRONTEND_URL: str = "http://localhost:3000"

    model_config = {"env_file": _env_file, "extra": "ignore"}


settings = Settings()
