from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Response, status

from app.core.enums import Permission
from app.schemas.auth.auth import SessionUser
from app.schemas.organisation import (
    OrganisationCreate,
    OrganisationListResponse,
    OrganisationRead,
    OrganisationTreeUpdate,
    OrganisationUpdate,
)
from app.db.engine import SessionDep
from app.services.access.identity.deps import CurrentUserDep
from app.services.access.rbac.deps import require_permission
from app.services.organisation.deps import (
    OrganisationServiceDep,
    OrganisationTreeServiceDep,
)
from app.services.practitioner_role.predicates import affiliated_org_ids_for

router = APIRouter(tags=["organisations"])

_TENANT_MEMBER_GUARD = Depends(require_permission(Permission.ORGANISATION_READ))
_CREATE_GUARD = Depends(require_permission(Permission.ORGANISATION_CREATE))
_UPDATE_GUARD = Depends(require_permission(Permission.ORGANISATION_UPDATE))
_DELETE_GUARD = Depends(require_permission(Permission.ORGANISATION_DELETE))


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


@router.get(
    "/me/organisations",
    operation_id="list_my_organisations",
    response_model=OrganisationListResponse,
)
async def list_my_organisations(
    service: OrganisationServiceDep,
    session: SessionDep,
    current_user: CurrentUserDep,  # AUTH-HARDEN: authenticated only — returns the caller's own orgs
) -> OrganisationListResponse:
    # The caller's own organisations come from their open `practitioner_roles`
    # rows; no extra RBAC permission since it exposes only their affiliations.
    own_ids = await affiliated_org_ids_for(session, current_user)
    orgs = await service.list_in_tenant(current_user.tenant_id)
    items = [OrganisationRead.model_validate(o) for o in orgs if o.id in own_ids]
    return OrganisationListResponse(items=items)


# AUTH-HARDEN: write gated on `organisation.create` via require_permission.
@router.post(
    "/organisations",
    operation_id="create_organisation",
    status_code=status.HTTP_201_CREATED,
    response_model=OrganisationRead,
)
async def create_organisation(
    payload: OrganisationCreate,
    service: OrganisationServiceDep,
    admin: SessionUser = _CREATE_GUARD,
) -> OrganisationRead:
    org = await service.create(admin, payload)
    return OrganisationRead.model_validate(org)


# AUTH-HARDEN: write gated on `organisation.update` via require_permission.
@router.patch(
    "/organisations/{organisation_id}",
    operation_id="update_organisation",
    response_model=OrganisationRead,
)
async def update_organisation(
    organisation_id: UUID,
    payload: OrganisationUpdate,
    service: OrganisationServiceDep,
    admin: SessionUser = _UPDATE_GUARD,
) -> OrganisationRead:
    org = await service.update(admin, organisation_id, payload)
    return OrganisationRead.model_validate(org)


# AUTH-HARDEN: atomic tree reparent + reorder gated on `organisation.update`.
@router.patch(
    "/admin/organisations/tree",
    operation_id="patch_organisation_tree",
    response_model=OrganisationListResponse,
)
async def patch_organisation_tree(
    payload: OrganisationTreeUpdate,
    service: OrganisationTreeServiceDep,
    admin: SessionUser = _UPDATE_GUARD,
) -> OrganisationListResponse:
    orgs = await service.apply_tree_moves(admin, payload.moves)
    return OrganisationListResponse(items=[OrganisationRead.model_validate(o) for o in orgs])


# AUTH-HARDEN: soft delete gated on `organisation.delete`; rejects when references exist.
@router.delete(
    "/organisations/{organisation_id}",
    operation_id="delete_organisation",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_organisation(
    organisation_id: UUID,
    service: OrganisationServiceDep,
    admin: SessionUser = _DELETE_GUARD,
) -> Response:
    await service.soft_delete(admin, organisation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["router"]
