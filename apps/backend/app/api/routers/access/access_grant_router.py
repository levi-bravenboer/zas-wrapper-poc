"""Break-glass access grants (REQ-NON-8).

Create is open to caregivers (vervanging / emergency is exactly when the
normal relations are absent); oversight (list / revoke) is admin-only.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.core.enums import Permission
from app.core.settings import SettingsDep
from app.db.engine import SessionDep
from app.schemas.access.access_grant import AccessGrantCreate, AccessGrantRead
from app.schemas.auth.auth import SessionUser
from app.services.access.grants.break_glass_service import BreakGlassService
from app.services.access.rbac.deps import require_permission

router = APIRouter(tags=["access-grants"])

_REQUEST_GUARD = Depends(require_permission(Permission.BREAK_GLASS_REQUEST))
_OVERSEE_GUARD = Depends(require_permission(Permission.BREAK_GLASS_OVERSEE))


def get_break_glass_service(session: SessionDep, settings: SettingsDep) -> BreakGlassService:
    return BreakGlassService(session, settings)


BreakGlassServiceDep = Annotated[BreakGlassService, Depends(get_break_glass_service)]


@router.post(
    "/patients/{patient_id}/access-grants",
    operation_id="create_access_grant",
    response_model=AccessGrantRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_access_grant(
    patient_id: UUID,
    payload: AccessGrantCreate,
    service: BreakGlassServiceDep,
    current_user: Annotated[SessionUser, _REQUEST_GUARD],  # AUTH-HARDEN: breakGlass.request
) -> AccessGrantRead:
    grant = await service.create_grant(
        current_user, patient_id=patient_id, reason=payload.reason, hours=payload.hours
    )
    return AccessGrantRead.model_validate(grant)


@router.get(
    "/admin/access-grants",
    operation_id="list_access_grants",
    response_model=list[AccessGrantRead],
)
async def list_access_grants(
    service: BreakGlassServiceDep,
    current_user: Annotated[SessionUser, _OVERSEE_GUARD],  # AUTH-HARDEN: breakGlass.oversee
    active: Annotated[bool, Query(description="Only unexpired, unrevoked grants")] = True,
) -> list[AccessGrantRead]:
    grants = await service.list_grants(current_user.tenant_id, active_only=active)
    return [AccessGrantRead.model_validate(g) for g in grants]


@router.post(
    "/admin/access-grants/{grant_id}/revoke",
    operation_id="revoke_access_grant",
    response_model=AccessGrantRead,
)
async def revoke_access_grant(
    grant_id: UUID,
    service: BreakGlassServiceDep,
    current_user: Annotated[SessionUser, _OVERSEE_GUARD],  # AUTH-HARDEN: breakGlass.oversee
) -> AccessGrantRead:
    grant = await service.revoke_grant(current_user, grant_id)
    return AccessGrantRead.model_validate(grant)
