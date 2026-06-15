from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.db.engine import SessionDep
from app.services.tasks.tasks_aggregator import TasksAggregator


def get_tasks_aggregator(session: SessionDep) -> TasksAggregator:
    return TasksAggregator(session)


TasksAggregatorDep = Annotated[TasksAggregator, Depends(get_tasks_aggregator)]
