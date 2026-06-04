"""External collaboration endpoints (REQ-FUN-1/42).

Profiles are admin config; consents + grants are managed by caregivers who
already hold access to the patient (the `PatientAccessDep` guard) or admins.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.core.enums.user import Role
from app.db.engine import SessionDep
from app.schemas.access.external import (
    ConsentCreate,
    ConsentRead,
    ExternalAccessProfileRead,
    ExternalAccessProfileUpsert,
    ExternalGrantCreate,
    ExternalGrantRead,
)
from app.schemas.auth.auth import SessionUser
from app.services.access.grants.external_service import ExternalAccessService
from app.services.access.identity.deps import require_role
from app.services.patient.deps import PatientAccessDep

router = APIRouter(tags=["external-collaboration"])

_ADMIN_GUARD = Depends(require_role(Role.ADMIN))
_CAREGIVER_OR_ADMIN_GUARD = Depends(require_role(Role.ADMIN, Role.CAREGIVER))


def get_external_access_service(session: SessionDep) -> ExternalAccessService:
    return ExternalAccessService(session)


ExternalAccessServiceDep = Annotated[ExternalAccessService, Depends(get_external_access_service)]


@router.get(
    "/admin/external-access-profiles",
    operation_id="list_external_access_profiles",
    response_model=list[ExternalAccessProfileRead],
)
async def list_external_access_profiles(
    service: ExternalAccessServiceDep,
    current_user: Annotated[SessionUser, _ADMIN_GUARD],  # AUTH-HARDEN: admin-only
) -> list[ExternalAccessProfileRead]:
    rows = await service.list_profiles(current_user.tenant_id)
    return [ExternalAccessProfileRead.model_validate(p) for p in rows]


@router.put(
    "/admin/external-access-profiles",
    operation_id="upsert_external_access_profile",
    response_model=ExternalAccessProfileRead,
)
async def upsert_external_access_profile(
    payload: ExternalAccessProfileUpsert,
    service: ExternalAccessServiceDep,
    current_user: Annotated[SessionUser, _ADMIN_GUARD],  # AUTH-HARDEN: admin-only
) -> ExternalAccessProfileRead:
    profile = await service.upsert_profile(
        current_user,
        professional_type=payload.professional_type,
        allow_read=payload.allow_read,
        allow_write=payload.allow_write,
        allow_record=payload.allow_record,
        allow_message=payload.allow_message,
    )
    return ExternalAccessProfileRead.model_validate(profile)


@router.post(
    "/patients/{patient_id}/consents",
    operation_id="create_consent",
    response_model=ConsentRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_consent(
    payload: ConsentCreate,
    service: ExternalAccessServiceDep,
    patient: PatientAccessDep,  # AUTH-HARDEN: patient relation required
    current_user: Annotated[SessionUser, _CAREGIVER_OR_ADMIN_GUARD],
) -> ConsentRead:
    consent = await service.create_consent(current_user, patient_id=patient.id, scope=payload.scope)
    return ConsentRead.model_validate(consent)


@router.post(
    "/patients/{patient_id}/consents/{consent_id}/revoke",
    operation_id="revoke_consent",
    response_model=ConsentRead,
)
async def revoke_consent(
    consent_id: UUID,
    service: ExternalAccessServiceDep,
    patient: PatientAccessDep,  # AUTH-HARDEN: patient relation required
    current_user: Annotated[SessionUser, _CAREGIVER_OR_ADMIN_GUARD],
) -> ConsentRead:
    consent = await service.revoke_consent(current_user, consent_id)
    return ConsentRead.model_validate(consent)


@router.get(
    "/patients/{patient_id}/external-grants",
    operation_id="list_external_grants",
    response_model=list[ExternalGrantRead],
)
async def list_external_grants(
    service: ExternalAccessServiceDep,
    patient: PatientAccessDep,  # AUTH-HARDEN: patient relation required
    current_user: Annotated[SessionUser, _CAREGIVER_OR_ADMIN_GUARD],
) -> list[ExternalGrantRead]:
    grants = await service.list_grants(current_user.tenant_id, patient_id=patient.id)
    return [ExternalGrantRead.model_validate(g) for g in grants]


@router.post(
    "/patients/{patient_id}/external-grants",
    operation_id="create_external_grant",
    response_model=ExternalGrantRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_external_grant(
    payload: ExternalGrantCreate,
    service: ExternalAccessServiceDep,
    patient: PatientAccessDep,  # AUTH-HARDEN: patient relation required
    current_user: Annotated[SessionUser, _CAREGIVER_OR_ADMIN_GUARD],
) -> ExternalGrantRead:
    grant = await service.create_grant(
        current_user,
        patient_id=patient.id,
        user_id=payload.user_id,
        professional_type=payload.professional_type,
        consent_id=payload.consent_id,
    )
    return ExternalGrantRead.model_validate(grant)


@router.post(
    "/external-grants/{grant_id}/end",
    operation_id="end_external_grant",
    response_model=ExternalGrantRead,
)
async def end_external_grant(
    grant_id: UUID,
    service: ExternalAccessServiceDep,
    current_user: Annotated[SessionUser, _CAREGIVER_OR_ADMIN_GUARD],
) -> ExternalGrantRead:
    grant = await service.end_grant(current_user, grant_id)
    return ExternalGrantRead.model_validate(grant)
