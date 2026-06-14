"""Schema-level tests for the luscii patient-data payload.

Pure model construction + JSON round-trip. The discriminated `Point` union is
the wire-shape contract the FE depends on; if the discriminator isn't wired
correctly, an OpenAPI consumer can't narrow at compile time and the chart
dispatch falls back to runtime sniffing — exactly the failure mode we're
moving away from.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from pydantic import TypeAdapter

from app.schemas.luscii.patient_data import (
    LusciiCategoricalPoint,
    LusciiFreeTextPoint,
    LusciiMeasurementPoint,
    LusciiMeasurementSeries,
    LusciiMeasurementValueView,
    LusciiMeasurementView,
    LusciiNumericPoint,
    LusciiOrdinalPoint,
    LusciiPatientData,
    LusciiUnknownPoint,
)

pytestmark = pytest.mark.no_db


# ── new fields keep existing construction sites compatible ──────────────


def test_patient_data_construction_without_series_still_works() -> None:
    data = LusciiPatientData(state="not_linked", window_days=30)
    assert data.series == []
    assert data.planned_actions == []
    assert data.unmatched_measurements == []


def test_measurement_value_view_archetype_defaults_to_unknown() -> None:
    value = LusciiMeasurementValueView(label="Gewicht", value="82", unit="kg")
    assert value.archetype == "unknown"
    assert value.item_id is None
    assert value.instrument_id is None


def test_measurement_view_instrument_id_optional() -> None:
    view = LusciiMeasurementView(measurement_id="m-1", instrument_name="Bloeddruk")
    assert view.instrument_id is None


# ── discriminated point union ───────────────────────────────────────────

POINT_ADAPTER: TypeAdapter[LusciiMeasurementPoint] = TypeAdapter(LusciiMeasurementPoint)


def _ts() -> datetime:
    return datetime(2026, 6, 14, 12, 0, 0, tzinfo=UTC)


def test_numeric_point_roundtrip() -> None:
    point = LusciiNumericPoint(observed_at=_ts(), value=82.5, program_id="prog-1")
    raw = point.model_dump(mode="json")
    assert raw["archetype"] == "numeric"
    assert raw["value"] == 82.5

    parsed = POINT_ADAPTER.validate_python(raw)
    assert isinstance(parsed, LusciiNumericPoint)
    assert parsed.value == 82.5
    assert parsed.program_id == "prog-1"


def test_ordinal_point_roundtrip() -> None:
    point = LusciiOrdinalPoint(observed_at=_ts(), value=3.0)
    parsed = POINT_ADAPTER.validate_python(point.model_dump(mode="json"))
    assert isinstance(parsed, LusciiOrdinalPoint)
    assert parsed.value == 3.0
    assert parsed.program_id is None


def test_categorical_point_roundtrip() -> None:
    point = LusciiCategoricalPoint(
        observed_at=_ts(), responses=["Vermoeidheid", "Kortademigheid"]
    )
    parsed = POINT_ADAPTER.validate_python(point.model_dump(mode="json"))
    assert isinstance(parsed, LusciiCategoricalPoint)
    assert parsed.responses == ["Vermoeidheid", "Kortademigheid"]


def test_free_text_point_roundtrip() -> None:
    point = LusciiFreeTextPoint(observed_at=_ts(), text="Voelt me ok.")
    parsed = POINT_ADAPTER.validate_python(point.model_dump(mode="json"))
    assert isinstance(parsed, LusciiFreeTextPoint)
    assert parsed.text == "Voelt me ok."


def test_unknown_point_roundtrip_with_raw() -> None:
    point = LusciiUnknownPoint(observed_at=_ts(), raw="II")
    parsed = POINT_ADAPTER.validate_python(point.model_dump(mode="json"))
    assert isinstance(parsed, LusciiUnknownPoint)
    assert parsed.raw == "II"


def test_unknown_point_roundtrip_with_null_raw() -> None:
    point = LusciiUnknownPoint(observed_at=_ts(), raw=None)
    parsed = POINT_ADAPTER.validate_python(point.model_dump(mode="json"))
    assert isinstance(parsed, LusciiUnknownPoint)
    assert parsed.raw is None


def test_discriminator_selects_right_variant_from_raw_dict() -> None:
    raw = {"observed_at": _ts().isoformat(), "archetype": "categorical", "responses": ["A"]}
    parsed = POINT_ADAPTER.validate_python(raw)
    assert isinstance(parsed, LusciiCategoricalPoint)
    assert parsed.responses == ["A"]


def test_discriminator_rejects_unknown_archetype_string() -> None:
    raw = {"observed_at": _ts().isoformat(), "archetype": "lab_result", "value": 1.0}
    with pytest.raises(ValueError):
        POINT_ADAPTER.validate_python(raw)


def test_numeric_point_rejects_missing_value() -> None:
    raw = {"observed_at": _ts().isoformat(), "archetype": "numeric"}
    with pytest.raises(ValueError):
        POINT_ADAPTER.validate_python(raw)


# ── series + patient-data composition ────────────────────────────────────


def test_series_with_mixed_archetype_points_via_unknown_fallback() -> None:
    # Each series advertises one archetype on the series object itself; the
    # discriminated points let a series whose archetype was set from the most
    # recent point still carry older points of a different archetype as
    # `unknown`. The schema accepts heterogeneous points; the projection
    # service is the layer that decides which archetypes co-exist.
    series = LusciiMeasurementSeries(
        series_id="abc123def456",
        instrument_id="inst-1",
        instrument_name="Gewicht",
        item_id="item-1",
        label="Gewicht",
        archetype="numeric",
        unit="kg",
        points=[
            LusciiNumericPoint(observed_at=_ts(), value=82.0),
            LusciiUnknownPoint(observed_at=_ts(), raw="??"),
        ],
    )
    raw = series.model_dump(mode="json")
    assert raw["archetype"] == "numeric"
    assert raw["points"][0]["archetype"] == "numeric"
    assert raw["points"][1]["archetype"] == "unknown"


def test_patient_data_with_series_block_roundtrip() -> None:
    data = LusciiPatientData(
        state="linked",
        window_days=30,
        series=[
            LusciiMeasurementSeries(
                series_id="abc123def456",
                instrument_id="inst-1",
                instrument_name="Gewicht",
                item_id="item-1",
                label="Gewicht",
                archetype="numeric",
                unit="kg",
                points=[
                    LusciiNumericPoint(observed_at=_ts(), value=82.0, program_id="prog-1"),
                ],
            ),
        ],
    )
    raw = data.model_dump(mode="json")
    assert raw["series"][0]["series_id"] == "abc123def456"
    assert raw["series"][0]["points"][0]["value"] == 82.0
    parsed = LusciiPatientData.model_validate(raw)
    assert len(parsed.series) == 1
    assert isinstance(parsed.series[0].points[0], LusciiNumericPoint)
