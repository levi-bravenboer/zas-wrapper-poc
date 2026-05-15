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
from app.services.patient.errors import PatientNotFoundError
from app.services.patient.patient_service import PatientService


def get_patient_service(
    repo: PatientRepoDep, organisation_repo: OrganisationRepoDep
) -> PatientService:
    return PatientService(repo, organisation_repo)


PatientServiceDep = Annotated[PatientService, Depends(get_patient_service)]


async def require_patient_access(
    patient_id: UUID,
    service: PatientServiceDep,
    current_user: SessionUser = Depends(require_role(Role.ADMIN, Role.CAREGIVER)),
) -> Patient:
    """Resolve a patient inside the caller's tenant or raise 404.

    AUTH-HARDEN: PoC body is tenant-scope only. MVP must layer the
    patient-level ACL described in BL-010 (caregiver sees patients in
    their care-team or delegated-care subtree, admin sees all in tenant).
    Returning 404 (not 403) on cross-tenant misses by design — leaking
    existence across tenants is a worse failure mode than a vague 404.
    """

    # AUTH-HARDEN
    patient = await service.get_by_id(current_user.tenant_id, patient_id)
    if patient is None:
        raise PatientNotFoundError()
    return patient


PatientAccessDep = Annotated[Patient, Depends(require_patient_access)]
