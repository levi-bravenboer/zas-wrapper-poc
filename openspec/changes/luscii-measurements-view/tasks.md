## 1. Backend: alerts fetch + flag projection

- [x] 1.1 Add `LusciiAlert` api-model (`id`, `measurementId`, `instrumentId`, `flag`, `status`, `type`) in `apps/backend/app/adapters/luscii/api_models.py`
- [x] 1.2 Add `get_alerts` to `LusciiHttpClient` against `/v1/alerts`, cursor-paginated, reusing the measurement pagination/guard pattern
- [x] 1.3 In `patient_data_service`, fetch alerts and join onto measurements by `measurementId`, client-filtering by patient; treat alert failure as non-fatal
- [x] 1.4 Add a per-measurement `alert_flag` field to the luscii patient-data schema (`apps/backend/app/schemas/luscii/patient_data.py`) and surface it on `series` points
- [ ] 1.5 Unit tests: alert join, missing-alert null flag, alerts-endpoint-failure degrades gracefully
- [x] 1.6 Run `/openapi-sync` to regenerate `openapi.json` + orchestrator FE client in lockstep

## 2. Frontend: env flag + tab dispatch

- [x] 2.1 Add `VITE_LUSCII_METINGEN_REPLICA` boolean (typed env access), defaulting to off
- [x] 2.2 At the `Metingen` tab dispatch in the patient profile, render the replica when the flag is on, else the existing `MeasurementCharts`
- [x] 2.3 Extend `useLusciiData` window typing to the Luscii preset set (`7/14/30/90/180/365`) plus a custom start/end range
- [x] 2.4 Poll the Luscii measurement data every 5 seconds while the replica view is mounted (`refetchInterval: 5000`); keep `retry: false`, pause when tab/window hidden

## 3. Frontend: replica components

- [x] 3.1 `MeasurementReplica` container: stacked full-width cards, one per measurement series, rendered in a static code-defined order (a dev-editable array — no UI ordering control, no freshness auto-sort)
- [x] 3.2 Luscii filter bar component: `Aangepast` custom range + `7D 14D 30D 3M 6M 12M` presets with active marking, wired to the window/range state
- [x] 3.3 Replica card: underlined localised title, `⋮` menu affordance (visual-only v1, no actions), stat row (`Gemiddeld/Minimum/Maximum/Nieuwste` + unit), chart slot
- [x] 3.4 Stat-row aggregates (mean/min/max/latest) computed from in-range points with correct units
- [ ] 3.5 Archetype chart styling tuned to Luscii: numeric/ordinal line, steps bar, boolean `Ja/Nee` step line, categorical/free_text list rows with status dots
- [ ] 3.6 Recolour accent to orchestrator green; keep semantic red/orange; point/row colouring by `alert_flag` (Luscii passthrough)
- [x] 3.7 No threshold bands (dropped — no API data + MDR boundary); ensure charts render cleanly without bands
- [x] 3.8 i18n: add `patient-profile` keys for Luscii labels, filter presets, and stat-row labels (Dutch)

## 4. Verify

- [ ] 4.1 Prototype with mock data and visually compare each card type against the Luscii screenshots
- [ ] 4.2 Frontend component tests: flag toggle, card rendering per archetype, filter preset selection, alert-flag colouring
- [ ] 4.3 Run `/verify` (lint + typecheck + tests) for affected apps
- [ ] 4.4 Manual check against sandbox patient `Juliet Dyer` (12 instruments) with the flag on
