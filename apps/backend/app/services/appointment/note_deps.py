from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.db.engine import SessionDep
from app.repositories.appointment.note_repository import AppointmentNoteRepository
from app.services.appointment.note_service import AppointmentNoteService


def get_note_service(session: SessionDep) -> AppointmentNoteService:
    return AppointmentNoteService(AppointmentNoteRepository(session))


NoteServiceDep = Annotated[AppointmentNoteService, Depends(get_note_service)]
