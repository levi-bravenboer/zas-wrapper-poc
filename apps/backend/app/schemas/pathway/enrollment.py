"""Wire schemas for the runtime aggregate (chain slot #3 §5).

`EnrollmentCreate` carries everything `_create_enrollment` needs:
the patient + pathway version + anchor date + supplied deferred
values. The response shape (`EnrollmentResponse`) bundles the
enrollment row, the per-block executions, and the deferred values
already supplied — clients render the runtime view from one fetch.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


EnrollmentState = Literal["active", "paused", "completed", "cancelled"]
BlockExecutionState = Literal[
    "pending",
    "eligible",
    "active",
    "completed",
    "skipped",
    "failed",
]


class DeferredFieldValueIn(BaseModel):
    """One `(block_template_id, attr, value_json)` triple at enrollment time."""

    model_config = ConfigDict(extra="forbid")

    block_template_id: UUID
    attr: str = Field(min_length=1, max_length=64)
    value_json: Any


class EnrollmentCreate(BaseModel):
    """Body for `POST /enrollments`."""

    model_config = ConfigDict(extra="forbid")

    patient_id: UUID
    pathway_version_id: UUID
    anchor_date: date
    deferred_values: list[DeferredFieldValueIn] = Field(default_factory=list)


class BlockExecutionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    block_template_id: UUID
    scheduled_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    due_at: datetime | None = None
    state: BlockExecutionState
    result_json: dict[str, Any] | None = None
    decision_output: str | None = None


class DeferredFieldValueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    block_template_id: UUID
    attr: str
    value_json: Any
    set_at: datetime


class EnrollmentResponse(BaseModel):
    id: UUID
    patient_id: UUID
    pathway_id: UUID
    pathway_version_id: UUID
    anchor_date: date
    state: EnrollmentState
    executions: list[BlockExecutionResponse] = Field(default_factory=list)
    deferred_values: list[DeferredFieldValueOut] = Field(default_factory=list)


class RuntimeTick(BaseModel):
    """Result of one runtime advance — drives the Temporal timer loop.

    `next_wake_at` is the earliest future moment a time-gated auto block
    becomes due (so the workflow sleeps until then); `None` means no
    pending timer. `terminal` is `True` once the enrollment is no longer
    `active`/`paused`.
    """

    state: EnrollmentState
    next_wake_at: datetime | None = None
    terminal: bool = False


class ExecutionCompleteRequest(BaseModel):
    """Body for `POST /enrollments/{id}/executions/{exec_id}:complete`."""

    model_config = ConfigDict(extra="forbid")

    result: dict[str, Any] | None = None


class DeferredFieldValuePatch(BaseModel):
    """Body for `PATCH /enrollments/{id}/deferred-values/{attr}`.

    Late-supply value for a `DeferredFieldSpec` whose value wasn't
    available at enrollment creation. The engine re-evaluates
    eligibility once the value lands.
    """

    model_config = ConfigDict(extra="forbid")

    block_template_id: UUID
    value_json: Any


__all__ = [
    "BlockExecutionResponse",
    "BlockExecutionState",
    "DeferredFieldValueIn",
    "DeferredFieldValueOut",
    "DeferredFieldValuePatch",
    "EnrollmentCreate",
    "EnrollmentResponse",
    "EnrollmentState",
    "ExecutionCompleteRequest",
    "RuntimeTick",
]
