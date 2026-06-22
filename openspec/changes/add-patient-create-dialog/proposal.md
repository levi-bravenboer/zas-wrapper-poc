## Why

Today a patient can only be created by a backend/seed script or a raw `POST /patients` call — the orchestrator patients overview (`F4`) has no affordance to add one. Caregivers and admins who are responsible for onboarding a patient have to leave the product. The overview is exactly where "I need to add a patient" is felt, so the action belongs there — gated, because not every caregiver should be able to mint patients.

This also closes a latent authz gap: `POST /patients` is currently **authenticated-only** (`CurrentUserDep`, "Keto gates patient data") — it has no RBAC guard, so any logged-in caregiver can create a patient via the API. Introducing a real `patient.create` permission lets us both gate the new button and harden the endpoint behind one slug.

## What Changes

- **New RBAC permission `patient.create`** — added to the code-defined catalog (`Permission` enum) and assigned to the seeded **admin** role only; a tenant admin opts non-admin roles in by granting it. Gates both the UI affordance and the backend route.
- **Creator joins the care team** — on create the service calls `CareTeamService.ensure_membership`, so the patient is immediately visible to whoever created it (no orphaned, invisible patient).
- **New RBAC permission `patient.createCrossOrg`** — when held, the create dialog reveals an **organisation selector** spanning any in-tenant organisation. When NOT held, the patient is created in the user's **own** organisation (derived from their open PractitionerRole affiliations): no selector when they have a single own org, an own-org selector when they have several.
- **"Create patient" button on the overview** — rendered in the `FilterableListPage` `primaryAction` slot, shown only when `useCan('patient.create')`. Opens a create-patient dialog.
- **Create-patient dialog** — a shadcn `Dialog` + `useEntityForm` form mirroring `EditPatientDialog`: `given_name`, `family_name`, `gender` (required), `birth_date` (optional), plus the conditional organisation selector. On success it invalidates the patients list and closes.
- **Backend guard + optional org + membership** — `POST /patients` gains `require_permission(Permission.PATIENT_CREATE)`. `PatientCreate.primary_organisation_id` becomes optional; the service resolves the target organisation from the caller when omitted and enforces the cross-org rule (callers without `patient.createCrossOrg` may only create in one of their own organisations). After persisting, the service calls `CareTeamService.ensure_membership(actor, patient.id)`.
- **Frontend client** — a `createPatient()` + `useCreatePatient()` mutation in `modules/patient/api.ts` against the generated `create_patient` operation; OpenAPI types regenerated.

## Capabilities

### Modified Capabilities
- `rbac-roles`: extend the permission catalog with `patient.create` and `patient.createCrossOrg`, and assign both to the seeded admin role only.
- `patients-base`: `POST /patients` is guarded by `patient.create`; `primary_organisation_id` is optional and server-resolved; the creator joins the patient's care team; a new `GET /me/organisations` exposes the caller's own orgs; the overview screen gains a permission-gated create affordance + dialog.

## Impact

- **Frontend (orchestrator)**: `createPatient`/`useCreatePatient` in `modules/patient/api.ts`; `CreatePatientDialog` component; extended form schema (adds optional `primary_organisation_id`); `useCan` gate + `primaryAction` button + dialog state in `PatientListPage`; an org-options source for the selector; new i18n keys under the patient namespace; regenerated `schema.d.ts`.
- **Backend**: new `Permission` members; `require_permission` guard on `create_patient`; `PatientCreate.primary_organisation_id` optional; `PatientService.create` resolves/validates the org against the caller and the cross-org permission, then calls `CareTeamService.ensure_membership`; new `GET /me/organisations` read; admin-only seed-role assignment.
- **Migrations**: none (permissions are code-defined; role↔permission seeding is data, applied via the seed/role bootstrap, not a schema migration).
- **Out of scope**: editing the patient after create (existing `EditPatientDialog`), identifiers entry in the create form (kept empty — added later via the Luscii/identifier flow), bulk import, choosing/naming the care team on create (the creator is auto-added to the patient's active team or a default "Zorgteam" — explicit team management stays in the care-team UI).
