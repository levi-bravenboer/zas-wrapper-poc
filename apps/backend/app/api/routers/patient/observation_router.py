"""Patient-scoped local observations (manual measurement entry).

Reads + writes go through `PatientAccessDep` / `PatientEditDep`, mirroring the
Luscii router — observations are patient data, governed by the same view/edit
verbs. The route layer is intentionally thin: the service owns the allow-list
resolution + persistence; the router just wires deps and shapes the response.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, status

from app.core.errors import ErrorResponse
from app.db.models.patient.observation import Observation
from app.schemas.patient.observation import ObservationCreate, ObservationView
from app.services.access.identity.deps import CurrentUserDep
from app.services.patient.deps import PatientAccessDep, PatientEditDep
from app.services.patient.observation.deps import ObservationServiceDep

router = APIRouter(tags=["patients"])

_CREATE_ERRORS: dict[int | str, dict[str, Any]] = {
    422: {"model": ErrorResponse},
}


def _to_view(
    observation: Observation,
    performer_display_name: str,
    owner_label: str | None,
) -> ObservationView:
    return ObservationView(
        id=observation.id,
        patient_id=observation.patient_id,
        code=observation.code,
        code_system=observation.code_system,
        value=observation.value,
        unit=observation.unit,
        effective_date_time=observation.effective_date_time,
        performer_id=observation.performer_id,
        performer_display_name=performer_display_name,
        owner_type=observation.owner_type,
        owner_id=observation.owner_id,
        owner_label=owner_label,
        created_at=observation.created_at,
    )


@router.post(
    "/patients/{patient_id}/observations",
    operation_id="create_patient_observation",
    response_model=ObservationView,
    status_code=status.HTTP_201_CREATED,
    responses=_CREATE_ERRORS,
)
async def create_patient_observation(
    payload: ObservationCreate,
    patient: PatientEditDep,  # AUTH-HARDEN: Keto `edit` verb when AUTHZ_KETO_ENABLED — same predicate as PATCH
    current_user: CurrentUserDep,
    service: ObservationServiceDep,
) -> ObservationView:
    observation, name, owner_label = await service.create(
        patient_id=patient.id,
        measurement_type=payload.measurement_type,
        value=payload.value,
        effective_date_time=payload.effective_date_time,
        performer_id=current_user.id,
        owner_type=payload.owner_type,
        owner_id=payload.owner_id,
    )
    return _to_view(observation, name, owner_label)


@router.get(
    "/patients/{patient_id}/observations",
    operation_id="list_patient_observations",
    response_model=list[ObservationView],
)
async def list_patient_observations(
    patient: PatientAccessDep,  # AUTH-HARDEN: graduated — Keto `view` check when AUTHZ_KETO_ENABLED
    current_user: CurrentUserDep,
    service: ObservationServiceDep,
) -> list[ObservationView]:
    rows = await service.list_for_patient(patient.id, current_user.tenant_id)
    return [_to_view(obs, name, label) for obs, name, label in rows]
