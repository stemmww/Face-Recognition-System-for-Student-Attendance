import csv
import io

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.rbac import require_role
from app.database import get_db
from app.models.user import Role, User
from app.schemas.classroom import ClassroomCreate, ClassroomOut, ClassroomUpdate
from app.services.classroom_service import ClassroomService

router = APIRouter()


@router.post("", response_model=ClassroomOut, status_code=201)
async def create_classroom(
    body: ClassroomCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    return await ClassroomService.create(db, body)


@router.get("", response_model=list[ClassroomOut])
async def list_classrooms(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await ClassroomService.list(db, active_only=active_only)


@router.get("/{classroom_id}", response_model=ClassroomOut)
async def get_classroom(
    classroom_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await ClassroomService.get(db, classroom_id)


@router.put("/{classroom_id}", response_model=ClassroomOut)
async def update_classroom(
    classroom_id: int,
    body: ClassroomUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    return await ClassroomService.update(db, classroom_id, body)


@router.delete("/{classroom_id}", status_code=204)
async def delete_classroom(
    classroom_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    await ClassroomService.delete(db, classroom_id)


@router.post("/import/csv", status_code=201)
async def import_classrooms_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
) -> dict:
    """
    Import classrooms from CSV.
    Required columns: name
    Optional: capacity, is_active
    name format: C1.1.101L (auto-parsed for block/floor/room_number/room_type)
    """
    content = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    created, skipped, errors = 0, 0, []

    for i, row in enumerate(reader, start=2):
        r = {k.strip().lower(): (v or "").strip() for k, v in row.items()}
        name = r.get("name", "")
        if not name:
            errors.append(f"Row {i}: missing name")
            skipped += 1
            continue

        capacity_raw = r.get("capacity", "")
        capacity = int(capacity_raw) if capacity_raw.isdigit() else None

        is_active_raw = r.get("is_active", "true").lower()
        is_active = is_active_raw not in ("false", "0", "no")

        try:
            data = ClassroomCreate(name=name, capacity=capacity, is_active=is_active)
            await ClassroomService.create(db, data)
            created += 1
        except Exception as e:
            errors.append(f"Row {i} ({name}): {e}")
            skipped += 1

    return {"created": created, "skipped": skipped, "errors": errors}
