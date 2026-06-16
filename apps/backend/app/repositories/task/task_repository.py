from __future__ import annotations

from collections.abc import Sequence
from typing import ClassVar
from uuid import UUID

from sqlalchemy import ColumnElement, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from app.db.models.task import Task
from app.repositories.base import BaseListRepository
from app.schemas._list.list_query import ListQuery, Operator


class TaskRepository(BaseListRepository[Task]):
    model = Task
    orderable_fields: ClassVar[frozenset[str]] = frozenset(
        {"due_at", "created_at", "updated_at", "status"}
    )
    filterable_fields: ClassVar[dict[str, frozenset[Operator]]] = {
        "status": frozenset({"eq", "in"}),
        "patient_id": frozenset({"eq"}),
    }
    searchable_fields: ClassVar[tuple[InstrumentedAttribute, ...]] = (Task.title,)
    default_order: ClassVar[tuple[str, str]] = ("created_at", "desc")

    def __init__(
        self,
        session: AsyncSession,
        *,
        assignee_user_id: UUID | None = None,
    ) -> None:
        super().__init__(session)
        self._assignee_user_id = assignee_user_id

    def with_assignee(self, assignee_user_id: UUID) -> "TaskRepository":
        """Return a view restricted to tasks assigned to one user.

        Used for caregiver listings; admins do not call this (tenant-wide).
        """
        return TaskRepository(self._session, assignee_user_id=assignee_user_id)

    def _extra_filters(self, query: ListQuery) -> Sequence[ColumnElement[bool]]:
        del query
        if self._assignee_user_id is not None:
            return (Task.assignee_user_id == self._assignee_user_id,)
        return ()

    async def get_by_id(self, tenant_id: UUID, task_id: UUID) -> Task | None:
        result = await self._session.execute(
            select(Task).where(
                Task.id == task_id,
                Task.tenant_id == tenant_id,
                Task.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()
