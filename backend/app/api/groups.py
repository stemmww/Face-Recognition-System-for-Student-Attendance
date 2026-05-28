import csv
import io
import re

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.rbac import require_role
from app.database import get_db
from app.models.group import SEMESTER_VALUES, VALID_MAJORS
from app.models.group_subject import GroupSubject
from app.models.user import Role, User
from app.schemas.group import GroupCreate, GroupOut, GroupStudentAdd, GroupUpdate
from app.schemas.group_subject import GroupSubjectAdd, GroupSubjectOut
from app.schemas.user import UserOut
from app.services.group_service import GroupService
from app.services.group_subject_service import GroupSubjectService


class GroupSubjectTagOut(BaseModel):
    group_id: int
    course_id: int
    course_code: str
    course_name: str
    semester: str

router = APIRouter()

_GROUP_CODE_RE = re.compile(r"^([A-Z]+)-(\d{4})$", re.IGNORECASE)


def _parse_group_code(code: str) -> tuple[str, int, int] | None:
    m = _GROUP_CODE_RE.match(code.strip())
    if not m:
        return None
    major = m.group(1).upper()
    digits = m.group(2)
    year_short = int(digits[:2])
    group_num = int(digits[2:])
    return major, year_short, group_num


# --- Batch helpers ---

@router.get("/all-subjects", response_model=list[GroupSubjectTagOut])
async def list_all_group_subjects(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    result = await db.execute(
        select(GroupSubject).options(selectinload(GroupSubject.course))
    )
    subjects = result.scalars().all()
    return [
        GroupSubjectTagOut(
            group_id=gs.group_id,
            course_id=gs.course_id,
            course_code=gs.course.code if gs.course else f"#{gs.course_id}",
            course_name=gs.course.name if gs.course else "",
            semester=gs.semester or "",
        )
        for gs in subjects
    ]


# --- CRUD ---

@router.post("", response_model=GroupOut, status_code=201)
async def create_group(
    body: GroupCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    return await GroupService.create_group(db, body)


@router.get("", response_model=list[GroupOut])
async def list_groups(
    active_only: bool = True,
    group_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await GroupService.list_groups(db, active_only=active_only, group_type=group_type)


@router.get("/{group_id}", response_model=GroupOut)
async def get_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await GroupService.get_group(db, group_id)


@router.put("/{group_id}", response_model=GroupOut)
async def update_group(
    group_id: int,
    body: GroupUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    return await GroupService.update_group(db, group_id, body)


@router.delete("/{group_id}", status_code=204)
async def delete_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    await GroupService.delete_group(db, group_id)


# --- Students in group ---

@router.get("/{group_id}/students", response_model=list[UserOut])
async def list_group_students(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    students = await GroupService.list_students(db, group_id)
    return [UserOut.model_validate(s) for s in students]


@router.post("/{group_id}/students", status_code=204)
async def add_students_to_group(
    group_id: int,
    body: GroupStudentAdd,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    await GroupService.add_students(db, group_id, body.student_ids)


@router.delete("/{group_id}/students/{student_id}", status_code=204)
async def remove_student_from_group(
    group_id: int,
    student_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    await GroupService.remove_student(db, group_id, student_id)


# --- Subjects in group ---

@router.get("/{group_id}/subjects", response_model=list[GroupSubjectOut])
async def list_group_subjects(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await GroupSubjectService.list(db, group_id)


@router.post("/{group_id}/subjects", response_model=GroupSubjectOut, status_code=201)
async def add_group_subject(
    group_id: int,
    body: GroupSubjectAdd,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    return await GroupSubjectService.add(db, group_id, body)


@router.delete("/{group_id}/subjects/{gs_id}", status_code=204)
async def remove_group_subject(
    group_id: int,
    gs_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    await GroupSubjectService.remove(db, group_id, gs_id)


# --- CSV import ---

@router.post("/import/csv", status_code=201)
async def import_groups_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
) -> dict:
    """
    Import groups from CSV.
    Columns: code, group_type, academic_year, semester, student_emails
    code format: SE-2322
    student_emails: semicolon-separated
    """
    content = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    created, skipped, errors = 0, 0, []

    for i, row in enumerate(reader, start=2):
        r = {k.strip().lower(): (v or "").strip() for k, v in row.items()}

        name_cell = r.get("code") or r.get("name") or ""
        group_type_raw = (r.get("group_type") or "MAIN").upper()
        if group_type_raw in ("OFFICIAL",):
            group_type_raw = "MAIN"
        elif group_type_raw in ("TEMPORARY",):
            group_type_raw = "ELECTIVE"

        if group_type_raw not in ("MAIN", "ELECTIVE"):
            group_type_raw = "MAIN"

        semester_raw = (r.get("semester") or "").upper() or None
        if semester_raw and semester_raw not in SEMESTER_VALUES:
            errors.append(f"Row {i}: invalid semester '{semester_raw}'")
            skipped += 1
            continue

        academic_year = r.get("academic_year") or None

        if name_cell:
            parsed = _parse_group_code(name_cell)
            if not parsed:
                errors.append(f"Row {i}: cannot parse code '{name_cell}' (expected SE-2322)")
                skipped += 1
                continue
            major, year_short, group_num = parsed
        else:
            major = (r.get("major") or "").upper()
            year_raw = r.get("enrollment_year") or r.get("year_short") or r.get("year") or ""
            num_raw = r.get("group_number") or r.get("number") or ""
            if not major or not year_raw or not num_raw:
                errors.append(f"Row {i}: missing code or major/enrollment_year/group_number")
                skipped += 1
                continue
            try:
                year_short = int(year_raw) % 100
                group_num = int(num_raw)
            except ValueError:
                errors.append(f"Row {i}: invalid year or group_number")
                skipped += 1
                continue

        if major not in VALID_MAJORS:
            errors.append(f"Row {i}: unknown major '{major}'")
            skipped += 1
            continue

        # Resolve student emails
        student_ids: list[int] = []
        emails_raw = r.get("student_emails") or ""
        if emails_raw:
            for email in emails_raw.split(";"):
                email = email.strip()
                if not email:
                    continue
                res = await db.execute(select(User).where(User.email == email))
                u = res.scalar_one_or_none()
                if u is None:
                    errors.append(f"Row {i}: student not found: '{email}'")
                elif u.role != Role.STUDENT:
                    errors.append(f"Row {i}: user '{email}' is not a student")
                else:
                    student_ids.append(u.id)

        try:
            data = GroupCreate(
                major=major,
                enrollment_year_short=year_short,
                group_number=group_num,
                group_type=group_type_raw,
                semester=semester_raw,
                academic_year=academic_year,
            )
            group_out = await GroupService.create_group(db, data)
            if student_ids:
                await GroupService.add_students(db, group_out.id, student_ids)
            created += 1
        except Exception as e:  # noqa: BLE001
            errors.append(f"Row {i} ({name_cell or major}): {e}")
            skipped += 1

    return {"created": created, "skipped": skipped, "errors": errors}
