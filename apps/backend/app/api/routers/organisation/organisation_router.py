from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.enums.user import Role
from app.schemas.auth.auth import SessionUser
from app.schemas.organisation import OrganisationListResponse, OrganisationRead
from app.services.auth.deps import require_role
from app.services.organisation.deps import OrganisationServiceDep

router = APIRouter(tags=["organisations"])

_TENANT_MEMBER_GUARD = Depends(require_role(Role.ADMIN, Role.CAREGIVER))


@router.get(
    "/organisations",
    operation_id="list_organisations",
    response_model=OrganisationListResponse,
)
async def list_organisations(
    service: OrganisationServiceDep,
    current_user: SessionUser = _TENANT_MEMBER_GUARD,
) -> OrganisationListResponse:
    # AUTH-HARDEN: PoC scopes by current_user.tenant_id. MVP must layer
    # row-level org-visibility on top (caller can only see organisations in
    # their own root subtree, plus their delegated-care patient roots).
    orgs = await service.list_in_tenant(current_user.tenant_id)
    return OrganisationListResponse(items=[OrganisationRead.model_validate(o) for o in orgs])


__all__ = ["router"]
