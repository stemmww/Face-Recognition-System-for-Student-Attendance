from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_role
from app.database import get_db
from app.models.user import Role, User
from app.schemas.statistics import CourseStatistics, SessionTrendPoint, StudentTrendPoint
from app.services.statistics_service import StatisticsService

router = APIRouter()


@router.get("/course/{course_id}", response_model=CourseStatistics)
async def get_course_statistics(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR)),
):
    return await StatisticsService.get_course_statistics(db, course_id)


@router.get("/course/{course_id}/trends", response_model=list[SessionTrendPoint])
async def get_course_trends(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR)),
):
    return await StatisticsService.get_course_trends(db, course_id)


@router.get("/student/me/trends", response_model=list[StudentTrendPoint])
async def get_student_trends(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.STUDENT)),
):
    return await StatisticsService.get_student_trends(db, current_user.id)
