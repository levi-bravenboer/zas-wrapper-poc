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


def _to_view(observation: Observation) -> ObservationView:
    return ObservationView.model_validate(observation)


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
    observation = await service.create(
        patient_id=patient.id,
        measurement_type=payload.measurement_type,
        value=payload.value,
        effective_date_time=payload.effective_date_time,
        performer_id=current_user.id,
    )
    return _to_view(observation)


@router.get(
    "/patients/{patient_id}/observations",
    operation_id="list_patient_observations",
    response_model=list[ObservationView],
)
async def list_patient_observations(
    patient: PatientAccessDep,  # AUTH-HARDEN: graduated — Keto `view` check when AUTHZ_KETO_ENABLED
    service: ObservationServiceDep,
) -> list[ObservationView]:
    observations = await service.list_for_patient(patient.id)
    return [_to_view(o) for o in observations]
