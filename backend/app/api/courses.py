from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.rbac import require_role
from app.database import get_db
from app.models.user import Role, User
from app.schemas.course import CourseCreate, CourseOut, CourseUpdate, EnrollmentRequest, ProfessorAssignRequest
from app.schemas.user import UserOut
from app.services.access_service import AccessService
from app.services.course_service import CourseService

router = APIRouter()


@router.post("", response_model=CourseOut, status_code=201)
async def create_course(
    body: CourseCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    return await CourseService.create_course(db, body)


@router.get("", response_model=list[CourseOut])
async def list_courses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await CourseService.list_courses(db, current_user)


@router.get("/{course_id}", response_model=CourseOut)
async def get_course(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await AccessService.ensure_course_access(db, current_user, course_id)
    return await CourseService.get_course(db, course_id)


@router.put("/{course_id}", response_model=CourseOut)
async def update_course(
    course_id: int,
    body: CourseUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    return await CourseService.update_course(db, course_id, body)


@router.delete("/{course_id}", status_code=204)
async def delete_course(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    await CourseService.delete_course(db, course_id)


# --- Professor assignment ---

@router.get("/{course_id}/professors", response_model=list[UserOut])
async def list_professors(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR)),
):
    await AccessService.ensure_course_access(db, current_user, course_id)
    return await CourseService.get_professors(db, course_id)


@router.post("/{course_id}/professors", status_code=204)
async def assign_professors(
    course_id: int,
    body: ProfessorAssignRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    await CourseService.assign_professors(db, course_id, body.professor_ids)


@router.delete("/{course_id}/professors/{professor_id}", status_code=204)
async def remove_professor(
    course_id: int,
    professor_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    await CourseService.remove_professor(db, course_id, professor_id)


# --- Student enrollment ---

@router.get("/{course_id}/students", response_model=list[UserOut])
async def list_enrolled_students(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.ADMIN, Role.PROFESSOR)),
):
    await AccessService.ensure_course_access(db, current_user, course_id)
    return await CourseService.get_enrolled_students(db, course_id)


@router.post("/{course_id}/students", status_code=204)
async def enroll_students(
    course_id: int,
    body: EnrollmentRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    await CourseService.enroll_students(db, course_id, body.student_ids)


@router.delete("/{course_id}/students/{student_id}", status_code=204)
async def remove_student(
    course_id: int,
    student_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    await CourseService.remove_student(db, course_id, student_id)
