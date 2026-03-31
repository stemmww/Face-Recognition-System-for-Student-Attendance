import csv
import io
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.rbac import require_role
from app.database import get_db
from app.models.user import Role, User
from app.core.exceptions import BadRequestError
from app.core.security import verify_password, hash_password
from app.schemas.user import BulkImportResult, PasswordChange, UserCreate, UserOut, UserUpdate
from app.services.user_service import UserService

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}

router = APIRouter()


@router.get("", response_model=list[UserOut])
async def list_users(
    role: Role | None = None,
    active_only: bool | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    return await UserService.list_users(db, role, active_only)


@router.post("", response_model=UserOut, status_code=201)
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    return await UserService.create_user(db, body)


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR, Role.STUDENT))):
    return current_user


@router.put("/me/password")
async def change_password(
    body: PasswordChange,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR, Role.STUDENT)),
):
    if not verify_password(body.old_password, current_user.hashed_password):
        raise BadRequestError("Current password is incorrect")
    current_user.hashed_password = hash_password(body.new_password)
    await db.commit()
    return {"message": "Password changed successfully"}


@router.put("/me/photo", response_model=UserOut)
async def upload_profile_photo(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR, Role.STUDENT)),
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise BadRequestError("Only JPEG, PNG, and WebP images are allowed")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise BadRequestError("Image must be smaller than 5 MB")

    # Delete old photo file if it exists
    if current_user.photo_url:
        old_path = Path(settings.UPLOAD_DIR) / current_user.photo_url
        old_path.unlink(missing_ok=True)

    ext = file.content_type.split("/")[-1].replace("jpeg", "jpg")
    filename = f"{current_user.id}_{uuid.uuid4().hex[:8]}.{ext}"
    relative_path = f"profiles/{filename}"
    save_dir = Path(settings.UPLOAD_DIR) / "profiles"
    save_dir.mkdir(parents=True, exist_ok=True)
    (save_dir / filename).write_bytes(content)

    current_user.photo_url = relative_path
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.delete("/me/photo", response_model=UserOut)
async def delete_profile_photo(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR, Role.STUDENT)),
):
    if current_user.photo_url:
        old_path = Path(settings.UPLOAD_DIR) / current_user.photo_url
        old_path.unlink(missing_ok=True)
        current_user.photo_url = None
        await db.commit()
        await db.refresh(current_user)
    return current_user


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    return await UserService.get_user(db, user_id)


@router.put("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    return await UserService.update_user(db, user_id, body)


@router.delete("/{user_id}", status_code=204)
async def deactivate_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    await UserService.deactivate_user(db, user_id)


@router.post("/import-csv", response_model=BulkImportResult)
async def import_students_csv(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    """Bulk import students from a CSV file.

    CSV columns: email, first_name, last_name, password, course_codes
    course_codes is optional and can contain multiple codes separated by commas or semicolons.
    """
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)
    return await UserService.bulk_import_students(db, rows)
