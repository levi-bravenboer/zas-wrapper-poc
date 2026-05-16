## 0. Chain prerequisite

- [x] 0.1 Verify FHIR-foundation chain archived: `tenant-base`, `user-base`, `organisations-base`, `patients-base`, `care-teams-base` all present in `openspec/changes/archive/` (or `openspec/specs/`); bail if not
- [x] 0.2 Confirm `openspec/changes/CHAIN-orchestrator-admin-ux.md` lists this change in row 1; nothing else `in-progress` upstream

## 1. Enums

- [x] 1.1 Create `app/core/enums/practitioner_role.py` with `PractitionerRoleCode` (`gp | physiotherapist | psychologist | nurse | physician | other`) as `StrEnum`; re-export from `app/core/enums/__init__.py`

## 2. ORM models

- [x] 2.1 Create `app/db/models/practitioner/practitioner.py` (`Practitioner(TenantOwnedEntity)`) with `user_id` FK (RESTRICT, unique), `family_name`, `given_name`, `qualification` (nullable text)
- [x] 2.2 Create `app/db/models/practitioner/practitioner_role.py` (`PractitionerRole(TenantOwnedEntity)`) with `practitioner_id` FK (RESTRICT), `organisation_id` FK (RESTRICT), `code` enum, `specialty` (nullable), `is_primary` boolean default FALSE, `period_start`, `period_end` (nullable)
- [x] 2.3 Add `Practitioner.roles` relationship (`selectinload`, order by `is_primary DESC, period_start DESC`)
- [x] 2.4 Register both models in metadata import root (`app/db/models/__init__.py`)

## 3. Migration

- [x] 3.1 Generate Alembic revision creating `practitioner_role_code` Postgres enum
- [x] 3.2 Create `practitioners` table + indexes (unique on `user_id`)
- [x] 3.3 Create `practitioner_roles` table + indexes:
  - partial unique `(practitioner_id, organisation_id) WHERE period_end IS NULL`
  - partial unique `(practitioner_id) WHERE is_primary AND period_end IS NULL`
  - `(practitioner_id, period_end)` partial WHERE period_end IS NULL
  - `(organisation_id, period_end)` partial WHERE period_end IS NULL
- [x] 3.4 Add `care_team_participants.acting_as_practitioner_role_id` (FK practitioner_roles, RESTRICT, nullable)
- [x] 3.5 Backfill: for each caregiver `User` create a `Practitioner` row (using `display_name` split for given/family); create one `PractitionerRole` row with `organisation_id = users.organisation_id`, `is_primary=TRUE`, `period_start = users.created_at`, `period_end=NULL`, `code='other'`
- [x] 3.6 Backfill `care_team_participants.acting_as_practitioner_role_id` from `on_behalf_of_organisation_id`: resolve to matching open role; fall back to `is_primary` role of same practitioner; NULL if neither resolves
- [x] 3.7 Drop `users.organisation_id` (FK, index, column)
- [x] 3.8 Drop `care_team_participants.on_behalf_of_organisation_id` (FK, column)
- [x] 3.9 Verify downgrade reverses every step in correct order (re-add columns, re-backfill, drop new tables, drop enum)
- [ ] 3.10 Migration test: fresh DB → head — pending Docker stack to actually run migration

## 4. Pydantic schemas

- [x] 4.1 Create `app/schemas/practitioner/practitioner.py`: `PractitionerRead` (with embedded `roles`), `PractitionerCreate` (`user_id`, `family_name`, `given_name`, `qualification?`), `PractitionerUpdate` (`family_name?`, `given_name?`, `qualification?`)
- [x] 4.2 Create `app/schemas/practitioner_role/practitioner_role.py`: `PractitionerRoleRead`, `PractitionerRoleCreate` (`practitioner_id`, `organisation_id`, `code`, `specialty?`, `is_primary?`, `period_start?`), `PractitionerRoleUpdate` (`code?`, `specialty?`, `is_primary?`; `period_end` only via close endpoint to centralise close-side invariants)
- [ ] 4.3 Unit tests: schema validation, enum round-trip, is_primary mutually-exclusive validator

## 5. Service layer

- [x] 5.1 Create `app/services/practitioner/practitioner_service.py`:
  - `get_by_user(user_id) -> PractitionerRead`
  - `create(actor, payload)` — admin only; enforces user.role=caregiver; checks tenant
  - `update(actor, user_id, payload)`
- [x] 5.2 Create `app/services/practitioner_role/practitioner_role_service.py`:
  - `list(filters)` — admin only; supports `practitioner_id`, `organisation_id`, `is_open`
  - `open_role(actor, payload)` — opens a new role; enforces partial-unique-friendly invariants (no existing open row for same practitioner+org; demoting current primary if `is_primary=TRUE`)
  - `update(actor, role_id, payload)`
  - `close_role(actor, role_id)` — sets `period_end=now`
