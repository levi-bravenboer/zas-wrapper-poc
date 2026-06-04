from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Response, status

from app.core.enums.user import Role
from app.schemas.auth.auth import SessionUser
from app.schemas.organisation import (
    OrganisationCreate,
    OrganisationListResponse,
    OrganisationRead,
    OrganisationTreeUpdate,
    OrganisationUpdate,
)
from app.services.access.identity.deps import AdminUserDep, require_role
from app.services.organisation.deps import (
    OrganisationServiceDep,
    OrganisationTreeServiceDep,
)

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


# AUTH-HARDEN: admin-only write — depends on require_role(Role.ADMIN) via AdminUserDep.
@router.post(
    "/organisations",
    operation_id="create_organisation",
    status_code=status.HTTP_201_CREATED,
    response_model=OrganisationRead,
)
async def create_organisation(
    payload: OrganisationCreate,
    service: OrganisationServiceDep,
    admin: AdminUserDep,
) -> OrganisationRead:
    org = await service.create(admin, payload)
    return OrganisationRead.model_validate(org)


# AUTH-HARDEN: admin-only write — depends on require_role(Role.ADMIN) via AdminUserDep.
@router.patch(
    "/organisations/{organisation_id}",
    operation_id="update_organisation",
    response_model=OrganisationRead,
)
async def update_organisation(
    organisation_id: UUID,
    payload: OrganisationUpdate,
    service: OrganisationServiceDep,
    admin: AdminUserDep,
) -> OrganisationRead:
    org = await service.update(admin, organisation_id, payload)
    return OrganisationRead.model_validate(org)


# AUTH-HARDEN: admin-only atomic tree reparent + reorder.
@router.patch(
    "/admin/organisations/tree",
    operation_id="patch_organisation_tree",
    response_model=OrganisationListResponse,
)
async def patch_organisation_tree(
    payload: OrganisationTreeUpdate,
    service: OrganisationTreeServiceDep,
    admin: AdminUserDep,
) -> OrganisationListResponse:
    orgs = await service.apply_tree_moves(admin, payload.moves)
    return OrganisationListResponse(items=[OrganisationRead.model_validate(o) for o in orgs])


# AUTH-HARDEN: admin-only soft delete; rejects when references exist.
@router.delete(
    "/organisations/{organisation_id}",
    operation_id="delete_organisation",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_organisation(
    organisation_id: UUID,
    service: OrganisationServiceDep,
    admin: AdminUserDep,
) -> Response:
    await service.soft_delete(admin, organisation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["router"]
