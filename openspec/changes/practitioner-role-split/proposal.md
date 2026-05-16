**Tier**: chain — orchestrator-admin-ux #1

## Why

The current backend conflates two FHIR resources into one row. A `User` carries **both** authentication identity (email, password, IdP subject, tenant, app role) **and** clinical-affiliation data (single `organisation_id` FK). This collapse:

1. **Breaks FHIR conformance on Practitioner ↔ PractitionerRole.** FHIR R4 splits a person (`Practitioner`) from their employments (`PractitionerRole`, M:N with `Organization`, period-bounded, code/specialty). We cannot model one person working at multiple orgs concurrently, the history of employments, or per-affiliation role/specialty.
2. **Forces the visibility predicate down the wrong path.** `is_external_for_root` reads `user.organisation_id` directly. Once a caregiver has more than one affiliation (e.g. a freelance physio working at clinic A and clinic B), the predicate gives the wrong answer.
3. **Locks the UI into a re-roll.** Every UI surface that lists users, shows "who works where", or filters by org will have to be rewritten when M:N lands later. Land the data shape now, build UI against the post-split contract.

The external-practitioner use case (ZAS + GPs + physiotherapists + psychologists, see chain coordinator) is the immediate driver: a person can hold an affiliation to their own practice (root org A) **and** appear as a participant on a ZAS patient's care team. Today we'd model that GP as a `User` with `organisation_id = GP practice` — fine while they have one job, ambiguous as soon as they consult elsewhere.

This change is **#1 of the orchestrator-admin-ux chain** (`openspec/changes/CHAIN-orchestrator-admin-ux.md`). It blocks every UI surface in the chain.

## What Changes

- **Add capability `practitioner-role-split`** with two new ORM tables:
  - `practitioners` — clinical person record, 1:1 with caregiver `User`, holds display name + qualification. Admin users do not get a Practitioner row.
  - `practitioner_roles` — M:N join `(practitioner_id, organisation_id, period_start, period_end, code, specialty, is_primary)` with partial unique on `(practitioner_id, organisation_id) WHERE period_end IS NULL` (no duplicate concurrent open affiliations) and partial unique on `(practitioner_id) WHERE is_primary AND period_end IS NULL` (at most one current primary affiliation).
- **Add `PractitionerRoleCode` enum** at `app/core/enums/practitioner_role.py`: `gp | physiotherapist | psychologist | nurse | physician | other`. Starts narrow; future change may widen to free `CodeableConcept` (see backlog).
- **MODIFIES `user-base`**: drop `users.organisation_id` column (and FK + index). The "where does this user work" question is answered by `PractitionerRole.is_primary=TRUE` rows. Admin auth flow is unchanged.
- **MODIFIES `care-teams-base`**: replace `care_team_participants.on_behalf_of_organisation_id` with `care_team_participants.acting_as_practitioner_role_id` (FK practitioner_roles, RESTRICT, nullable). The new column records **which specific affiliation** the user was acting under for that engagement — strictly more precise than the org-only reference. Backfill via migration: for each existing participant, resolve the open `PractitionerRole` whose `organisation_id` matches `on_behalf_of_organisation_id`; fall back to NULL if not resolvable.
- **MODIFIES `organisations-base`**: `is_external_for_root` predicate signature unchanged, but `app/services/organisation/predicates.py` higher-level wrapper now resolves caregiver root orgs via `PractitionerRole.is_primary=TRUE` row (instead of `user.organisation_id`). New helper `practitioner_root_orgs_for(user)` returns the set of org-tree roots a user can act under (across all open `PractitionerRole` rows).
- **MODIFIES `patients-base` and `care-teams-base` visibility filter**:
  - `PatientService.list_in_tenant` for caregiver: caregiver sees a patient iff (a) they have an open `CareTeamParticipant` row for that patient, OR (b) **any** of their open `PractitionerRole.organisation_id` roots shares a root with `patient.primary_organisation_id`. (b) is unchanged in semantics; only the lookup path changes.
  - `require_patient_access` uses the same predicate. Admin bypass kept.
