"""Pathway-runtime Temporal worker entrypoint.

Runs as a separate process from the API (same image): `python -m
app.temporal.worker`. Registers the pathway workflows + activities and
polls the task queue. Activities (materialization, projection, Luscii
enroll, audit emit) land in later chunks.
"""

from __future__ import annotations

import asyncio

from temporalio.worker import Worker

from app.core.settings import get_settings
from app.temporal.activities import advance_runtime, cancel_runtime, complete_step
from app.temporal.client import get_temporal_client
from app.temporal.workflows import HealthWorkflow, PathwayEnrollmentWorkflow


async def run_worker() -> None:
    settings = get_settings()
    client = await get_temporal_client()
    worker = Worker(
        client,
        task_queue=settings.temporal_task_queue,
        workflows=[HealthWorkflow, PathwayEnrollmentWorkflow],
        activities=[advance_runtime, complete_step, cancel_runtime],
    )
    await worker.run()


def main() -> None:
    asyncio.run(run_worker())


if __name__ == "__main__":
    main()
