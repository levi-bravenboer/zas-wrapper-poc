from __future__ import annotations

from fastapi import APIRouter

from app.api._list.deps import ListQueryParamsDep
from app.repositories.audit.deps import AuditEventRepoDep
from app.schemas._list.page import Page
from app.schemas.audit.audit_event import AuditEventRead
from app.services.access.identity.deps import AdminUserDep

router = APIRouter(tags=["audit"])


# AUTH-HARDEN: admin-only read — depends on require_role(Role.ADMIN) via AdminUserDep.
@router.get(
    "/audit-events",
    operation_id="list_audit_events",
    response_model=Page[AuditEventRead],
)
async def list_audit_events(
    query: ListQueryParamsDep,
    repo: AuditEventRepoDep,
    _admin: AdminUserDep,
) -> Page[AuditEventRead]:
    # Repository yields Page[AuditEvent] (ORM rows); FastAPI converts to
    # Page[AuditEventRead] via Pydantic `from_attributes`.
    return await repo.list_page(query)  # type: ignore[return-value]
