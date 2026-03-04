import os
import uuid
from pathlib import Path

from app.config import settings


def save_upload(file_bytes: bytes, filename: str, subfolder: str = "faces") -> str:
    """Save an uploaded file and return its relative path."""
    upload_dir = Path(settings.UPLOAD_DIR) / subfolder
    upload_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(filename).suffix or ".jpg"
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = upload_dir / unique_name

    with open(file_path, "wb") as f:
        f.write(file_bytes)

    return str(file_path)


def delete_file(path: str) -> None:
    """Delete a file if it exists."""
    if os.path.exists(path):
        os.remove(path)
