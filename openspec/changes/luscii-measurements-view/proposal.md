## Why

Caregivers already use Luscii's own web app and know its `Overzicht`/`Metingen`
layout by heart. Our current `Metingen` tab (`MeasurementCharts.tsx`) shows the
same data in a Reaktor-styled tile grid, so caregivers have to re-learn the
view. Embedding Luscii's real screen is not viable (Viewer is SAML-only and
needs a per-org certificate exchange with Luscii staff). Since we already fetch
all the underlying data, we can instead render a pixel-faithful replica of
Luscii's measurement screen ourselves — same layout, filter bar, labels, and
chart styling — recoloured to the orchestrator green.

## What Changes

- Add a second `Metingen` presentation: a faithful replica of Luscii's
  measurement screen (full-width stacked cards, one per measurement; each card =
  underlined title, `Gemiddeld / Minimum / Maximum / Nieuwste` stat row with
  unit, `⋮` menu, and the chart).
- Add the Luscii filter bar exactly: `Aangepast` (custom range) + presets
  `7D 14D 30D 3M 6M 12M`, replacing the current `7/30/90/365` pills.
- Match chart styling per archetype (numeric/ordinal line, boolean `Ja/Nee`
  step line, steps bar, categorical/free_text list rows with status dots),
  Luscii royal-blue swapped for the orchestrator green; semantic red/orange
  status dots kept.
- Colour data points / list rows by fired alert flag (red/orange) using a new
  `/v1/alerts` fetch joined on `measurementId`.
- Hardcode threshold-band ranges per instrument (e.g. Hartslag 100–150, Temp
  >39) as static config — the band ranges are NOT exposed by the Luscii API, so
  static config is the only way to reproduce the shaded zones.
- Gate the replica behind a frontend env flag so the existing view stays the
  default until the replica is signed off; flag on → replica, flag off →
  current `MeasurementCharts`.

## Capabilities

### New Capabilities
- `luscii-metingen-replica`: frontend replica of Luscii's measurement screen on the patient `Metingen` tab — card layout, filter bar, archetype-styled charts, alert-flag colouring, hardcoded threshold bands, and the env-flag toggle between replica and the existing view.

### Modified Capabilities
- `luscii-patient-data`: extend the live-proxy data layer to fetch `/v1/alerts` and expose per-measurement alert flags so the frontend can colour points/rows.

## Impact

- **Frontend** (`apps/orchestrator`): new replica components under
  `modules/patient/components/` (and `charts/`); tab dispatch in the patient
  profile reads the env flag; new `patient-profile` i18n keys for the Luscii
  labels and filter presets.
- **Backend** (`apps/backend`): `LusciiHttpClient` gains a `get_alerts` call;
  `patient_data_service` joins alert flags onto measurements; `luscii`
  patient-data schema gains a flag field. OpenAPI + generated FE client
  regenerate in lockstep.
- **Config**: one new `VITE_`-prefixed boolean env var (frontend, build-time).
- **External**: additional read-only calls to the Luscii public API
  (`/v1/alerts`, org-wide + client-side filtered like measurements).
- No data-model/migration changes; presentation + read-path only.
