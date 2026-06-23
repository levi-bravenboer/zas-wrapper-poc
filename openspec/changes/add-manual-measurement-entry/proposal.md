## Why

Today every measurement shown on a patient comes from Luscii — a read-only live proxy with no local write path. There is no way for a caregiver to record a measurement that was taken outside Luscii (e.g. a heart-rate reading from a bedside monitor). The patient detail page is exactly where "I need to log this reading" is felt, so the affordance belongs there.

This change introduces the first **local** measurement store and a dropdown-driven entry dialog. It is intentionally scoped to capture + persist + read-back only — no chart-merge with Luscii data, and no clinical logic (thresholds, scoring, alerts, pathway feed), so it stays clear of the display-only / MDR line for now.

## What Changes

- **New local observation store** — a FHIR `Observation`-style table (`code`, `value`, `unit`, `effective_date_time`, `performer`, `patient_id`) for measurements entered in-product, separate from the Luscii proxy which persists nothing.
- **Create endpoint** — `POST /patients/{patient_id}/observations` to persist a manual measurement, plus `GET /patients/{patient_id}/observations` to read them back.
- **Measurement-type dropdown** — the entry dialog offers a type selector; for now the only enabled type is **heart rate** (LOINC `8867-4`, unit `beats/min`). Other types render as a deliberately constrained list so adding more later is data, not new UI.
- **Add-measurement dialog (orchestrator)** — a shadcn `Dialog` on the patient detail page with the type dropdown + value field + timestamp (defaults to now). On success it invalidates the observations query and closes.
- **Frontend client** — `createObservation()` / `useCreateObservation()` + `fetchObservations()` / `useObservations()` in the patient module against the generated operations; OpenAPI types regenerated.

## Capabilities

### New Capabilities
- `manual-measurements`: local FHIR-Observation storage for measurements entered in-product, a guarded create/read API, a constrained measurement-type vocabulary (heart rate only for now), and a dropdown-driven entry dialog on the patient detail page.

### Modified Capabilities
<!-- none — Luscii proxy (luscii-patient-data) is untouched; local measurements are a separate store and surface. -->

## Impact

- **Backend**: new `Observation` SQLAlchemy model + Alembic migration; `ObservationCreate` / `ObservationView` schemas; an observation service (create + list by patient); `POST` / `GET /patients/{patient_id}/observations` router; a server-side allow-list of permitted measurement types (heart rate only) rejecting anything else.
- **Frontend (orchestrator)**: `AddMeasurementDialog` component with type dropdown; `createObservation`/`useCreateObservation` + `fetchObservations`/`useObservations` in `modules/patient/api.ts`; dialog trigger on the patient detail page; new i18n keys; regenerated `schema.d.ts`.
- **Migrations**: one new table (`observation`).
- **Out of scope**: merging local measurements into the Luscii "Metingen" charts (data + entry only for now); any clinical logic on the values (thresholds, scoring, alerts, pathway feed — MDR-gated, deferred); editing/deleting an observation; measurement types beyond heart rate.
