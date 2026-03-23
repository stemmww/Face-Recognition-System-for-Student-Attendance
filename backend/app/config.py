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

    UPLOAD_DIR: str = "./uploads"

    QR_TOKEN_EXPIRE_SECONDS: int = 45
    GPS_RADIUS_METERS: int = 200
    LIVENESS_THRESHOLD: float = 0.001
    LIVENESS_BLINK_THRESHOLD: float = 0.08
    LIVENESS_HEAD_TURN_THRESHOLD: float = 0.10
    LIVENESS_NOD_THRESHOLD: float = 0.07

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
