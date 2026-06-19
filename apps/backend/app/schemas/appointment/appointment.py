# Minimal appointment-domain schemas. v1 ships ONLY
# `AppointmentParticipantInlineSummary`, consumed by `tasks-base` when
# projecting `AppointmentPayload.participants`. NO `AppointmentRead`,
# `AppointmentCreate`, or `AppointmentPatch` schema ships in this change —
# the appointment domain has no HTTP surface v1. When a future change adds
# the `/appointments` API, the larger schemas land in that change.

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.core.enums.appointment import (
    AppointmentKind,
    AppointmentModality,
    AppointmentParticipantRole,
    AppointmentStatus,
)
from app.schemas.patient.patient import PatientInlineSummary


class AppointmentParticipantInlineSummary(BaseModel):
    """Inline projection of one `appointment_participants` row.

    Used inside `AppointmentPayload.participants` on the `TaskItem` envelope.
    `user_display_name` is resolved via the same users projection used elsewhere
    in the codebase (e.g. care-team participant reads).
    """

    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    role: AppointmentParticipantRole
    user_display_name: str


class AppointmentRead(BaseModel):
    """Read model for the first-class `/appointments` API."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient: PatientInlineSummary
    title: str
    description: str | None = None
    kind: AppointmentKind
    starts_at: datetime
    ends_at: datetime
    modality: AppointmentModality
    location_text: str | None = None
    status: AppointmentStatus
    participants: list[AppointmentParticipantInlineSummary]


# How a patient relates to an appointment on the patient profile:
# `about` = the appointment's subject (`appointments.patient_id`);
# `with` = the patient attends via `appointment_patient_attendees`.
PatientAppointmentRelation = Literal["about", "with"]


class PatientAppointmentEntry(BaseModel):
    """An appointment in the patient-profile Afspraken tab, tagged by relation."""

    model_config = ConfigDict(from_attributes=True)

    relation: PatientAppointmentRelation
    appointment: AppointmentRead
