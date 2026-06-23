## 1. Backend data model + migration

- [x] 1.1 Add `Observation` SQLAlchemy model (`app/db/models/patient/observation.py`) extending `AuditableEntity`: `patient_id` FK (CASCADE, indexed), `code`, `code_system`, `value` (numeric), `unit`, `effective_date_time`, `performer_id`
- [x] 1.2 Wire the model into `app/db/models/patient/__init__.py` and add the `observations` relationship on `Patient`
- [x] 1.3 Generate the Alembic migration via `/new-migration "add observation table"`; verify autogen creates the table + index on `(patient_id, effective_date_time)` and nothing else
- [ ] 1.4 Apply the migration locally and confirm the table shape

## 2. Backend supported-types allow-list

- [x] 2.1 Define a supported measurement-type allow-list (key → `code`, `code_system`, `unit`); seed exactly one entry: heart rate (`8867-4`, `http://loinc.org`, `beats/min`)
- [x] 2.2 Add a typed error code `invalid.observation.unsupported_type` for rejected types

## 3. Backend schemas + service

- [x] 3.1 Add `ObservationCreate` (measurement_type key + numeric value + optional `effective_date_time`) and `ObservationView` schemas
- [x] 3.2 Add an observation service: `create(patient, type_key, value, effective_date_time, performer_id)` resolving code/system/unit from the allow-list (rejecting unknown types, defaulting time to now) and `list_for_patient(patient)` newest-first excluding soft-deleted rows
- [x] 3.3 Add the service dependency wiring (`deps.py`)

## 4. Backend routes

- [x] 4.1 Add `POST /patients/{patient_id}/observations` (`operation_id=create_patient_observation`), guarded by `PatientEditDep` (`# AUTH-HARDEN`), performer from `CurrentUserDep`, returns `201` + `ObservationView`, `422` on unsupported type
- [x] 4.2 Add `GET /patients/{patient_id}/observations` (`operation_id=list_patient_observations`), guarded by `PatientAccessDep` (`# AUTH-HARDEN`), returns the patient's observations newest-first
- [x] 4.3 Register the router

## 5. Backend tests

- [x] 5.1 Service test: heart rate persists with server-derived code/system/unit; effective time defaults to now
- [x] 5.2 Service/route test: unsupported type → `422 invalid.observation.unsupported_type`, nothing persisted
- [x] 5.3 Route test: create returns `201` view; list returns newest-first excluding soft-deleted
- [x] 5.4 Route test: caller without patient access is denied on both endpoints

## 6. OpenAPI + frontend client

- [ ] 6.1 Run `/openapi-sync` to regenerate `openapi.json` + orchestrator types
- [x] 6.2 Add `createObservation`/`useCreateObservation` and `fetchObservations`/`useObservations` to `apps/orchestrator/src/modules/patient/api.ts` against the generated operations

## 7. Frontend dialog

- [x] 7.1 Add `AddMeasurementDialog` (shadcn `Dialog` + project form hook) with a type dropdown (`Select`, heart rate only), numeric value field, timestamp field defaulting to now
- [x] 7.2 Disable submit until a type is selected and the value parses as a number
- [x] 7.3 On success: invalidate the observations query and close
- [x] 7.4 Add the dialog trigger affordance on the patient detail page
- [x] 7.5 Add i18n keys (dialog title, type label, heart-rate option, value/unit, timestamp, errors)

## 8. Verify

- [ ] 8.1 Run `/verify` (lint + typecheck + tests for changed apps)
- [ ] 8.2 Manually exercise the dialog in the orchestrator: add a heart-rate reading, confirm it persists and reads back
