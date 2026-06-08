import csv
import io

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel, field_validator
from sqlalchemy import distinct, func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.rbac import require_role
from app.database import get_db
from app.models.course import Course, CourseProf
from app.models.group import TRIMESTER_VALUES
from app.models.group_subject import GroupSubject
from app.models.schedule import Schedule
from app.models.user import Role, User
from app.schemas.course import CourseCreate, CourseOut, CourseUpdate, EnrollmentRequest, ProfessorAssignRequest
from app.schemas.user import UserOut
from app.services.access_service import AccessService
from app.services.course_service import CourseService


class CourseGroupAdd(BaseModel):
    group_id: int
    semester: str

    @field_validator("semester")
    @classmethod
    def validate_semester(cls, value: str) -> str:
        value = value.upper()
        if value not in TRIMESTER_VALUES:
            raise ValueError(f"trimester must be one of {TRIMESTER_VALUES}")
        return value


class CourseGroupOut(BaseModel):
    group_subject_id: int
    group_id: int
    course_id: int
    group_name: str
    group_type: str
    semester: str


class CourseSetupStatusOut(BaseModel):
    course_id: int
    professor_count: int
    group_count: int
    schedule_count: int


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


# Must be registered BEFORE /{course_id} to avoid FastAPI matching "all-groups" as an int param
@router.get("/all-groups", response_model=list[CourseGroupOut])
async def list_all_course_groups(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    result = await db.execute(
        select(GroupSubject).options(selectinload(GroupSubject.group))
    )
    return [
        CourseGroupOut(
            group_subject_id=gs.id,
            group_id=gs.group_id,
            course_id=gs.course_id,
            group_name=gs.group.name if gs.group else f"#{gs.group_id}",
            group_type=gs.group.group_type if gs.group else "",
            semester=gs.semester or "",
        )
        for gs in result.scalars().all()
    ]


@router.get("/setup-status", response_model=list[CourseSetupStatusOut])
async def list_course_setup_statuses(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    result = await db.execute(
        select(
            Course.id.label("course_id"),
            func.count(distinct(CourseProf.professor_id)).label("professor_count"),
            func.count(distinct(GroupSubject.id)).label("group_count"),
            func.count(distinct(Schedule.id)).label("schedule_count"),
        )
        .select_from(Course)
        .outerjoin(CourseProf, CourseProf.course_id == Course.id)
        .outerjoin(GroupSubject, GroupSubject.course_id == Course.id)
        .outerjoin(Schedule, Schedule.course_id == Course.id)
        .group_by(Course.id)
    )
    return [CourseSetupStatusOut(**row._mapping) for row in result.all()]


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


# --- Groups linked to course ---

@router.get("/{course_id}/groups", response_model=list[CourseGroupOut])
async def list_course_groups(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    result = await db.execute(
        select(GroupSubject)
        .options(selectinload(GroupSubject.group))
        .where(GroupSubject.course_id == course_id)
        .order_by(GroupSubject.semester)
    )
    rows = result.scalars().all()
    return [
        CourseGroupOut(
            group_subject_id=gs.id,
            group_id=gs.group_id,
            course_id=gs.course_id,
            group_name=gs.group.name if gs.group else f"#{gs.group_id}",
            group_type=gs.group.group_type if gs.group else "",
            semester=gs.semester or "",
        )
        for gs in rows
    ]


@router.post("/{course_id}/groups", response_model=CourseGroupOut, status_code=201)
async def add_course_group(
    course_id: int,
    body: CourseGroupAdd,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    gs = GroupSubject(group_id=body.group_id, course_id=course_id, semester=body.semester)
    db.add(gs)
    await db.commit()
    result = await db.execute(
        select(GroupSubject)
        .options(selectinload(GroupSubject.group))
        .where(GroupSubject.id == gs.id)
    )
    gs = result.scalar_one()
    return CourseGroupOut(
        group_subject_id=gs.id,
        group_id=gs.group_id,
        course_id=gs.course_id,
        group_name=gs.group.name if gs.group else f"#{gs.group_id}",
        group_type=gs.group.group_type if gs.group else "",
        semester=gs.semester or "",
    )


@router.delete("/{course_id}/groups/{group_subject_id}", status_code=204)
async def remove_course_group(
    course_id: int,
    group_subject_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    result = await db.execute(
        select(GroupSubject).where(
            GroupSubject.id == group_subject_id,
            GroupSubject.course_id == course_id,
        )
    )
    gs = result.scalar_one_or_none()
    if gs:
        await db.delete(gs)
        await db.commit()


# --- CSV import ---

@router.post("/import/csv", status_code=201)
async def import_courses_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
) -> dict:
    """
    Import subjects/courses from CSV.
    Required: name, trimester, academic_year
    Optional: lesson_type, group_type, description
    Code is auto-generated.
    """
    content = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    created, skipped, errors = 0, 0, []

    for i, row in enumerate(reader, start=2):
        r = {k.strip().lower(): (v or "").strip() for k, v in row.items()}

        name = r.get("name", "")
        semester = (r.get("trimester") or r.get("semester") or "").upper()
        academic_year = r.get("academic_year", "")
        lesson_type = (r.get("lesson_type") or "").upper() or None
        group_type = (r.get("group_type") or "").upper() or None
        description = r.get("description") or None

        if not name or not semester or not academic_year:
            errors.append(f"Row {i}: missing name, trimester, or academic_year")
            skipped += 1
            continue

        try:
            data = CourseCreate(
                name=name,
                semester=semester,
                academic_year=academic_year,
                lesson_type=lesson_type,
                group_type=group_type,
                description=description,
            )
            await CourseService.create_course(db, data)
            created += 1
        except Exception as e:  # noqa: BLE001
            errors.append(f"Row {i} ({name}): {e}")
            skipped += 1

    return {"created": created, "skipped": skipped, "errors": errors}
