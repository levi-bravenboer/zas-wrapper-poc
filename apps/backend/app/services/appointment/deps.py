from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends

from app.core.enums.user import Role
from app.core.settings import SettingsDep
from app.db.engine import SessionDep
from app.repositories.appointment import AppointmentReadRepository
from app.schemas.appointment.appointment import AppointmentRead
from app.schemas.auth.auth import SessionUser
from app.services.access.identity.deps import require_role
from app.services.access.permissions.deps import KetoClientDep
from app.services.appointment.appointment_service import AppointmentReadService
from app.services.appointment.errors import AppointmentNotFoundError
from app.services.care_team.deps import CareTeamServiceDep
from app.services.patient.deps import PatientServiceDep, resolve_patient_with_relation


def get_appointment_read_service(session: SessionDep) -> AppointmentReadService:
    return AppointmentReadService(AppointmentReadRepository(session))


AppointmentReadServiceDep = Annotated[
    AppointmentReadService, Depends(get_appointment_read_service)
]


async def require_appointment_access(
    appointment_id: UUID,
    appointment_service: AppointmentReadServiceDep,
    patient_service: PatientServiceDep,
    care_team_service: CareTeamServiceDep,
    session: SessionDep,
    settings: SettingsDep,
    keto: KetoClientDep,
    current_user: SessionUser = Depends(require_role(Role.ADMIN, Role.CAREGIVER)),
) -> AppointmentRead:
    """Resolve a visible appointment or 404.

    Detail access is patient-relation-based, not list-style participant
    scoping: load the appointment in the caller's tenant, then enforce
    `require_patient_access` on its subject patient — which admits admins
    (tenant-wide), caregivers with a care-team/org relation, and external
    grant-holders. A miss surfaces as 404 (existence hiding), the same as a
    missing appointment.
    """

    read = await appointment_service.get(
        tenant_id=current_user.tenant_id, appointment_id=appointment_id
    )
    if read is None:
        raise AppointmentNotFoundError()
    if current_user.role == Role.ADMIN:
        return read
    # A participant on the appointment sees it directly; otherwise fall back
    # to patient-relation access (care-team / org / external grant).
    if await appointment_service.is_participant(
        appointment_id=appointment_id, user_id=current_user.id
    ):
        return read
    await resolve_patient_with_relation(
        read.patient.id,
        patient_service,
        care_team_service,
        session,
        settings,
        keto,
        current_user,
        relation="view",
    )
    return read


AppointmentAccessDep = Annotated[AppointmentRead, Depends(require_appointment_access)]
