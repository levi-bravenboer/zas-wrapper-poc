from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.core.enums.collaboration import OwnerType
from app.services.patient.observation.types import MeasurementType


class ObservationCreate(BaseModel):
    """`POST /patients/{patient_id}/observations` payload.

    `measurement_type` is the only typed selector — `code` / `code_system` /
    `unit` are resolved server-side from the allow-list. Effective time
    defaults to the server's now() when omitted. `owner_type`/`owner_id`
    record where the measurement was entered (defaults to the patient
    themselves); the patient activity feed uses them to render a source chip.
    """

    model_config = ConfigDict(extra="forbid")

    measurement_type: MeasurementType
    value: Decimal
    effective_date_time: datetime | None = None
    owner_type: OwnerType | None = None
    owner_id: UUID | None = None


class ObservationView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    code: str
    code_system: str
    value: Decimal
    unit: str
    effective_date_time: datetime
    performer_id: UUID
    performer_display_name: str
    owner_type: OwnerType
    owner_id: UUID
    # Where the measurement lives (appointment title / task title /
    # pathway-step name). Resolved only in the patient aggregate; null for
    # patient-owned observations.
    owner_label: str | None = None
    created_at: datetime
