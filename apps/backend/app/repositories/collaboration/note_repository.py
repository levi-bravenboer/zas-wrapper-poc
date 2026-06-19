from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.collaboration import OwnerType
from app.db.audit import SESSION_ACTOR_KEY
from app.db.models.appointment import Appointment
from app.db.models.collaboration import Note
from app.db.models.pathway.block import PathwayBlock
from app.db.models.pathway.block_execution import PathwayBlockExecution
from app.db.models.task import Task
from app.repositories.collaboration._queries import list_with_author_name


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

    async def owner_labels(
        self, *, tenant_id: UUID, ids_by_type: dict[OwnerType, set[UUID]]
    ) -> dict[UUID, str]:
        """Resolve a human label for each owner — appointment / task title,
        pathway-step block name — so the patient aggregate can show where a
        note lives. Batched per owner type."""

        out: dict[UUID, str] = {}
        appointments = ids_by_type.get(OwnerType.APPOINTMENT)
        if appointments:
            rows = await self._session.execute(
                select(Appointment.id, Appointment.title).where(
                    Appointment.id.in_(appointments), Appointment.tenant_id == tenant_id
                )
            )
            for owner_id, title in rows:
                out[owner_id] = title
        tasks = ids_by_type.get(OwnerType.TASK)
        if tasks:
            rows = await self._session.execute(
                select(Task.id, Task.title).where(Task.id.in_(tasks), Task.tenant_id == tenant_id)
            )
            for owner_id, title in rows:
                out[owner_id] = title
        steps = ids_by_type.get(OwnerType.PATHWAY_STEP)
        if steps:
            rows = await self._session.execute(
                select(PathwayBlockExecution.id, PathwayBlock.label)
                .join(PathwayBlock, PathwayBlock.id == PathwayBlockExecution.block_template_id)
                .where(
                    PathwayBlockExecution.id.in_(steps),
                    PathwayBlockExecution.tenant_id == tenant_id,
                )
            )
            for owner_id, label in rows:
                if label:
                    out[owner_id] = label
        return out

    async def _list(
        self, *predicates, tenant_id: UUID, ascending: bool
    ) -> Sequence[tuple[Note, str]]:
        order = Note.created_at.asc() if ascending else Note.created_at.desc()
        return await list_with_author_name(
            self._session,
            Note,
            author_col=Note.author_user_id,
            tenant_id=tenant_id,
            predicates=predicates,
            order_by=(order, Note.id.asc()),
        )

    async def add(
        self,
        *,
        owner_type: OwnerType,
        owner_id: UUID,
        patient_id: UUID | None,
        author_user_id: UUID,
        body: str | None,
        filename: str | None = None,
        content_type: str | None = None,
        size: int | None = None,
        storage_key: str | None = None,
    ) -> Note:
        note = Note(
            owner_type=owner_type,
            owner_id=owner_id,
            patient_id=patient_id,
            author_user_id=author_user_id,
            body=body,
            filename=filename,
            content_type=content_type,
            size=size,
            storage_key=storage_key,
        )
        self._session.add(note)
        await self._session.flush()
        return note

    async def get(self, *, note_id: UUID, tenant_id: UUID) -> Note | None:
        result = await self._session.execute(
            select(Note).where(
                Note.id == note_id,
                Note.tenant_id == tenant_id,
                Note.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def soft_delete(self, note: Note) -> None:
        note.deleted_at = func.now()
        actor = self._session.info.get(SESSION_ACTOR_KEY)
        if actor is not None:
            note.deleted_by = actor.id
        await self._session.flush()
