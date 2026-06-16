# Generic note service. Authz-free: the per-entity route enforces owner
# access and resolves the owner + patient before calling here.

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from app.core.enums.collaboration import OwnerType
from app.db.models.collaboration import Note
from app.repositories.collaboration import NoteRepository
from app.schemas.auth.auth import SessionUser
from app.schemas.collaboration.note import NoteRead


def _to_read(note: Note, author_display_name: str) -> NoteRead:
    return NoteRead(
        id=note.id,
        owner_type=note.owner_type,
        owner_id=note.owner_id,
        patient_id=note.patient_id,
        author_user_id=note.author_user_id,
        author_display_name=author_display_name,
        body=note.body,
        created_at=note.created_at,
    )


def _project(rows: Sequence[tuple[Note, str]]) -> list[NoteRead]:
    return [_to_read(note, name) for note, name in rows]


class NoteService:
    def __init__(self, repo: NoteRepository) -> None:
        self._repo = repo

    async def list_for_owner(
        self, *, tenant_id: UUID, owner_type: OwnerType, owner_id: UUID
    ) -> list[NoteRead]:
        return _project(
            await self._repo.list_for_owner(
                tenant_id=tenant_id, owner_type=owner_type, owner_id=owner_id
            )
        )

    async def list_for_patient(self, *, tenant_id: UUID, patient_id: UUID) -> list[NoteRead]:
        return _project(await self._repo.list_for_patient(tenant_id=tenant_id, patient_id=patient_id))

    async def add(
        self,
        *,
        owner_type: OwnerType,
        owner_id: UUID,
        patient_id: UUID | None,
        author: SessionUser,
        body: str,
    ) -> NoteRead:
        note = await self._repo.add(
            owner_type=owner_type,
            owner_id=owner_id,
            patient_id=patient_id,
            author_user_id=author.id,
            body=body,
        )
        return _to_read(note, author.display_name)
