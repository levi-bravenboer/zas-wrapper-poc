# Minimal appointment-domain schemas. v1 ships ONLY
# `AppointmentParticipantInlineSummary`, consumed by `tasks-base` when
# projecting `AppointmentPayload.participants`. NO `AppointmentRead`,
# `AppointmentCreate`, or `AppointmentPatch` schema ships in this change —
# the appointment domain has no HTTP surface v1. When a future change adds
# the `/appointments` API, the larger schemas land in that change.

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.core.enums.appointment import AppointmentParticipantRole


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
