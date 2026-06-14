"""Pydantic models for the Luscii public API (v3.30.x).

Vendor-shaped, not FHIR — field names mirror the public-API JSON (camelCase
in transit, snake_case here via alias generator). Only the slices consumed
by patient enrichment are modelled; the contract snapshot lives at
`openspec/changes/luscii-patient-enrichment/luscii-public-api.json`.
"""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class _LusciiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        frozen=True,
        extra="ignore",
    )


class LusciiProgramRef(_LusciiModel):
    id: str | None = None
    name: str | None = None
    start_date: date | None = None


class LusciiProtocolRef(_LusciiModel):
    id: str | None = None
    name: str | None = None


class LusciiPatientDetails(_LusciiModel):
    """`GET /v1/patients/{id}` — programme/protocol slice only.

    Luscii's demographic block (name, email, phone, …) is deliberately not
    modelled: the aggregation payload must never pass it through (see the
    display-only requirement in `luscii-patient-data`).
    """

    id: str
    status: str | None = None
    program: LusciiProgramRef | None = None
    protocol: LusciiProtocolRef | None = None


class LusciiPlannedAction(_LusciiModel):
    """`GET /v1/patients/{uuid}/planned-actions` row."""

    id: str
    program_action_id: str | None = None
    patient_id: str | None = None
    self_planned: bool | None = None
    not_before: datetime | None = None
    expires_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime | None = None


class LusciiMeasurement(_LusciiModel):
    """`GET /v1/measurements` row (org-wide; caller filters by patient)."""

    measurement_id: str | None = None
    patient_id: str
    planned_action_id: str | None = None
    instrument_id: str | None = None
    instrument_version: str | None = None
    processed_at: datetime | None = None
    created_at: datetime | None = None
    details: str = ""


class LusciiInstrumentLocalisation(_LusciiModel):
    """`GET /v1/instrument-localisations` row — instrument display name."""

    instrument_id: str
    instrument_version: str
    locale: str
    name: str | None = None
    unit: str | None = None


class LusciiInstrumentItemLocalisation(_LusciiModel):
    """`GET /v1/instrument-item-localisations` row — item label + unit."""

    item_id: str
    item_version: str
    locale: str
    title: str | None = None
    subtitle: str | None = None
    unit: str | None = None


class LusciiItemResponseLocalisation(_LusciiModel):
    """`GET /v1/instrument-item-response-localisations` row — answer text."""

    item_response_id: str
    locale: str
    response_text: str | None = None


class LusciiMeasurementDetailItem(_LusciiModel):
    """One entry of the `measurement.details` JSON string.

    These keys arrive snake_case (unlike the camelCase envelope fields), so
    no aliasing applies in practice; the shared config is harmless.
    """

    item_id: str | None = None
    item_version: str | None = None
    value: str | None = None
    response_ids: list[str] = Field(default_factory=list)
    file_name: str | None = None
