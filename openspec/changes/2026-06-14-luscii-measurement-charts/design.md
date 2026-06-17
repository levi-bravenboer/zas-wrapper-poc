## Context

`luscii-patient-enrichment` (PR #45) shipped the data path: `GET /patients/{id}/luscii-data?days=N` returns a linked patient's programme + protocol + planned actions (with embedded measurements when joined by `plannedActionId`) + unmatched measurements. Measurement values are decoded against locally-synced Luscii localisation catalogues into `{label, value, unit, response_texts}` items. The current FE consumer is `<LusciiPanel>`, a planned-actions timeline rendering each measurement inline.

This change adds the **visualisation layer**: typed time-series projection on the wire + instrument-grouped chart UI on the Metingen tab. The data shape today does not carry stable item/instrument IDs on individual values, nor any archetype classification, so the FE cannot group items across measurements into time-series. We add those additively without breaking the existing planned-actions consumer.

Tenancy, visibility, MDR display-only invariant, and Luscii degradation behaviour from `luscii-patient-data` are inherited as-is.

## Goals / Non-Goals

**Goals:**

- A caregiver opens the patient detail Metingen tab and immediately sees grouped charts of the patient's measurements over the last 30 days. Each instrument is a card; numeric items chart as lines, ordinal/score items chart as bars, questionnaire answers render as chip-stream timelines.
- The 30-day default reads as "what's recent and relevant"; the 7d / 30d / 90d / 365d selector lets caregivers zoom out for trend review without leaving the page.
- The wire format gives the FE everything it needs to render charts without re-grouping or re-parsing: typed series, parsed numeric values, stable IDs, archetype-discriminated point shapes.
- Chart dispatch is data-driven (`archetype` switch), so adding a new archetype later is one renderer + one classifier rule.
- The existing planned-actions timeline (`<LusciiPanel>`) keeps working unchanged — relocated visually but identical in code.
- The display-only invariant of `luscii-patient-data` is preserved (no thresholds, no scores, no derived signals) and **reasserted** because adding chart rendering invites threshold-style additions later.

**Non-Goals:**

- Server-side caching of Luscii responses (request-path stays a live proxy).
- HiX FHIR-backed equivalents for `smart` + `embed` (component contract is multi-surface; the FHIR adapter is `[mvp]`).
- Historical programme-name resolution (transition bands fall back to anonymous when not the current programme).
- Per-point drill-down routes, export to PDF/CSV, cohort views, annotations.
- User-configurable scale overrides (log scale, custom axis range) — would push display-only ambiguity.
- Real-time push; re-fetch on focus is enough for the demo.
- A new sidebar entry; `<MeasurementCharts>` lives inside the existing Metingen tab.

## Decisions

### D-ARCH — Visualisation is FE-rendered over a typed series wire

The backend projects time-series (`series[]`) and classifies each item's archetype; the FE renders. No server-side chart generation, no SVG-on-the-wire. This keeps the backend deterministic + cache-friendly and the FE free to evolve chart shapes (sparklines, expanded charts, future overlays) without re-shaping the wire.

**Alternatives considered:**

- Server-rendered SVG chart images per series. Rejected — caching is harder, dynamic interactivity (hover, zoom, window switch) impossible, and the wire becomes opaque to FE composition.
- Pure FE-side projection (no `series[]` on the wire, FE groups raw measurements). Rejected — FE has to re-iterate the full measurement set on every render, lacks stable IDs for grouping, must reparse numeric values; the per-surface cost (app + smart + embed) duplicates the logic three times.

### D-WIRE — Discriminated `Point` per archetype, typed numeric values

`LusciiMeasurementPoint` is a discriminated union over `archetype`:

```
NumericPoint     { observed_at, archetype: 'numeric',     value: float,            program_id? }
OrdinalPoint     { observed_at, archetype: 'ordinal',     value: float,            program_id? }
CategoricalPoint { observed_at, archetype: 'categorical', responses: list[str],    program_id? }
FreeTextPoint    { observed_at, archetype: 'free_text',   text: str,               program_id? }
UnknownPoint     { observed_at, archetype: 'unknown',     raw: str | None,         program_id? }
```

OpenAPI emits this as `oneOf` with `discriminator: archetype`. TS narrows automatically in the chart `switch`. Server parses numeric/ordinal values to `float` ONCE; unparseable values drop the point but keep the series.

**Why per-point archetype rather than per-series only:** The data already has it per series too — `LusciiMeasurementSeries.archetype` is set to match every point's archetype (each item has one archetype across all its measurements). Carrying it on both is redundant but cheap, and lets a stray point survive a future archetype-mixing case without breaking the FE switch. Keep both.

### D-CLASSIFIER — Pure rule-based archetype classifier

`classify_archetype(value, response_ids, unit)` is a pure function. Rules in order:

1. `response_ids` non-empty → `categorical`.
2. `value` parses as `float` AND `unit` ∈ `ORDINAL_UNITS` → `ordinal`.
3. `value` parses as `float` → `numeric`.
4. `value` is a non-empty string AND `unit` is empty AND no `response_ids` → `free_text`.
5. Otherwise → `unknown`.

`ORDINAL_UNITS` (initial allowlist, seeded from the 2026-06-14 catalogue scan):

```python
ORDINAL_UNITS: Final[frozenset[str]] = frozenset({
    "Punten", "punten",
    "Punkte",
    "Points", "points",
    "Score", "score",
    "NYHA klasse", "NYHA",
    "Sterren", "sterren",
    "Klachten", "klachten",
})
```

**Why an allowlist instead of a heuristic:** Heuristics ("integer in [0,10]") drift with locale and instrument families. An allowlist is explicit, reviewable, MDR-defensible (no value interpretation; just metadata classification), and extendable in one place. Items mis-classified as `numeric` still chart correctly — just with a line instead of bars; the operator sees the wrong chart type and adds the unit to the allowlist.

**Locale handling:** The classifier sees the catalogue-resolved unit (per `luscii-patient-data` locale rule: prefer `nl`, fallback first available). The allowlist covers both `nl` and `en` spellings of the same concept. Adding a new locale extends the allowlist.

**Display-only check:** The classifier looks at `unit` (a label string) and `response_ids` (a marker of multiple-choice items). It NEVER looks at `value` to infer severity, urgency, or out-of-range status. This is structural metadata only.

### D-SERIES-ID — Stable hash for deep-linking

`series_id = sha256(f"{instrument_id}|{item_id}").hexdigest()[:12]`. Stable across requests as long as Luscii's IDs are stable; survives `days` changes; safe in URL paths (lowercase hex). The hash is deterministic, computed in the projection pass, never persisted.

FE consumes `series_id` for React keys and intra-page focus state in v1. A future change wiring deep-link routes (`?focus=<series_id>`) reuses the same ID.

### D-WINDOW — 30-day default + 7/30/90/365 selector

The backend already supports `?days=N` (default 30, max 365) per `luscii-patient-data`. The FE selector exposes 7, 30, 90, 365. Default = 30 to match the existing API default and the "what's recent" framing in the proposal. Window changes refetch via TanStack Query; the cache key includes `days`.

**Why exactly these four:** 7d for "this week's activity", 30d for the default mental model, 90d for "quarterly trends", 365d for "the full programme arc". Skipping 14d/60d keeps the chip strip readable.

### D-WINDOW-NOT-IN-URL — Selector state is component-local in v1

The window selector value is panel-local React state, not persisted to the URL. Reasons:

- The patient detail URL is the patient's identity. Two caregivers reviewing the same patient should not see different defaults because one chose a 365d window earlier.
- Persistence in the URL forces conflict with the existing patient-detail route shape.
- Deep-linking to a specific window is not a v1 use case; share-the-URL stays "share the patient", not "share my chosen window".

Revisit if usage data shows people want their window choice to survive a tab switch.

### D-LAYOUT — Instrument-grouped, sparkline-first cards

The panel renders one card per `instrument_id` present in `series[]`. Card header = instrument name + last-value badge + sparkline (when ≥ 2 points). Click-to-expand reveals the full chart + a tabular list of points.

**Sorting:** Cards sort by most-recent point timestamp DESC (the patient's freshest activity tops the panel). Within an instrument, multi-item charts share the card body.

**Multi-item instruments:** Items belonging to the same `instrument_id` render as a single chart with a per-item legend. Blood pressure (`sys` + `dia`) is the canonical case. See D-MULTI-SERIES.

**Why instrument-first instead of item-first:** The catalogue stitches items inside instruments (BP-instrument has sys+dia+pulse items). Splitting them into three independent cards loses the "these were measured together" semantic. Instrument-grouped is how the patient actually experienced the measurement.

**Why sparkline-first instead of all-expanded:** A patient on a heart-failure protocol might have 5–10 instruments active. Expanding all by default forces a long scroll; sparkline preview keeps the page scannable. Single-point sparklines are hidden (no value to render) and the card shows only the last-value badge.

### D-CHART — Three chart engines (line, bar, chip-stream) + two list renderers

| Archetype | Renderer | Engine |
|---|---|---|
| `numeric` | `<LineChart>` (1 series) / `<MultiLineChart>` (≥2 items same instrument) | shadcn `Chart` over Recharts `LineChart` |
| `ordinal` | `<BarChart>` with discrete y-ticks | shadcn `Chart` over Recharts `BarChart` |
| `categorical` | `<ChipStreamTimeline>` — horizontal stream of dated chips | custom Tailwind/JSX (no chart engine) |
| `free_text` | `<FreeTextLog>` — dated list of text entries | plain Tailwind list |
| `unknown` | `<UnknownLog>` — dated list with "Onbekend formaat" annotation | plain Tailwind list |

Each renderer accepts a single `LusciiMeasurementSeries` and exports a typed prop signature. Adding a new archetype later = one new renderer + one classifier rule + one registry entry.

### D-MULTI-SERIES — Shared axis for multi-item instruments

When an instrument has multiple numeric items (BP sys + dia), they render as ONE chart with a shared y-axis and per-item legend lines. Tooltip shows the timestamp + all items' values at that timestamp.

**Why shared axis:** Medically conventional for BP. The observed ranges stay compact (sys ≈ 80–200, dia ≈ 50–120) so a shared axis reads cleanly. Two separate sub-charts would lose the visual correlation that motivates rendering them together in the first place.

**Trade-off:** Instruments with items at wildly disparate scales (hypothetical: BMI + Watt in one instrument) would render badly. **Mitigation accepted**: such instruments don't exist in Luscii's catalogue today; if a future instrument does, the chart's auto-axis will compress one item into a flat line and the operator can split it manually.

### D-MEASUREMENT-REGISTRY — Per-measurement-type chart specs, hybrid-keyed

Chart KIND is chosen **per measurement type** (the specific clinical concept),
not generically per archetype. A blood pressure has a best-practice rendering
that a wellbeing score does not. A curated registry maps a measurement to its
chart spec; the archetype dispatch (D-CHART) is the **fallback** for anything
not in the registry.

**Three-level resolution (first match wins):**

1. **Instrument-level composite** — group sibling items into one chart.
   Keyed by instrument FHIR coding / `instrumentType`. (BP sys+dia → one
   shared-axis chart, per D-MULTI-SERIES.)
2. **Item-level spec** — the measurement's curated chart. Keyed **hybrid:
   FHIR `coding` (LOINC) first, Luscii `item_id` fallback** for items Luscii
   has not coded.
3. **Archetype default** — line/bar/chip-stream/log per D-CHART, when no
   registry entry matches.

**Registry entry shape:**
```
{ match: { loinc?: string[]; lusciiItemId?: string[] },
  chartKind, unit, axis?: { min, max, step, decimals }, composite?, labelKey }
```

**Seed scope = vitals + scores** (everything else → archetype fallback):

| Measurement | LOINC (or id fallback) | Chart | Axis / unit |
|---|---|---|---|
| Blood pressure | 85354-9 (8480-6 sys / 8462-4 dia) | dual line, shared axis (composite) | mmHg |
| Heart rate / pulse | 8867-4 | line | bpm |
| Weight | 29463-7 | line | kg, 1 dec |
| Body temperature | 8310-5 | line | °C, 1 dec |
| SpO₂ | 59408-5 / 2708-6 | line | %, axis 85–100 |
| Respiratory rate | 9279-1 | line | /min |
| Pain (NRS) | 72514-3 | line | score, axis 0–10 |
| NYHA class | id fallback (no clean LOINC) | dot / stepped | ordinal I–IV |
| Wellbeing score | id fallback (questionnaire) | ordinal line | score |

**Dependency:** the LOINC key requires the **structural catalogue** (`coding`
+ item `type`), which is NOT synced today (only the localisation strings are).
This change must extend `sync_luscii_catalogue.py` to `/v1/instruments` +
`/v1/instrument-items` (+ item-sets, responses) so `coding`/`type` are
available. Until then the registry runs on the `lusciiItemId` fallback +
archetype default. The authoritative `itemType` also replaces the
`classify_archetype` heuristic (D-CLASSIFIER) for coded items.

**Why hybrid, not LOINC-only:** Luscii does not code every item; id fallback
keeps known-but-uncoded items (NYHA, org questionnaires) curatable. **Why not
id-only:** LOINC is portable across orgs and survives Luscii id reissue.

**MDR:** registry entries set chart kind, unit, and axis bounds (display
scaffolding) only — **never** reference ranges, thresholds, colour-by-value,
or any clinical interpretation. Axis min/max is the instrument's possible
range, not a normal range. The display-only invariant (D-NO-DERIVED) holds.

### D-CAREPATH-GROUPS — Outer sectioning by carepath (depends on patient-luscii-connection)

With `patient-luscii-connection`, a patient holds many Luscii connections
(one per Luscii patient/program), each attributable to a carepath. The panel
gains an **outer section layer above the instrument cards**:

```
carepath group  (Huidig zorgpad / Historie / Niet gekoppeld)   ← outer
  └─ instrument card  (per instrument_id)
       └─ chart per series  (registry → archetype fallback)
```

Grouping is **layout only** — it sections the same instrument cards; it never
changes a chart's kind. Bucketing (current/history/unassigned) is the FE
attribution from `patient-luscii-connection` D5. Labels: `luscii.groups.*`
(already in `nl/patient-profile.json`). This layer is gated on the connection
change landing; until then the panel renders a single flat instrument list.

### D-PROGRAM — Concurrent programmes via connections, optional `program_id` per point

Per Luscii *patient* programmes are sequential — one active programme at a
time. But one of OUR patients can hold several Luscii patients at once
(`patient-luscii-connection`), so across our patient multiple programmes run
**concurrently**, one per connection. A measurement attributes to a programme
via its connection (`measurement.patient_id`); historical membership within a
single connection stays implicit in the time-stamped measurements.

`LusciiPatientData.program` stays singular (the current programme). Each `Point` gains an optional `program_id` so the FE can:

- Render a transition band on the x-axis when the `program_id` changes between consecutive points.
- Filter "only show points from the current programme" (UX deferred; the field is on the wire to enable it later).

**Why optional and not always-set:** older measurements may pre-date programme attribution in Luscii's API. Treating `program_id` as best-effort metadata keeps the wire honest.

**Historical programme NAMES** are not resolved — the FE renders the current programme name when the `program_id` matches `program.id`, otherwise `Programmawissel` fallback. Resolving historical names needs a backend cache or another Luscii API call; deferred.

### D-PROJECTION — Single-pass server projection

The aggregation service already iterates the windowed measurement set once to build `planned_actions[]` + `unmatched_measurements[]`. Series projection runs in the same pass:

```python
series_map: dict[tuple[str, str], list[Point]] = {}
for measurement in windowed_measurements:
    instrument_id = measurement.instrument_id
    for value in measurement.values:
        item_id = value.item_id
        if not item_id or not instrument_id:
            continue
        archetype = classify_archetype(value.value, value.response_ids, value.unit)
        point = build_point(archetype, value, measurement.processed_at or measurement.created_at, programme_id_at(measurement))
        if point is None:  # parse failure for numeric/ordinal
            continue
        series_map[(instrument_id, item_id)].append(point)

series = [
    build_series(instrument_id, item_id, points, archetype, label, unit, instrument_name)
    for (instrument_id, item_id), points in series_map.items()
    if points
]
```

Sort points within a series by `observed_at` ASC at series-construction time. Sort series by most-recent point DESC.

**No extra Luscii API calls.** Same data, projected differently.

### D-ARCHETYPE-PER-SERIES — Single archetype per series (no mixing)

If an item's values across measurements classify into different archetypes (one measurement has a `value` that parses, the next has `response_ids`), the **series takes the archetype of the most recent point** and renders mixed historical points as fallback (raw string in the appropriate `unknown`/`free_text` lane).

**Why:** Mixed-archetype series confuse charting. The historical data isn't lost — it just renders in a less typed way. Operator can investigate.

**Realistic occurrence:** Should be rare. Item IDs in Luscii are tied to instrument items, and an instrument's item is either a numeric capture or a multiple-choice — switching mid-stream would be a Luscii data anomaly.

### D-NO-DERIVED — Display-only invariant reasserted

The wire MUST NOT carry:

- Min/max/threshold hints
- Severity / rank / out-of-range flags
- Trend direction (`improving`, `worsening`) computed from values
- Aggregates (mean, median, p95) over the series
- Comparison to cohort/baseline

These are all MDR-adjacent because they apply clinical interpretation to raw values. The wire carries values, labels, units, timestamps, identifiers, archetypes, and optional programme attribution. Nothing else.

The chart layer SHALL respect this:

- Y-axis ranges derive from the observed point range (auto-scale), NEVER a hardcoded clinical range.
- Colours are theme palette only; no green/red value-coded heuristics.
- Tooltips show the raw value + unit + timestamp; no annotations like "below normal".

Adding any of the forbidden fields requires an `openspec/mdr-watchlist.md` entry first.

### D-RECHARTS — shadcn/ui Chart over Recharts, widen the closed set

The `apps/orchestrator/AGENTS.md` shadcn primitive list is intentionally closed; adding a primitive requires an OpenSpec change. This is that change for `Chart`.

**Why shadcn/ui Chart:**

- Tailwind-themed via the project's existing token system (no new CSS surface).
- Composable with the rest of the shadcn primitive set already in use.
- Re-exports Recharts components with sensible defaults (Tooltip, Legend, ResponsiveContainer).
- Repo memory favours packages over custom builds; shadcn baseline is the explicit reference.

**Alternatives considered:**

- Recharts directly (no shadcn wrapper). Loses the Tailwind theme integration; would re-implement Tooltip/Legend styling. Rejected on cost.
- Visx (D3 toolbox). Maximum flexibility, but we don't need custom scales/axes for v1; the cost-to-benefit favours shadcn.
- Custom SVG. Reinvents axis/legend/tooltip; high iteration cost.
- ECharts / Chart.js. Canvas-based; doesn't compose with shadcn theming; bigger bundle.
- Tremor. Opinionated dashboard kit; overlaps with shadcn; heavier.

**Bundle cost:** ≈110 KB gzipped (Recharts + shadcn wrapper). Acceptable for a default-tab content panel.

### D-DEMO-FOCUS — v1 polish targets weight + blood pressure

The wire-side machinery (5 archetypes, series projection, discriminated points) ships in full so any catalogue item Luscii returns renders without a runtime crash. **Demo polish + smoke-test coverage focuses on `Gewicht` and `Bloeddrukmeting`** — the two clinically-canonical items every Luscii patient on a `Hartfalen Monitor`-style programme produces. Other instrument types (NYHA klasse, Klachten dagboek, Welbevinden score, free-text questionnaires) render correctly but receive less iteration in v1; follow-up changes refine their visuals based on real-data observation.

**Practical consequences:**

- Backend tests cover every archetype (correctness invariants), but the end-to-end smoke targets weight + BP.
- The HTML prototype keeps the 4 archetype examples (so reviewers see the full range) but the locked-version visual decisions are biased toward numeric line charts.
- NYHA klasse and similar roman-numeral ordinal items are NOT special-cased in v1 (see D-NYHA-DEFER). They land as `unknown` until a real demo needs them.

### D-NYHA-DEFER — Roman-numeral ordinals fall through to `unknown` in v1

`NYHA klasse` values arrive as `"I"`, `"II"`, `"III"`, `"IV"`. The classifier's `parse_numeric` step does not recognise roman numerals, so even though `NYHA klasse` is in `ORDINAL_UNITS`, an NYHA value lands at rule 5 (`unknown`) — no `response_ids`, no numeric parse, no `free_text` (because `unit` is present).

**v1 acceptance:** NYHA values render as a dated `<UnknownLog>` list. Readable, not pretty.

**Why defer:** roman-numeral parsing is one helper but classifier complexity grows quickly (locale variants, lowercase, dotted forms, ranges like `II-III`). The cost is non-trivial for a corner case that the weight+BP demo does not exercise (D-DEMO-FOCUS). A follow-up change can add `_parse_roman()` once an actual NYHA demo patient is in scope.

**ORDINAL_UNITS amendment:** drop `Klachten` from the initial allowlist — observed catalogue usage is more often a chip-stream questionnaire (categorical) than a numeric score. Keep `Punten/Punkte/Points/points/Score/score/Sterren/sterren/NYHA klasse/NYHA` so the allowlist is ready when roman parsing lands.

### D-PALETTE — ZAS teal + 4 derived accents for multi-series charts

Multi-series charts use a 5-slot palette declared as CSS variables in `apps/orchestrator/src/styles/tokens.css`:

```css
:root {
  --chart-series-1: #266b5e; /* ZAS teal — primary */
  --chart-series-2: #c7705a; /* coral — sys/dia second line */
  --chart-series-3: #d4a13a; /* amber */
  --chart-series-4: #4a5b6c; /* slate */
  --chart-series-5: #7a5cb0; /* violet */
}
```

Chart components reference the CSS vars by index (`var(--chart-series-1)`, ...). Light theme only at PoC — when dark mode lands the same indices get dark-theme overrides.

**Why CSS vars, not Tailwind classes:** chart engines apply colours via the SVG `stroke`/`fill` attribute, not via Tailwind classes. CSS vars compose cleanly with both the theme system and `color-mix()` for soft backgrounds.

**Cap:** charts requesting a 6th series should never happen in real data (Luscii instruments rarely emit more than 3-4 items per measurement). If it ever does, the FE falls back to D-MULTI-SERIES's "stack as separate charts" split rule.

### D-SPARSE — Dots-only for series with 1 or 2 points

Numeric/ordinal series with fewer than 3 points render points-only — no connecting line. The card header still shows the last-value badge. 

- 1 point: a single dot at its timestamp on the x-axis.
- 2 points: two dots, no connecting line (a two-point line reads as a trend that doesn't exist).
- ≥ 3 points: standard line (+ dots at each point for hover targets).

**Why:** a connecting line between 1 or 2 points implies a trajectory the data does not support. Dots-only is honest. The sparkline rule already hides at < 2 points; the in-card chart shares the same threshold-driven behaviour but renders dots when ≥ 1.

### D-FREETEXT-TRUNCATE — Truncate to ~140 chars with `meer tonen` toggle

`<FreeTextLog>` truncates each entry's `text` at 140 characters. If the source text is longer, the truncated render appends an ellipsis and shows a `meer tonen` ↔ `minder tonen` toggle that expands/collapses just that entry. The card body height stays scannable for patients with verbose questionnaire answers.

Truncation respects word boundaries (truncate at the last whitespace before the 140-character mark; fall back to hard truncation only if no whitespace exists in the first 140 chars).

i18n keys: `patient-profile:charts.free_text.show_more` / `patient-profile:charts.free_text.show_less`.

### D-PROTOTYPE — HTML prototypes first, lock the visual

Per the project's design-phase rule and the patient-inbox precedent (12 HTML iterations before locking v12), measurement-charts ships with `prototypes/charts/v1.html` ... `vN.html`. Each iteration is a new `vN.html`; never edit a prior version.

The React build follows the locked prototype version. The HTML uses inline SVG (no chart engine) with synthetic data shaped exactly like the wire `series[]` to keep the prototype consumer-shaped.

The first prototype (v1) is delivered alongside this proposal as a starting point; further iterations land via small commits before the React build begins.

### D-DISCLOSURE — Planned-actions timeline kept, demoted

`<LusciiPanel>`'s programme/protocol header + planned-actions timeline + link/unlink UX remain valuable for "what was planned vs what was measured". This change demotes them visually (collapsed disclosure below the charts) but not in code (same component, same hooks).

**Why not delete:** caregivers still need to see WHICH actions were planned and which were missed. The timeline is the authority on that; charts only show measurements taken. A "Planned actions" disclosure keeps the surface available without dominating the tab.

**Default state:** collapsed. Charts are the primary content.

### D-STATES — Per-panel state machine, errors contained

The `<MeasurementCharts>` panel handles five states, all panel-scoped (errors do not break the rest of the patient profile):

1. **Loading** — skeleton cards with skeleton sparklines.
2. **Not configured** — quiet info state (existing `<LusciiPanel>` not-configured state, lifted into the new panel).
3. **Not linked** — existing link UX from `<LusciiPanel>`, lifted.
4. **Empty-with-link** — patient linked, but no measurements in the window. Renders window selector + an `<EmptyState>` ("Geen metingen in deze periode") with a "Switch to 90 dagen" CTA when `days < 90`.
5. **Loaded** — instrument cards + planned-actions disclosure.

Errors during fetch surface as a toast + retry button inside the panel. The rest of the patient profile (header, CareTeamSlot, kebab) keeps rendering normally.

### D-LOCALE — Inherit `luscii-patient-data` locale rule

Instrument names + item labels stay in the locale resolved by the backend (prefer `nl`, fallback first available). The FE renders the resolved strings as-is. No FE-side translation of measurement labels.

Window-selector chips, empty-state copy, programme-transition fallback, panel chrome → standard `react-i18next` under the `patient-profile.charts.*` namespace.

### D-SURFACES — `app` first, multi-surface contract preserved

v1 ships the `app` surface (orchestrator caregiver patient detail). `smart` + `embed` surfaces register the same `<MeasurementCharts>` component via `defineFeature` with their own ports. The orchestrator port reads `/patients/{id}/luscii-data`; the FHIR-backed equivalent is `[mvp]` and gated behind the HiX FHIR adapter.

The component contract is:

```ts
type MeasurementChartsProps = {
  patientId: string
  // Future surfaces inject their own data port; v1 hardcodes the orchestrator port.
}
```

Per the feature-surface gating memory, we asked the surface question before scaffolding and got `app + smart + embed`. The non-app surfaces ship a 3-line route shim and their own port wiring; the chart component is unchanged.

## Risks / Trade-offs

- **R1** — Archetype misclassification (D-CLASSIFIER allowlist). Mitigation: explicit allowlist, observable mis-render, no MDR risk.
- **R2** — `unknown` archetype tail. Mitigation accepted: readable list fallback.
- **R3** — Recharts bundle (~110 KB gz). Mitigation: tree-shakable; default-tab content justifies the cost.
- **R4** — Multi-series shared axis on disparate scales. Mitigation: not a real case in Luscii's current catalogue.
- **R5** — Window-switch race. Mitigation: TanStack Query key includes `days`.
- **R6** — Historical programme names anonymous. Mitigation accepted; fallback text.
- **R7** — Sparkline noise on 1-point series. Mitigation: hide sparkline.
- **R8** — Display-only invariant regression. Mitigation: reassertion + MDR watchlist gate.
- **R9** — Disclosure-hidden planned actions risk being missed. Mitigation: count badge on the disclosure trigger ("Geplande acties (12)") makes it obvious there's content.
- **R10** — `program_id` per point bloats the wire if measurements are dense. Mitigation: `program_id` is a short string; for a 365d window with daily measurements the overhead is ≈30 KB uncompressed. Acceptable.
- **R11** — shadcn `Chart` primitive may evolve incompatibly upstream. Mitigation: we vendor the generated file like every other shadcn primitive; upstream changes land via deliberate `pnpm dlx shadcn add chart` re-runs.

## Migration Plan

- **Data migration**: none. All new fields are derived in the request path from existing data.
- **API**: additive on `GET /patients/{id}/luscii-data`. Existing FE consumers (`<LusciiPanel>`'s planned-actions timeline) keep reading their fields; new `series[]` is ignored by old code paths. No version bump.
- **Frontend**: `<MeasurementCharts>` replaces the `Metingen` tab body content. `<LusciiPanel>` itself is not deleted — it is wrapped in a disclosure inside `<MeasurementCharts>`. Import paths preserved.
- **i18n**: `patient-profile.charts.*` namespace added. Existing `patient-profile.luscii.*` keys unchanged (the panel they serve is now nested inside the disclosure).
- **Rollback**: revert PR. The `LusciiPanel`-driven Metingen body comes back; backend `series[]` field becomes orphan data the FE ignores. No DB state to undo. The `Chart` shadcn primitive file can stay or be deleted; either is reversible.

## Locked wireframe

Wireframe iterations land under `prototypes/charts/v1.html` ... `vN.html`. v1 is delivered alongside this proposal with the instrument-card + sparkline + chart-on-expand shape (D-LAYOUT) and a 7/30/90/365 selector at the top. The React build follows the locked prototype version once design accepts it.

The first prototype renders synthetic data shaped exactly like the wire `series[]` to make the React port a thin translation.

## Component reuse audit

### Reuse as-is

| Primitive | Used for |
|---|---|
| `components/ui/card.tsx` | InstrumentCard chrome. |
| `components/ui/badge.tsx` | Last-value badge in card header; window selector chips. |
| `components/ui/skeleton.tsx` | Loading state. |
| `components/states/EmptyState.tsx` | Empty-with-link state. |
| `components/entity/EntityErrorCard.tsx` | Panel-scoped error fallback (variant). |
| `modules/patient/components/LusciiPanel.tsx` | Wrapped in disclosure; not modified. |
| `modules/patient/hooks.ts::useLusciiData` | Extended signature (`{ days }`); existing call sites compatible (default 30). |
| `lib/api/client` typed client | Wire types regenerated; consumer wraps the typed call. |
| `lib/i18n` `useTranslation` | New `patient-profile.charts.*` namespace. |
| Date formatting helpers from `lib/utils/datetime` | Point timestamps. |

### Drop on archive

None. The change adds; it does not retire any current component.

### New reusable primitives (broader value)

- `<Chart>` (shadcn/ui) — the chart primitive itself, available for any future chart consumer (pathway analytics, admin dashboards, etc.).
- `<Sparkline>` — module-local in `modules/patient/components/charts/`; promote to `components/ui/` if a second consumer lands (don't promote pre-emptively per AHA).
- `<ChipStreamTimeline>` — module-local; same AHA rule.

### New feature components (scope-bound)

| Component | Location | Notes |
|---|---|---|
| `<MeasurementCharts>` | `modules/patient/components/MeasurementCharts.tsx` | The top-level panel. Owns the window selector, instrument-card list, planned-actions disclosure. |
| `<InstrumentCard>` | `modules/patient/components/charts/InstrumentCard.tsx` | One per instrument. Manages expand/collapse. |
| `<LineChart>` | `modules/patient/components/charts/LineChart.tsx` | Numeric single-series + multi-series via prop. |
| `<BarChart>` | `modules/patient/components/charts/BarChart.tsx` | Ordinal. |
| `<ChipStreamTimeline>` | `modules/patient/components/charts/ChipStreamTimeline.tsx` | Categorical. |
| `<FreeTextLog>` | `modules/patient/components/charts/FreeTextLog.tsx` | Free-text. |
| `<UnknownLog>` | `modules/patient/components/charts/UnknownLog.tsx` | Unknown. |
| `<Sparkline>` | `modules/patient/components/charts/Sparkline.tsx` | Compact preview in card header. |
| Archetype dispatch | `modules/patient/components/charts/registry.ts` | Lookup table mapping archetype → renderer. |

### Build order

1. Backend: classifier + projection + schema additions + tests (`/openapi-sync` afterwards).
2. Frontend primitive: add `shadcn/ui` `Chart` (single PR-style commit; widen AGENTS list).
3. Frontend prototype: HTML v1 (locked-version checkbox in design.md when accepted).
4. Frontend components: chart renderers + `<Sparkline>` + `<InstrumentCard>` + `<MeasurementCharts>` + tests.
5. Wire `<MeasurementCharts>` into the `Metingen` tab body, wrap `<LusciiPanel>` in disclosure.
6. `/verify` both apps; smoke in browser; commit + PR.

### Tests strategy

- Backend classifier: pure-unit tests covering every archetype + edge cases (empty value, whitespace value, locale variants of ordinal units, parse failures, unicode in response_texts).
- Backend projection: tests with multi-measurement fixtures verifying group-by-key, sort-asc, parse-failure drops, programme-id stitching across a transition.
- Backend router: existing scenarios extended to assert new fields; new scenarios for archetype + program_id presence.
- FE chart renderers: snapshot-free RTL tests asserting the chart engine consumes the correct number of data points + the correct legend entries (no visual regression testing — out of scope).
- FE `<MeasurementCharts>` integration: window-selector triggers refetch with new `days`; empty-state + not-linked + not-configured render correctly.
- FE prototype: not tested (HTML only, archival artifact).

## Resolved questions

- **Programme concurrency:** sequential PER Luscii patient, but concurrent across our patient via multiple connections (`patient-luscii-connection`). Per-point `program_id` stays optional provenance; carepath grouping handled by D-CAREPATH-GROUPS.
- **Window URL persistence:** no, panel-local state in v1 (D-WINDOW-NOT-IN-URL).
- **Chart library:** shadcn/ui Chart over Recharts (D-RECHARTS). Closed set widened in this change.
- **Categorical rendering:** chip-stream timeline (matches sparse, free-form questionnaire data; distribution charts collapse the time dimension we explicitly want).
- **Multi-item instruments:** shared axis, single chart (D-MULTI-SERIES). Standard for BP.
- **Where do planned actions go:** disclosure below the charts (D-DISCLOSURE). Same code, demoted visually.
