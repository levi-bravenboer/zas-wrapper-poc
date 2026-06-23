## ADDED Requirements

### Requirement: Env-flag toggle between replica and existing view
The patient `Metingen` tab SHALL render the Luscii replica view when the
frontend env flag is enabled, and the existing `MeasurementCharts` view when it
is disabled. The flag SHALL be a build-time `VITE_`-prefixed boolean read on the
frontend, defaulting to disabled.

#### Scenario: Flag enabled
- **WHEN** the env flag is enabled and a caregiver opens the `Metingen` tab
- **THEN** the Luscii replica view renders instead of the existing tile-grid view

#### Scenario: Flag disabled (default)
- **WHEN** the env flag is unset or disabled
- **THEN** the existing `MeasurementCharts` view renders unchanged

### Requirement: Replica polls measurement data every 5 seconds
While the replica view is mounted, it SHALL poll the Luscii measurement data on
a 5-second interval so newly submitted measurements appear without a manual
refresh. Polling SHALL not retry on error and SHOULD pause when the tab/window
is hidden.

#### Scenario: Live refresh
- **WHEN** the replica view is open and a new measurement arrives upstream
- **THEN** the cards update within ~5 seconds without user action

#### Scenario: Hidden tab
- **WHEN** the browser tab/window is hidden
- **THEN** polling pauses and resumes when the tab is visible again

### Requirement: Measurement cards replicate Luscii layout
The replica SHALL render one full-width card per measurement, stacked
vertically, each containing an underlined title (the localised instrument/item
label), a `⋮` menu affordance, a stat row, and the measurement chart. Card
order SHALL come from a static, dev-editable list in code — there SHALL be no
in-UI ordering control and no freshness-based auto-sort.

#### Scenario: One card per measurement
- **WHEN** the patient has measurements across multiple instruments in range
- **THEN** the replica renders one stacked card per measurement series with its localised title

#### Scenario: Static code-defined order
- **WHEN** a developer changes the order in the code list
- **THEN** the cards render in that order, with no UI control exposed to caregivers

#### Scenario: Localised labels
- **WHEN** an instrument/item has a Dutch localisation in the synced catalogue
- **THEN** the card title and units use that localised text, matching Luscii

### Requirement: Stat row shows aggregate values
Each card SHALL show a `Gemiddeld / Minimum / Maximum / Nieuwste` stat row,
each value computed from the in-range points and suffixed with the instrument
unit (e.g. `bpm`, `mmHg`, `minuten`, `punten`, `score`, `Stappen`, `°C`).

#### Scenario: Numeric aggregates
- **WHEN** a numeric series has points in range
- **THEN** the row shows mean, min, max, and latest values with the correct unit

#### Scenario: Latest reflects most recent point
- **WHEN** new points arrive
- **THEN** `Nieuwste` reflects the most recent observed value

### Requirement: Filter bar replicates Luscii presets
The replica SHALL show a filter bar with an `Aangepast` custom-range control and
preset buttons `7D 14D 30D 3M 6M 12M`, with the active preset visually marked.
Selecting a preset SHALL refetch/scope the displayed range accordingly.

#### Scenario: Preset selection
- **WHEN** a caregiver selects the `3M` preset
- **THEN** all cards display the last 3 months and `3M` is marked active

#### Scenario: Custom range
- **WHEN** a caregiver picks a custom start/end via `Aangepast`
- **THEN** all cards display that explicit range

### Requirement: Charts styled per archetype with orchestrator green
Each card SHALL render a chart selected by the series archetype — numeric and
ordinal as line charts, step counts as bar charts, boolean as a `Ja/Nee` step
line, and categorical/free-text as list rows with status dots. The Luscii
royal-blue accent SHALL be replaced by the orchestrator green; semantic
red/orange status indicators SHALL be kept.

#### Scenario: Numeric line chart
- **WHEN** a numeric series renders
- **THEN** it draws a green line chart with a date x-axis matching Luscii's styling

#### Scenario: Boolean step line
- **WHEN** a boolean (`Ja/Nee`) series renders
- **THEN** it draws a step line against a `Ja/Nee` axis

#### Scenario: Categorical list rows
- **WHEN** a categorical or free-text series renders
- **THEN** it shows dated list rows with the response text and a status dot

### Requirement: Alert flags colour points and rows (Luscii passthrough)
The replica SHALL colour data points and list rows by the fired Luscii alert
flag (red/orange) when an alert exists for that measurement, joining alerts to
measurements on `measurementId`. The flag SHALL be Luscii's own fired status,
passed through verbatim — the system MUST NOT compute the flag or derive it
from measurement values. This passthrough is logged in
`openspec/mdr-watchlist.md` (2026-06-22) and gated behind the default-off flag
pending PO confirmation. The replica SHALL NOT render threshold bands (the
Luscii API exposes no ranges; asserting ranges ourselves is out of scope).

#### Scenario: Flagged measurement
- **WHEN** Luscii has raised a red alert for a measurement
- **THEN** its point/row is shown with the red status colour, echoing Luscii's flag

#### Scenario: Unflagged measurement
- **WHEN** a measurement has no Luscii alert
- **THEN** its point/row uses the default (green) styling

#### Scenario: No threshold bands
- **WHEN** any chart renders
- **THEN** no shaded threshold band is drawn
