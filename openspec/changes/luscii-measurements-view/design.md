## Context

The patient `Metingen` tab already renders Luscii data via
`MeasurementCharts.tsx`: a Reaktor-styled tile grid that calls `useLusciiData`
(one live-proxy call per window per patient) and dispatches the typed `series[]`
through a per-archetype chart registry (`charts/registry.tsx` →
`LineChart`/`BarChart`/`ChipStreamTimeline`/`FreeTextLog`/`UnknownLog`). The
backend live-proxy (`LusciiHttpClient` + `patient_data_service`) fetches
patient, planned-actions, org-wide measurements, and localisation catalogues,
then projects measurements into `series`.

This change adds a **second presentation** of the same data — a pixel-faithful
replica of Luscii's own measurement screen — selectable by a frontend env flag,
so caregivers see the layout they already know. Confirmed via live API probing
(sandbox patient `Juliet Dyer`): the API exposes no dashboard/ordering/threshold
config; threshold-band ranges are not fetchable; `/v1/alerts` returns fired
alert flags (no numeric bounds); all list endpoints ignore server-side filters
and must be filtered client-side.

## Goals / Non-Goals

**Goals:**
- Faithful visual copy of Luscii's measurement screen: stacked full-width cards,
  `Gemiddeld/Minimum/Maximum/Nieuwste` stat row, `7D 14D 30D 3M 6M 12M`/custom
  filter bar, archetype-styled charts, exact Dutch labels.
- Recolour Luscii royal-blue → orchestrator green; keep semantic red/orange.
- Colour points/rows by fired alert flag.
- Reproduce threshold bands via static per-instrument config.
- Default-off behind a frontend env flag; existing view stays default.

**Non-Goals:**
- No SAML/iframe embedding of Luscii's real Viewer.
- No live threshold-range fetch (API does not expose it).
- No change to the link/unlink UX or the data-model/persistence layer.
- Not removing the existing `MeasurementCharts` view.

## Decisions

- **Reuse the data layer, add a parallel view.** Keep `useLusciiData` and the
  `series` projection; build replica components (`charts/` additions) rather
  than forking the data path. Alternative (separate hook) rejected — duplicates
  the live-proxy call.
- **Frontend build-time flag — LOCKED `VITE_LUSCII_METINGEN_REPLICA`.** Gate via
  this `VITE_` boolean read at the tab-dispatch point in the patient profile
  (the original `LUSCII_IFRAME` name is dropped — no iframe).
  Runtime/backend-config toggle rejected for this iteration to keep scope
  frontend-only.
- **Filter presets map to window-days.** `7D→7, 14D→14, 30D→30, 3M→90, 6M→180,
  12M→365`; `Aangepast` passes an explicit start/end. `useLusciiData` currently
  types `LusciiWindowDays = 7|30|90|365` — extend to the Luscii preset set (and
  custom range) for the replica.
- **Alerts on the backend.** Add `LusciiHttpClient.get_alerts` (cursor-paginated,
  client-side patient filter like measurements) and join onto measurements by
  `measurementId` in `patient_data_service`; expose a flag field in the
  patient-data schema. Alternative (frontend fetches alerts directly) rejected —
  the token is server-side and the join belongs with the projection.
- **5-second polling — LOCKED.** The replica polls `useLusciiData` on a 5s
  `refetchInterval` while mounted so new measurements surface live; `retry`
  stays `false` (live external vendor) and polling pauses on hidden tab. Note:
  each poll is a live-proxy call to the Luscii API — acceptable for the demo;
  revisit interval if rate-limited.
- **Card order = static code list.** A dev-editable array defines card order;
  no UI ordering control and no freshness auto-sort. The user reorders by
  editing the list. Alternative (data-driven sort / UI control) rejected — user
  explicitly wants to set order in code.
- **Self-contained replica component tree.** The replica view and all its
  sub-components live in their own directory, isolated from the existing
  `MeasurementCharts`, so the env flag swaps a single entry component cleanly.
- **Threshold bands = DROPPED.** The Luscii API exposes no band ranges (all
  threshold endpoints 404) and hardcoding ranges would be us asserting clinical
  thresholds — barred by the MDR display-only invariant. No shaded zones.
- **Alert dots = Luscii passthrough (MDR-logged).** Colour points/rows by
  Luscii's OWN fired alert flag from `/v1/alerts`, joined on `measurementId`,
  echoed verbatim — no computation. This revisits the 2026-06-10 "no alerts"
  decision, so it is logged in `openspec/mdr-watchlist.md` (2026-06-22) and
  ships behind the default-off flag pending PO confirmation. Alternative
  (compute our own flags from values) rejected — that is squarely MDR.
- **`⋮` per-card menu = visual-only for v1 — LOCKED.** The affordance is
  rendered to match Luscii but exposes no actions yet; wiring real actions is a
  follow-up.

## Risks / Trade-offs

- **Static threshold bands drift** from Luscii's real config → Mitigation: keep
  the map small/explicit and comment its provenance; revisit if Luscii ever
  exposes ranges.
- **`/v1/alerts` is org-wide + cursor-paginated** → Mitigation: reuse the
  existing measurement pagination/guard pattern; client-filter by patient; treat
  alert failure as non-fatal (payload still returns).
- **Two `Metingen` views diverge in styling/labels** → Mitigation: flag-gated,
  default-off; remove the losing view once the replica is signed off.
- **Pixel-faithfulness vs design-system tokens** → Mitigation: prototype with
  mock data and compare against screenshots before backend wiring.

## Migration Plan

1. Land backend `get_alerts` + flag projection (additive, default-safe).
2. Regenerate OpenAPI + FE client in lockstep.
3. Build replica components behind the flag (default off) — no behaviour change
   shipped until the flag flips.
4. Rollback = unset/remove the flag; existing view is untouched.

## Open Questions

All resolved and locked into Decisions:
- Env-flag name → `VITE_LUSCII_METINGEN_REPLICA`.
- Threshold-band ranges → static per-instrument config seeded from the
  Drempelwaarden screen; bandless when not configured.
- `⋮` per-card menu → visual-only for v1.
