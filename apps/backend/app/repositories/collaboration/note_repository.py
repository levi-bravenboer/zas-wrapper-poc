from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.collaboration import OwnerType
from app.db.models.collaboration import Note
from app.db.models.user import User


class NoteRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_for_owner(
        self, *, tenant_id: UUID, owner_type: OwnerType, owner_id: UUID
    ) -> Sequence[tuple[Note, str]]:
        return await self._list(
            Note.owner_type == owner_type,
            Note.owner_id == owner_id,
            tenant_id=tenant_id,
            ascending=True,
        )

    async def list_for_patient(
        self, *, tenant_id: UUID, patient_id: UUID
    ) -> Sequence[tuple[Note, str]]:
        return await self._list(Note.patient_id == patient_id, tenant_id=tenant_id, ascending=False)

    async def _list(self, *predicates, tenant_id: UUID, ascending: bool) -> Sequence[tuple[Note, str]]:
        order = Note.created_at.asc() if ascending else Note.created_at.desc()
        result = await self._session.execute(
            select(Note, User.display_name)
            .join(User, User.id == Note.author_user_id)
            .where(Note.tenant_id == tenant_id, Note.deleted_at.is_(None), *predicates)
            .order_by(order, Note.id.asc())
        )
        return result.tuples().all()

    async def add(
        self,
        *,
        owner_type: OwnerType,
        owner_id: UUID,
        patient_id: UUID,
        author_user_id: UUID,
        body: str,
    ) -> Note:
        note = Note(
            owner_type=owner_type,
            owner_id=owner_id,
            patient_id=patient_id,
            author_user_id=author_user_id,
            body=body,
        )
        self._session.add(note)
        await self._session.flush()
        return note
