"""Time-series projection over decoded Luscii measurements.

`project_series` runs in the request-path right after the catalogue decoder
produces `LusciiMeasurementView`s. It groups values by `(instrument_id,
item_id)`, parses numeric/ordinal `value`s once, and emits
archetype-discriminated `LusciiMeasurementPoint`s under a stable `series_id`.

Display-only invariant (D-NO-DERIVED): this module sorts, groups, and
type-narrows. It NEVER computes thresholds, severity, trends, or any value-
derived clinical signal.
"""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime

from app.schemas.luscii.patient_data import (
    LusciiCategoricalPoint,
    LusciiFreeTextPoint,
    LusciiMeasurementPoint,
    LusciiMeasurementSeries,
    LusciiMeasurementValueView,
    LusciiMeasurementView,
    LusciiNumericPoint,
    LusciiOrdinalPoint,
    LusciiUnknownPoint,
)
from app.services.luscii.archetype import parse_numeric

logger = logging.getLogger(__name__)

# Sentinel timestamp for "no points seen yet" — older than any conceivable
# Luscii measurement. UTC so subsequent comparisons are tz-aware.
_EPOCH = datetime(1970, 1, 1, tzinfo=UTC)


def compute_series_id(instrument_id: str, item_id: str) -> str:
    """Stable 12-character hex hash of an `(instrument_id, item_id)` pair.

    Used as a React key on the FE and as the deep-link parameter
    (`?focus=<series_id>`). Stable across requests and across `?days=N`
    changes; deterministic.
    """

    raw = f"{instrument_id}|{item_id}".encode()
    return hashlib.sha256(raw).hexdigest()[:12]


def project_series(
    measurements: list[LusciiMeasurementView],
    *,
    program_id: str | None = None,
) -> list[LusciiMeasurementSeries]:
    """Project decoded measurements into a time-series list.

    For each value with both `instrument_id` and `item_id` set, builds an
    archetype-discriminated `LusciiMeasurementPoint`. Numeric/ordinal values
    that fail `parse_numeric` are dropped (logged at WARN) — the series
    survives. Series with zero points are not emitted.

    The series-level archetype/unit/label come from the most recent point's
    source value. Series are sorted by most-recent point timestamp DESC so
    the patient's freshest activity tops the list.
    """

    groups: dict[tuple[str, str], _Group] = {}

    for measurement in measurements:
        observed_at = measurement.processed_at or measurement.created_at
        if observed_at is None:
            continue
        for value in measurement.values:
            if not value.instrument_id or not value.item_id:
                continue
            point = _build_point(value, observed_at, program_id, measurement.alert_flag)
            if point is None:
                continue
            key = (value.instrument_id, value.item_id)
            group = groups.get(key)
            if group is None:
                group = _Group(
                    instrument_id=value.instrument_id,
                    item_id=value.item_id,
                    instrument_name=measurement.instrument_name,
                    last_value=value,
                    last_observed_at=observed_at,
                )
                groups[key] = group
            group.points.append(point)
            # Track the freshest value so the series face (archetype, label,
            # unit, instrument_name) reflects what the patient most recently
            # submitted. Strict `>` keeps the FIRST value at a tied timestamp
            # — deterministic across runs.
            if observed_at > group.last_observed_at:
                group.last_observed_at = observed_at
                group.last_value = value
                if measurement.instrument_name:
                    group.instrument_name = measurement.instrument_name

    series: list[LusciiMeasurementSeries] = []
    for (instrument_id, item_id), group in groups.items():
        group.points.sort(key=lambda p: p.observed_at)
        archetype = group.last_value.archetype
        unit = group.last_value.unit if archetype in ("numeric", "ordinal") else None
        series.append(
            LusciiMeasurementSeries(
                series_id=compute_series_id(instrument_id, item_id),
                instrument_id=instrument_id,
                instrument_name=group.instrument_name,
                item_id=item_id,
                label=group.last_value.label,
                archetype=archetype,
                unit=unit,
                points=list(group.points),
            )
        )

    series.sort(key=lambda s: s.points[-1].observed_at, reverse=True)
    return series


def _build_point(
    value: LusciiMeasurementValueView,
    observed_at: datetime,
    program_id: str | None,
    alert_flag: str | None,
) -> LusciiMeasurementPoint | None:
    """Build the archetype-specific point or return `None` to drop the value.

    `alert_flag` is Luscii's own fired flag for the source measurement, passed
    through verbatim onto the point (never computed here).

    Drop reasons (point excluded from the series, series survives):
    - numeric/ordinal: `value` does not parse as a finite float;
    - free_text: stripped text is empty.
    """

    archetype = value.archetype
    if archetype == "numeric":
        parsed = parse_numeric(value.value)
        if parsed is None:
            # PHI hygiene: NEVER log the raw measurement value — it may carry
            # clinical information. The id pair is enough to locate the
            # offending row via the upstream catalogue.
            logger.warning(
                "luscii.series.numeric_parse_failed",
                extra={
                    "item_id": value.item_id,
                    "instrument_id": value.instrument_id,
                },
            )
            return None
        return LusciiNumericPoint(
            observed_at=observed_at, value=parsed, program_id=program_id, alert_flag=alert_flag
        )
    if archetype == "ordinal":
        parsed = parse_numeric(value.value)
        if parsed is None:
            logger.warning(
                "luscii.series.ordinal_parse_failed",
                extra={
                    "item_id": value.item_id,
                    "instrument_id": value.instrument_id,
                },
            )
            return None
        return LusciiOrdinalPoint(
            observed_at=observed_at, value=parsed, program_id=program_id, alert_flag=alert_flag
        )
    if archetype == "categorical":
        return LusciiCategoricalPoint(
            observed_at=observed_at,
            responses=list(value.response_texts),
            program_id=program_id,
            alert_flag=alert_flag,
        )
    if archetype == "free_text":
        text = (value.value or "").strip()
        if not text:
            return None
        return LusciiFreeTextPoint(
            observed_at=observed_at, text=text, program_id=program_id, alert_flag=alert_flag
        )
    # archetype == "unknown" — keep the raw value so the FE can still render
    # a dated row in the UnknownLog renderer.
    return LusciiUnknownPoint(
        observed_at=observed_at, raw=value.value, program_id=program_id, alert_flag=alert_flag
    )


@dataclass
class _Group:
    instrument_id: str
    item_id: str
    instrument_name: str | None
    last_value: LusciiMeasurementValueView
    last_observed_at: datetime = _EPOCH
    points: list[LusciiMeasurementPoint] = field(default_factory=list)
