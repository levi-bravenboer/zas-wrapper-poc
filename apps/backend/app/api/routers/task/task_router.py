"""`/tasks` — the real task domain (replaces the appointment-as-task
projection). Caregivers see + act on their own tasks; admins are tenant-wide.
Task creation/assignment is a `TaskService` function, not an HTTP route.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter

from app.api.deps import ListQueryParamsDep
from app.schemas._list.page import Page
from app.schemas.task.task import TaskRead, TaskStatusUpdate
from app.services.access.identity.deps import CurrentUserDep
from app.services.task.deps import TaskServiceDep
from app.services.task.errors import TaskNotFoundError

router = APIRouter(tags=["tasks"])


@router.get("/tasks", operation_id="list_tasks", response_model=Page[TaskRead])
async def list_tasks(
    service: TaskServiceDep,
    query: ListQueryParamsDep,
    current_user: CurrentUserDep,
) -> Page[TaskRead]:
    page = await service.list_for_caller(current_user, query)
    return Page[TaskRead](
        items=[TaskRead.model_validate(task) for task in page.items],
        page=page.page,
        page_size=page.page_size,
        total=page.total,
        total_pages=page.total_pages,
    )


@router.get("/tasks/{task_id}", operation_id="get_task", response_model=TaskRead)
async def get_task(
    task_id: UUID,
    service: TaskServiceDep,
    current_user: CurrentUserDep,
) -> TaskRead:
    task = await service.get_for_caller(current_user, task_id)
    if task is None:
        raise TaskNotFoundError()
    return TaskRead.model_validate(task)


@router.patch("/tasks/{task_id}", operation_id="update_task_status", response_model=TaskRead)
async def update_task_status(
    task_id: UUID,
    payload: TaskStatusUpdate,
    service: TaskServiceDep,
    current_user: CurrentUserDep,
) -> TaskRead:
    task = await service.set_status(current_user, task_id, payload.status)
    if task is None:
        raise TaskNotFoundError()
    return TaskRead.model_validate(task)
