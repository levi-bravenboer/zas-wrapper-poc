"""Admin surface for specialism master data + carepath scoping links
(REQ-FUN-28, REQ-NON-10/12). All endpoints are admin-only; link mutations
ride the authz outbox via the ORM, so Keto follows within one relay poll.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.core.enums.user import Role
from app.db.engine import SessionDep
from app.schemas.access.scoping import (
    AssignedUserIdsUpdate,
    SpecialismCreate,
    SpecialismIdsUpdate,
    SpecialismRead,
)
from app.schemas.auth.auth import SessionUser
from app.services.access.identity.deps import require_role
from app.services.access.scoping.scoping_service import ScopingService

router = APIRouter(tags=["access-scoping"])

_ADMIN_GUARD = Depends(require_role(Role.ADMIN))


def get_scoping_service(session: SessionDep) -> ScopingService:
    return ScopingService(session)


ScopingServiceDep = Annotated[ScopingService, Depends(get_scoping_service)]


@router.get(
    "/admin/specialisms",
    operation_id="list_specialisms",
    response_model=list[SpecialismRead],
)
async def list_specialisms(
    service: ScopingServiceDep,
    current_user: Annotated[SessionUser, _ADMIN_GUARD],  # AUTH-HARDEN: admin-only
) -> list[SpecialismRead]:
    rows = await service.list_specialisms(current_user.tenant_id)
    return [SpecialismRead.model_validate(s) for s in rows]


@router.post(
    "/admin/specialisms",
    operation_id="create_specialism",
    response_model=SpecialismRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_specialism(
    payload: SpecialismCreate,
    service: ScopingServiceDep,
    current_user: Annotated[SessionUser, _ADMIN_GUARD],  # AUTH-HARDEN: admin-only
) -> SpecialismRead:
    specialism = await service.create_specialism(
        current_user, code=payload.code, display=payload.display
    )
    return SpecialismRead.model_validate(specialism)


@router.delete(
    "/admin/specialisms/{specialism_id}",
    operation_id="delete_specialism",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_specialism(
    specialism_id: UUID,
    service: ScopingServiceDep,
    current_user: Annotated[SessionUser, _ADMIN_GUARD],  # AUTH-HARDEN: admin-only
) -> None:
    await service.delete_specialism(current_user, specialism_id)


@router.get(
    "/admin/practitioner-roles/{role_id}/specialisms",
    operation_id="list_role_specialisms",
    response_model=list[SpecialismRead],
)
async def list_role_specialisms(
    role_id: UUID,
    service: ScopingServiceDep,
    current_user: Annotated[SessionUser, _ADMIN_GUARD],  # AUTH-HARDEN: admin-only
) -> list[SpecialismRead]:
    rows = await service.list_role_specialisms(current_user.tenant_id, role_id)
    return [SpecialismRead.model_validate(s) for s in rows]


@router.put(
    "/admin/practitioner-roles/{role_id}/specialisms",
    operation_id="set_role_specialisms",
    response_model=list[SpecialismRead],
)
async def set_role_specialisms(
    role_id: UUID,
    payload: SpecialismIdsUpdate,
    service: ScopingServiceDep,
    current_user: Annotated[SessionUser, _ADMIN_GUARD],  # AUTH-HARDEN: admin-only
) -> list[SpecialismRead]:
    rows = await service.set_role_specialisms(
        current_user, role_id=role_id, specialism_ids=payload.specialism_ids
    )
    return [SpecialismRead.model_validate(s) for s in rows]


@router.put(
    "/admin/pathways/{pathway_id}/specialisms",
    operation_id="set_pathway_specialisms",
    response_model=list[SpecialismRead],
)
async def set_pathway_specialisms(
    pathway_id: UUID,
    payload: SpecialismIdsUpdate,
    service: ScopingServiceDep,
    current_user: Annotated[SessionUser, _ADMIN_GUARD],  # AUTH-HARDEN: admin-only
) -> list[SpecialismRead]:
    rows = await service.set_pathway_specialisms(
        current_user, pathway_id=pathway_id, specialism_ids=payload.specialism_ids
    )
    return [SpecialismRead.model_validate(s) for s in rows]


@router.put(
    "/admin/pathways/{pathway_id}/practitioners",
    operation_id="set_pathway_practitioners",
    response_model=list[UUID],
)
async def set_pathway_practitioners(
    pathway_id: UUID,
    payload: AssignedUserIdsUpdate,
    service: ScopingServiceDep,
    current_user: Annotated[SessionUser, _ADMIN_GUARD],  # AUTH-HARDEN: admin-only
) -> list[UUID]:
    return await service.set_pathway_practitioners(
        current_user, pathway_id=pathway_id, user_ids=payload.user_ids
    )
