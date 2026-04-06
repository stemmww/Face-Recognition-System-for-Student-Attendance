from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_role
from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.user import Role, User

router = APIRouter()


class AuditLogOut(BaseModel):
    id: int
    user_id: int | None
    method: str
    path: str
    status_code: int
    ip_address: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("", response_model=list[AuditLogOut])
async def list_audit_logs(
    user_id: int | None = Query(None),
    method: str | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    q = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
    if user_id is not None:
        q = q.where(AuditLog.user_id == user_id)
    if method is not None:
        q = q.where(AuditLog.method == method.upper())
    result = await db.execute(q)
    return result.scalars().all()
