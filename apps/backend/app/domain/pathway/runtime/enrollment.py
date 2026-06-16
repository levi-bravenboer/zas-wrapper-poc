"""`PathwayEnrollment` typed domain model.

The runtime root: binds a patient to a published pathway version and
owns the `anchor_date` against which relative `TimingPolicy` offsets
are computed at enrollment time. State is a closed enum; transitions
are owned by the enrollment service (admins can pause/resume, the
runtime engine can mark complete when every block execution is in a
terminal state).
"""

from __future__ import annotations

from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


EnrollmentState = Literal["active", "paused", "completed", "cancelled"]


class PathwayEnrollment(BaseModel):
    """Aggregate root for one patient × pathway version × runtime."""

    model_config = ConfigDict(extra="forbid", frozen=False)

    id: UUID
    patient_id: UUID
    pathway_version_id: UUID
    anchor_date: date
    state: EnrollmentState = "active"


__all__ = ["EnrollmentState", "PathwayEnrollment"]
