"""Unit tests for the Luscii archetype classifier.

Pure logic, no DB. The classifier underpins both the wire-side `archetype`
field on every measurement value and the per-series archetype on the
`series[]` block; misclassification ripples into chart selection on the FE.
"""

from __future__ import annotations

import pytest

from app.services.luscii.archetype import (
    ORDINAL_UNITS,
    classify_archetype,
    parse_numeric,
)

pytestmark = pytest.mark.no_db


# ── parse_numeric ─────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("82", 82.0),
        (" 82 ", 82.0),
        ("82.5", 82.5),
        ("82,5", 82.5),
        (" 82,5 ", 82.5),
        ("0", 0.0),
        ("-3", -3.0),
        ("3.0e2", 300.0),
    ],
)
def test_parse_numeric_accepts_plain_and_locale_decimals(raw: str, expected: float) -> None:
    assert parse_numeric(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [
        None,
        "",
        "   ",
        "abc",
        "II",  # NYHA roman numeral — parser drops, D-NYHA-DEFER
        "82 kg",
        "nan",  # str → float("nan") technically parses; rejected as non-finite
        "inf",
        "-inf",
    ],
)
def test_parse_numeric_returns_none_for_unparseable_or_non_finite(raw: str | None) -> None:
    assert parse_numeric(raw) is None


# ── classify_archetype ────────────────────────────────────────────────────


def test_categorical_takes_precedence_over_numeric_value() -> None:
    # A questionnaire that records a numeric scale-position label via
    # response_ids is still semantically categorical.
    assert classify_archetype("3", ["resp-1"], "Punten") == "categorical"


def test_categorical_with_empty_unit() -> None:
    assert classify_archetype(None, ["resp-1"], None) == "categorical"


def test_categorical_with_multiple_response_ids() -> None:
    assert classify_archetype(None, ["r1", "r2", "r3"], "Klachten") == "categorical"


@pytest.mark.parametrize(
    "unit",
    sorted(ORDINAL_UNITS),
)
def test_ordinal_units_classify_as_ordinal_when_value_parses(unit: str) -> None:
    # Every unit in the allowlist becomes ordinal when paired with a
    # parseable numeric value and no response_ids.
    assert classify_archetype("3", [], unit) == "ordinal"


def test_numeric_units_classify_as_numeric() -> None:
    for unit in ("kg", "Kg", "Kilogram", "BMI", "mmHg", "BPM", "L/min", "Watt", "Stappen", "%"):
        assert classify_archetype("82", [], unit) == "numeric", unit


def test_numeric_value_without_unit_is_numeric() -> None:
    assert classify_archetype("82", [], None) == "numeric"


def test_decimal_comma_value_is_numeric() -> None:
    assert classify_archetype("82,5", [], "kg") == "numeric"


def test_whitespace_value_is_numeric() -> None:
    assert classify_archetype(" 82 ", [], "kg") == "numeric"


def test_freetext_when_no_unit_no_response_ids_and_value_non_numeric() -> None:
    assert classify_archetype("Voelt me ok, een beetje moe.", [], None) == "free_text"


def test_freetext_with_blank_unit_string() -> None:
    assert classify_archetype("hello", [], "") == "free_text"
    assert classify_archetype("hello", [], "   ") == "free_text"


def test_unknown_when_value_empty_no_unit_no_responses() -> None:
    assert classify_archetype("", [], None) == "unknown"
    assert classify_archetype(None, [], None) == "unknown"
    assert classify_archetype("   ", [], None) == "unknown"


def test_unknown_when_value_unparseable_and_unit_present() -> None:
    # The free_text rule is gated by "no unit"; with a unit, non-numeric +
    # no responses → unknown. NYHA roman-numeral case lives here in v1.
    assert classify_archetype("II", [], "NYHA klasse") == "unknown"


def test_classifier_is_pure() -> None:
    args = ("82", [], "kg")
    a = classify_archetype(*args)
    b = classify_archetype(*args)
    assert a == b == "numeric"
