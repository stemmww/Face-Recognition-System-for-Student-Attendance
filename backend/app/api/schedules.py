import csv
import io
from datetime import time

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.rbac import require_role
from app.database import get_db
from app.models.classroom import Classroom
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.group import Group, TRIMESTER_VALUES
from app.models.schedule import DAY_OF_WEEK_VALUES
from app.models.user import Role, User
from app.schemas.schedule import ScheduleCreate, ScheduleOut, ScheduleUpdate
from app.services.schedule_service import ScheduleService

router = APIRouter()


@router.get("/my", response_model=list[ScheduleOut])
async def get_my_schedule(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await ScheduleService.get_my_schedules(db, current_user)


@router.post("", response_model=ScheduleOut, status_code=201)
async def create_schedule(
    body: ScheduleCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    return await ScheduleService.create_schedule(db, body)


@router.get("", response_model=list[ScheduleOut])
async def list_schedules(
    semester: str | None = None,
    academic_year: str | None = None,
    course_id: int | None = None,
    professor_id: int | None = None,
    classroom_id: int | None = None,
    group_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == Role.ADMIN:
        return await ScheduleService.list_schedules(
            db,
            semester=semester,
            academic_year=academic_year,
            course_id=course_id,
            professor_id=professor_id,
            classroom_id=classroom_id,
            group_id=group_id,
        )

    if current_user.role == Role.STUDENT and course_id is not None:
        enrolled = await db.execute(
            select(Enrollment).where(
                Enrollment.student_id == current_user.id,
                Enrollment.course_id == course_id,
            )
        )
        if enrolled.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enrolled in this course")

    schedules = await ScheduleService.get_my_schedules(db, current_user)
    if course_id is not None:
        schedules = [s for s in schedules if s.course_id == course_id]
    return schedules


@router.get("/{schedule_id}", response_model=ScheduleOut)
async def get_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    schedule = await ScheduleService.get_schedule(db, schedule_id)
    if current_user.role == Role.STUDENT:
        enrolled = await db.execute(
            select(Enrollment).where(
                Enrollment.student_id == current_user.id,
                Enrollment.course_id == schedule.course_id,
            )
        )
        if enrolled.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enrolled in this course")
    return schedule


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


@router.post("/import/csv", status_code=201)
async def import_schedules_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
) -> dict:
    """
    Import schedules from CSV.
    Required columns (case-insensitive):
      day_of_week, start_time, subject_code (or subject_name), professor_email,
      classroom_code, group_codes, trimester, academic_year
    group_codes: semicolon-separated
    """
    content = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    created, skipped, errors = 0, 0, []

    for i, row in enumerate(reader, start=2):
        r = {k.strip().lower(): (v or "").strip() for k, v in row.items()}

        day = (r.get("day_of_week") or "").upper()
        if day not in DAY_OF_WEEK_VALUES:
            errors.append(f"Row {i}: invalid day_of_week '{day}'")
            skipped += 1
            continue

        start_raw = r.get("start_time", "").strip()
        try:
            h, m = start_raw.split(":")
            start = time(int(h), int(m))
        except Exception:  # noqa: BLE001
            errors.append(f"Row {i}: invalid start_time '{start_raw}'")
            skipped += 1
            continue

        # Resolve course by code or name
        course_code = r.get("subject_code") or r.get("course_code") or ""
        course_name = r.get("subject_name") or r.get("course_name") or ""
        if course_code:
            res = await db.execute(select(Course).where(Course.code == course_code))
        elif course_name:
            res = await db.execute(select(Course).where(Course.name == course_name))
        else:
            errors.append(f"Row {i}: missing subject_code or subject_name")
            skipped += 1
            continue
        course = res.scalar_one_or_none()
        if course is None:
            errors.append(f"Row {i}: course not found (code='{course_code}' name='{course_name}')")
            skipped += 1
            continue

        # Resolve professor by email (optional — warning only, row is not skipped)
        prof_email = r.get("professor_email", "").strip()
        professor_id: int | None = None
        if prof_email:
            res = await db.execute(select(User).where(User.email == prof_email))
            prof = res.scalar_one_or_none()
            if prof is None:
                errors.append(f"Row {i}: professor not found: '{prof_email}' (schedule created without professor)")
            else:
                professor_id = prof.id

        # Resolve classroom by name (optional — warning only, row is not skipped)
        classroom_raw = (r.get("classroom_name") or r.get("classroom_code") or "").strip()
        classroom_id: int | None = None
        if classroom_raw:
            res = await db.execute(select(Classroom).where(Classroom.name == classroom_raw.upper()))
            classroom = res.scalar_one_or_none()
            if classroom is None:
                errors.append(f"Row {i}: classroom not found: '{classroom_raw}' (schedule created without classroom)")
            else:
                classroom_id = classroom.id

        # Resolve groups
        group_codes_raw = r.get("group_codes", "")
        group_ids: list[int] = []
        if group_codes_raw:
            for gc in group_codes_raw.split(";"):
                gc = gc.strip().upper()
                if not gc:
                    continue
                # Parse group code e.g. SE-2322
                res = await db.execute(select(Group).where(Group.is_active == True))
                all_groups = res.scalars().all()
                matched = next((g for g in all_groups if g.name == gc), None)
                if matched is None:
                    errors.append(f"Row {i}: group not found: '{gc}'")
                else:
                    group_ids.append(matched.id)

        semester = (r.get("trimester") or r.get("semester") or "").upper() or None
        if semester and semester not in TRIMESTER_VALUES:
            errors.append(f"Row {i}: invalid trimester '{semester}'")
            skipped += 1
            continue
        academic_year = r.get("academic_year") or None
        lesson_type = (r.get("lesson_type") or "LECTURE").upper()

        try:
            data = ScheduleCreate(
                course_id=course.id,
                professor_id=professor_id,
                classroom_id=classroom_id,
                day_of_week=day,
                start_time=start,
                lesson_type=lesson_type,
                semester=semester,
                academic_year=academic_year,
                group_ids=group_ids,
            )
            await ScheduleService.create_schedule(db, data)
            created += 1
        except Exception as e:  # noqa: BLE001
            errors.append(f"Row {i}: {e}")
            skipped += 1

    return {"created": created, "skipped": skipped, "errors": errors}
