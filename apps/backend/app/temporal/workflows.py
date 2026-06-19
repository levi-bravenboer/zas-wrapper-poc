"""Temporal workflows for the pathway runtime.

`PathwayEnrollmentWorkflow` is the durable orchestrator for one enrollment.
It owns the runtime lifecycle: durable timers advance time-gated auto
blocks, a `complete` Update applies caregiver actions, and a `cancel`
Signal terminates the run. The actual state transitions live in the
activities (`app.temporal.activities`), which reuse `EnrollmentService`
so the engine semantics are defined once.

`HealthWorkflow` stays as a trivial liveness check.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from app.schemas.pathway.enrollment import RuntimeTick
    from app.temporal.activities import advance_runtime, cancel_runtime, complete_step
    from app.temporal.types import (
        AdvanceInput,
        CancelInput,
        CompleteStepInput,
        EnrollmentWorkflowInput,
    )


_ACTIVITY_TIMEOUT = timedelta(seconds=30)
_RETRY = RetryPolicy(maximum_attempts=5)


@workflow.defn
class HealthWorkflow:
    @workflow.run
    async def run(self) -> str:
        return "ok"


@workflow.defn
class PathwayEnrollmentWorkflow:
    def __init__(self) -> None:
        self._cancel_requested = False
        self._paused = False
        self._wake = False
        self._terminal = False
        self._input: EnrollmentWorkflowInput | None = None

    @workflow.run
    async def run(self, payload: EnrollmentWorkflowInput) -> str:
        self._input = payload
        tick = await self._advance()

        while not self._terminal and not self._cancel_requested:
            if self._paused:
                # Halt timers — park until resumed or cancelled.
                await workflow.wait_condition(lambda: not self._paused or self._cancel_requested)
                if self._cancel_requested:
                    break
                tick = await self._advance()
                continue
            timeout = self._timeout_until(tick.next_wake_at)
            try:
                await workflow.wait_condition(
                    lambda: self._wake or self._cancel_requested or self._paused,
                    timeout=timeout,
                )
            except asyncio.TimeoutError:
                # Durable timer elapsed — a time-gated auto block is due.
                pass
            self._wake = False
            if self._cancel_requested:
                break
            if self._paused:
                continue
            tick = await self._advance()

        if self._cancel_requested:
            await workflow.execute_activity(
                cancel_runtime,
                CancelInput(enrollment_id=payload.enrollment_id, actor=payload.actor),
                start_to_close_timeout=_ACTIVITY_TIMEOUT,
                retry_policy=_RETRY,
            )
            return "cancelled"
        return tick.state

    def _timeout_until(self, wake_at: datetime | None) -> timedelta | None:
        if wake_at is None:
            return None
        delta = wake_at - workflow.now()
        return delta if delta > timedelta(0) else timedelta(0)

    async def _advance(self) -> RuntimeTick:
        assert self._input is not None
        tick = await workflow.execute_activity(
            advance_runtime,
            AdvanceInput(
                enrollment_id=self._input.enrollment_id,
                actor=self._input.actor,
                now=workflow.now(),
            ),
            start_to_close_timeout=_ACTIVITY_TIMEOUT,
            retry_policy=_RETRY,
        )
        self._terminal = tick.terminal
        return tick

    @workflow.update
    async def complete(self, execution_id: UUID, result: dict[str, Any] | None) -> RuntimeTick:
        """Caregiver action — complete a step, then settle the runtime."""
        assert self._input is not None
        tick = await workflow.execute_activity(
            complete_step,
            CompleteStepInput(
                enrollment_id=self._input.enrollment_id,
                execution_id=execution_id,
                result=result,
                actor=self._input.actor,
                now=workflow.now(),
            ),
            start_to_close_timeout=_ACTIVITY_TIMEOUT,
            retry_policy=_RETRY,
        )
        self._terminal = tick.terminal
        self._wake = True
        return tick

    @workflow.signal
    def cancel(self) -> None:
        self._cancel_requested = True

    @workflow.signal
    def pause(self) -> None:
        self._paused = True
        self._wake = True

    @workflow.signal
    def resume(self) -> None:
        self._paused = False
        self._wake = True

    @workflow.signal
    def notify(self) -> None:
        # External state changed (e.g. a clinical date was edited) — re-advance
        # so the timer loop recomputes the next wake against the new schedule.
        self._wake = True


__all__ = ["HealthWorkflow", "PathwayEnrollmentWorkflow"]
