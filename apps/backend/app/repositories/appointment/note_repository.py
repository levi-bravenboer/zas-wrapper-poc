from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.appointment.appointment_note import AppointmentNote
from app.db.models.user import User


class AppointmentNoteRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_for_appointment(
        self, appointment_id: UUID, *, tenant_id: UUID
    ) -> Sequence[tuple[AppointmentNote, str]]:
        result = await self._session.execute(
            select(AppointmentNote, User.display_name)
            .join(User, User.id == AppointmentNote.author_user_id)
            .where(
                AppointmentNote.appointment_id == appointment_id,
                AppointmentNote.tenant_id == tenant_id,
                AppointmentNote.deleted_at.is_(None),
            )
            .order_by(AppointmentNote.created_at.asc(), AppointmentNote.id.asc())
        )
        return result.tuples().all()

    async def add(
        self, *, appointment_id: UUID, author_user_id: UUID, body: str
    ) -> AppointmentNote:
        note = AppointmentNote(
            appointment_id=appointment_id,
            author_user_id=author_user_id,
            body=body,
        )
        self._session.add(note)
        await self._session.flush()
        return note
