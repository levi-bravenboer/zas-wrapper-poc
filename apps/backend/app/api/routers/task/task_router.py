"""`/tasks` aggregator routes.

Two reads only (`GET /tasks`, `GET /tasks/{source}/{source_id}`). NO write
routes ship v1 — task items are projected from source domains, not stored
in a `tasks` table.

`GET /tasks` allows exactly `order_by=due_at` + `order=asc`. Any other
combination → 422. `filter[patient_id][eq]=<uuid>` restricts within the
participant predicate (used by tests / tooling; the task list UI does not
send it v1). Unknown flat query params (e.g. `?within=`) are silently
ignored at the FastAPI dependency layer per design.md D-WINDOW.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import ListQueryParamsDep, SessionDep
from app.core.enums.user import Role
from app.schemas._list.list_query import Operator
from app.schemas._list.page import Page
from app.schemas.auth.auth import SessionUser
from app.schemas.task.task_item import TaskItem
from app.services.access.identity.deps import require_role
from app.services.tasks.tasks_aggregator import VALID_SOURCES, TasksAggregator

router = APIRouter(tags=["tasks"])

_CAREGIVER_OR_ADMIN_GUARD = Depends(require_role(Role.ADMIN, Role.CAREGIVER))


def _raise_422(detail: str) -> None:
    raise HTTPException(status_code=422, detail=detail)


def _resolve_patient_id_filter(query_filters: dict[str, dict[Operator, list[str]]]) -> UUID | None:
    """Pull `filter[patient_id][eq]=<uuid>` out of the parsed `ListQuery`.

    Anything else (other fields, other ops) → 422.
    """

    if not query_filters:
        return None
    if set(query_filters.keys()) - {"patient_id"}:
        unknown = sorted(set(query_filters.keys()) - {"patient_id"})
        _raise_422(f"unknown filter field(s): {unknown}")
    patient_filters = query_filters.get("patient_id", {})
    if set(patient_filters.keys()) - {"eq"}:
        _raise_422("`filter[patient_id]` supports only the `eq` operator")
    values = patient_filters.get("eq", [])
    if not values:
        return None
    if len(values) > 1:
        _raise_422("`filter[patient_id][eq]` must not be repeated")
    try:
        return UUID(values[0])
    except ValueError:
        _raise_422(f"`filter[patient_id][eq]` must be a UUID; got {values[0]!r}")
        raise  # pragma: no cover


@router.get(
    "/tasks",
    operation_id="list_tasks",
    response_model=Page[TaskItem],
)
async def list_tasks(
    session: SessionDep,
    query: ListQueryParamsDep,
    current_user: Annotated[SessionUser, _CAREGIVER_OR_ADMIN_GUARD],  # AUTH-HARDEN
) -> Page[TaskItem]:
    if query.order_by is not None and query.order_by != "due_at":
        _raise_422("`order_by` must be `due_at` (or omitted) in v1")
    if query.order != "asc":
        _raise_422("`order` must be `asc` (or omitted) in v1")
    if query.q is not None:
        _raise_422("free-text `q` search is not supported on `/tasks` in v1")

    patient_id_filter = _resolve_patient_id_filter(query.filters)

    aggregator = TasksAggregator()
    return await aggregator.list(
        session,
        current_user,
        page=query.page,
        page_size=query.page_size,
        patient_id_filter=patient_id_filter,
    )


@router.get(
    "/tasks/{source}/{source_id}",
    operation_id="get_task",
    response_model=TaskItem,
)
async def get_task(
    source: str,
    source_id: UUID,
    session: SessionDep,
    current_user: Annotated[SessionUser, _CAREGIVER_OR_ADMIN_GUARD],  # AUTH-HARDEN
) -> TaskItem:
    if source not in VALID_SOURCES:
        # Match the cross-source-id-not-found shape so attackers cannot
        # distinguish "source unknown" from "task not found".
        raise HTTPException(status_code=404, detail="Task not found")
    aggregator = TasksAggregator()
    return await aggregator.get(session, current_user, source=source, source_id=source_id)
