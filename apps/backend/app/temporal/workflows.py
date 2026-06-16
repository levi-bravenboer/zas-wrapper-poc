"""Temporal workflows for the pathway runtime.

`PathwayEnrollmentWorkflow` (the generic interpreter over a pinned pathway
version) lands in a later chunk. `HealthWorkflow` is a placeholder so the
worker has a valid registration to boot against.
"""

from __future__ import annotations

from temporalio import workflow


@workflow.defn
class HealthWorkflow:
    @workflow.run
    async def run(self) -> str:
        return "ok"
