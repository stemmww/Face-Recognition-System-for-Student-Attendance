import csv
import io

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.rbac import require_role
from app.database import get_db
from app.models.user import Role, User
from app.schemas.professor import ProfessorCreate, ProfessorOut, ProfessorUpdate
from app.services.professor_service import ProfessorService

router = APIRouter()


@router.get("", response_model=list[ProfessorOut])
async def list_professors(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await ProfessorService.list_professors(db)


@router.get("/{professor_id}", response_model=ProfessorOut)
async def get_professor(
    professor_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await ProfessorService.get_professor(db, professor_id)


@router.post("", response_model=ProfessorOut, status_code=201)
async def create_professor(
    body: ProfessorCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    return await ProfessorService.create_professor(db, body)


@router.put("/{professor_id}", response_model=ProfessorOut)
async def update_professor(
    professor_id: int,
    body: ProfessorUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    return await ProfessorService.update_professor(db, professor_id, body)


@router.delete("/{professor_id}", status_code=204)
async def delete_professor(
    professor_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    await ProfessorService.delete_professor(db, professor_id)


@router.post("/import/csv", status_code=201)
async def import_professors_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
) -> dict:
    """Import professors from CSV. Required: email, first_name, last_name, password"""
    content = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    created, skipped, errors = 0, 0, []

    for i, row in enumerate(reader, start=2):
        r = {k.strip().lower(): (v or "").strip() for k, v in row.items()}

        email = r.get("email", "")
        first_name = r.get("first_name", "")
        last_name = r.get("last_name", "")
        password = r.get("password", "")

        if not email or not first_name or not last_name:
            errors.append(f"Row {i}: missing first_name, last_name or email")
            skipped += 1
            continue

        if not password:
            errors.append(f"Row {i} ({email}): password is required")
            skipped += 1
            continue

        try:
            data = ProfessorCreate(
                email=email,
                first_name=first_name,
                last_name=last_name,
                password=password,
            )
            await ProfessorService.create_professor(db, data)
            created += 1
        except Exception as e:  # noqa: BLE001
            errors.append(f"Row {i} ({email}): {e}")
            skipped += 1

    return {"created": created, "skipped": skipped, "errors": errors}
