## Context

Most of the machinery already exists:

- **Backend** — `POST /patients` (`patient_router.py:87`) → `PatientService.create` (`patient_service.py:83`) already builds the `Patient`, asserts the org is in-tenant (`_assert_organisation_in_tenant`), and persists. Its only auth today is `CurrentUserDep` ("authenticated only; Keto gates patient data") — **no RBAC guard**. The RBAC catalog is a code-defined `StrEnum` (`app/core/enums/permission.py`); guards are `Depends(require_permission(Permission.X))` (see `role_router.py`). Caregiver↔org affiliation is the `practitioner_roles` table (M:N practitioner↔organisation, one open row per pair).
- **Frontend** — `PatientListPage` composes `FilterableListPage`, which exposes a `primaryAction` slot (currently unused). `useCan('slug')` reads the session's RBAC permission slugs. `EditPatientDialog` + `useEntityForm` + `patientFormSchema` (zod) + shadcn `Dialog` is the established create/edit form pattern; `RolesListPage` is the reference for a `useCan`-gated `primaryAction` button. Patient API calls live in `modules/patient/api.ts` (generated `openapi-fetch` client).

What's missing is the permission, the gate + dialog wiring, the create mutation, and the org-resolution rule.

## Goals / Non-Goals

**Goals:**
- A permission-gated "Create patient" button on `/_auth/patients` opening a create dialog.
- A real `patient.create` RBAC permission enforced on BOTH the button and `POST /patients`.
- Org handling: default to the caller's own organisation; show a selector for `patient.createCrossOrg` holders (any tenant org) or for non-holders with more than one own org (own orgs only) — see D4/D5.
- The creator joins the new patient's care team so they can see it immediately (D8).

**Non-Goals:**
- Choosing or naming the care team on create (the creator is auto-added to the patient's active team or a default "Zorgteam"; explicit team management stays in the care-team UI).
- Identifier entry in the create form, bulk import, post-create edit (existing dialog handles edit).

## Decisions

- **D1 — New `patient.create` permission, gate both sides.** Add `PATIENT_CREATE = "patient.create"` to the catalog; `useCan('patient.create')` gates the button and `Depends(require_permission(Permission.PATIENT_CREATE))` guards `create_patient`. Reason: user chose defense-in-depth; also closes the existing unguarded-endpoint gap. NOT a crown permission (it does not grant role/permission editing).
- **D2 — `patient.create` is not `patient.accessAll`.** Creating a patient is an app function (RBAC); seeing patient *data* stays Keto/care-team. The permission alone grants no data access — holding `patient.create` does not let a caller see arbitrary patients. The creator sees the patient they just made only because D8 adds them to its care team; visibility of *other* patients is unchanged.
- **D3 — `primary_organisation_id` becomes optional in `PatientCreate`; the server resolves it.** Frontend omits it for own-org creation; the service derives the caller's organisation. Reason: the session does not carry an org (`sessionUserSchema` has no org field), and "own org" comes from `practitioner_roles`. Putting resolution server-side keeps the trust boundary on the backend.
- **D4 — Cross-org rule is enforced in the service, keyed on `patient.createCrossOrg`.**
  - Caller HAS `patient.createCrossOrg`: may pass any in-tenant `primary_organisation_id` (existing `_assert_organisation_in_tenant` validates tenant); the dialog shows an org selector populated from the orgs the user can list.
  - Caller LACKS it: any passed org MUST be one of the caller's own affiliated orgs, else `403`; if omitted and the caller has exactly one own org, the server uses it. The dialog hides the selector when there is a single own org; with more than one it shows an own-org selector (see D5).
  Reason: user instruction — "should also be a permission if no fallback to own org." The permission governs whether you can target an org other than your own.
- **D5 — Multiple own orgs without cross-org permission → own-org selector.** A caregiver affiliated with >1 organisation but lacking `patient.createCrossOrg` cannot have the org auto-picked unambiguously. The dialog then shows a selector limited to the caller's own orgs, and the server validates membership. Single own org → no selector, server auto-fills. Reason: avoids guessing which of several orgs; keeps the "default to own" intent without a silent wrong choice.
- **D6 — Dialog mirrors `EditPatientDialog`.** Same shadcn `Dialog` + `useEntityForm` + zod schema, fields `given_name`/`family_name`/`gender`/`birth_date`, plus the conditional org `Select`. `identifiers` defaults to `[]` (not in the form). On success: `toast`, invalidate the patients list query, close. Reason: visual + code consistency, minimal new surface.
- **D7 — Seed-role assignment: admin only.** Both `patient.create` and `patient.createCrossOrg` are assigned to the seeded **admin** role only. The seeded caregiver role gets neither by default; a tenant admin grants a role holding `patient.create` (optionally `patient.createCrossOrg`) to enable non-admin onboarding. Reason: user decision — keep onboarding admin-gated out of the box, opt-in per tenant.
- **D8 — Create assigns the creator to the patient's care team.** After persisting, `PatientService.create` calls `CareTeamService.ensure_membership(actor, patient.id)` — an existing idempotent method that reuses the patient's active care team (or creates a default "Zorgteam") and adds the actor as an open `CONSULTING` participant. Reason: user decision — the creator must see the patient they just created. This resolves the "invisible after create" gap with an existing seam rather than new care-team code; admins (who hold `patient.accessAll`) are unaffected, non-admin creators gain immediate visibility.

## Risks / Trade-offs

- **Created patient visibility — resolved via D8.** Visibility requires an open care-team participant row (`patients-base` D). `ensure_membership` on create gives the creator that row, so the patient is immediately visible to them. Trade-off: every create now also touches `care_teams`/`care_team_participants` (one extra write path); acceptable since the method is idempotent and already used by enrollment.
- **Org-options source for the selector — resolved (D9).** `(b)` cross-org holders reuse `GET /organisations` (admins can list). `(a)` the caller's own orgs cannot reuse `GET /practitioner-roles` (it requires `practitionerRole.read`, which a non-admin `patient.create` holder need not have), so we add a small authenticated-only `GET /me/organisations` returning the caller's open-affiliation orgs. With the admin-only seed, `(a)` only matters when a tenant grants `patient.create` (no cross-org) to a multi-org role; the endpoint keeps that path correct.
- **OpenAPI drift.** Making `primary_organisation_id` optional changes the `create_patient` request schema → must run `/openapi-sync` so the generated client/types match, or the FE mutation type will be wrong.
- **Spec text staleness.** `patients-base` still says routes use `require_role(Role.ADMIN, Role.CAREGIVER)`; the live router uses `CurrentUserDep`. The MODIFIED requirement here describes the new `require_permission` reality for the create route only; the legacy phrasing is left untouched elsewhere to keep this change scoped.

## Migration Plan

No schema migration. `Permission` members are code-defined. Role→permission assignment is seed/bootstrap data applied through the existing role-seeding path. `PatientCreate` field optionality is a schema/API change requiring `/openapi-sync`, not a DB migration.

## Open Questions

- All resolved: seed is admin-only (D7); creator joins the care team via `ensure_membership` (D8); own-org selector source is a new `GET /me/organisations` (D9).
