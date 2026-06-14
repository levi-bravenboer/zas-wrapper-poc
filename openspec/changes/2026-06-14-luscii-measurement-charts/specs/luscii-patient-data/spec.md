# Capability delta: `luscii-patient-data`

## ADDED Requirements

### Requirement: Each measurement value carries a typed archetype + stable IDs

`LusciiMeasurementValueView` SHALL include `item_id: str | None`, `instrument_id: str | None`, and `archetype: Literal['numeric','ordinal','categorical','free_text','unknown']`. `item_id` and `instrument_id` SHALL be passed through verbatim from the Luscii source row (item_id from `LusciiMeasurementDetailItem.item_id`; instrument_id from the parent measurement's `LusciiMeasurement.instrument_id`). `archetype` SHALL be set by a deterministic server-side classifier (see "Archetype classifier" requirement below) and SHALL never be null — when classification fails it defaults to `unknown`.

`LusciiMeasurementView` SHALL include `instrument_id: str | None`, sourced from `LusciiMeasurement.instrument_id`.

These fields are additive on the existing `GET /patients/{id}/luscii-data` response. Existing consumers ignoring them continue to function.

#### Scenario: Numeric weight value gets archetype `numeric`

- **WHEN** a measurement value has `value="82"`, `unit="kg"`, and empty `response_ids`
- **THEN** its archetype on the wire MUST be `numeric` and its `item_id` MUST match the Luscii source item id

#### Scenario: Multiple-choice questionnaire item gets archetype `categorical`

- **WHEN** a measurement value has non-empty `response_ids` (regardless of `value` content)
- **THEN** its archetype on the wire MUST be `categorical`

#### Scenario: Score item gets archetype `ordinal`

- **WHEN** a measurement value has `value="3"`, `unit="Punten"`, and empty `response_ids`
- **THEN** its archetype on the wire MUST be `ordinal`

#### Scenario: Free-text answer gets archetype `free_text`

- **WHEN** a measurement value has a non-empty `value`, no `unit`, and empty `response_ids`, and the `value` does NOT parse as a number
- **THEN** its archetype on the wire MUST be `free_text`

#### Scenario: Unparseable item gets archetype `unknown`

- **WHEN** a measurement value has empty `value`, no `unit`, and empty `response_ids`
- **THEN** its archetype on the wire MUST be `unknown`

#### Scenario: Stable IDs survive across measurements

- **WHEN** two measurements from the same patient both carry an item with `item_id="X"` from the same `instrument_id="Y"`
- **THEN** both values on the wire MUST report `item_id="X"` and `instrument_id="Y"`, enabling clients to group them into one time-series

---

### Requirement: Archetype classifier is deterministic + rule-based + display-only

The backend SHALL include a pure module `app/services/luscii/archetype.py` implementing `classify_archetype(value: str | None, response_ids: list[str], unit: str | None) -> Archetype`. The function SHALL be deterministic (same inputs → same output), SHALL have no I/O, and SHALL apply the following rules in order:

1. If `response_ids` is non-empty → `categorical`.
2. Else if `value` parses as a finite float AND `unit` is in the `ORDINAL_UNITS` allowlist → `ordinal`.
3. Else if `value` parses as a finite float → `numeric`.
4. Else if `value` is a non-empty string AND `unit` is empty AND `response_ids` is empty → `free_text`.
5. Otherwise → `unknown`.

The `ORDINAL_UNITS` allowlist SHALL include at minimum the Luscii catalogue strings observed today: `Punten`, `punten`, `Punkte`, `Points`, `points`, `Score`, `score`, `NYHA klasse`, `NYHA`, `Sterren`, `sterren`, `Klachten`, `klachten`. New unit strings observed in later catalogue scans MAY be added to the allowlist in subsequent changes.

The classifier SHALL NOT inspect the value to derive any clinical interpretation. It SHALL NOT compute thresholds, ranges, severity, urgency, or any value-derived signal. The classifier is structural metadata only.

#### Scenario: Classifier is pure

- **WHEN** `classify_archetype(value, response_ids, unit)` is called twice with identical inputs
- **THEN** both calls MUST return the same archetype, with no external side effects

#### Scenario: Allowlist precedence over generic numeric

- **WHEN** the input is `value="5"`, `response_ids=[]`, `unit="Sterren"`
- **THEN** the classifier MUST return `ordinal` (allowlist match), NOT `numeric`

#### Scenario: Whitespace + decimal-comma tolerance

- **WHEN** the input is `value=" 82,5 "`, `response_ids=[]`, `unit="kg"`
- **THEN** the classifier MUST return `numeric` (whitespace stripped, comma parsed as decimal)

---

### Requirement: `GET /patients/{id}/luscii-data` returns a `series[]` block

`LusciiPatientData` SHALL include a `series: list[LusciiMeasurementSeries]` field, additive to the existing `program`, `protocol`, `planned_actions`, and `unmatched_measurements` fields. The series block SHALL project measurement values into time-series grouped by `(instrument_id, item_id)` over the window selected by `?days=N`.

When the patient state is `not_linked` or no measurements with both an `instrument_id` AND an `item_id` landed in the window, `series` SHALL be an empty list. Existing consumers of `planned_actions` and `unmatched_measurements` SHALL keep working unchanged — `series[]` is purely additive.

Each `LusciiMeasurementSeries` SHALL carry:

- `series_id: str` — stable 12-character lowercase hex, computed as `sha256(f"{instrument_id}|{item_id}").hexdigest()[:12]`. Stable across requests and across `days` changes.
- `instrument_id: str` — Luscii instrument id, non-null (series are skipped if either ID is missing).
- `instrument_name: str | None` — catalogue-resolved per the existing locale rule (prefer `nl`, fallback first available).
- `item_id: str` — Luscii item id, non-null.
- `label: str | None` — catalogue-resolved item title, locale rule as above.
- `archetype: Archetype` — the most recent point's archetype (D-ARCHETYPE-PER-SERIES); never `null`.
- `unit: str | None` — present only when `archetype ∈ {'numeric','ordinal'}`; absent for `categorical`/`free_text`/`unknown`.
- `points: list[LusciiMeasurementPoint]` — sorted ascending by `observed_at`; never empty (series with zero points are not emitted).

Series SHALL be sorted in the response by the timestamp of their most recent point in DESCENDING order (most recently-active series first).

#### Scenario: Linked patient with two measurements of one item produces a series with two points

- **WHEN** a linked patient has two measurements with the same `(instrument_id, item_id)` at different `processed_at` timestamps in the window
- **THEN** `series` MUST contain exactly one entry for that `(instrument_id, item_id)` with two points sorted ASC by `observed_at`

#### Scenario: Multi-item instrument produces multiple series

- **WHEN** a single measurement contains two items belonging to the same `instrument_id` (e.g. blood-pressure sys + dia)
- **THEN** `series` MUST contain two entries, both with the same `instrument_id` and different `item_id`s, each with one point

#### Scenario: Not-linked patient returns an empty series list

- **WHEN** a patient is not linked to Luscii
- **THEN** the response MUST contain `series: []`

#### Scenario: Series with no points are not emitted

- **WHEN** every value for a candidate `(instrument_id, item_id)` is dropped during point construction (e.g. all numeric parses failed)
- **THEN** that `(instrument_id, item_id)` MUST NOT appear in `series`

#### Scenario: Series sort order

- **WHEN** the response contains multiple series whose most-recent points fall on different timestamps
- **THEN** the series with the most-recent point in time MUST appear first in the `series` array

---

### Requirement: `LusciiMeasurementPoint` is a discriminated union over `archetype`

Each point in a series SHALL be one of five archetype-specific shapes, discriminated by the `archetype` field:

- `LusciiNumericPoint`: `observed_at: datetime`, `archetype: 'numeric'`, `value: float`, optional `program_id: str | None`.
- `LusciiOrdinalPoint`: `observed_at: datetime`, `archetype: 'ordinal'`, `value: float`, optional `program_id: str | None`.
- `LusciiCategoricalPoint`: `observed_at: datetime`, `archetype: 'categorical'`, `responses: list[str]`, optional `program_id: str | None`.
- `LusciiFreeTextPoint`: `observed_at: datetime`, `archetype: 'free_text'`, `text: str`, optional `program_id: str | None`.
- `LusciiUnknownPoint`: `observed_at: datetime`, `archetype: 'unknown'`, `raw: str | None`, optional `program_id: str | None`.

OpenAPI SHALL render this as a `oneOf` with `discriminator: { propertyName: archetype }`. The TypeScript client emitted by openapi-typescript SHALL produce a literal-discriminated union enabling exhaustive `switch (point.archetype)` checks at compile time.

`observed_at` SHALL be sourced from the parent measurement's `processed_at`, falling back to `created_at` when `processed_at` is null.

`program_id` SHALL carry the patient's current programme id (`LusciiPatientData.program.id` when present) for every point in v1. A future change may resolve historical programme ids when the window spans a programme transition.

For `numeric` and `ordinal` archetypes, the server SHALL parse `value` to a finite `float` ONCE during projection. If parsing fails, the point SHALL be silently dropped from the series, logged at WARN with the series_id + the unparseable raw value. The series SHALL survive. The wire SHALL NEVER carry stringly-typed numeric values.

#### Scenario: Numeric point carries a parsed float

- **WHEN** the source value is `"82"` with `unit="kg"`
- **THEN** the emitted point MUST satisfy `archetype="numeric"` AND `value === 82.0` (typed as JSON number, not string)

#### Scenario: Categorical point carries a responses list

- **WHEN** the source value has `response_texts=["Geel", "Helder"]`
- **THEN** the emitted point MUST satisfy `archetype="categorical"` AND `responses === ["Geel", "Helder"]`

#### Scenario: Unparseable numeric value drops the point

- **WHEN** the source value is `"not a number"` with `unit="kg"`
- **THEN** the value MUST NOT produce a point in the series, and the rest of the series MUST be emitted normally

#### Scenario: `program_id` carries the current programme id

- **WHEN** the patient is linked to a programme with id `"prog-123"`
- **THEN** every point on every series in the response MUST carry `program_id="prog-123"`

#### Scenario: Discriminator narrows TypeScript types

- **WHEN** a TypeScript consumer writes `if (point.archetype === 'numeric')`
- **THEN** the TypeScript compiler MUST narrow `point.value` to `number` and `point.responses` MUST be inaccessible

---

## MODIFIED Requirements

### Requirement: Display-only invariant reasserted

The aggregation payload SHALL contain only values, labels, units, timestamps, identifiers, **archetype structural metadata**, and Luscii's own status fields, passed through unmodified or projected/classified structurally (group-by, sort, parse-numeric, archetype-from-data-shape).

The backend MUST NOT compute, expose, or include in the payload:

- Thresholds (clinical or otherwise)
- Severity, urgency, or rank derived from value
- Out-of-range flags
- Trend direction (`improving` / `worsening`) computed from values
- Aggregates over the series (mean, median, p95)
- Comparison to a baseline, cohort, or reference range

Any future change adding such a field MUST first add an entry to `openspec/mdr-watchlist.md`.

The `archetype` field added in this change is explicitly NOT a clinical interpretation; it is structural metadata derived from the data shape (`unit`, `response_ids`, parseability of `value`). Reviewers SHALL treat any pull request that derives a flag/score/range/comparison from `value` content — even when labelled as "metadata" — as MDR-adjacent and SHALL require the watchlist entry before approval.

The chart layer consuming this payload SHALL respect the same invariant: y-axis ranges MUST derive from observed point ranges (auto-scale), NEVER from hardcoded clinical ranges; colours MUST be theme-palette only with no value-coded heuristics; tooltips MUST show the raw value + unit + timestamp without annotations like "below normal".

#### Scenario: No threshold fields on the wire

- **WHEN** the aggregation payload is serialised
- **THEN** no field named `threshold`, `severity`, `rank`, `out_of_range`, `flag`, `trend`, `mean`, `median`, `p95`, `baseline`, `reference_range`, or any synonymous variant MUST appear, on any model

#### Scenario: Archetype is structural, not interpretive

- **WHEN** two measurements have the same `unit` and `response_ids` shape but different `value` content (e.g. `value="82"` vs `value="120"`, both `unit="kg"`)
- **THEN** both points MUST receive the same `archetype` (`numeric`), regardless of value magnitude
