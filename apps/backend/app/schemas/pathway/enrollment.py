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


class EnrollmentParticipantIn(BaseModel):
    """A Practitioner resolved for a block at enrollment (§5.4)."""

    model_config = ConfigDict(extra="forbid")

    block_template_id: UUID
    user_id: UUID
    role: str = Field(min_length=1, max_length=64)


class EnrollmentCreate(BaseModel):
    """Body for `POST /enrollments`."""

    model_config = ConfigDict(extra="forbid")

    patient_id: UUID
    pathway_version_id: UUID
    anchor_date: date
    deferred_values: list[DeferredFieldValueIn] = Field(default_factory=list)
    participants: list[EnrollmentParticipantIn] = Field(default_factory=list)


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
    completed_by_name: str | None = None


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


class EnrollDescriptorField(BaseModel):
    """One enrollment-time deferred field the enroll dialog must render."""

    block_template_id: UUID
    block_label: str
    attr: str
    label: str
    kind: str
    required: bool
    help: str | None = None


class EnrollDescriptorParticipant(BaseModel):
    """A block that needs a Practitioner bound at enrollment (role + specialty)."""

    block_template_id: UUID
    block_label: str
    role: str
    specialty: str | None = None


class EnrollDescriptorClinicalDate(BaseModel):
    """A named clinical date (e.g. `operation_date`) that `relative_to_date`
    blocks anchor to — collected at enrollment so their timers resolve (§5.5).
    `block_template_id` is a representative referencing block (for the
    deferred-value FK; resolution is by `name` across the enrollment).

    `earliest_offset_days` is the largest `before` offset of any block
    anchored to this date — the date cannot feasibly be earlier than
    `today + earliest_offset_days` or that block's lead time can't be met
    (§4.6 earliest-feasible)."""

    name: str
    block_template_id: UUID
    earliest_offset_days: int = 0


class EnrollDescriptor(BaseModel):
    """Enroll-phase form descriptor for a pathway version — the deferred
    fields a caregiver fills, the per-block participants to resolve, and the
    named clinical dates to set (tasks 4.1/5.2/5.4/5.5)."""

    pathway_version_id: UUID
    fields: list[EnrollDescriptorField] = Field(default_factory=list)
    participants: list[EnrollDescriptorParticipant] = Field(default_factory=list)
    clinical_dates: list[EnrollDescriptorClinicalDate] = Field(default_factory=list)


class EnrollmentCandidate(BaseModel):
    """An assignable user (caregiver/physician) for a participant slot —
    served to the enroll dialog so a caregiver can resolve each block's
    participant without admin-only `/users` access.

    `practitioner_role` / `specialty` come from the user's open practitioner
    role (when they have one) so the dialog can scope each dropdown to the
    block's required role + specialty."""

    id: UUID
    display_name: str
    role: str
    practitioner_role: str | None = None
    specialty: str | None = None


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
    "EnrollDescriptor",
    "EnrollDescriptorClinicalDate",
    "EnrollDescriptorField",
    "EnrollDescriptorParticipant",
    "EnrollmentParticipantIn",
    "EnrollmentResponse",
    "EnrollmentState",
    "ExecutionCompleteRequest",
    "RuntimeTick",
]
