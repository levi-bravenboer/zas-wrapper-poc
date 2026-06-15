# prototypes/charts

HTML prototypes for the `Metingen` tab's `<MeasurementCharts>` panel. Each iteration is a new `vN.html` — never edit a prior version. The locked version is recorded in `../../design.md` once accepted.

## Versions

- `v1.html` — initial draft (2026-06-14). Patient header + Metingen tab body. Top strip with programme name + 7/30/90/365 window selector (30 active). Four instrument cards covering all three chart archetypes:
  1. `Bloeddrukmeting` — multi-line numeric (sys + dia shared y-axis, programme-transition band example).
  2. `Gewicht` — single-line numeric, sparkline-only header until expanded.
  3. `Klachten dagboek` — categorical chip stream.
  4. `Welbevinden vandaag` — ordinal bar chart (1–5 Punten).
  Planned-actions disclosure collapsed at the bottom with a `<LusciiPanel>` placeholder note.

## How to iterate

1. Start a vite-less browser session: `open vN.html` (file:// is fine; no JS deps).
2. Synthetic data is shaped exactly like the wire `series[]` so the React port is a thin translation.
3. After a design discussion, copy the latest accepted version to a new `vN+1.html` and apply the change. Commit both files.

## Synthetic data rules

- No real patient names. Use `Patiënt A`, `Patiënt B` or anonymous initials.
- Instrument names are real catalogue entries (`Bloeddrukmeting`, `Gewicht`, `Klachten dagboek`) so the locale wiring reads true.
- Timestamps are within the last 30 days from the prototype's commit date.
- Synthetic numeric ranges stay clinically plausible but value content is illustrative — no thresholds or annotations.
