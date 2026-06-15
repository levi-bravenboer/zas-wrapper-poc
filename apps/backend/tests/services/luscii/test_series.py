"""Unit tests for the series projection.

Pure logic — no DB. The projection guarantees the FE depends on are:
- group by `(instrument_id, item_id)` across measurements;
- sort points ASC within a series, sort series DESC by most-recent point;
- parse numeric/ordinal `value` ONCE; parse failures drop the point, not the series;
- `series_id` is a stable hash of the instrument-item pair.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from app.schemas.luscii.patient_data import (
    LusciiCategoricalPoint,
    LusciiFreeTextPoint,
    LusciiMeasurementValueView,
    LusciiMeasurementView,
    LusciiNumericPoint,
    LusciiUnknownPoint,
)
from app.services.luscii.series import compute_series_id, project_series

pytestmark = pytest.mark.no_db


# ── helpers ───────────────────────────────────────────────────────────────


def _ts(days_ago: int = 0, hours: int = 8) -> datetime:
    return datetime(2026, 6, 14, hours, 0, 0, tzinfo=UTC) - timedelta(days=days_ago)


def _value(
    *,
    instrument_id: str | None = "inst-bp",
    item_id: str | None = "item-sys",
    archetype: str = "numeric",
    value: str | None = "128",
    unit: str | None = "mmHg",
    label: str | None = "Systolisch",
    response_texts: list[str] | None = None,
) -> LusciiMeasurementValueView:
    return LusciiMeasurementValueView(
        label=label,
        value=value,
        unit=unit,
        response_texts=response_texts or [],
        item_id=item_id,
        instrument_id=instrument_id,
        archetype=archetype,  # type: ignore[arg-type]
    )


def _measurement(
    *,
    observed_at: datetime,
    instrument_id: str | None = "inst-bp",
    instrument_name: str | None = "Bloeddrukmeting",
    values: list[LusciiMeasurementValueView] | None = None,
) -> LusciiMeasurementView:
    return LusciiMeasurementView(
        measurement_id=f"meas-{observed_at.isoformat()}",
        instrument_id=instrument_id,
        instrument_name=instrument_name,
        created_at=observed_at,
        processed_at=observed_at,
        values=values or [],
    )


# ── compute_series_id ─────────────────────────────────────────────────────


def test_series_id_is_stable_for_same_inputs() -> None:
    assert compute_series_id("inst-1", "item-1") == compute_series_id("inst-1", "item-1")


def test_series_id_is_12_lowercase_hex() -> None:
    sid = compute_series_id("inst-1", "item-1")
    assert len(sid) == 12
    assert sid == sid.lower()
    int(sid, 16)  # parses as hex


def test_series_id_differs_when_inputs_differ() -> None:
    assert compute_series_id("inst-1", "item-1") != compute_series_id("inst-1", "item-2")
    assert compute_series_id("inst-1", "item-1") != compute_series_id("inst-2", "item-1")


# ── project_series ────────────────────────────────────────────────────────


def test_empty_input_yields_empty_series() -> None:
    assert project_series([]) == []


def test_single_measurement_with_two_items_yields_two_series() -> None:
    measurement = _measurement(
        observed_at=_ts(),
        values=[
            _value(item_id="item-sys", value="128", label="Systolisch"),
            _value(item_id="item-dia", value="82", label="Diastolisch"),
        ],
    )
    series = project_series([measurement])
    assert len(series) == 2
    assert {s.item_id for s in series} == {"item-sys", "item-dia"}
    for s in series:
        assert s.instrument_id == "inst-bp"
        assert s.archetype == "numeric"
        assert s.unit == "mmHg"
        assert len(s.points) == 1


def test_two_measurements_same_item_yield_one_series_two_points_sorted_asc() -> None:
    older = _measurement(
        observed_at=_ts(days_ago=10),
        values=[_value(value="120")],
    )
    newer = _measurement(
        observed_at=_ts(days_ago=1),
        values=[_value(value="132")],
    )
    series = project_series([newer, older])  # mixed input order
    assert len(series) == 1
    points = series[0].points
    assert len(points) == 2
    assert all(isinstance(p, LusciiNumericPoint) for p in points)
    assert points[0].observed_at < points[1].observed_at
    assert [p.value for p in points if isinstance(p, LusciiNumericPoint)] == [120.0, 132.0]


def test_numeric_parse_failure_drops_point_keeps_series() -> None:
    series = project_series(
        [
            _measurement(
                observed_at=_ts(days_ago=2),
                values=[_value(value="not-a-number")],
            ),
            _measurement(
                observed_at=_ts(days_ago=1),
                values=[_value(value="125")],
            ),
        ]
    )
    assert len(series) == 1
    assert len(series[0].points) == 1
    only = series[0].points[0]
    assert isinstance(only, LusciiNumericPoint)
    assert only.value == 125.0


def test_ordinal_parse_failure_drops_point() -> None:
    series = project_series(
        [
            _measurement(
                observed_at=_ts(),
                values=[
                    _value(
                        archetype="ordinal",
                        value="II",
                        unit="NYHA klasse",
                        label="NYHA",
                    )
                ],
            )
        ]
    )
    # The only value's `II` doesn't parse, so the candidate (instrument-item)
    # has zero points — drop the whole series.
    assert series == []


def test_categorical_point_carries_response_texts() -> None:
    series = project_series(
        [
            _measurement(
                observed_at=_ts(),
                instrument_id="inst-q",
                instrument_name="Klachten dagboek",
                values=[
                    _value(
                        instrument_id="inst-q",
                        item_id="item-symptoms",
                        archetype="categorical",
                        value=None,
                        unit=None,
                        label="Klachten",
                        response_texts=["Vermoeidheid", "Kortademigheid"],
                    )
                ],
            )
        ]
    )
    assert len(series) == 1
    point = series[0].points[0]
    assert isinstance(point, LusciiCategoricalPoint)
    assert point.responses == ["Vermoeidheid", "Kortademigheid"]
    assert series[0].unit is None  # categorical has no unit


def test_free_text_point_kept_when_non_empty_unknown_when_no_value() -> None:
    series = project_series(
        [
            _measurement(
                observed_at=_ts(),
                instrument_id="inst-q",
                instrument_name="Open vraag",
                values=[
                    _value(
                        instrument_id="inst-q",
                        item_id="item-free",
                        archetype="free_text",
                        value="Voelt me ok.",
                        unit=None,
                        label="Open vraag",
                    )
                ],
            )
        ]
    )
    assert len(series) == 1
    point = series[0].points[0]
    assert isinstance(point, LusciiFreeTextPoint)
    assert point.text == "Voelt me ok."


def test_free_text_empty_string_drops_point() -> None:
    series = project_series(
        [
            _measurement(
                observed_at=_ts(),
                values=[
                    _value(
                        item_id="item-free",
                        archetype="free_text",
                        value="   ",
                        unit=None,
                        label="Open vraag",
                    )
                ],
            )
        ]
    )
    assert series == []


def test_unknown_archetype_keeps_raw_value() -> None:
    series = project_series(
        [
            _measurement(
                observed_at=_ts(),
                values=[_value(archetype="unknown", value="II", unit="NYHA klasse")],
            )
        ]
    )
    assert len(series) == 1
    point = series[0].points[0]
    assert isinstance(point, LusciiUnknownPoint)
    assert point.raw == "II"


def test_series_archetype_takes_most_recent_point() -> None:
    # An older measurement classified as numeric, a newer one as categorical
    # for the same item-id. The series face follows the freshest point AND
    # the older point survives as its own archetype variant.
    series = project_series(
        [
            _measurement(
                observed_at=_ts(days_ago=2),
                values=[_value(value="128", archetype="numeric")],
            ),
            _measurement(
                observed_at=_ts(days_ago=1),
                values=[
                    _value(
                        archetype="categorical",
                        value=None,
                        unit=None,
                        response_texts=["Hoog"],
                    )
                ],
            ),
        ]
    )
    assert len(series) == 1
    assert len(series[0].points) == 2, "older numeric point must survive series-archetype switch"
    assert series[0].archetype == "categorical"
    assert series[0].unit is None  # categorical scrubs unit


def test_series_sort_order_is_most_recent_point_descending() -> None:
    # Two series: weight (most recent 1d ago) and BP (most recent 5d ago).
    # Weight should come first.
    series = project_series(
        [
            _measurement(
                observed_at=_ts(days_ago=5),
                instrument_id="inst-bp",
                values=[_value(value="128")],
            ),
            _measurement(
                observed_at=_ts(days_ago=1),
                instrument_id="inst-w",
                instrument_name="Gewicht",
                values=[
                    _value(
                        instrument_id="inst-w",
                        item_id="item-weight",
                        value="79.2",
                        unit="kg",
                        label="Gewicht",
                    )
                ],
            ),
        ]
    )
    assert [s.instrument_id for s in series] == ["inst-w", "inst-bp"]


def test_value_without_instrument_or_item_id_is_skipped() -> None:
    series = project_series(
        [
            _measurement(
                observed_at=_ts(),
                values=[
                    _value(instrument_id=None, value="128"),
                    _value(item_id=None, value="82"),
                    _value(value="79.2", item_id="item-w", instrument_id="inst-w"),
                ],
            )
        ]
    )
    assert len(series) == 1
    assert series[0].item_id == "item-w"


def test_program_id_attached_to_every_point_when_provided() -> None:
    series = project_series(
        [
            _measurement(
                observed_at=_ts(days_ago=1),
                values=[_value(value="128")],
            ),
            _measurement(
                observed_at=_ts(days_ago=5),
                values=[_value(value="120")],
            ),
        ],
        program_id="prog-zas-1",
    )
    assert len(series) == 1
    for point in series[0].points:
        assert point.program_id == "prog-zas-1"


def test_program_id_absent_when_not_provided() -> None:
    series = project_series(
        [_measurement(observed_at=_ts(), values=[_value(value="128")])],
    )
    assert series[0].points[0].program_id is None


def test_measurement_without_timestamp_is_skipped() -> None:
    bad = LusciiMeasurementView(
        instrument_id="inst-bp",
        instrument_name="Bloeddruk",
        values=[_value(value="128")],
    )
    assert project_series([bad]) == []


def test_series_id_matches_compute_series_id_for_its_pair() -> None:
    measurement = _measurement(
        observed_at=_ts(),
        values=[_value(item_id="item-w", instrument_id="inst-w", value="79.2", unit="kg")],
    )
    series = project_series([measurement])
    assert series[0].series_id == compute_series_id("inst-w", "item-w")
