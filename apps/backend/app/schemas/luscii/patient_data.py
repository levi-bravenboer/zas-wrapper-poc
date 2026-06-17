"""Schemas for patient↔Luscii linking and the merged patient-data payload.

Display-only invariant (luscii-patient-data spec): every field below is a
passthrough or join/decode of Luscii response fields. No thresholds, scores,
flags, trends, or any value-derived computation — adding one requires an
`openspec/mdr-watchlist.md` entry first.

`archetype` and `series[]` are STRUCTURAL metadata derived from data shape
(unit / response_ids / parseability), NOT clinical interpretation. They drive
chart-kind dispatch on the FE; they never carry severity, range, or trend.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.services.luscii.archetype import Archetype


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
    raw `value`.

    `item_id`/`instrument_id` are passed through from the Luscii source row;
    they let clients group values across measurements into a time-series.
    `archetype` is set by the pure `classify_archetype` classifier — never
    `null`, defaults to `"unknown"` when classification fails.
    """

    label: str | None = None
    value: str | None = None
    unit: str | None = None
    response_texts: list[str] = Field(default_factory=list)
    item_id: str | None = None
    instrument_id: str | None = None
    archetype: Archetype = "unknown"


class LusciiMeasurementView(BaseModel):
    measurement_id: str | None = None
    instrument_id: str | None = None
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


# ── series[] block ────────────────────────────────────────────────────────
#
# Each `LusciiMeasurementSeries` is a time-projected stream of one
# instrument-item pair across all measurements in the window. Points are
# archetype-discriminated; OpenAPI emits a `oneOf` with
# `discriminator: archetype` so the TS client narrows automatically.


class LusciiNumericPoint(BaseModel):
    """A single measurement point projected as a numeric value."""

    observed_at: datetime
    archetype: Literal["numeric"] = "numeric"
    value: float
    program_id: str | None = None


class LusciiOrdinalPoint(BaseModel):
    """A single measurement point projected as an ordinal (allowlisted unit)."""

    observed_at: datetime
    archetype: Literal["ordinal"] = "ordinal"
    value: float
    program_id: str | None = None


class LusciiCategoricalPoint(BaseModel):
    """A single measurement point projected from a multiple-choice item."""

    observed_at: datetime
    archetype: Literal["categorical"] = "categorical"
    responses: list[str] = Field(default_factory=list)
    program_id: str | None = None


class LusciiFreeTextPoint(BaseModel):
    """A single measurement point projected from a free-text answer."""

    observed_at: datetime
    archetype: Literal["free_text"] = "free_text"
    text: str
    program_id: str | None = None


class LusciiUnknownPoint(BaseModel):
    """Fallback point for values the classifier cannot categorise."""

    observed_at: datetime
    archetype: Literal["unknown"] = "unknown"
    raw: str | None = None
    program_id: str | None = None


LusciiMeasurementPoint = Annotated[
    Union[
        LusciiNumericPoint,
        LusciiOrdinalPoint,
        LusciiCategoricalPoint,
        LusciiFreeTextPoint,
        LusciiUnknownPoint,
    ],
    Field(discriminator="archetype"),
]


class LusciiMeasurementSeries(BaseModel):
    """A time-projected series of one instrument-item across the window.

    `unit` is present only when `archetype` is `numeric` or `ordinal`;
    categorical / free_text / unknown series carry no unit. Points are
    sorted ascending by `observed_at` at projection time and the list is
    never empty (series with zero points are not emitted).
    """

    series_id: str
    instrument_id: str
    instrument_name: str | None = None
    item_id: str
    label: str | None = None
    archetype: Archetype
    unit: str | None = None
    points: list[LusciiMeasurementPoint] = Field(default_factory=list)


class ConnectionGroup(BaseModel):
    """Live Luscii data for one active connection (one Luscii patient).

    A patient may hold several connections at once (one per Luscii patient,
    each running one program). Each group carries its own program/protocol +
    decoded measurements/series; `program_id` is provenance the FE matches to
    a carepath. Display-only invariant holds — every field is a
    passthrough/join/decode, never a value-derived signal.
    """

    connection_id: UUID
    luscii_patient_id: UUID
    status: Literal["active", "inactive"]
    program: LusciiProgramView | None = None
    protocol: LusciiProtocolView | None = None
    planned_actions: list[LusciiPlannedActionView] = Field(default_factory=list)
    measurements: list[LusciiMeasurementView] = Field(default_factory=list)
    series: list[LusciiMeasurementSeries] = Field(default_factory=list)


class LusciiPatientData(BaseModel):
    """`GET /patients/{id}/luscii-data` response.

    `connections[]` is the multi-connection view (one entry per active Luscii
    connection). The top-level `program`/`protocol`/`planned_actions`/
    `unmatched_measurements`/`series` mirror the FIRST connection for backward
    compatibility while the FE migrates to `connections[]`; they are removed
    once no consumer reads them.
    """

    state: Literal["linked", "not_linked"]
    luscii_patient_id: UUID | None = None
    window_days: int
    program: LusciiProgramView | None = None
    protocol: LusciiProtocolView | None = None
    planned_actions: list[LusciiPlannedActionView] = Field(default_factory=list)
    unmatched_measurements: list[LusciiMeasurementView] = Field(default_factory=list)
    # Time-series projection for chart consumers. Always present; empty for
    # not-linked patients or windows with no measurements.
    series: list[LusciiMeasurementSeries] = Field(default_factory=list)
    # Multi-connection view. Empty when not linked.
    connections: list[ConnectionGroup] = Field(default_factory=list)
