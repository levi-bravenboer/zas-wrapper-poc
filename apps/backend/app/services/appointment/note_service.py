from __future__ import annotations

from uuid import UUID

from app.repositories.appointment.note_repository import AppointmentNoteRepository
from app.schemas.appointment.note import AppointmentNoteRead
from app.schemas.auth.auth import SessionUser


class AppointmentNoteService:
    def __init__(self, repo: AppointmentNoteRepository) -> None:
        self._repo = repo

    async def list(self, appointment_id: UUID, *, tenant_id: UUID) -> list[AppointmentNoteRead]:
        rows = await self._repo.list_for_appointment(appointment_id, tenant_id=tenant_id)
        return [
            AppointmentNoteRead(
                id=note.id,
                author_user_id=note.author_user_id,
                author_display_name=display_name,
                body=note.body,
                created_at=note.created_at,
            )
            for note, display_name in rows
        ]

    async def add(
        self, *, appointment_id: UUID, author: SessionUser, body: str
    ) -> AppointmentNoteRead:
        note = await self._repo.add(
            appointment_id=appointment_id, author_user_id=author.id, body=body
        )
        return AppointmentNoteRead(
            id=note.id,
            author_user_id=note.author_user_id,
            author_display_name=author.display_name,
            body=note.body,
            created_at=note.created_at,
        )
