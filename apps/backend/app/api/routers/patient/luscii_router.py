"""Patient↔Luscii link + merged patient-data routes (luscii-patient-enrichment).

Patient-scoped (`/patients/{patient_id}/luscii-*`), so they live in the
patient router package, not under `/luscii/*` (that prefix is the
builder-picker surface).
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Query, status

from app.core.errors import ErrorResponse
from app.schemas.luscii.patient_data import (
    LusciiLinkRequest,
    LusciiLinkResult,
    LusciiPatientData,
)
from app.services.luscii.deps import LusciiPatientDataServiceDep
from app.services.patient.deps import PatientAccessDep, PatientEditDep

router = APIRouter(tags=["patients"])

_LINK_ERRORS: dict[int | str, dict[str, Any]] = {
    409: {"model": ErrorResponse},
    422: {"model": ErrorResponse},
    502: {"model": ErrorResponse},
    503: {"model": ErrorResponse},
}
_DATA_ERRORS: dict[int | str, dict[str, Any]] = {
    502: {"model": ErrorResponse},
    503: {"model": ErrorResponse},
}


@router.put(
    "/patients/{patient_id}/luscii-link",
    operation_id="link_patient_luscii",
    response_model=LusciiLinkResult,
    responses=_LINK_ERRORS,
)
async def link_patient_luscii(
    payload: LusciiLinkRequest,
    patient: PatientEditDep,  # AUTH-HARDEN: Keto `edit` verb when AUTHZ_KETO_ENABLED — same predicate as PATCH
    service: LusciiPatientDataServiceDep,
) -> LusciiLinkResult:
    return await service.link(patient, payload.luscii_patient_id)


@router.delete(
    "/patients/{patient_id}/luscii-link",
    operation_id="unlink_patient_luscii",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def unlink_patient_luscii(
    patient: PatientEditDep,  # AUTH-HARDEN: Keto `edit` verb when AUTHZ_KETO_ENABLED — same predicate as PATCH
    service: LusciiPatientDataServiceDep,
) -> None:
    await service.unlink(patient)


@router.get(
    "/patients/{patient_id}/luscii-data",
    operation_id="get_patient_luscii_data",
    response_model=LusciiPatientData,
    responses=_DATA_ERRORS,
)
async def get_patient_luscii_data(
    patient: PatientAccessDep,  # AUTH-HARDEN: graduated — Keto `view` check when AUTHZ_KETO_ENABLED
    service: LusciiPatientDataServiceDep,
    days: Annotated[int, Query(ge=1, le=365, description="Lookback window")] = 30,
) -> LusciiPatientData:
    return await service.get_patient_data(patient, days)


__all__ = ["router"]
