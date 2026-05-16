from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import ListQueryParamsDep
from app.core.enums.user import Role
from app.schemas._list.page import Page
from app.schemas.auth.auth import SessionUser
from app.schemas.patient.patient import PatientCreate, PatientRead, PatientUpdate
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
    response_model=Page[PatientRead],
)
async def list_patients(
    query: ListQueryParamsDep,
    service: PatientServiceDep,
    current_user: Annotated[SessionUser, _CAREGIVER_OR_ADMIN_GUARD],  # AUTH-HARDEN
    identifier: Annotated[
        str | None,
        Query(description="FHIR Patient.identifier short-circuit; exact value match"),
    ] = None,
) -> Page[PatientRead]:
    # AUTH-HARDEN: tenant scope is applied inside `BaseListRepository.list_page`
    # via `_tenant_predicate`; caregiver visibility (open `CareTeamParticipant`
    # row) is applied inside `PatientService.list_in_tenant`. FHIR semantics:
    # `identifier` short-circuits the other discrete params, so we drop
    # `filter[...]` + `q` from the query before listing when set.
    effective_query = query.model_copy(update={"filters": {}, "q": None}) if identifier else query
    page = await service.list_in_tenant(current_user, effective_query, identifier=identifier)
    return Page[PatientRead](
        items=[PatientRead.model_validate(p) for p in page.items],
        page=page.page,
        page_size=page.page_size,
        total=page.total,
        total_pages=page.total_pages,
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
    current_user: Annotated[SessionUser, _CAREGIVER_OR_ADMIN_GUARD],  # AUTH-HARDEN
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
    current_user: Annotated[SessionUser, _CAREGIVER_OR_ADMIN_GUARD],
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
    current_user: Annotated[SessionUser, _CAREGIVER_OR_ADMIN_GUARD],
) -> None:
    await service.soft_delete(current_user, patient_id)


__all__ = ["router"]
