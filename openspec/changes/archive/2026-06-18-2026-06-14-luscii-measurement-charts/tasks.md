# tasks — luscii-measurement-charts

Tier: [poc]. Worktree: `.worktrees/feat-luscii-measurement-charts`. Branch: `feat/luscii-measurement-charts`. Base: `main`.

Tasks land in this order. Each task ends with `- [ ]` until done.

---

## 0. Pre-flight

- [ ] 0.1 Re-read `openspec/scope.md` — confirm BL-074 promotion to `[poc]` is consistent with `F5 Patient view` (currently mentions Luscii data inside Metingen tab via F13).
- [ ] 0.2 Update `openspec/backlog.md`: mark `BL-074` as "Promoted to `changes/2026-06-14-luscii-measurement-charts/` on 2026-06-14. Retain entry."
- [ ] 0.3 Confirm `luscii-patient-enrichment` is fully archived OR still under `changes/` — if active, this change explicitly depends on it being merged first. (Already merged on 2026-06-13 per PR #45.)
- [ ] 0.4 Confirm no other open change touches `luscii-patient-data` or `patient-profile-ui` spec deltas (grep `openspec/changes/*/specs/luscii-patient-data` and `*/specs/patient-profile-ui`).
- [ ] 0.5 Verify `apps/backend/data/luscii_catalogue/nl.json` is committed (it is — landed in PR #45) and the ORDINAL_UNITS allowlist (D-CLASSIFIER) is consistent with the units the catalogue actually emits.

---

## 1. Backend — archetype classifier (pure)

- [ ] 1.1 New module `apps/backend/app/services/luscii/archetype.py`. Exports:
  - `Archetype = Literal['numeric','ordinal','categorical','free_text','unknown']`
  - `ORDINAL_UNITS: Final[frozenset[str]]` (initial allowlist per D-CLASSIFIER)
  - `classify_archetype(value: str | None, response_ids: list[str], unit: str | None) -> Archetype`
  - `parse_numeric(value: str | None) -> float | None` (strip whitespace, accept comma decimal, locale-tolerant)
- [ ] 1.2 New test `apps/backend/tests/services/luscii/test_archetype.py` with `pytestmark = pytest.mark.no_db`. Scenarios:
  - `response_ids non-empty → 'categorical'` (even with numeric `value`)
  - `value='82', unit='kg' → 'numeric'`
  - `value='3', unit='Punten' → 'ordinal'`
  - `value='3,5', unit='kg' → 'numeric'` (comma decimal)
  - `value='II', unit='NYHA klasse' → 'ordinal'` even though `value` doesn't parse as float — keeps it `ordinal` per allowlist precedence over parse? **Open**: revisit in 1.3.
  - `value='lots of text', unit=None, response_ids=[] → 'free_text'`
  - `value='', unit=None, response_ids=[] → 'unknown'`
  - `value=None, unit=None, response_ids=[] → 'unknown'`
  - `value='  82  ', unit='kg' → 'numeric'` (whitespace tolerance)
  - All ORDINAL_UNITS allowlist entries classify as `ordinal` when `value` parses.
- [ ] 1.3 Decide the NYHA-klasse-style "ordinal label, non-numeric value" case explicitly. Two options: (a) treat as `categorical` (response-set style; needs `response_ids` mock); (b) ordinal allows non-parseable values and the point becomes `OrdinalPoint` with the raw string. **Default: classify as `categorical` if no `response_ids` and value is non-numeric — meaning the catalogue must have shipped `response_ids` for true ordinal items.** Document the decision inline in `archetype.py`.
- [ ] 1.4 `moon run backend:lint` + `moon run backend:typecheck` + `moon run backend:test-host -- tests/services/luscii/test_archetype.py` all clean.

---

## 2. Backend — schema additions

- [ ] 2.1 Extend `apps/backend/app/schemas/luscii/patient_data.py`:
  - `LusciiMeasurementValueView` gains `item_id: str | None = None`, `instrument_id: str | None = None`, `archetype: Archetype` (default `'unknown'`).
  - `LusciiMeasurementView` gains `instrument_id: str | None = None`.
  - New `LusciiMeasurementPoint` discriminated union (per D-WIRE):
    - `LusciiNumericPoint`, `LusciiOrdinalPoint`, `LusciiCategoricalPoint`, `LusciiFreeTextPoint`, `LusciiUnknownPoint`.
    - Each has `observed_at: datetime`, `archetype: Literal[<value>]` (single-literal so Pydantic discriminator works), `program_id: str | None = None`, and its archetype-specific payload field.
    - Pydantic v2 discriminated union via `Annotated[Union[...], Field(discriminator='archetype')]`.
  - New `LusciiMeasurementSeries`:
    - `series_id: str` (12-char hex)
    - `instrument_id: str`, `instrument_name: str | None`
    - `item_id: str`, `label: str | None`
    - `archetype: Archetype`
    - `unit: str | None` (present only when `archetype ∈ {'numeric','ordinal'}`)
    - `points: list[LusciiMeasurementPoint]` (non-empty by construction; sorted ASC by `observed_at`)
  - `LusciiPatientData` gains `series: list[LusciiMeasurementSeries] = Field(default_factory=list)`.
- [ ] 2.2 Re-run `moon run backend:typecheck` — verify Pydantic v2 discriminator types narrow correctly.
- [ ] 2.3 Update / extend `apps/backend/tests/schemas/luscii/test_patient_data.py` (or add it if missing): instantiate each new model + round-trip JSON encode/decode + assert discriminator selects the right variant.

---

## 3. Backend — series projection

- [ ] 3.1 New module `apps/backend/app/services/luscii/series.py`. Exports:
  - `project_series(measurements: list[LusciiMeasurement], values_by_measurement: dict[str, list[LusciiMeasurementValueView]], programme_at: Callable[[datetime], str | None] | None) -> list[LusciiMeasurementSeries]`
  - `compute_series_id(instrument_id: str, item_id: str) -> str` — `sha256(...)[:12]`
- [ ] 3.2 Projection runs in a single pass over the windowed measurement set (D-PROJECTION). For each measurement:
  - Determine `observed_at = processed_at or created_at`.
  - For each value:
    - Skip if `instrument_id` or `item_id` is None.
    - Classify archetype.
    - Build the archetype-specific point; numeric/ordinal that fail to parse drop the point (logged at WARN with `series_id` + raw value).
    - Append to `series_map[(instrument_id, item_id)]`.
- [ ] 3.3 Build series from the populated map:
  - Sort each series' points by `observed_at` ASC.
  - Series archetype = most recent point's archetype (D-ARCHETYPE-PER-SERIES).
  - Series `unit` = unit from the most recent point's source value (numeric/ordinal only).
  - Series `label` = label from the most recent point's source value (label resolution is done upstream during catalogue decoding).
  - Series `instrument_name` = first non-null instrument name observed in the contributing measurements (catalogue-resolved upstream).
  - Sort series by most-recent point timestamp DESC.
  - Drop series with zero points (defensive — shouldn't happen since we skip drops above series-build).
- [ ] 3.4 Wire the call into `apps/backend/app/services/luscii/patient_data.py` (the existing `LusciiPatientDataService`-equivalent module): after building `planned_actions` + `unmatched_measurements`, project series from the same source rows and include in the response.
- [ ] 3.5 `programme_at` parameter v1: pass `lambda ts: program.id if program else None` — every point in the window gets the CURRENT programme ID. Mid-window programme transitions are not surfaced in v1 (a follow-up resolving historical programmes via an extra Luscii call would extend this).
- [ ] 3.6 New test `apps/backend/tests/services/luscii/test_series.py` covering:
  - Empty input → empty series list.
  - Single measurement with two items (sys + dia) → two series, each with one point.
  - Two measurements at different timestamps with same `(instrument_id, item_id)` → one series with two points sorted ASC.
  - Parse-failure on a numeric value drops the point, not the series.
  - Series ordering: series with the more-recent point sorts first.
  - `series_id` is stable for the same `(instrument_id, item_id)` across runs.
  - Categorical value (`response_texts` populated) produces a `LusciiCategoricalPoint` with `responses` list.
- [ ] 3.7 `moon run backend:typecheck` + `moon run backend:test-host -- tests/services/luscii/`.

---

## 4. Backend — router integration

- [ ] 4.1 Verify the existing `GET /patients/{id}/luscii-data` route handler returns `LusciiPatientData` — no router changes needed beyond the model expansion.
- [ ] 4.2 Extend `apps/backend/tests/api/routers/patient/test_luscii_data_router.py` (or wherever the existing tests live — locate first):
  - Existing "linked patient" scenario: assert `response.json()["series"]` is a non-empty list AND each series has `series_id`, `archetype`, `points[]`.
  - New scenario: linked patient with two measurements of the same instrument-item produces one series with two points sorted ASC.
  - New scenario: linked patient with a multi-item instrument (sys+dia fixture) produces two series under the same `instrument_id`.
  - New scenario: archetype classification visible on wire (numeric, ordinal, categorical) using fixture values that trigger each rule.
  - Not-linked scenario: `series` field present, empty list.
  - Not-configured scenario: `series` field absent OR empty per the existing not-configured response shape (decide based on the existing test).
- [ ] 4.3 Regenerate OpenAPI: `moon run backend:openapi`.
- [ ] 4.4 `moon run backend:lint` + `moon run backend:typecheck` + `moon run backend:test-host -- tests/api/routers/patient/test_luscii_data_router.py tests/services/luscii/`.

---

## 5. Frontend — shadcn Chart primitive

- [ ] 5.1 From `apps/orchestrator`, run `pnpm dlx shadcn@latest add chart`. Confirm:
  - New file `apps/orchestrator/src/components/ui/chart.tsx`.
  - New dep `recharts` in `package.json`.
  - No other shadcn primitives changed (run `git diff src/components/ui/` to confirm).
- [ ] 5.2 Update `apps/orchestrator/AGENTS.md` `## Folder rules` table: add `Chart` to the closed primitive set list.
- [ ] 5.3 `moon run orchestrator:install` to refresh lockfile.
- [ ] 5.4 `moon run orchestrator:lint` + `moon run orchestrator:typecheck`.

---

## 6. Frontend — regenerate typed client

- [ ] 6.1 Run `/openapi-sync` (or `moon run orchestrator:typegen` if the slash command is unavailable in this context). Confirm:
  - `apps/orchestrator/src/lib/api/schema.d.ts` shows new `series[]`, `LusciiMeasurementSeries`, `LusciiMeasurementPoint` variants, archetype enum.
  - Discriminated union renders as TS union with `archetype` literal.
- [ ] 6.2 `moon run orchestrator:typecheck` clean.

---

## 7. Frontend — HTML prototype iteration

- [ ] 7.1 `prototypes/charts/v1.html` — initial draft. Synthetic data shaped exactly like wire `series[]`. Includes:
  - Window selector chip strip (7 / 30 / 90 / 365 — 30 active).
  - 3 instrument cards: BP (multi-line), Weight (single-line), Klachten (chip stream).
  - Sparkline previews on numeric cards; click-to-expand reveals full chart.
  - Planned-actions disclosure collapsed at bottom.
- [ ] 7.2 `prototypes/charts/README.md` — version log seed.
- [ ] 7.3 Iterate per design feedback: each accepted change = new `vN.html`. Lock the version in `design.md` once accepted.

---

## 8. Frontend — chart renderers (archetype-keyed)

- [ ] 8.1 `modules/patient/components/charts/Sparkline.tsx` — compact non-interactive line for numeric/ordinal series ≥ 2 points. Props: `{ points: NumericPoint[] | OrdinalPoint[], width, height }`. Hidden when `< 2` points (caller decides).
- [ ] 8.2 `modules/patient/components/charts/LineChart.tsx` — single-line or multi-line numeric chart. Props: `{ series: NumericSeries | NumericSeries[] }`. Uses shadcn `Chart` over Recharts `LineChart` + `ResponsiveContainer`.
- [ ] 8.3 `modules/patient/components/charts/BarChart.tsx` — ordinal bar chart with discrete y-ticks derived from observed point range. Props: `{ series: OrdinalSeries }`.
- [ ] 8.4 `modules/patient/components/charts/ChipStreamTimeline.tsx` — categorical horizontal timeline. Props: `{ series: CategoricalSeries }`. Each chip = date + responses.
- [ ] 8.5 `modules/patient/components/charts/FreeTextLog.tsx` — dated text list.
- [ ] 8.6 `modules/patient/components/charts/UnknownLog.tsx` — dated raw-value list with muted "Onbekend formaat" annotation.
- [ ] 8.7 `modules/patient/components/charts/registry.ts` — `CHART_REGISTRY: Record<Archetype, ChartRenderer>` lookup table. Exposes `renderChartForSeries(series)` that dispatches via `series.archetype`.
- [ ] 8.8 Unit tests under `modules/patient/components/charts/__tests__/` per renderer:
  - Renders the right number of points / chips.
  - Empty `points` array renders the empty-state copy (not the chart).
  - Multi-line LineChart with 2 items renders 2 legend entries.
  - Tooltip / accessibility: tooltip role is `tooltip`, axis labels readable.
- [ ] 8.9 `moon run orchestrator:lint` + `moon run orchestrator:typecheck` + `moon run orchestrator:test -- src/modules/patient/components/charts/`.

---

## 9. Frontend — `<InstrumentCard>`

- [ ] 9.1 `modules/patient/components/charts/InstrumentCard.tsx`. Props: `{ instrument_id, instrument_name, series: Series[] }`. State: `expanded: boolean` (default false).
- [ ] 9.2 Card header: instrument name (or "Onbekend instrument" fallback), last-value badge (most recent point across the card's series), sparkline (when applicable). Click on header toggles expand.
- [ ] 9.3 Card body (when expanded):
  - If all card series share archetype `numeric` → single multi-line chart.
  - Else → one renderer per series via `renderChartForSeries`.
  - Below the chart(s): a small tabular list of recent points (collapsible if > 10).
- [ ] 9.4 Tests: header renders with last-value badge; expanding shows the chart(s); single-point series hides the sparkline; multi-item numeric instrument renders one chart with two series.

---

## 10. Frontend — `<MeasurementCharts>` panel

- [ ] 10.1 `modules/patient/components/MeasurementCharts.tsx`. Props: `{ patientId: string }`.
- [ ] 10.2 State: `days: 7 | 30 | 90 | 365` (default `30`). React local state — no URL persistence (D-WINDOW-NOT-IN-URL).
- [ ] 10.3 Data: `useLusciiData(patientId, { days })`.
- [ ] 10.4 Top strip: programme name (`program.name || 'Geen programma'`), window selector (4 chips), "Planned actions (N)" disclosure trigger (count comes from `planned_actions.length + unmatched_measurements.length`).
- [ ] 10.5 Body: cards via `Object.groupBy(series, s => s.instrument_id)` (per AGENTS array idioms). Sort group keys by most-recent point DESC. Render one `<InstrumentCard>` per group.
- [ ] 10.6 Disclosure (collapsed by default): wrap the existing `<LusciiPanel>` body — programme/protocol header + planned-actions timeline + link/unlink UX — inside a shadcn-compatible disclosure (Card with toggleable body via `useState`).
- [ ] 10.7 States:
  - Loading → skeleton cards.
  - Error → toast + retry button, panel-scoped.
  - Not-configured → reuse `<LusciiPanel>`'s not-configured state, lifted into the panel.
  - Not-linked → reuse `<LusciiPanel>`'s link UX, lifted.
  - Empty-with-link → window selector visible + `<EmptyState>` "Geen metingen in deze periode" + CTA to widen window (when `days < 90`).
  - Loaded → cards + disclosure.
- [ ] 10.8 Tests:
  - Renders the right number of instrument cards.
  - Window selector click triggers refetch (mock `useLusciiData` and assert it was called with the new `days`).
  - Empty-window state shows the correct empty-state copy + CTA.
  - Not-linked state shows the link form.
  - Not-configured state shows the quiet info text.

---

## 11. Frontend — hook signature + i18n

- [ ] 11.1 Extend `modules/patient/hooks.ts::useLusciiData` to accept `{ days }`. Default `days=30`. TanStack Query key gains `days`. All existing call sites pass through (default applied).
- [ ] 11.2 Update `modules/patient/components/__tests__/PatientProfilePage.test.tsx`'s `useLusciiData` mock to match the new signature (the test currently passes `undefined`-shaped stub).
- [ ] 11.3 `lib/i18n/locales/nl/patient-profile.json`: add `charts.*` namespace:
  - `charts.window.7d / .30d / .90d / .365d`
  - `charts.window.label`
  - `charts.empty.title / .body`
  - `charts.empty.widen_cta`
  - `charts.planned_actions.toggle` (with `{{count}}`)
  - `charts.unknown_instrument`
  - `charts.unknown_format`
  - `charts.last_value` (badge prefix or sr-only label)
  - `charts.error.title / .body / .retry`
  - `charts.programme.transition_label` (`Programmawissel` fallback)
- [ ] 11.4 `moon run orchestrator:lint` + `moon run orchestrator:typecheck`.

---

## 12. Frontend — wire `<MeasurementCharts>` into `<PatientProfilePage>`

- [ ] 12.1 Edit `modules/patient/components/PatientProfilePage.tsx`: replace the Metingen tab `content` from `<LusciiPanel patientId={...} />` to `<MeasurementCharts patientId={...} />`.
- [ ] 12.2 `<LusciiPanel>` itself is no longer the Metingen body — it lives inside `<MeasurementCharts>`'s disclosure. Confirm the import is removed from `PatientProfilePage.tsx` (now imported by `<MeasurementCharts>`).
- [ ] 12.3 Update the `PatientProfilePage.test.tsx` mock if needed — luscii hook signature changed in 11.1; assertions on tab content might still find the right copy via i18n keys.
- [ ] 12.4 `moon run orchestrator:test` full suite.

---

## 13. Verify

- [ ] 13.1 `/verify` for backend: `moon run backend:lint` + `:typecheck` + `:test-host -- tests/services/luscii/ tests/api/routers/patient/`.
- [ ] 13.2 `/verify` for orchestrator: `moon run orchestrator:lint` + `:typecheck` + `:test`.
- [ ] 13.3 Smoke in browser:
  - `moon run :up` (or rely on existing stack).
  - Seed: pick a patient + link to a Luscii UUID with measurements in the last 30 days.
  - Navigate to `/_auth/patients/<id>`. Confirm Metingen tab renders charts.
  - Click window selector chips: 7d → 30d → 90d → 365d. Confirm refetch + chart updates.
  - Click an InstrumentCard header — expand reveals chart + point table.
  - Open the "Planned actions" disclosure — original `<LusciiPanel>` content renders.
  - Test not-linked patient: charts hidden, link form visible.
- [ ] 13.4 Verify accessibility: chart tooltips reachable via keyboard, axis labels readable, instrument card header is a `<button>` with `aria-expanded`.
- [ ] 13.5 Verify the prototype version locked in `design.md` matches the React layout (sanity check, not pixel-perfect).

---

## 14. Documentation + close-out

- [ ] 14.1 Update `apps/orchestrator/AGENTS.md` `## Folder rules` table — `Chart` already added in 5.2. Double-check.
- [ ] 14.2 Update this change's `tasks.md` checkboxes from `[ ]` to `[x]` as work lands. Commit task-state changes alongside the relevant implementation commits.
- [ ] 14.3 Open PR. Title: `feat(luscii): instrument-grouped measurement charts on patient detail`. Body summarises the scope + lists the spec deltas.
- [ ] 14.4 After merge, archive: move folder to `openspec/changes/archive/2026-06-14-luscii-measurement-charts/` and update the relevant specs under `openspec/specs/luscii-patient-data/` + `openspec/specs/patient-profile-ui/`.
- [ ] 14.5 Mark `BL-074` entry: "Archived 2026-MM-DD via `2026-06-14-luscii-measurement-charts`."
