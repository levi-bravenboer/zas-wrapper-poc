from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends

from app.db.engine import SessionDep
from app.db.models.task import Task
from app.repositories.task import TaskRepository
from app.services.access.identity.deps import CurrentUserDep
from app.services.task.errors import TaskNotFoundError
from app.services.task.task_service import TaskService


def get_task_service(session: SessionDep) -> TaskService:
    return TaskService(TaskRepository(session), session)


TaskServiceDep = Annotated[TaskService, Depends(get_task_service)]


async def require_task_access(
    task_id: UUID,
    service: TaskServiceDep,
    current_user: CurrentUserDep,
) -> Task:
    """Resolve a task the caller may act on (assignee or admin) or 404."""

    task = await service.get_for_caller(current_user, task_id)
    if task is None:
        raise TaskNotFoundError()
    return task


TaskAccessDep = Annotated[Task, Depends(require_task_access)]
