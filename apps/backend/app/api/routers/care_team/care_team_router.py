from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, status

from app.schemas.care_team.care_team import CareTeamCreate, CareTeamRead, CareTeamUpdate
from app.schemas.care_team.participant import (
    ParticipantCreate,
    ParticipantRead,
    ParticipantRoleChange,
)
from app.services.access.identity.deps import CurrentUserDep
from app.services.care_team.deps import CareTeamServiceDep
from app.services.patient.deps import PatientAccessDep

router = APIRouter(tags=["care-teams"])


@router.get(
    "/patients/{patient_id}/care-teams",
    operation_id="list_patient_care_teams",
    response_model=list[CareTeamRead],
)
async def list_patient_care_teams(
    patient: PatientAccessDep,  # AUTH-HARDEN: graduated — Keto view check when AUTHZ_KETO_ENABLED
    service: CareTeamServiceDep,
    _current_user: CurrentUserDep,  # AUTH-HARDEN: authenticated only; Keto gates patient data (D12)
) -> list[CareTeamRead]:
    teams = await service.list_for_patient(patient.tenant_id, patient.id)
    return [CareTeamRead.model_validate(t) for t in teams]


@router.post(
    "/patients/{patient_id}/care-teams",
    operation_id="create_care_team",
    response_model=CareTeamRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_care_team(
    payload: CareTeamCreate,
    patient: PatientAccessDep,  # AUTH-HARDEN: graduated — Keto view check when AUTHZ_KETO_ENABLED
    service: CareTeamServiceDep,
    current_user: CurrentUserDep,  # AUTH-HARDEN: authenticated only; Keto gates patient data (D12)
) -> CareTeamRead:
    team = await service.create_for_patient(current_user, patient.id, payload)
    return CareTeamRead.model_validate(team)


@router.patch(
    "/care-teams/{care_team_id}",
    operation_id="update_care_team",
    response_model=CareTeamRead,
)
async def update_care_team(
    care_team_id: UUID,
    payload: CareTeamUpdate,
    service: CareTeamServiceDep,
    current_user: CurrentUserDep,  # AUTH-HARDEN: authenticated only; Keto gates patient data (D12)
) -> CareTeamRead:
    team = await service.update(current_user, care_team_id, payload)
    return CareTeamRead.model_validate(team)


@router.post(
    "/care-teams/{care_team_id}/participants",
    operation_id="add_care_team_participant",
    response_model=ParticipantRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_care_team_participant(
    care_team_id: UUID,
    payload: ParticipantCreate,
    service: CareTeamServiceDep,
    current_user: CurrentUserDep,  # AUTH-HARDEN: authenticated only; Keto gates patient data (D12)
) -> ParticipantRead:
    row = await service.add_participant(current_user, care_team_id, payload)
    return ParticipantRead.model_validate(row)


@router.patch(
    "/care-teams/{care_team_id}/participants/{user_id}",
    operation_id="change_participant_role",
    response_model=ParticipantRead,
)
async def change_participant_role(
    care_team_id: UUID,
    user_id: UUID,
    payload: ParticipantRoleChange,
    service: CareTeamServiceDep,
    current_user: CurrentUserDep,  # AUTH-HARDEN: authenticated only; Keto gates patient data (D12)
) -> ParticipantRead:
    row = await service.change_participant_role(
        current_user, care_team_id, user_id, payload.role_in_care
    )
    return ParticipantRead.model_validate(row)


@router.delete(
    "/care-teams/{care_team_id}/participants/{user_id}",
    operation_id="unassign_care_team_participant",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def unassign_care_team_participant(
    care_team_id: UUID,
    user_id: UUID,
    service: CareTeamServiceDep,
    current_user: CurrentUserDep,  # AUTH-HARDEN: authenticated only; Keto gates patient data (D12)
) -> None:
    await service.unassign_participant(current_user, care_team_id, user_id)


__all__ = ["router"]
