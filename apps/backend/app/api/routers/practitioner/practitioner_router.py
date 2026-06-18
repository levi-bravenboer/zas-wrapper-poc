from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.core.enums import Permission
from app.schemas.auth.auth import SessionUser
from app.schemas.practitioner.practitioner import (
    PractitionerCreate,
    PractitionerRead,
    PractitionerUpdate,
)
from app.services.access.rbac.deps import require_permission
from app.services.practitioner.deps import PractitionerServiceDep

router = APIRouter(tags=["practitioners"])

_CREATE_GUARD = Depends(require_permission(Permission.PRACTITIONER_ROLE_CREATE))
_UPDATE_GUARD = Depends(require_permission(Permission.PRACTITIONER_ROLE_UPDATE))
_READ_GUARD = Depends(require_permission(Permission.PRACTITIONER_ROLE_READ))


@router.get(
    "/practitioners/{user_id}",
    operation_id="get_practitioner",
    response_model=PractitionerRead,
)
async def get_practitioner(
    user_id: UUID,
    service: PractitionerServiceDep,
    current_user: Annotated[SessionUser, _READ_GUARD],  # AUTH-HARDEN: practitionerRole.read
) -> PractitionerRead:
    practitioner = await service.get_by_user_id(current_user, user_id)
    return PractitionerRead.model_validate(practitioner)


@router.post(
    "/practitioners",
    operation_id="create_practitioner",
    response_model=PractitionerRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_practitioner(
    payload: PractitionerCreate,
    service: PractitionerServiceDep,
    current_user: Annotated[SessionUser, _CREATE_GUARD],  # AUTH-HARDEN: practitionerRole.create
) -> PractitionerRead:
    practitioner = await service.create(current_user, payload)
    return PractitionerRead.model_validate(practitioner)


@router.patch(
    "/practitioners/{user_id}",
    operation_id="update_practitioner",
    response_model=PractitionerRead,
)
async def update_practitioner(
    user_id: UUID,
    payload: PractitionerUpdate,
    service: PractitionerServiceDep,
    current_user: Annotated[SessionUser, _UPDATE_GUARD],  # AUTH-HARDEN: practitionerRole.update
) -> PractitionerRead:
    practitioner = await service.update(current_user, user_id, payload)
    return PractitionerRead.model_validate(practitioner)


__all__ = ["router"]
