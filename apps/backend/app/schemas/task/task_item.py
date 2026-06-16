# `TaskItem` envelope returned by the `/tasks` aggregator. Per design.md
# D-AGG, there is no `tasks` table — every `TaskItem` is materialised at
# request time from a source domain. v1 source set: `appointment` only.
#
# Per D14 (source identifier), `id` is the source row's database PK
# (no composite encoding). `source` says which domain the row came from;
# `source_id` is the explicit addressing key for `GET /tasks/{source}/{source_id}`.
# v1 `id == source_id` because the only source uses UUID PKs. Future
# non-UUID-PK sources would diverge.
#
# Per D-PATIENT, there is NO top-level `patient` field. Patient summary
# lives inside `payload.patient`. The aggregator JOINs the source row's
# patient FK at projection time; the frontend reads `item.payload.patient`.

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.core.enums.appointment import (
    AppointmentKind,
    AppointmentModality,
    AppointmentStatus,
)
from app.schemas.appointment.appointment import AppointmentParticipantInlineSummary
from app.schemas.patient.patient import PatientInlineSummary

Source = Literal["appointment"]
TaskPriority = Literal["low", "normal", "high", "urgent"]


class AppointmentPayload(BaseModel):
    """Discriminated payload for `source = "appointment"`.

    Carries the source row's data needed by the frontend without forcing
    a follow-up `/appointments` fetch (which is also unavailable v1 — the
    appointment domain ships without HTTP routes).
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient: PatientInlineSummary
    starts_at: datetime
    ends_at: datetime
    kind: AppointmentKind
    modality: AppointmentModality
    location_text: str | None = None
    status: AppointmentStatus
    participants: list[AppointmentParticipantInlineSummary]


class TaskItem(BaseModel):
    """Unified envelope returned by `GET /tasks` and `GET /tasks/{source}/{source_id}`.

    Sortable by `due_at` (which v1 always maps to `appointment.starts_at`).
    `priority` is reserved for future sources; v1 appointment source
    always emits `null`.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    source: Source
    source_id: UUID
    due_at: datetime
    title: str
    kind: str | None = None
    priority: TaskPriority | None = None
    # Per-caller read-state: True once this user has opened the task. Drives
    # the unread indicator in the inbox; the detail read stamps it.
    opened: bool = False
    payload: AppointmentPayload
