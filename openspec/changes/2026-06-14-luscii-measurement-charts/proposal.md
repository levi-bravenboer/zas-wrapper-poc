**Tier**: [poc]
**Promotes**: BL-074 (`Metingen` tab backend wiring — was [mvp], now [poc] since `luscii-patient-enrichment` landed the data layer on 2026-06-13).

## Why

`luscii-patient-enrichment` (PR #45, merged 2026-06-13) shipped the data layer for live Luscii patient data: a linked patient's programme + protocol + planned actions + measurements are fetched via the public Luscii API, decoded against locally-synced localisation catalogues, and rendered today as a flat planned-actions timeline inside the patient profile's `Metingen` tab. The current `<LusciiPanel>` is *readable* but not *legible*: it lists measurements chronologically by planned action, mixing instruments and items into one stream. A caregiver scanning a patient's recent weight trend has to mentally re-thread weight items out of a list interleaved with blood-pressure items, questionnaire answers, and missed actions.

The clinically-useful framing is the opposite: group measurements **by the thing being measured** ("weight over the last month", "blood pressure", "yesterday's questionnaire"), render each as the chart shape that matches the data, and let the caregiver compare instruments at a glance.

This change ships:

- A typed **archetype** for each measurement item (`numeric` / `ordinal` / `categorical` / `free_text` / `unknown`), classified server-side from the existing `value` + `unit` + `response_ids` fields. The archetype controls chart selection; it is structural metadata only — no thresholds, no rankings, no derived clinical signal (display-only invariant of `luscii-patient-data` preserved + reasserted).
- A new **`series[]` block** on the existing `GET /patients/{id}/luscii-data` payload (additive — `planned_actions[]` and `unmatched_measurements[]` stay untouched). Each series is a time-projected stream of one instrument-item: `{ series_id, instrument_id, instrument_name, item_id, label, archetype, unit?, points[] }`. Points are archetype-discriminated (`numeric` / `ordinal` carry a parsed `number` + `unit`; `categorical` carries `responses[]`; `free_text` carries `text`; `unknown` carries `raw`).
- An optional `program_id` per point — patient programmes are sequential (one active programme at a time per Luscii's model), but the 30/90/365-day window may span a programme transition; the FE uses `program_id` to render a transition band on the x-axis.
- A `<MeasurementCharts>` panel that **replaces** the current `<LusciiPanel>` body in the Metingen tab: one card per instrument, sparkline preview in the card header, click-to-expand to a full chart. Multi-item instruments (e.g. blood-pressure → systolic + diastolic) render as a single chart with multi-series legend. A 7d / 30d / 90d / 365d window selector lives at the top of the panel.
- The current `<LusciiPanel>` (programme/protocol header + planned-actions timeline + link/unlink UX) is **not deleted**: it relocates into a "Planned actions" disclosure below the charts. Same hooks, same components, same i18n — only the visual primacy changes.
- The `shadcn/ui` `chart` primitive is added to the closed primitive set (`apps/orchestrator/src/components/ui/chart.tsx`) — this requires the OpenSpec amendment folded into this change. Underlying engine: `recharts` (dep added). No other chart libraries enter the codebase.

The change targets all three orchestrator surfaces (`app`, `smart`, `embed`) per feature-surface gating. v1 implementation lands on `app` first; the `smart` + `embed` adapters mount the same `<MeasurementCharts>` component reading the orchestrator's `/patients/{id}/luscii-data` (FHIR-backed equivalent is `[mvp]`).

## What Changes

### Modified backend capability — `luscii-patient-data`

- `LusciiMeasurementValueView` adds two stable IDs and an archetype tag:
  - `item_id: str | None` — Luscii item id from `LusciiMeasurementDetailItem.item_id`, passed through. Stable across measurements; required for time-series projection.
  - `instrument_id: str | None` — Luscii instrument id of the parent measurement, projected onto every value of that measurement.
  - `archetype: Literal['numeric','ordinal','categorical','free_text','unknown']` — set by a pure server-side classifier (see D-CLASSIFIER in design.md). Never null; falls back to `unknown` when the value is unparseable AND no `response_texts` are present.
- `LusciiMeasurementView` adds `instrument_id: str | None` (parent of the values, sourced from `LusciiMeasurement.instrument_id`).
- `LusciiPatientData` adds a new `series: list[LusciiMeasurementSeries]` field (always present; empty list when state == `not_linked` or when no measurements landed in the window).
- New `LusciiMeasurementSeries` shape:
  - `series_id: str` — stable 12-character hex hash of `f"{instrument_id}|{item_id}"`. Used by the FE for deep-link `?focus=<series_id>` and React keys. Independent of `window_days` so links survive window changes.
  - `instrument_id`, `instrument_name`, `item_id`, `label`
  - `archetype: Literal[...]` (same enum)
  - `unit: str | None` — present only when `archetype ∈ {'numeric','ordinal'}`
  - `points: list[LusciiMeasurementPoint]` — sorted ascending by `observed_at`, oldest first; never empty (series with zero points are not emitted).
- New `LusciiMeasurementPoint` — discriminated union by archetype:
  - `LusciiNumericPoint { observed_at, archetype: 'numeric',     value: float, program_id?: str }`
  - `LusciiOrdinalPoint { observed_at, archetype: 'ordinal',     value: float, program_id?: str }`
  - `LusciiCategoricalPoint { observed_at, archetype: 'categorical', responses: list[str], program_id?: str }`
  - `LusciiFreeTextPoint { observed_at, archetype: 'free_text', text: str, program_id?: str }`
  - `LusciiUnknownPoint { observed_at, archetype: 'unknown', raw: str | None, program_id?: str }`
  - `observed_at` = `LusciiMeasurement.processed_at` if present, else `created_at`. Parse-failure handling: numeric/ordinal values that fail `float()` parsing are silently dropped from the series (logged at WARN with `series_id` + raw value); the series itself survives.
- Series projection runs in the aggregation service alongside the existing planned-actions join: same single pass over the windowed measurement set, no extra Luscii API calls.
- The archetype classifier (`app/services/luscii/archetype.py`) is a pure function over `(value, response_ids, unit)` — no I/O. Ordinal unit allowlist (`Punten`, `Punkte`, `Points`, `Score`, `NYHA klasse`, `Sterren`, `Klachten`) seeded from the catalogue scan documented in design.md.
- The display-only invariant of `luscii-patient-data` is **preserved and explicitly reasserted**: archetype is structural metadata derived from data shape, not value interpretation. No thresholds, no ranges, no flags. Any future change adding such a field must first add an entry to `openspec/mdr-watchlist.md`.

### Modified frontend capability — `patient-profile-ui`

- The `Metingen` tab body — currently rendering `<LusciiPanel>` — is replaced by `<MeasurementCharts>`, a new module-internal component under `apps/orchestrator/src/modules/patient/components/`. The panel composes:
  - A header strip with the current programme name (`program.name` fallback `Geen programma`), a 7d / 30d / 90d / 365d window selector, and a "Planned actions" disclosure toggle (closed by default).
  - One `<InstrumentCard>` per unique `instrument_id` in `series[]`, sorted by most-recent point descending so the patient's freshest activity tops the panel.
  - Below the cards (collapsed by default), the existing `<LusciiPanel>` programme/protocol header + planned-actions timeline + link/unlink UX. Same component, same hooks; the disclosure is a thin wrapper.
- `<InstrumentCard>` anatomy: card header = instrument name + sparkline (for numeric/ordinal archetypes with ≥2 points) + last-value badge; expanded body = full chart + tabular data list. Multi-item instruments render as one chart with a series-per-item legend.
- Chart dispatch is a pure `switch (archetype)` over the series:
  - `numeric` → `<LineChart>` (or `<MultiLineChart>` when an instrument has multiple numeric items)
  - `ordinal` → `<BarChart>` with discrete y-ticks (score range derived from observed values, never hardcoded)
  - `categorical` → `<ChipStreamTimeline>` — horizontal stream of dated chips rendering `responses[]` as text; no aggregation
  - `free_text` → simple dated list rendering `text`
  - `unknown` → dated list rendering `raw` with a muted "Onbekend formaat" annotation
- Window-selector change re-fetches `/patients/{id}/luscii-data?days=<n>` (existing TanStack Query key extended with `days`). The selector is stateful at the panel level; not persisted to the URL in v1 (see D-WINDOW-NOT-IN-URL).
- Programme-transition rendering: if any point in a series carries a `program_id` that differs from the most recent point's `program_id`, the FE renders a vertical band at the transition timestamp with the new programme name (when known) or `Programmawissel` fallback.
- States per panel: loading (skeleton sparklines + skeleton cards), error (toast + retry button, panel-scoped — doesn't break the rest of the page), not-linked (link UX from the existing `<LusciiPanel>`), not-configured (existing quiet info state), empty-with-link (no measurements in window; shows the window selector + a "Geen metingen in deze periode" empty-state).
- i18n: new keys under `patient-profile.charts.*`. Instrument names + item labels stay in `nl` per the existing `luscii-patient-data` locale rule (preferred `nl`, fallback to first available).

### Added orchestrator primitive — `shadcn/ui` chart

- Add `chart` to the closed `components/ui/*` primitive set. File: `apps/orchestrator/src/components/ui/chart.tsx`, generated via `pnpm dlx shadcn@latest add chart`. Adds `recharts` runtime dep.
- Update `apps/orchestrator/AGENTS.md` to include `Chart` in the canonical primitive list. The list previously read:

  > Alert, Avatar, Badge, Breadcrumb, Button, Card, Checkbox, Command, Dialog, DropdownMenu, Form, Icon, Input, Label, Select, Separator, Sheet, Sidebar, Skeleton, Switch, Table, Tabs, Textarea, Toaster, Tooltip

  becomes:

  > Alert, Avatar, Badge, Breadcrumb, Button, Card, **Chart**, Checkbox, Command, Dialog, DropdownMenu, Form, Icon, Input, Label, Select, Separator, Sheet, Sidebar, Skeleton, Switch, Table, Tabs, Textarea, Toaster, Tooltip

- No other charting libraries enter the codebase. `recharts` is the only chart-engine dep; `visx`, `chart.js`, `echarts`, `tremor`, `nivo`, `victory` remain absent.

### Multi-surface

- `<MeasurementCharts>` is surface-agnostic: takes `{ patientId, dataPort }` props. v1 ships the `app` surface (orchestrator port — reads `/patients/{id}/luscii-data`).
- The `smart` + `embed` surfaces register the same component via `defineFeature` with their own ports (FHIR-backed equivalents return at `[mvp]` once the HiX FHIR adapter ships — flagged as out-of-scope for this change in the Impact section). The `app` adapter is sufficient for the PoC demo.
- Sidebar wiring is unchanged: the Metingen tab lives inside an existing route (no new sidebar entry); surface gating happens at the route/feature registry level, not via a new top-level page.

### Architecture seams

- The chart layer composes directly over the typed `series[]` wire. No client-side projection across measurements is needed; FE iterates `series[]` and renders.
- The instrument-card component owns no chart engine specifics; archetype dispatch is data-driven via a small `CHART_REGISTRY` lookup table.
- Regenerate OpenAPI + typed client (`/openapi-sync`).

## Capabilities

### Modified Capabilities

- `luscii-patient-data` — additive wire fields: `LusciiMeasurementView.instrument_id`, `LusciiMeasurementValueView.{item_id,instrument_id,archetype}`, `LusciiPatientData.series[]`, new `LusciiMeasurementSeries` + `LusciiMeasurementPoint` (discriminated). Server-side archetype classifier added. Display-only invariant reasserted.
- `patient-profile-ui` — `Metingen` tab content replaced: `<LusciiPanel>` body relocated into a collapsed disclosure below the new `<MeasurementCharts>` panel. New i18n keys `patient-profile.charts.*`. shadcn primitive set widened by one (`Chart`).

## Impact

- **Prerequisites**: `luscii-patient-enrichment` archived (PR #45 merged 2026-06-13), `patient-inbox` archived (PR #46 merged 2026-06-13).
- **DB**: NO new tables, NO new enums, NO new migration. All new fields are derived from existing data in the request path.
- **Backend code** (`apps/backend/app/`):
  - `services/luscii/archetype.py` — new module: `classify_archetype(value, response_ids, unit) -> Archetype`, `parse_numeric(value) -> float | None`, `ORDINAL_UNITS` constant.
  - `services/luscii/patient_data.py` — extended: project `series[]` from the same windowed measurement set used today.
  - `services/luscii/series.py` — new module: `project_series(measurements, programme_log) -> list[LusciiMeasurementSeries]`. Pure, testable.
  - `schemas/luscii/patient_data.py` — extended: new fields + new `LusciiMeasurementSeries` + discriminated `LusciiMeasurementPoint`.
  - `tests/services/luscii/test_archetype.py` — classifier coverage (numeric / ordinal / categorical / free_text / unknown / parse-failure).
  - `tests/services/luscii/test_series.py` — projection coverage (grouping by instrument-item, sorting, multi-programme stitching, parse-failure drops point not series).
  - `tests/api/routers/patient/test_luscii_data_router.py` — extended: assert wire-shape additions on existing scenarios, add scenarios for archetype + program_id-in-point.
- **Frontend code** (`apps/orchestrator/src/`):
  - `components/ui/chart.tsx` — new shadcn primitive (generated).
  - `modules/patient/components/MeasurementCharts.tsx` — new top-level panel.
  - `modules/patient/components/charts/InstrumentCard.tsx` — new per-instrument card.
  - `modules/patient/components/charts/{LineChart,BarChart,ChipStreamTimeline,FreeTextLog,UnknownLog}.tsx` — five archetype renderers.
  - `modules/patient/components/charts/Sparkline.tsx` — compact preview used in card headers.
  - `modules/patient/components/charts/registry.ts` — archetype → renderer dispatch.
  - `modules/patient/components/charts/__tests__/*.tsx` — unit + integration tests.
  - `modules/patient/components/PatientProfilePage.tsx` — Metingen tab content swap (one-line component substitution).
  - `modules/patient/components/LusciiPanel.tsx` — unchanged code; wrapped in a `<Disclosure>` from inside `<MeasurementCharts>`.
  - `modules/patient/hooks.ts` — extend `useLusciiData(patientId)` signature to `useLusciiData(patientId, { days })`; default `days=30`.
  - `lib/i18n/locales/nl/patient-profile.json` — new `charts.*` keys.
  - `lib/api/schema.d.ts` — regenerated from OpenAPI (typegen).
- **HTML prototypes**: `openspec/changes/2026-06-14-luscii-measurement-charts/prototypes/charts/v1.html` ... `vN.html` per the project's HTML-first design rule. Each iteration is a new `vN.html`; never edit prior versions.
- **OpenAPI / typed client**: regenerated.

## Risks and mitigations

- **R1 — Archetype mis-classification (ordinal-looking numeric items or vice versa).** The catalogue contains units like `Punten` (score) and `Sterren` (1-5 rating) that look numeric but should chart as bars. **Mitigation**: explicit `ORDINAL_UNITS` allowlist seeded from the 21k-item catalogue scan, expanded conservatively. Mis-classified items still render — the chart is just suboptimal. Misclassification is observable to the operator (wrong chart type) and fixable by editing the allowlist. No MDR risk since archetype influences only the chart kind, not any displayed value.
- **R2 — Long-tail `unknown` archetypes.** Catalogue items with no unit and no `response_ids` (free-text questionnaire answers, multimedia, file uploads) classify as `free_text` or `unknown`. **Mitigation accepted**: those items render as dated lists — readable, not pretty. No silent data loss.
- **R3 — Chart engine bundle weight.** `recharts` adds ≈110 KB gzipped. **Mitigation**: shadcn-chart is tree-shakable; only used chart variants ship. Lazy-load `<MeasurementCharts>` is **not** done in v1 (the Metingen tab is the default tab on patient detail; the chart layer is the load-bearing content).
- **R4 — Multi-series scaling (BP sys + dia).** Two-item instruments share a y-axis even when their scales differ (sys 80–200 mmHg, dia 50–120 mmHg). **Mitigation**: shared axis is the medically conventional rendering for BP, and the observed range stays compact. Document the decision (D-MULTI-SERIES); revisit if a 3+ item instrument with disparate scales lands.
- **R5 — Window-selector race.** Switching from 365d to 7d while a 365d request is still in flight could render stale data. **Mitigation**: TanStack Query key includes `days`, so the stale request resolves into its own cache slot and is ignored by the UI.
- **R6 — Programme-transition rendering when historical programme metadata is unknown.** Backend only returns the current programme name. **Mitigation accepted**: transitions render with `Programmawissel` fallback text and the new programme name when the point's `program_id` matches the current programme; older transitions stay anonymous. A future change can resolve historical programme names via a cache table.
- **R7 — Sparkline noise on instruments with one data point.** A single-point sparkline is meaningless. **Mitigation**: cards with < 2 points hide the sparkline and render only the last-value badge in the header.
- **R8 — Display-only invariant regression risk.** Adding `archetype` is a typed classification; reviewers might be tempted to follow up with `severity` / `out_of_range` / `trend` flags. **Mitigation**: proposal + spec text reasserts the invariant; MDR watchlist entry stays the operative gate; this change adds no thresholds and the code review checklist (`patient-profile-ui` spec) flags any value-derived field as MDR-adjacent.

## Out of scope

- HiX FHIR-backed equivalents of `<MeasurementCharts>` for the `smart` + `embed` surfaces (`[mvp]`, depends on HiX FHIR adapter).
- Server-side caching of Luscii responses; today's request-path is still a live proxy per `luscii-patient-data`.
- Historical programme-name resolution (transition bands fall back to anonymous when the programme is not the current one).
- Cross-patient comparison views ("compare patient A's weight trend vs cohort"). Outside `patient-profile-ui` scope.
- Export to PDF / CSV from the charts panel.
- Per-item drill-down route (e.g. `/_auth/patients/$id/series/$series_id`). The `series_id` deep-link parameter is on the wire but consumed only by intra-page focus state in v1.
- Configurable axis (log scale, custom y-min/y-max overrides). Display-only invariant blocks user-configurable scale overrides at PoC.
- Real-time push of new measurement points into a live chart. Re-fetch on focus is sufficient for the demo.
- Patient-facing rendering of charts on the mobile app (`F9`/`F10`). Out of orchestrator scope.
- Annotations / clinician notes on individual points.
- Multi-tenant / cohort dashboards.
- Bulk export of the underlying `series[]` data.
- Lazy / virtualised rendering of >50 instruments on one patient. The PoC patient set has fewer than 20 instruments per patient; revisit if reality says otherwise.
