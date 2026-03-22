import csv
import io

from fastapi import APIRouter, Depends, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_role
from app.database import get_db
from app.models.user import Role, User
from app.schemas.user import BulkImportResult, UserCreate, UserOut, UserUpdate
from app.services.user_service import UserService

router = APIRouter()


@router.get("", response_model=list[UserOut])
async def list_users(
    role: Role | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    return await UserService.list_users(db, role)


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
