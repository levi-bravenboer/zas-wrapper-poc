from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.services.patient.observation.types import MeasurementType


class ObservationCreate(BaseModel):
    """`POST /patients/{patient_id}/observations` payload.

    `measurement_type` is the only typed selector — `code` / `code_system` /
    `unit` are resolved server-side from the allow-list. Effective time
    defaults to the server's now() when omitted.
    """

    model_config = ConfigDict(extra="forbid")

    measurement_type: MeasurementType
    value: Decimal
    effective_date_time: datetime | None = None


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
    created_at: datetime
