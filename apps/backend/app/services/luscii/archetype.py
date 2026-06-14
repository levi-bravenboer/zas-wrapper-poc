"""Archetype classifier for Luscii measurement values.

The wire-side `LusciiMeasurementValueView.archetype` field is set by the pure
function below. It is structural metadata derived from data shape only:

- presence of `response_ids` marks a categorical (multiple-choice) item;
- a parseable numeric `value` plus an ordinal-unit allowlist match → ordinal;
- a parseable numeric `value` → numeric;
- a free-text string with no unit and no response ids → free_text;
- otherwise unknown.

The classifier MUST NOT interpret the value (no thresholds, severity, ranges,
flags). It looks at unit/response-ids/parseability only. Display-only invariant
of `luscii-patient-data` is preserved (see also the
`luscii-measurement-charts` change spec under
`openspec/changes/2026-06-14-luscii-measurement-charts/`).

NYHA klasse values (roman numerals like "II", "III") classify as `unknown` in
v1 (D-NYHA-DEFER); a follow-up may add `_parse_roman()` to surface them as
`ordinal`.
"""

from __future__ import annotations

from typing import Final, Literal

Archetype = Literal["numeric", "ordinal", "categorical", "free_text", "unknown"]


ORDINAL_UNITS: Final[frozenset[str]] = frozenset(
    {
        "Punten",
        "punten",
        "Punkte",
        "Points",
        "points",
        "Score",
        "score",
        "Sterren",
        "sterren",
        # NYHA values are roman numerals which `parse_numeric` does not yet
        # recognise; the allowlist keeps the unit string so adding a roman
        # parser later is a one-line change.
        "NYHA klasse",
        "NYHA",
    }
)


def parse_numeric(value: str | None) -> float | None:
    """Parse a Luscii detail-item value into a finite float.

    Tolerant of surrounding whitespace and decimal-comma locales (`82,5` →
    `82.5`). Returns `None` when the input is missing, empty, or unparseable;
    `None` also for non-finite results (NaN, inf) so downstream code can drop
    the point without surfacing junk.
    """

    if value is None:
        return None
    stripped = value.strip()
    if not stripped:
        return None
    normalised = stripped.replace(",", ".")
    try:
        parsed = float(normalised)
    except ValueError:
        return None
    # `float("inf")` parses successfully; reject non-finite to keep the wire
    # clean.
    if parsed != parsed or parsed in (float("inf"), float("-inf")):
        return None
    return parsed


def classify_archetype(
    value: str | None,
    response_ids: list[str],
    unit: str | None,
) -> Archetype:
    """Assign an `Archetype` to one measurement-detail item.

    Rule order is significant — rule 1 (categorical) takes precedence over a
    parseable numeric value because a multiple-choice questionnaire item with
    a numeric scale-position label (e.g. "3" out of 5) is still semantically
    categorical on the wire.
    """

    if response_ids:
        return "categorical"

    parsed = parse_numeric(value)
    has_unit = bool(unit and unit.strip())

    if parsed is not None and has_unit and unit in ORDINAL_UNITS:
        return "ordinal"
    if parsed is not None:
        return "numeric"
    if value is not None and value.strip() and not has_unit:
        return "free_text"
    return "unknown"