- **Add API endpoints** under `/practitioners` and `/practitioner-roles`:
  - `GET /practitioners/{user_id}` — returns Practitioner + open + historical PractitionerRoles
  - `POST /practitioners` (admin only) — create Practitioner row for an existing User (caregiver role)
  - `PATCH /practitioners/{user_id}` (admin only) — edit display name, qualification
  - `GET /practitioner-roles?practitioner_id=&organisation_id=` — list, filter
  - `POST /practitioner-roles` (admin only) — open a new affiliation
  - `PATCH /practitioner-roles/{id}` (admin only) — edit specialty / code / is_primary / close period
  - `DELETE /practitioner-roles/{id}` (admin only) — soft-close (sets `period_end=now`)
- **Update seeds** (`scripts/seed_practitioners.py`, wired into `seed_all.py` AFTER `seed_users.py`):
  - For every seeded caregiver, create a Practitioner + 1 PractitionerRole row (using each user's pre-migration `organisation_id`, `is_primary=TRUE`, `code='other'`).
- **Regenerate OpenAPI + typed client** (`/openapi-sync`). Frontend types reflect new shape; no UI surface yet (chain #2+ consumes).

## Capabilities

### New Capabilities

- `practitioner-role-split`: FHIR `Practitioner` and `PractitionerRole` modelling separating clinical identity from affiliation history.

### Modified Capabilities

- `user-base`: drops `users.organisation_id`; auth/login/role enum unchanged.
- `organisations-base`: visibility predicate consumers updated to query `practitioner_roles`; helper added.
- `patients-base`: visibility filter rerouted through new predicate; admin path unchanged.
- `care-teams-base`: `Participant.on_behalf_of_organisation_id` replaced by `acting_as_practitioner_role_id`; backfill migration handles existing rows.

## Impact

- **Chain prerequisites**: FHIR-foundation chain (`tenant-base`, `user-base`, `organisations-base`, `patients-base`, `care-teams-base`) ALL archived in `main`.
- **Code**:
  - `apps/backend/app/models/practitioner.py` (new), `app/models/practitioner_role.py` (new)
  - `app/core/enums/practitioner_role.py` (new)
  - `app/schemas/practitioner/` (new), `app/schemas/practitioner_role/` (new)
  - `app/services/practitioner/` (new), `app/services/practitioner_role/` (new)
  - `app/api/routers/practitioner/practitioner_router.py` (new), `app/api/routers/practitioner_role/practitioner_role_router.py` (new)
  - edits to `app/services/patient/patient_service.py`, `app/services/patient/deps.py`, `app/services/care_team/care_team_service.py`, `app/services/organisation/predicates.py`
  - removal of `users.organisation_id` references in models, services, schemas, routers, seeds, tests
  - Alembic revision with backfill
  - `scripts/seed_practitioners.py` (new), wired into `scripts/seed_all.py`
- **APIs**: 7 new endpoints; 0 modified endpoints in shape (`GET /patients` filter behaviour is identical but lookup path different).
- **DB**: 2 new tables, 1 new enum (`practitioner_role_code`), 4 new partial unique indexes, drop of 1 column + 1 FK + 1 index on `users`, rename of 1 column on `care_team_participants`.
- **Dependencies**: no new runtime deps.
- **Demo**: invisible — backend-only. Unblocks every UI surface in the chain.
- **Chain position**: change #1 of the orchestrator-admin-ux chain.

## Risks and mitigations

- **R1 — backfill correctness for `acting_as_practitioner_role_id`.** Existing CareTeamParticipant rows may have an `on_behalf_of_organisation_id` that no longer maps to any open `PractitionerRole` (e.g. the user's primary affiliation org is different). **Mitigation**: backfill resolves to the matching open role if exists, otherwise to the primary role, otherwise to NULL. Integration test asserts no participant row breaks; report on migration prints any unresolved rows.
- **R2 — visibility regressions.** Caregivers may "lose" patients post-migration if the primary-role-only lookup differs from their previous `user.organisation_id` root. **Mitigation**: the predicate now ORs across **all** open roles (strictly more permissive than the old single-FK path); test fixtures assert legacy access unchanged for single-role users.
- **R3 — admin auth.** Dropping `users.organisation_id` could break admin queries that reference it. **Mitigation**: `users.role` enum + `tenant_id` are unchanged; `is_admin` checks do not consult organisation. Grep the codebase for `user.organisation_id` and route all reads through `practitioner.primary_role.organisation_id` (helper).

## Out of scope

- PractitionerRole.specialty as open `CodeableConcept` — start narrow enum, widen later (additive).
- FHIR wire-format serialization — adapter work at integration time.
- M:N cross-tenant practitioners — federation deferred to MVP.
- UI changes — separate specs in the chain.
