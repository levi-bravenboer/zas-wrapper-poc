"""First-class appointment read API.

Two reads: `GET /appointments` (internal, caller-scoped list) and
`GET /appointments/{appointment_id}` (detail, patient-access-gated — admits
external grant-holders). No write routes ship here.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import ListQueryParamsDep
from app.schemas._list.page import Page
from app.schemas.appointment.appointment import AppointmentRead, PatientAppointmentEntry
from app.services.access.identity.deps import CurrentUserDep
from app.services.appointment.deps import AppointmentAccessDep, AppointmentReadServiceDep
from app.services.patient.deps import PatientAccessDep

router = APIRouter(tags=["appointments"])


@router.get(
    "/appointments",
    operation_id="list_appointments",
    response_model=Page[AppointmentRead],
)
async def list_appointments(
    service: AppointmentReadServiceDep,
    query: ListQueryParamsDep,
    current_user: CurrentUserDep,
) -> Page[AppointmentRead]:
    return await service.list_visible(current_user, page=query.page, page_size=query.page_size)


@router.get(
    "/appointments/{appointment_id}",
    operation_id="get_appointment",
    response_model=AppointmentRead,
)
async def get_appointment(appointment: AppointmentAccessDep) -> AppointmentRead:
    return appointment


@router.get(
    "/patients/{patient_id}/appointments",
    operation_id="list_patient_appointments",
    response_model=list[PatientAppointmentEntry],
)
async def list_patient_appointments(
    patient: PatientAccessDep,
    service: AppointmentReadServiceDep,
) -> list[PatientAppointmentEntry]:
    return await service.list_for_patient(tenant_id=patient.tenant_id, patient_id=patient.id)