- [x] 5.3 Create `app/services/practitioner/deps.py` (`PractitionerServiceDep`) and `app/services/practitioner_role/deps.py` (`PractitionerRoleServiceDep`)
- [x] 5.4 Add helper `practitioner_root_orgs_for(user) -> set[UUID]` to `app/services/organisation/predicates.py` (or new file `app/services/practitioner_role/predicates.py`); returns set of org-tree roots a user can act under via open PractitionerRole rows
- [x] 5.5 Edit `app/services/patient/patient_service.py` `list_in_tenant`: caregiver visibility now ORs care-team membership with `practitioner_root_orgs_for(user)` containing root of `patient.primary_organisation_id`
- [x] 5.6 Edit `app/services/patient/deps.py` `require_patient_access`: same predicate; admin bypass kept
- [x] 5.7 Edit `app/services/care_team/care_team_service.py` to read/write `acting_as_practitioner_role_id` instead of `on_behalf_of_organisation_id`; helper to look up "practitioner role acting under" for participant create

## 6. Router

- [x] 6.1 Create `app/api/routers/practitioner/practitioner_router.py` with three endpoints (`GET /practitioners/{user_id}`, `POST /practitioners`, `PATCH /practitioners/{user_id}`)
- [x] 6.2 Create `app/api/routers/practitioner_role/practitioner_role_router.py` with four endpoints (`GET`, `POST`, `PATCH`, `DELETE`)
- [x] 6.3 Apply `require_role(Role.ADMIN)` guard with `# AUTH-HARDEN` comment on every write handler; `require_role(Role.ADMIN, Role.CAREGIVER)` on `GET` reads
- [x] 6.4 Register routers in `app/api/__init__.py`

## 7. Seed

- [x] 7.1 Create `scripts/seed_practitioners.py`: for each seeded caregiver, create one Practitioner + one open primary PractitionerRole row (idempotent by `(tenant_id, user_id)` for Practitioner and `(practitioner_id, organisation_id, period_end IS NULL)` for role)
- [x] 7.2 Wire into `scripts/seed_all.py` AFTER `seed_users.py` and BEFORE `seed_care_teams.py`
- [x] 7.3 Update `scripts/seed_care_teams.py` to populate `acting_as_practitioner_role_id` (look up the just-created primary role)

## 8. Integration tests

- [x] 8.1 `tests/api/test_practitioner_router.py`: admin creates, gets, updates Practitioner; caregiver can read own; cross-tenant rejected
- [x] 8.2 `tests/api/test_practitioner_role_router.py`: admin opens role, demotes existing primary on `is_primary=TRUE` open, closes role; non-admin write rejected
- [x] 8.3 `tests/db/test_practitioner_role_uniqueness.py`: two concurrent open roles for same (practitioner, org) rejected; repeat over closed periods OK; two `is_primary` open rows rejected
- [x] 8.4 `tests/services/test_visibility_after_split.py`: caregiver with single role sees same patients as before (regression); caregiver with two primary-eligible roles sees union of their root subtrees
- [ ] 8.5 `tests/api/test_patients_visibility_after_split.py`: regression suite against `GET /patients` results across role permutations — deferred to integration run with Docker stack
- [x] 8.6 `tests/_conformance/test_no_user_organisation_id_refs.py`: grep test asserting no code reads `user.organisation_id` (excluding migration files)
- [x] 8.7 AUTH-HARDEN markers asserted inline in each router test (`test_*_router_marks_auth_harden`)

## 9. OpenAPI + frontend client

- [x] 9.1 Regenerate OpenAPI (`moon run backend:openapi`)
- [x] 9.2 Regenerate orchestrator typed client (ran `openapi-typescript ../backend/openapi.json -o src/lib/api/schema.d.ts` — `moon run orchestrator:typegen` requires a running backend on `:18000`)
- [x] 9.3 Contract test: 7 new operations present in `openapi.json` (`create_practitioner`, `get_practitioner`, `update_practitioner`, `list_practitioner_roles`, `open_practitioner_role`, `update_practitioner_role`, `close_practitioner_role`)
- [ ] 9.4 Commit generated client diff in its own commit — deferred until user reviews

## 10. Docs, verification, follow-ups

- [x] 10.1 Update `openspec/changes/CHAIN-orchestrator-admin-ux.md`: mark `practitioner-role-split` `applied` after merge
- [x] 10.2 Update `openspec/mdr-watchlist.md`: practitioner role storage is administrative, not clinical reasoning — MDR-safe
- [x] 10.3 Open follow-up: `PractitionerRole.specialty` as open CodeableConcept — BL-061
- [x] 10.4 Open follow-up: free `PractitionerRoleCode` widening — BL-062
- [x] 10.5 Open follow-up: Cross-tenant Practitioner federation — BL-063
- [x] 10.6 Run `apps/backend` test + lint + type-check; quote results (311 passed, 0 lint, 0 type errors)
- [x] 10.7 Run `apps/orchestrator` build + type-check after client regen; typecheck clean. Build fails on local Node 20.18 vs required 20.19+ (rolldown native binding); env issue, not a code regression
- [x] 10.8 `openspec validate practitioner-role-split --strict` clean
