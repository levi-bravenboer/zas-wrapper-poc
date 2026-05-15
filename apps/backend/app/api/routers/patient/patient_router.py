from __future__ import annotations

from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.core.enums.user import Role
from app.repositories.patient.patient_repository import PatientFilters
from app.schemas.auth.auth import SessionUser
from app.schemas.patient.patient import (
    PaginationMeta,
    PatientCreate,
    PatientListResponse,
    PatientRead,
    PatientUpdate,
)
from app.services.auth.deps import require_role
from app.services.patient.deps import (
    PatientAccessDep,
    PatientServiceDep,
)

router = APIRouter(tags=["patients"])

_CAREGIVER_OR_ADMIN_GUARD = Depends(require_role(Role.ADMIN, Role.CAREGIVER))


@router.get(
    "/patients",
    operation_id="list_patients",
    response_model=PatientListResponse,
)
async def list_patients(
    service: PatientServiceDep,
    current_user: SessionUser = _CAREGIVER_OR_ADMIN_GUARD,  # AUTH-HARDEN
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
    family_name: str | None = None,
    given_name: str | None = None,
    birth_date: date | None = None,
    identifier: str | None = None,
) -> PatientListResponse:
    filters = PatientFilters(
        family_name=family_name,
        given_name=given_name,
        birth_date=birth_date,
        identifier=identifier,
    )
    items, total = await service.list_in_tenant(
        current_user.tenant_id, filters, limit=limit, offset=offset
    )
    return PatientListResponse(
        items=[PatientRead.model_validate(p) for p in items],
        meta=PaginationMeta(total=total, limit=limit, offset=offset),
    )


@router.get(
    "/patients/{patient_id}",
    operation_id="get_patient",
    response_model=PatientRead,
)
async def get_patient(
    patient: PatientAccessDep,  # AUTH-HARDEN
) -> PatientRead:
    return PatientRead.model_validate(patient)


@router.post(
    "/patients",
    operation_id="create_patient",
    response_model=PatientRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_patient(
    payload: PatientCreate,
    service: PatientServiceDep,
    current_user: SessionUser = _CAREGIVER_OR_ADMIN_GUARD,  # AUTH-HARDEN
) -> PatientRead:
    patient = await service.create(current_user, payload)
    return PatientRead.model_validate(patient)


@router.patch(
    "/patients/{patient_id}",
    operation_id="update_patient",
    response_model=PatientRead,
)
async def update_patient(
    patient_id: UUID,
    payload: PatientUpdate,
    service: PatientServiceDep,
    _patient: PatientAccessDep,  # AUTH-HARDEN
    current_user: SessionUser = _CAREGIVER_OR_ADMIN_GUARD,
) -> PatientRead:
    patient = await service.update(current_user, patient_id, payload)
    return PatientRead.model_validate(patient)


@router.delete(
    "/patients/{patient_id}",
    operation_id="soft_delete_patient",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def soft_delete_patient(
    patient_id: UUID,
    service: PatientServiceDep,
    _patient: PatientAccessDep,  # AUTH-HARDEN
    current_user: SessionUser = _CAREGIVER_OR_ADMIN_GUARD,
) -> None:
    await service.soft_delete(current_user, patient_id)


__all__ = ["router"]
