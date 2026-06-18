from __future__ import annotations

from fastapi import APIRouter

from app.repositories.patient.deps import PatientRepoDep
from app.repositories.user.deps import UserRepoDep
from app.schemas.auth.mobile_session import PatientSession
from app.services.access.identity.deps import CurrentUserDep
from app.services.access.identity.errors import UnauthenticatedError

router = APIRouter(tags=["mobile"])


@router.get(
    "/mobile/auth/me",
    operation_id="mobile_get_current_patient",
    response_model=PatientSession,
)
async def mobile_get_current_patient(
    current_user: CurrentUserDep,
    user_repo: UserRepoDep,
    patient_repo: PatientRepoDep,
) -> PatientSession:
    if not current_user.is_patient:
        raise UnauthenticatedError()

    user = await user_repo.get_by_id(current_user.id)
    if user is None or user.patient_id is None:
        raise UnauthenticatedError()

    patient = await patient_repo.get_by_id(current_user.tenant_id, user.patient_id)
    if patient is None:
        raise UnauthenticatedError()

    return PatientSession(
        id=user.id,
        given_name=patient.given_name,
        patient_id=user.patient_id,
        tenant_id=user.tenant_id,
    )
