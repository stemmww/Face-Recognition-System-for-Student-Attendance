from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.exceptions import NotFoundError
from app.core.rbac import require_role
from app.database import get_db
from app.models.professor_availability import ProfessorAvailability
from app.models.user import Role, User
from app.schemas.professor_availability import AvailabilityCreate, AvailabilityOut

router = APIRouter()


@router.get("", response_model=list[AvailabilityOut])
async def get_my_availability(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.PROFESSOR)),
):
    result = await db.execute(
        select(ProfessorAvailability)
        .where(ProfessorAvailability.professor_id == current_user.id)
        .order_by(ProfessorAvailability.day_of_week, ProfessorAvailability.start_time)
    )
    return result.scalars().all()


@router.get("/professor/{professor_id}", response_model=list[AvailabilityOut])
async def get_professor_availability(
    professor_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    result = await db.execute(
        select(ProfessorAvailability)
        .where(ProfessorAvailability.professor_id == professor_id)
        .order_by(ProfessorAvailability.day_of_week, ProfessorAvailability.start_time)
    )
    return result.scalars().all()


@router.post("", response_model=AvailabilityOut, status_code=201)
async def add_availability_slot(
    body: AvailabilityCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.PROFESSOR)),
):
    slot = ProfessorAvailability(
        professor_id=current_user.id,
        day_of_week=body.day_of_week,
        start_time=body.start_time,
        end_time=body.end_time,
    )
    db.add(slot)
    await db.commit()
    await db.refresh(slot)
    return slot


@router.delete("/{slot_id}", status_code=204)
async def delete_availability_slot(
    slot_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.PROFESSOR)),
):
    result = await db.execute(
        select(ProfessorAvailability).where(
            ProfessorAvailability.id == slot_id,
            ProfessorAvailability.professor_id == current_user.id,
        )
    )
    slot = result.scalar_one_or_none()
    if slot is None:
        raise NotFoundError("Availability slot")
    await db.delete(slot)
    await db.commit()
