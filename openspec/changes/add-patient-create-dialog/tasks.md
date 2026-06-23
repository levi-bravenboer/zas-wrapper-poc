## 1. RBAC permission catalog (backend)

- [x] 1.1 Add `PATIENT_CREATE = "patient.create"` and `PATIENT_CREATE_CROSS_ORG = "patient.createCrossOrg"` to `Permission` (`app/core/enums/permission.py`); decide crown membership (neither is crown).
- [x] 1.2 Assign both new permissions to the seeded **admin** role only (D7); no caregiver default.
- [x] 1.3 Update `rbac-roles` tests/fixtures that assert the catalog/seed contents.

## 2. Backend create endpoint + service

- [x] 2.1 Guard `create_patient` with `Depends(require_permission(Permission.PATIENT_CREATE))`; keep the `# AUTH-HARDEN` marker.
- [x] 2.2 Make `PatientCreate.primary_organisation_id` optional (`UUID | None`, default `None`).
- [x] 2.3 In `PatientService.create`, resolve/validate the org: cross-org holders may pass any in-tenant org; non-holders must pass/omit one of their own affiliated orgs (else `403`); omitted + single own org → auto-fill. Reuse `_assert_organisation_in_tenant` for the tenant check.
- [x] 2.4 Source the caller's own affiliated orgs from `practitioner_roles` (open rows); add a helper/repo method if none exists.
- [x] 2.5 After persisting, call `CareTeamService.ensure_membership(actor, patient.id)` (D8) so the creator joins the patient's care team; inject the care-team service into `PatientService`.
- [x] 2.6 Backend tests: gate (403 without `patient.create`), own-org default, cross-org allow/deny, multi-own-org behaviour, and creator-is-member-after-create (creator's `GET /patients` includes the new patient).

## 3. Own-org affiliations source (D9)

- [x] 3.1 Add `GET /me/organisations` (authenticated-only) returning the caller's organisations from open `practitioner_roles` rows; reuse the helper from 2.4.
- [x] 3.2 Backend test: returns only the caller's affiliated, in-tenant orgs.

## 4. OpenAPI sync

- [x] 4.1 Run `/openapi-sync` (regenerate `apps/backend/openapi.json` then `orchestrator:typegen`) so the optional `primary_organisation_id` + any new endpoint land in `schema.d.ts`.

## 5. Frontend data layer

- [x] 5.1 Add `createPatient(payload)` + `useCreatePatient()` to `modules/patient/api.ts` against the generated `create_patient` op; invalidate the patients list query on success.
- [x] 5.2 Add an org-options query: `GET /organisations` when `patient.createCrossOrg`, else `GET /me/organisations` (own orgs) for the selector.

## 6. Create dialog + gate

- [x] 6.1 Extend the patient form schema with optional `primary_organisation_id` (or a dedicated create schema) — `given_name`, `family_name`, `gender` required; `birth_date` optional.
- [x] 6.2 Build `CreatePatientDialog` mirroring `EditPatientDialog` (shadcn `Dialog` + `useEntityForm`); conditional org `Select` per D4/D5; `toast` + close on success.
- [x] 6.3 In `PatientListPage`: `const canCreate = useCan('patient.create')`; pass a `primaryAction` button (Plus icon) when `canCreate`; wire dialog open/close state.
- [x] 6.4 Add i18n keys under the patient namespace (`create.title`, `create.trigger`, `create.fields.*`, `create.org.*`, `create.toast.*`) in the `nl` locale.

## 7. Tests + verify

- [x] 7.1 Unit test `CreatePatientDialog` (validation, submit calls mutation; org selector: shown for `createCrossOrg`, shown for >1 own org, hidden for single own org).
- [x] 7.2 Test the gate: button absent without `patient.create`, present with it.
- [x] 7.3 Run `/verify` (lint + typecheck + tests, backend + orchestrator); quote results.
- [x] 7.4 Browser check: create a patient as admin (tenant-wide org selector visible); confirm the new patient appears in the creator's list immediately (care-team membership applied). Test a custom non-admin role holding `patient.create` only: single-own-org user → no selector; multi-own-org user → own-org selector; patient visible after.
