"""Schemas for patient↔Luscii linking and the merged patient-data payload.

Display-only invariant (luscii-patient-data spec): every field below is a
passthrough or join/decode of Luscii response fields. No thresholds, scores,
flags, trends, or any value-derived computation — adding one requires an
`openspec/mdr-watchlist.md` entry first.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class LusciiLinkRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    luscii_patient_id: UUID


class LusciiLinkResult(BaseModel):
    """Echo of the linked Luscii patient for eyeball verification in the UI."""

    luscii_patient_id: UUID
    program_name: str | None = None
    protocol_name: str | None = None


class LusciiProgramView(BaseModel):
    id: str | None = None
    name: str | None = None
    start_date: str | None = None


class LusciiProtocolView(BaseModel):
    id: str | None = None
    name: str | None = None


class LusciiMeasurementValueView(BaseModel):
    """One decoded `measurement.details` item. `label`/`unit` come from the
    Luscii item localisation (nl preferred); `response_texts` resolve the
    multiple-choice `response_ids`. Unknown items keep `label=None` with the
    raw `value`."""

    label: str | None = None
    value: str | None = None
    unit: str | None = None
    response_texts: list[str] = Field(default_factory=list)


class LusciiMeasurementView(BaseModel):
    measurement_id: str | None = None
    instrument_name: str | None = None
    created_at: datetime | None = None
    processed_at: datetime | None = None
    values: list[LusciiMeasurementValueView] = Field(default_factory=list)


class LusciiPlannedActionView(BaseModel):
    id: str
    not_before: datetime | None = None
    expires_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime | None = None
    self_planned: bool | None = None
    # Joined via Luscii's plannedActionId; None when nothing matched.
    measurement: LusciiMeasurementView | None = None


class LusciiPatientData(BaseModel):
    """`GET /patients/{id}/luscii-data` response."""

    state: Literal["linked", "not_linked"]
    luscii_patient_id: UUID | None = None
    window_days: int
    program: LusciiProgramView | None = None
    protocol: LusciiProtocolView | None = None
    planned_actions: list[LusciiPlannedActionView] = Field(default_factory=list)
    unmatched_measurements: list[LusciiMeasurementView] = Field(default_factory=list)
