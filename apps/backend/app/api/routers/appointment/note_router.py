"""Append-only appointment notes. Guarded by appointment visibility
(`AppointmentAccessDep`); any visible caller may add a note, attributed to
them. No edit/delete routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.core.enums.user import Role
from app.schemas.appointment.note import AppointmentNoteCreate, AppointmentNoteRead
from app.schemas.auth.auth import SessionUser
from app.services.access.identity.deps import require_role
from app.services.appointment.deps import AppointmentAccessDep
from app.services.appointment.note_deps import NoteServiceDep

router = APIRouter(tags=["appointments"])

_CAREGIVER_OR_ADMIN_GUARD = Depends(require_role(Role.ADMIN, Role.CAREGIVER))


@router.get(
    "/appointments/{appointment_id}/notes",
    operation_id="list_appointment_notes",
    response_model=list[AppointmentNoteRead],
)
async def list_appointment_notes(
    appointment: AppointmentAccessDep,
    service: NoteServiceDep,
) -> list[AppointmentNoteRead]:
    return await service.list(appointment.id)


@router.post(
    "/appointments/{appointment_id}/notes",
    operation_id="add_appointment_note",
    response_model=AppointmentNoteRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_appointment_note(
    appointment: AppointmentAccessDep,
    payload: AppointmentNoteCreate,
    service: NoteServiceDep,
    current_user: Annotated[SessionUser, _CAREGIVER_OR_ADMIN_GUARD],
) -> AppointmentNoteRead:
    return await service.add(
        appointment_id=appointment.id, author=current_user, body=payload.body
    )
