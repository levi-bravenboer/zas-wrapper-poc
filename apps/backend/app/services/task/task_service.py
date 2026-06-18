# Real task domain service. Caregivers see + act on their own tasks;
# admins are tenant-wide. Creation/assignment is a service function (no HTTP
# create route) used by seeds + future task producers.

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import Permission
from app.core.enums.task import TaskStatus
from app.db.models.task import Task
from app.repositories.task import TaskRepository
from app.schemas._list.list_query import ListQuery
from app.schemas._list.page import Page
from app.schemas.auth.auth import SessionUser


class TaskService:
    def __init__(self, repo: TaskRepository, session: AsyncSession) -> None:
        self._repo = repo
        self._session = session

    async def list_for_caller(self, caller: SessionUser, query: ListQuery) -> Page[Task]:
        if caller.has_permission(Permission.PATIENT_ACCESS_ALL):
            return await self._repo.list_page(query)
        return await self._repo.with_assignee(caller.id).list_page(query)

    async def get_for_caller(self, caller: SessionUser, task_id: UUID) -> Task | None:
        task = await self._repo.get_by_id(caller.tenant_id, task_id)
        if task is None:
            return None
        if not caller.has_permission(Permission.PATIENT_ACCESS_ALL) and (
            task.assignee_user_id != caller.id
        ):
            return None
        return task

    async def set_status(
        self, caller: SessionUser, task_id: UUID, status: TaskStatus
    ) -> Task | None:
        task = await self.get_for_caller(caller, task_id)
        if task is None:
            return None
        task.status = status
        await self._session.flush()
        # `updated_at` is DB-computed via `onupdate`; refresh so serialising the
        # response doesn't trigger an async lazy-load outside the greenlet.
        await self._session.refresh(task)
        return task

    async def create(
        self,
        *,
        assignee_user_id: UUID,
        title: str,
        description: str | None = None,
        due_at: datetime | None = None,
        patient_id: UUID | None = None,
        source_ref: str | None = None,
        status: TaskStatus = TaskStatus.OPEN,
    ) -> Task:
        """Create + assign a task. Service-only (no HTTP route); the audit hook
        stamps tenant/actor from the session actor the caller set."""

        task = Task(
            assignee_user_id=assignee_user_id,
            title=title,
            description=description,
            due_at=due_at,
            patient_id=patient_id,
            source_ref=source_ref,
            status=status,
        )
        self._session.add(task)
        await self._session.flush()
        return task
