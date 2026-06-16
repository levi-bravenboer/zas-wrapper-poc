from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.db.engine import SessionDep
from app.repositories.task import TaskRepository
from app.services.task.task_service import TaskService


def get_task_service(session: SessionDep) -> TaskService:
    return TaskService(TaskRepository(session), session)


TaskServiceDep = Annotated[TaskService, Depends(get_task_service)]
