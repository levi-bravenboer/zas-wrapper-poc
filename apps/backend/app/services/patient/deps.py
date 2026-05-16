from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends

from app.core.enums.user import Role
from app.db.models.patient import Patient
from app.repositories.organisation.deps import OrganisationRepoDep
from app.repositories.patient.deps import PatientRepoDep
from app.schemas.auth.auth import SessionUser
from app.services.auth.deps import require_role
from app.services.care_team.deps import CareTeamServiceDep
from app.services.patient.errors import PatientNotFoundError
from app.services.patient.patient_service import PatientService


def get_patient_service(
    repo: PatientRepoDep,
    organisation_repo: OrganisationRepoDep,
    care_team_service: CareTeamServiceDep,
) -> PatientService:
    return PatientService(repo, organisation_repo, care_team_service)


PatientServiceDep = Annotated[PatientService, Depends(get_patient_service)]


async def require_patient_access(
    patient_id: UUID,
    service: PatientServiceDep,
    care_team_service: CareTeamServiceDep,
    current_user: SessionUser = Depends(require_role(Role.ADMIN, Role.CAREGIVER)),
) -> Patient:
    """Resolve a patient inside the caller's tenant or raise 404.

    Admins see every patient in their tenant. Caregivers must have an
    open `CareTeamParticipant` row on a team for this patient. Cross-team
    and cross-tenant misses both surface as 404 by design — leaking
    existence is a worse failure mode than a vague 404.
    """

    # AUTH-HARDEN
    patient = await service.get_by_id(current_user.tenant_id, patient_id)
    if patient is None:
        raise PatientNotFoundError()
    if current_user.role != Role.ADMIN:
        has_access = await care_team_service.has_open_membership(current_user.id, patient_id)
        if not has_access:
            raise PatientNotFoundError()
    return patient


PatientAccessDep = Annotated[Patient, Depends(require_patient_access)]
