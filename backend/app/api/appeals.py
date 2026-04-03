import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_role
from app.database import get_db
from app.models.appeal import AppealStatus
from app.models.user import Role, User
from app.schemas.appeal import AppealCreate, AppealOut, AppealReview
from app.services.appeal_service import AppealService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("", response_model=AppealOut, status_code=201)
async def create_appeal(
    body: AppealCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.STUDENT)),
):
    return await AppealService.create_appeal(
        db, current_user.id, body.attendance_id, body.reason
    )


@router.get("/me", response_model=list[AppealOut])
async def get_my_appeals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.STUDENT)),
):
    return await AppealService.list_my_appeals(db, current_user.id)


@router.get("", response_model=list[AppealOut])
async def list_appeals(
    status: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR)),
):
    parsed_status = None
    if status is not None:
        try:
            parsed_status = AppealStatus(status)
        except ValueError:
            logger.debug("Invalid appeal status filter: %s", status)
    return await AppealService.list_appeals(db, parsed_status)


@router.patch("/{appeal_id}", response_model=AppealOut)
async def review_appeal(
    appeal_id: int,
    body: AppealReview,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR)),
):
    return await AppealService.review_appeal(db, appeal_id, body.status, current_user.id)
