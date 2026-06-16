"""Bridge from the HTTP layer to the Temporal pathway runtime.

Only used when `settings.pathway_runtime_engine == "temporal"`. The
enrollment row + executions are still created synchronously by
`EnrollmentService.create` (so the create response carries the initial
projection); this module then starts the durable workflow and routes
caregiver actions to it as Updates / Signals. The Temporal client is
connected lazily and cached on `app.state` so the API process holds one
connection.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import FastAPI
from temporalio.client import Client

from app.schemas.auth.auth import SessionUser
from app.temporal.client import get_temporal_client
from app.temporal.types import EnrollmentWorkflowInput
from app.temporal.workflows import PathwayEnrollmentWorkflow


def _workflow_id(enrollment_id: UUID) -> str:
    return f"enrollment-{enrollment_id}"


async def _client(app: FastAPI) -> Client:
    client = getattr(app.state, "temporal_client", None)
    if client is None:
        client = await get_temporal_client()
        app.state.temporal_client = client
    return client


async def start_enrollment_workflow(
    app: FastAPI,
    *,
    enrollment_id: UUID,
    actor: SessionUser,
    task_queue: str,
) -> None:
    client = await _client(app)
    await client.start_workflow(
        PathwayEnrollmentWorkflow.run,
        EnrollmentWorkflowInput(enrollment_id=enrollment_id, actor=actor),
        id=_workflow_id(enrollment_id),
        task_queue=task_queue,
    )


async def complete_via_workflow(
    app: FastAPI,
    *,
    enrollment_id: UUID,
    execution_id: UUID,
    result: dict[str, Any] | None,
) -> None:
    client = await _client(app)
    handle = client.get_workflow_handle(_workflow_id(enrollment_id))
    await handle.execute_update(
        PathwayEnrollmentWorkflow.complete,
        args=[execution_id, result],
    )


async def cancel_via_workflow(app: FastAPI, *, enrollment_id: UUID) -> None:
    client = await _client(app)
    handle = client.get_workflow_handle(_workflow_id(enrollment_id))
    await handle.signal(PathwayEnrollmentWorkflow.cancel)


__all__ = [
    "cancel_via_workflow",
    "complete_via_workflow",
    "start_enrollment_workflow",
]
