"""Temporal activities for the pathway runtime.

The workflow is the durable orchestrator; all DB I/O lives here. Each
activity opens its own short-lived session via `script_session(actor=)`
so the audit hook stamps rows with the acting `SessionUser`, then drives
the existing `EnrollmentService` — the runtime semantics (eligibility,
auto-fire, decision fanout, end-complete) stay in one place and are
reused verbatim, not re-implemented inside the workflow.
"""

from __future__ import annotations

from temporalio import activity

from app.repositories.pathway.enrollment_repository import EnrollmentRepository
from app.repositories.pathway.pathway_repository import PathwayRepository
from app.schemas.pathway.enrollment import RuntimeTick
from app.services.pathway.enrollment_service import EnrollmentService
from app.temporal.types import AdvanceInput, CancelInput, CompleteStepInput
from scripts._db import script_session


@activity.defn
async def advance_runtime(payload: AdvanceInput) -> RuntimeTick:
    async with script_session(actor=payload.actor) as session:
        service = EnrollmentService(PathwayRepository(session), EnrollmentRepository(session))
        return await service.advance(
            payload.enrollment_id,
            tenant_id=payload.actor.tenant_id,
            now=payload.now,
        )


@activity.defn
async def complete_step(payload: CompleteStepInput) -> RuntimeTick:
    async with script_session(actor=payload.actor) as session:
        service = EnrollmentService(PathwayRepository(session), EnrollmentRepository(session))
        await service.complete_execution(
            payload.enrollment_id,
            payload.execution_id,
            result=payload.result,
            tenant_id=payload.actor.tenant_id,
            now=payload.now,
        )
        # Settle any time-gated auto blocks freed by the completion and
        # report the next pending timer in the same session.
        return await service.advance(
            payload.enrollment_id,
            tenant_id=payload.actor.tenant_id,
            now=payload.now,
        )


@activity.defn
async def cancel_runtime(payload: CancelInput) -> RuntimeTick:
    async with script_session(actor=payload.actor) as session:
        service = EnrollmentService(PathwayRepository(session), EnrollmentRepository(session))
        view = await service.cancel(payload.enrollment_id, tenant_id=payload.actor.tenant_id)
        return RuntimeTick(state=view.state, next_wake_at=None, terminal=True)


__all__ = ["advance_runtime", "cancel_runtime", "complete_step"]
