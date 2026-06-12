# Aggregator orchestration for `/tasks`. Holds the source registry and
# dispatches list/get to the right projection. v1 ships exactly one
# source (`appointment`); adding a second source = add to the registry
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
from app.schemas.task.task_item import TaskItem
from app.services.tasks.errors import TaskNotFoundError
from app.services.tasks.sources.appointment_source import AppointmentSource

VALID_SOURCES: Final[frozenset[str]] = frozenset({"appointment"})


class TasksAggregator:
    def __init__(self, session: AsyncSession) -> None:
        self._sources: dict[str, AppointmentSource] = {
            "appointment": AppointmentSource(session),
        }

    async def list(
        self,
        caller: SessionUser,
        *,
        page: int,
        page_size: int,
        patient_id_filter: UUID | None = None,
    ) -> Page[TaskItem]:
        # v1: single source → delegate. v2+ would top-K merge per-source pages.
        return await self._sources["appointment"].list(
            caller,
            page=page,
            page_size=page_size,
            patient_id_filter=patient_id_filter,
        )

    async def get(self, caller: SessionUser, *, source: str, source_id: UUID) -> TaskItem:
        # Unknown source and missing id are indistinguishable on the wire —
        # both raise the same not-found error (existence hiding).
        source_impl = self._sources.get(source)
        if source_impl is None:
            raise TaskNotFoundError()
        item = await source_impl.get(caller, source_id)
        if item is None:
            raise TaskNotFoundError()
        return item
