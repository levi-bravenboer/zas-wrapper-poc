from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api._list.deps import ListQueryParamsDep
from app.core.enums import Permission
from app.repositories.audit.deps import AuditEventRepoDep
from app.schemas._list.page import Page
from app.schemas.audit.audit_event import AuditEventRead
from app.schemas.auth.auth import SessionUser
from app.services.access.rbac.deps import require_permission

router = APIRouter(tags=["audit"])

_READ_GUARD = Depends(require_permission(Permission.AUDIT_READ))


# AUTH-HARDEN: read gated on `audit.read` via require_permission.
@router.get(
    "/audit-events",
    operation_id="list_audit_events",
    response_model=Page[AuditEventRead],
)
async def list_audit_events(
    query: ListQueryParamsDep,
    repo: AuditEventRepoDep,
    _user: SessionUser = _READ_GUARD,
) -> Page[AuditEventRead]:
    # Repository yields Page[AuditEvent] (ORM rows); FastAPI converts to
    # Page[AuditEventRead] via Pydantic `from_attributes`.
    return await repo.list_page(query)  # type: ignore[return-value]
