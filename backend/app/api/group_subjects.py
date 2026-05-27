"""Group subjects endpoints — kept for backward compatibility.
The same routes are also accessible via /api/groups/{group_id}/subjects.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.exceptions import NotFoundError
from app.core.rbac import require_role
from app.database import get_db
from app.models.group import Group
from app.models.group_subject import GroupSubject
from app.models.user import Role, User
from app.schemas.group_subject import GroupSubjectAdd, GroupSubjectOut

router = APIRouter()


def _to_out(gs: GroupSubject) -> GroupSubjectOut:
    return GroupSubjectOut(
        id=gs.id,
        group_id=gs.group_id,
        course_id=gs.course_id,
        course_code=gs.course.code if gs.course else "",
        course_name=gs.course.name if gs.course else "",
        semester=str(gs.semester),
    )


@router.get("/{group_id}/subjects", response_model=list[GroupSubjectOut])
async def list_group_subjects(
    group_id: int,
    semester: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = (
        select(GroupSubject)
        .options(selectinload(GroupSubject.course))
        .where(GroupSubject.group_id == group_id)
    )
    if semester is not None:
        query = query.where(GroupSubject.semester == semester.upper())
    query = query.order_by(GroupSubject.semester, GroupSubject.course_id)
    result = await db.execute(query)
    return [_to_out(gs) for gs in result.scalars().all()]


@router.post("/{group_id}/subjects", response_model=GroupSubjectOut, status_code=201)
async def add_group_subject(
    group_id: int,
    body: GroupSubjectAdd,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    group_result = await db.execute(select(Group).where(Group.id == group_id))
    if group_result.scalar_one_or_none() is None:
        raise NotFoundError("Group")

    gs = GroupSubject(group_id=group_id, course_id=body.course_id, semester=body.semester)
    db.add(gs)
    await db.commit()
    result = await db.execute(
        select(GroupSubject)
        .options(selectinload(GroupSubject.course))
        .where(GroupSubject.id == gs.id)
    )
    return _to_out(result.scalar_one())


@router.delete("/{group_id}/subjects/{subject_id}", status_code=204)
async def remove_group_subject(
    group_id: int,
    subject_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    result = await db.execute(
        select(GroupSubject).where(
            GroupSubject.id == subject_id,
            GroupSubject.group_id == group_id,
        )
    )
    gs = result.scalar_one_or_none()
    if gs is None:
        raise NotFoundError("GroupSubject")
    await db.delete(gs)
    await db.commit()
