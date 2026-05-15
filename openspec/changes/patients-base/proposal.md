## Why

PoC orchestrator needs a tenant-scoped, FHIR-shaped patient entity to drive the Rugrevalidatie demo and unblock subsequent capabilities (`care-teams-base`, future pathway-runs). We have no `patients` table yet, and the June 2026 demo depends on it. We also need this entity shaped so that MVP can flip the source of truth to HiX (SMART-on-FHIR launch returning a FHIR `Patient` resource) without a rewrite — same constraint that drove `tenant-base` and `user-base`. Building the seam now (FHIR-shaped fields, identifier child table, source flag, adapter slot, organisation affiliation) costs little; deferring it forces a migration during the HiX integration crunch.

This change depends on `organisations-base` (chain change #1) being merged: `patients.primary_organisation_id` is mandatory, and `users.role` no longer carries `external`. See `openspec/changes/CHAIN.md`.

## What Changes

- Add backend `patients` table (tenant-scoped, soft-deleted, audit columns) inheriting `TenantOwnedEntity`, with `primary_organisation_id` FK → `organisations.id`.
- Add `patient_identifiers` child table (multi-identifier from day one to mirror FHIR `Patient.identifier`); seed Belgian INSZ rows for demo patients.
- Add ORM model, Pydantic schemas (Read / Create / Update), and Alembic migration.
- Add `seed_patients.py` script generating synthetic patients (deterministic, fake INSZ via Mod-97 algo, never real) under the demo program organisation seeded by `organisations-base`.
- Add minimal API under `/patients`: list (FHIR-aligned discrete search params, paginated), get-by-id, create, patch, soft-delete.
- Add HiX adapter seam at `app/adapters/hix/patients.py` — stub raising `NotImplementedError` so the MVP wiring point is reserved and import-tested.
- Add `Gender`, `PatientSource` enums in `app/core/enums/patient.py` aligned with FHIR R4 codes.
- Generate OpenAPI contract entries for new endpoints; refresh frontend client.

Visibility on `GET /patients` in this change is **tenant-scope only** (caregivers + admins in the tenant see all patients in the tenant). Care-team-based row filtering for caregivers lands in `care-teams-base` (chain change #3) as a MODIFIED requirement.

## Capabilities

### New Capabilities

- `patients-base`: backend patient entity (table, identifiers, API, adapter seam) — tenant-scoped projection of an MVP HiX-sourced patient, FHIR R4 shape preserved without depending on `fhir.resources`.

### Modified Capabilities

- (none — `organisations-base` is consumed unchanged as a dependency; `user-base` and `auth-stub` were already modified in chain change #1)

## Impact

- **Chain prerequisite**: `organisations-base` MUST be merged first.
- **Code**: `apps/backend/app/models/patient.py`, `app/models/patient_identifier.py`, `app/schemas/patient/patient.py`, `app/core/enums/patient.py`, `app/api/routers/patient/patient_router.py`, `app/services/patient/`, `app/adapters/hix/patients.py`, Alembic revision under `alembic/versions/`, `scripts/seed_patients.py`.
- **APIs**: 5 new endpoints under `/patients`. OpenAPI regen + orchestrator client regen.
- **DB**: 2 new tables, 2 new enum types (`gender`, `patient_source`), partial unique indexes on `(patient_id, system, value)` and `(tenant_id, external_system, external_ref)`.
- **Dependencies**: no new runtime deps. `fhir.resources` deliberately NOT introduced (BL-025 still deferred).
- **Future seams reserved**: `patient_names` / `patient_addresses` / `patient_telecoms` child tables (MVP), GDPR-Art.17 erasure flow (MVP), care-team visibility filter (chain #3).
- **Demo**: unblocks Rugrevalidatie patient list + pathway-run binding in the orchestrator.
- **Chain position**: change #2 of the FHIR-foundation chain. Must merge AFTER `organisations-base` and BEFORE `care-teams-base`.
