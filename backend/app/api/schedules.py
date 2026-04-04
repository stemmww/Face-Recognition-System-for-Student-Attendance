from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.rbac import require_role
from app.database import get_db
from app.models.user import Role, User
from app.schemas.schedule import ScheduleCreate, ScheduleOut, ScheduleUpdate
from app.services.access_service import AccessService
from app.services.schedule_service import ScheduleService

router = APIRouter()


@router.post("", response_model=ScheduleOut, status_code=201)
async def create_schedule(
    body: ScheduleCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    return await ScheduleService.create_schedule(db, body)


@router.get("", response_model=list[ScheduleOut])
async def list_schedules(
    course_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if course_id is not None:
        await AccessService.ensure_course_access(db, current_user, course_id)

    allowed_course_ids = None
    if current_user.role == Role.PROFESSOR:
        allowed_course_ids = await AccessService.get_professor_course_ids(db, current_user.id)

    return await ScheduleService.list_schedules(
        db,
        course_id,
        allowed_course_ids=allowed_course_ids,
    )


@router.get("/{schedule_id}", response_model=ScheduleOut)
async def get_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await AccessService.ensure_schedule_access(db, current_user, schedule_id)
    return await ScheduleService.get_schedule(db, schedule_id)


@router.put("/{schedule_id}", response_model=ScheduleOut)
async def update_schedule(
    schedule_id: int,
    body: ScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    return await ScheduleService.update_schedule(db, schedule_id, body)


@router.delete("/{schedule_id}", status_code=204)
async def delete_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    await ScheduleService.delete_schedule(db, schedule_id)
