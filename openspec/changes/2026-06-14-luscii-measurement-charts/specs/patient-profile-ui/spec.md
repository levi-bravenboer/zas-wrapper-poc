# Capability delta: `patient-profile-ui`

## MODIFIED Requirements

### Requirement: `Metingen` tab body renders `<MeasurementCharts>` instead of `<LusciiPanel>`

The `Metingen` tab content under `<PatientProfilePage>` SHALL render `<MeasurementCharts patientId={patient.id} />` at `apps/orchestrator/src/modules/patient/components/MeasurementCharts.tsx`. The prior body (`<LusciiPanel patientId={...} />` as the tab's direct content) is REPLACED.

`<MeasurementCharts>` is the new primary measurement-visualisation panel. The existing `<LusciiPanel>` component is NOT deleted — its programme/protocol header + planned-actions timeline + link/unlink UX relocate into a collapsed disclosure rendered BELOW the chart cards (see the "Planned-actions disclosure" requirement). The import path of `<LusciiPanel>` (`apps/orchestrator/src/modules/patient/components/LusciiPanel.tsx`) and its prop signature (`{ patientId: string }`) SHALL be unchanged.

The other clinical tab (`Labresultaten`) SHALL remain unchanged from the patient-inbox revision (`<EmptyState>` rendering "Wordt geleverd door de HiX-koppeling.").

#### Scenario: Metingen tab renders the charts panel

- **WHEN** a caregiver loads `/_auth/patients/<id>` and the default-active `Metingen` tab renders
- **THEN** the tab body MUST be `<MeasurementCharts>` and MUST NOT render `<LusciiPanel>` as the immediate tab body

#### Scenario: Labresultaten tab is unaffected

- **WHEN** the caregiver activates the `Labresultaten` tab
- **THEN** the body MUST render the existing `<EmptyState>` with the HiX-koppeling copy

---

### Requirement: `<MeasurementCharts>` panel composition

`<MeasurementCharts>` SHALL render, top to bottom:

1. A top strip containing:
   - The current programme name (`program.name` resolved by the backend; fallback string `Geen programma` when `program` is null).
   - A window-selector chip strip with exactly four chips: `7 dagen`, `30 dagen`, `90 dagen`, `365 dagen`. The active chip is visually distinguished. Default selection is `30 dagen`.
   - A "Planned actions (`N`)" disclosure trigger button where `N = planned_actions.length + unmatched_measurements.length` (deferred to the disclosure body — not the chart list).
2. A list of `<InstrumentCard>` components, one per unique `instrument_id` present in `series[]`, sorted by the timestamp of the most recent point per instrument in DESCENDING order.
3. A collapsed (by default) disclosure body wrapping the existing `<LusciiPanel>` (see "Planned-actions disclosure" requirement).

The window-selector chip click SHALL refetch the data via `useLusciiData(patientId, { days })`. The TanStack Query cache key SHALL include `days` so concurrent requests for different windows produce distinct cache slots. The selector state SHALL be panel-local React state; it MUST NOT be persisted to the URL or to localStorage in v1.

#### Scenario: Default window is 30 days

- **WHEN** the panel mounts
- **THEN** the active window chip MUST be `30 dagen` and `useLusciiData` MUST be called with `{ days: 30 }`

#### Scenario: Window selector refetches with new `days`

- **WHEN** the caregiver clicks the `90 dagen` chip
- **THEN** `useLusciiData` MUST be called with `{ days: 90 }` and the previously-active chip MUST lose its active styling

#### Scenario: Instrument cards sort by most-recent activity

- **WHEN** the response contains series from two instruments A (most recent point at `T-3 days`) and B (most recent point at `T-1 day`)
- **THEN** `<InstrumentCard>` for B MUST render before `<InstrumentCard>` for A

#### Scenario: Programme name falls back when null

- **WHEN** the response has `program: null` (linked patient without a programme assigned)
- **THEN** the top strip MUST render the fallback text `Geen programma`

---

### Requirement: `<InstrumentCard>` anatomy + interaction

Each `<InstrumentCard>` SHALL render a card with:

- A header containing the instrument name (or `Onbekend instrument` fallback when `instrument_name` is null), a last-value badge (showing the latest point's display value across the card's series), and — for cards whose series include at least one numeric or ordinal series with ≥ 2 points — a sparkline preview.
- An expandable body, collapsed by default. When expanded, the body renders one or more archetype-appropriate charts plus a small tabular list of the card's most recent points (collapsible if the list exceeds 10 entries).

Multi-item instruments (instruments contributing more than one series in this patient's window) SHALL render in the expanded body as follows:

- If all card series share `archetype === 'numeric'` → a SINGLE chart with one line per series and a per-series legend (blood-pressure case: sys + dia on one chart, shared y-axis).
- Otherwise → one renderer per series, stacked vertically inside the card body.

The card header SHALL be a focusable `<button>` element with `aria-expanded` reflecting the body's state.

Sparklines SHALL be hidden when the card has fewer than 2 points overall — a single-point sparkline carries no signal.

#### Scenario: Card header is keyboard-actionable

- **WHEN** the caregiver tabs to the card header and presses Enter
- **THEN** the card body MUST toggle visibility and `aria-expanded` MUST reflect the new state

#### Scenario: Multi-numeric instrument renders one shared chart

- **WHEN** an instrument has two series both with `archetype === 'numeric'`
- **THEN** the expanded card body MUST render exactly one `<LineChart>` with two legend entries

#### Scenario: Mixed-archetype instrument stacks renderers

- **WHEN** an instrument has one `numeric` series and one `categorical` series
- **THEN** the expanded card body MUST render the `<LineChart>` followed by a `<ChipStreamTimeline>` for the categorical series

#### Scenario: Single-point card hides the sparkline

- **WHEN** the card's series total exactly one point across all series
- **THEN** the card header MUST render the last-value badge but MUST NOT render a sparkline

---

### Requirement: Archetype-keyed chart dispatch

Chart selection inside `<InstrumentCard>` SHALL be driven by a single `switch (series.archetype)` (or equivalent registry lookup) over each series, NOT by sniffing `unit`, `value`, or `response_texts` shape on the client. The dispatch SHALL be:

- `numeric` → `<LineChart>` (or `<MultiLineChart>` when grouped per the multi-item rule above) — engine: shadcn `Chart` over Recharts `LineChart`.
- `ordinal` → `<BarChart>` with discrete y-ticks derived from the observed point range — engine: shadcn `Chart` over Recharts `BarChart`.
- `categorical` → `<ChipStreamTimeline>` — horizontal stream of dated chips rendering `responses[]` as text; no aggregation, no chart engine.
- `free_text` → `<FreeTextLog>` — dated text list, no chart engine.
- `unknown` → `<UnknownLog>` — dated raw-value list with a muted "Onbekend formaat" annotation, no chart engine.

The chart layer SHALL respect the display-only invariant from `luscii-patient-data`:

- Y-axis ranges MUST be auto-scaled from observed values; the chart components MUST NOT accept hardcoded clinical-range overrides as props.
- Colours MUST come from the orchestrator theme palette only. The chart layer MUST NOT apply value-coded heuristics ("red when high", "green when normal").
- Tooltips MUST show the raw value + unit + timestamp. They MUST NOT include annotations like "below normal" or "out of range".

#### Scenario: TypeScript narrows series in the dispatch switch

- **WHEN** a developer writes `switch (series.archetype) { case 'numeric': ... }` against the `LusciiMeasurementSeries` type emitted by openapi-typescript
- **THEN** inside the `'numeric'` case the TypeScript compiler MUST narrow `series.points` to `LusciiNumericPoint[]` and an unrelated archetype field MUST be inaccessible

#### Scenario: No hardcoded clinical-range props on chart components

- **WHEN** reviewing the chart component signatures
- **THEN** no chart component MUST accept props named `yMin`, `yMax`, `referenceRange`, `normalRange`, `threshold`, or any synonymous variant

---

### Requirement: Programme-transition rendering

When a series' points carry `program_id` values that differ between consecutive points (sorted by `observed_at` ASC), the chart layer SHALL render a vertical transition band at the timestamp of the change. The band SHALL be labelled with the new programme name when the new `program_id` matches the current `LusciiPatientData.program.id` (use `program.name`); otherwise the band SHALL render the fallback label `Programmawissel`.

#### Scenario: Transition band labelled with current programme name

- **WHEN** a numeric series has 5 points; the 3rd point's `program_id` differs from the 2nd's; and the most recent point's `program_id` matches `program.id`
- **THEN** the chart MUST render a vertical band between the 2nd and 3rd points labelled with `program.name`

#### Scenario: Anonymous transition fallback

- **WHEN** a transition occurs between two `program_id` values, neither of which matches the current `program.id` (e.g. window spans two prior programmes)
- **THEN** the band MUST render the label `Programmawissel`

#### Scenario: No transition without programme change

- **WHEN** every point in a series carries the same `program_id`
- **THEN** the chart MUST NOT render any transition band

---

### Requirement: Planned-actions disclosure preserves the existing surface

`<MeasurementCharts>` SHALL render, below the instrument cards, a collapsible disclosure that wraps the existing `<LusciiPanel>` body — the programme/protocol header + planned-actions timeline + link/unlink UX. The disclosure SHALL be collapsed by default. The disclosure trigger SHALL display a count `N = planned_actions.length + unmatched_measurements.length` so caregivers can see at a glance that planned-action content exists below the charts.

The wrapped `<LusciiPanel>` SHALL render with its existing component, hooks, and i18n keys. No changes to `<LusciiPanel>`'s internals SHALL be required by this change.

#### Scenario: Disclosure collapsed by default

- **WHEN** `<MeasurementCharts>` mounts with at least one planned action
- **THEN** the disclosure body MUST NOT be visible and the disclosure trigger MUST be rendered with `aria-expanded={false}`

#### Scenario: Trigger shows the count

- **WHEN** the response carries 12 planned actions and 4 unmatched measurements
- **THEN** the disclosure trigger MUST include the text `(16)` or an i18n-formatted equivalent

#### Scenario: Expanding shows the LusciiPanel body

- **WHEN** the caregiver clicks the disclosure trigger
- **THEN** the body MUST render the existing `<LusciiPanel>` (programme/protocol header + planned actions + link UX) and `aria-expanded` MUST flip to `true`

---

### Requirement: Panel-scoped state machine

`<MeasurementCharts>` SHALL handle exactly five visible states; errors during fetch SHALL stay contained to the panel and MUST NOT break the rest of the patient profile (header, CareTeamSlot, kebab):

1. **Loading** — render skeleton cards (with skeleton sparkline placeholders) until the data resolves.
2. **Not configured** — when the backend response indicates the Luscii integration is not configured, render the existing quiet info state (reused from `<LusciiPanel>`) at the panel level.
3. **Not linked** — when the response state is `not_linked`, render the existing link-by-UUID form (reused from `<LusciiPanel>`) at the panel level. The chart cards and disclosure MUST NOT render.
4. **Empty-with-link** — when the response has `state === 'linked'` but `series` is empty (no measurements in the window), render the window-selector chip strip plus an `<EmptyState>` with the copy `Geen metingen in deze periode`. When the current `days` is less than `90`, the empty state MUST include a CTA button labelled `Bekijk 90 dagen` (clicking it sets the window to 90).
5. **Loaded** — render the top strip, instrument cards, and disclosure as specified above.

Fetch errors SHALL surface a `<sonner>` toast plus an inline retry button inside the panel. The rest of the page MUST continue to render normally.

#### Scenario: Error stays contained to the panel

- **WHEN** the `/patients/{id}/luscii-data` fetch fails with a 5xx
- **THEN** the patient header, CareTeamSlot, kebab, and the Labresultaten tab MUST continue to render normally; only the `Metingen` tab body MUST show the error state

#### Scenario: Empty-with-link CTA

- **WHEN** the linked patient has zero series in a `7 dagen` window
- **THEN** the panel MUST render the empty state with the `Bekijk 90 dagen` CTA button visible

#### Scenario: Empty-with-link CTA hidden at wide windows

- **WHEN** the linked patient has zero series in a `365 dagen` window
- **THEN** the panel MUST render the empty state WITHOUT the `Bekijk 90 dagen` CTA (because widening further would not yield more data)

---

### Requirement: i18n keys live under `patient-profile.charts.*`

All user-visible copy introduced by `<MeasurementCharts>` SHALL be routed through `react-i18next` with keys under the `patient-profile` namespace's `charts.*` subtree. The minimum key set:

- `charts.window.label`, `charts.window.7d`, `charts.window.30d`, `charts.window.90d`, `charts.window.365d`
- `charts.empty.title`, `charts.empty.body`, `charts.empty.widen_cta`
- `charts.planned_actions.toggle` (with `{{count}}` interpolation)
- `charts.unknown_instrument`
- `charts.unknown_format`
- `charts.last_value` (badge prefix or screen-reader label)
- `charts.error.title`, `charts.error.body`, `charts.error.retry`
- `charts.programme.transition_label` (defaults to `Programmawissel`)

Measurement item labels and instrument names SHALL be rendered as-is from the backend (catalogue-resolved per the existing `luscii-patient-data` locale rule); they are NOT routed through `react-i18next`.

#### Scenario: No untranslated chrome copy

- **WHEN** the panel renders any of its chrome — selector chips, disclosure trigger, empty-state copy, error toast, programme transition fallback
- **THEN** every such string MUST come from `t('patient-profile:charts...')` and MUST NOT appear as a JSX literal in the source

---

### Requirement: shadcn primitive set widens by exactly one (`Chart`)

The orchestrator's closed shadcn primitive set documented in `apps/orchestrator/AGENTS.md` SHALL widen to include `Chart`. The new file `apps/orchestrator/src/components/ui/chart.tsx` SHALL be generated via `pnpm dlx shadcn@latest add chart` and SHALL NOT be hand-edited; subsequent upgrades land via deliberate re-runs of the shadcn CLI. The runtime engine dependency `recharts` SHALL be added to `apps/orchestrator/package.json`.

No other chart engines (`visx`, `chart.js`, `echarts`, `tremor`, `nivo`, `victory`) SHALL enter the codebase as part of this change.

#### Scenario: AGENTS list updated

- **WHEN** `apps/orchestrator/AGENTS.md` is read after this change
- **THEN** the `components/ui/*` primitive list MUST include `Chart` alongside the prior 25 entries

#### Scenario: Only Recharts added as a chart dep

- **WHEN** inspecting `apps/orchestrator/package.json` after this change
- **THEN** `recharts` MUST appear in `dependencies` AND no other chart-engine package (`visx`, `chart.js`, `echarts`, `tremor`, `nivo`, `victory`) MUST appear

---

### Requirement: `useLusciiData` accepts a window option

The hook `apps/orchestrator/src/modules/patient/hooks.ts::useLusciiData` SHALL accept an options object with `days: 7 | 30 | 90 | 365`. The TanStack Query key SHALL include `days` so concurrent queries for different windows occupy distinct cache slots. When `days` is omitted, the hook SHALL default to `30`, preserving backwards compatibility with existing call sites.

#### Scenario: Hook default preserves backwards compatibility

- **WHEN** an existing consumer calls `useLusciiData(patientId)` without the options object
- **THEN** the hook MUST execute as if `{ days: 30 }` had been passed and the existing planned-actions consumer MUST keep working

#### Scenario: Window option drives the query key

- **WHEN** the same `patientId` is queried with `{ days: 30 }` and `{ days: 365 }` concurrently
- **THEN** TanStack Query MUST treat the two as distinct cache entries (the second call MUST NOT return the first call's data)
