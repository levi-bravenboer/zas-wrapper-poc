# Aggregator orchestration for `/tasks`. Holds the source registry and
# dispatches list/get to the right projection. v1 ships exactly one
# source (`appointment`); adding a second source = add to `SOURCES`
# plus implement the same `name + list + get` shape.
#
# Per design.md D-AGG: there is no `tasks` table; every `TaskItem` is
# materialised by a source projection at request time. Multi-source
# `list()` for v2 becomes a top-K merge by `due_at asc`; v1 delegates
# directly because there is only one source.

from __future__ import annotations

from typing import Final
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas._list.page import Page
from app.schemas.auth.auth import SessionUser
from app.schemas.task.task_item import Source, TaskItem
from app.services.tasks.errors import TaskNotFoundError, UnknownTaskSourceError
from app.services.tasks.sources.appointment_source import AppointmentSource

VALID_SOURCES: Final[frozenset[str]] = frozenset({"appointment"})


class TasksAggregator:
    def __init__(self) -> None:
        self._sources: dict[Source, AppointmentSource] = {
            "appointment": AppointmentSource(),
        }

    async def list(
        self,
        session: AsyncSession,
        caller: SessionUser,
        *,
        page: int,
        page_size: int,
        patient_id_filter: UUID | None = None,
    ) -> Page[TaskItem]:
        # v1: single source → delegate. v2+ would top-K merge per-source pages.
        return await self._sources["appointment"].list(
            session,
            caller,
            page=page,
            page_size=page_size,
            patient_id_filter=patient_id_filter,
        )

    async def get(
        self,
        session: AsyncSession,
        caller: SessionUser,
        *,
        source: str,
        source_id: UUID,
    ) -> TaskItem:
        if source not in VALID_SOURCES:
            raise UnknownTaskSourceError()
        item = await self._sources[source].get(session, caller, source_id)  # type: ignore[index]
        if item is None:
            raise TaskNotFoundError()
        return item
