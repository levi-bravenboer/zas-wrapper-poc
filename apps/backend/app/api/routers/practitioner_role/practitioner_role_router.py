from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.api._list.deps import ListQueryParamsDep
from app.core.enums import Permission
from app.repositories.practitioner_role.deps import PractitionerRoleRepoDep
from app.schemas._list.page import Page
from app.schemas.auth.auth import SessionUser
from app.schemas.practitioner_role.practitioner_role import (
    PractitionerRoleCreate,
    PractitionerRoleRead,
    PractitionerRoleUpdate,
)
from app.services.access.rbac.deps import require_permission
from app.services.practitioner_role.deps import PractitionerRoleServiceDep

router = APIRouter(tags=["practitioner-roles"])

_CREATE_GUARD = Depends(require_permission(Permission.PRACTITIONER_ROLE_CREATE))
_UPDATE_GUARD = Depends(require_permission(Permission.PRACTITIONER_ROLE_UPDATE))
_DELETE_GUARD = Depends(require_permission(Permission.PRACTITIONER_ROLE_DELETE))
_READ_GUARD = Depends(require_permission(Permission.PRACTITIONER_ROLE_READ))


@router.get(
    "/practitioner-roles",
    operation_id="list_practitioner_roles",
    response_model=Page[PractitionerRoleRead],
)
async def list_practitioner_roles(
    query: ListQueryParamsDep,
    repo: PractitionerRoleRepoDep,
    _current_user: Annotated[SessionUser, _READ_GUARD],  # AUTH-HARDEN: practitionerRole.read
) -> Page[PractitionerRoleRead]:
    # Repository yields Page[PractitionerRole] (ORM rows); FastAPI's response_model
    # converts to Page[PractitionerRoleRead] via Pydantic's `from_attributes`.
    return await repo.list_page(query)  # type: ignore[return-value]


@router.post(
    "/practitioner-roles",
    operation_id="open_practitioner_role",
    response_model=PractitionerRoleRead,
    status_code=status.HTTP_201_CREATED,
)
async def open_practitioner_role(
    payload: PractitionerRoleCreate,
    service: PractitionerRoleServiceDep,
    current_user: Annotated[SessionUser, _CREATE_GUARD],  # AUTH-HARDEN: practitionerRole.create
) -> PractitionerRoleRead:
    row = await service.open_role(current_user, payload)
    return PractitionerRoleRead.model_validate(row)


@router.patch(
    "/practitioner-roles/{role_id}",
    operation_id="update_practitioner_role",
    response_model=PractitionerRoleRead,
)
async def update_practitioner_role(
    role_id: UUID,
    payload: PractitionerRoleUpdate,
    service: PractitionerRoleServiceDep,
    current_user: Annotated[SessionUser, _UPDATE_GUARD],  # AUTH-HARDEN: practitionerRole.update
) -> PractitionerRoleRead:
    row = await service.update(current_user, role_id, payload)
    return PractitionerRoleRead.model_validate(row)


@router.delete(
    "/practitioner-roles/{role_id}",
    operation_id="close_practitioner_role",
    response_model=PractitionerRoleRead,
)
async def close_practitioner_role(
    role_id: UUID,
    service: PractitionerRoleServiceDep,
    current_user: Annotated[SessionUser, _DELETE_GUARD],  # AUTH-HARDEN: practitionerRole.delete
) -> PractitionerRoleRead:
    row = await service.close_role(current_user, role_id)
    return PractitionerRoleRead.model_validate(row)


__all__ = ["router"]
