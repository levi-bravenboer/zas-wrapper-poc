"""Patient↔Luscii link + merged patient-data routes (luscii-patient-enrichment).

Patient-scoped (`/patients/{patient_id}/luscii-*`), so they live in the
patient router package, not under `/luscii/*` (that prefix is the
builder-picker surface).
"""

from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Query, status

from app.core.errors import ErrorResponse
from app.db.models.patient import PatientLusciiConnection
from app.schemas.luscii.patient_data import (
    LusciiConnectionSummary,
    LusciiLinkRequest,
    LusciiLinkResult,
    LusciiPatientData,
)
from app.services.luscii.deps import LusciiPatientDataServiceDep
from app.services.patient.deps import PatientAccessDep, PatientEditDep


def _connection_summary(conn: PatientLusciiConnection) -> LusciiConnectionSummary:
    return LusciiConnectionSummary(
        connection_id=conn.id,
        luscii_patient_id=conn.luscii_patient_id,
        status=conn.status.value,
        program_id=conn.program_id,
        program_name=conn.program_name,
    )


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


@router.get(
    "/patients/{patient_id}/luscii-connections",
    operation_id="list_patient_luscii_connections",
    response_model=list[LusciiConnectionSummary],
)
async def list_patient_luscii_connections(
    patient: PatientAccessDep,
    service: LusciiPatientDataServiceDep,
) -> list[LusciiConnectionSummary]:
    conns = await service.list_connections(patient.id)
    return [_connection_summary(c) for c in conns]


@router.post(
    "/patients/{patient_id}/luscii-connections",
    operation_id="add_patient_luscii_connection",
    response_model=LusciiConnectionSummary,
    status_code=status.HTTP_201_CREATED,
    responses=_LINK_ERRORS,
)
async def add_patient_luscii_connection(
    payload: LusciiLinkRequest,
    patient: PatientEditDep,  # AUTH-HARDEN: Keto `edit` verb — same predicate as PATCH
    service: LusciiPatientDataServiceDep,
) -> LusciiConnectionSummary:
    conn = await service.add_connection(patient, payload.luscii_patient_id)
    return _connection_summary(conn)


@router.delete(
    "/patients/{patient_id}/luscii-connections/{connection_id}",
    operation_id="deactivate_patient_luscii_connection",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def deactivate_patient_luscii_connection(
    connection_id: UUID,
    patient: PatientEditDep,  # AUTH-HARDEN: Keto `edit` verb — same predicate as PATCH
    service: LusciiPatientDataServiceDep,
) -> None:
    await service.deactivate_connection(patient, connection_id)


__all__ = ["router"]
