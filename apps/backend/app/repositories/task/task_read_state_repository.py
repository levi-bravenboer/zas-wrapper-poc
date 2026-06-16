# SQL access for per-user task read-state. A `task_read_state` row means the
# user has opened the `(source, source_id)` task; absence means unopened.
# Read-state is decoupled from the task source so any `/tasks` source reuses
# this table unchanged.

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.task import TaskReadState


class TaskReadStateRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def opened_source_ids(
        self, *, user_id: UUID, source: str, source_ids: Sequence[UUID]
    ) -> set[UUID]:
        """Subset of `source_ids` the user has an open read-state row for."""

        if not source_ids:
            return set()
        result = await self._session.execute(
            select(TaskReadState.source_id).where(
                TaskReadState.user_id == user_id,
                TaskReadState.source == source,
                TaskReadState.source_id.in_(source_ids),
                TaskReadState.deleted_at.is_(None),
            )
        )
        return set(result.scalars().all())

    async def mark_opened(self, *, user_id: UUID, source: str, source_id: UUID) -> None:
        """Idempotently record that the user opened this task.

        Tenant / audit columns are stamped by the `before_flush` audit hook
        from the request actor (the opener). A no-op when a row already
        exists, so repeated detail opens never duplicate.
        """

        existing = (
            await self._session.execute(
                select(TaskReadState.id).where(
                    TaskReadState.user_id == user_id,
                    TaskReadState.source == source,
                    TaskReadState.source_id == source_id,
                    TaskReadState.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            return
        self._session.add(TaskReadState(user_id=user_id, source=source, source_id=source_id))
        await self._session.flush()
