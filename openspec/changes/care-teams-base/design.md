## Context

`patients-base` ships tenant-scope-only visibility — every caregiver in a tenant sees every patient. That works for the smallest possible demo but is wrong for any realistic hospital deployment: caregivers should only see patients on their team. `organisations-base` introduced the org tree and removed `external` from `Role`, but did not model team membership. This change closes the loop.

FHIR R4's modelling is the target: `CareTeam` (longitudinal team caring for a patient/condition) holds `participant[]` rows with `member` (Practitioner ref), `role` (CodeableConcept), `period.start/end`, `onBehalfOf` (Organization ref). HiX exports its `Behandelteam` this way. The decision to flatten or fully normalise (`care_teams` + `care_team_participants`) was settled in the chain-design discussion: flatten loses fidelity exactly where MVP needs it (multi-team-per-patient, period overlaps), so the FHIR-exact two-table shape ships now.

## Goals / Non-Goals

**Goals:**
- Two-table model matching FHIR `CareTeam` and `CareTeam.participant`.
- Period-bounded participant rows so handovers, switches, leave-and-rejoin produce auditable history without delete-recreate.
- `onBehalfOf` organisation column so the "internal vs external on this team" question is answered by data (not by user.role).
- Visibility filter: `GET /patients` for `caregiver` returns only patients where the caregiver has an open participant row in any active care team, OR (PoC fallback) patients in the caregiver's organisation subtree. `admin` continues to see all in tenant.
- Trip wires on common mistakes: tests assert tenant isolation, partial unique constraints, audit trail preservation.

**Non-Goals:**
- No `Encounter` (per-visit participants) or `EpisodeOfCare` (care episode wrapping CareTeam). Bundled into future clinical-data changes.
- No `PractitionerRole` M:N for users. `users.organisation_id` FK from `organisations-base` is still single-org-per-user. PractitionerRole is additive future.
- No FHIR `CareTeam` wire-format serialisation. API speaks our own typed DTOs; FHIR is the shape contract.
- No cross-tenant teams. Both the team and every participant user MUST share the patient's tenant. (External-caregiver federation across tenants is MVP+.)
- No org-policy engine. Per-org rules / permissions are a future capability; this change exposes the data they will key off.
- No `CareTeam.managingOrganization` field — `on_behalf_of_organisation_id` on each participant covers per-participant affiliation, which is enough for the visibility filter. Top-level team-managing-org column can be added additively if MVP demands it.

## Decisions

### D1. Two tables: `care_teams` + `care_team_participants`

`care_teams (id, tenant_id, patient_id, name nullable, status enum, period_start, period_end nullable, category text nullable, audit cols)`. One row per logical team. Patient can have many — different conditions, different episodes.

`care_team_participants (id, tenant_id [denorm], care_team_id, user_id, role_in_care enum, period_start, period_end nullable, on_behalf_of_organisation_id FK organisations nullable, assigned_by FK users, unassigned_by FK users nullable, audit cols)`. Periods are right-open (NULL `period_end` = currently active).

- **Why two tables**: FHIR-exact. One-team-per-patient assumption (flat-table alternative) breaks the moment a multi-condition patient appears — common in geriatrics, oncology, complex orthopedics.
- **Why `tenant_id` denormalised on participants**: primary access pattern is `WHERE user_id = :me AND period_end IS NULL` to compute "patients I see today". One-hop tenant filter on that path beats a two-table join. Consistency enforced in service layer (writes go through the service that asserts patient.tenant == participant.tenant).

### D2. Period semantics

- `period_start` NOT NULL (defaults to `now()` on insert).
- `period_end` nullable. NULL = currently active. Setting `period_end` = "this assignment ended at this timestamp".
- Same `(care_team_id, user_id)` pair can have multiple rows over time; partial unique `(care_team_id, user_id) WHERE period_end IS NULL` prevents two concurrent open rows for the same practitioner on the same team.
- Role changes are closed+reopen: PATCH on `role_in_care` sets the existing row's `period_end = now()`, opens a new row with the new role. Preserves history.

### D3. `RoleInCare` enum

`primary | consulting | observer`. FHIR `CareTeam.participant.role` is CodeableConcept (free); we constrain to a closed set for PoC. Future change can widen to a coded value set with a `code_system` column. Mappings to standard FHIR participant-role codes documented in the seed file's header.

### D4. Externality is data, not role

Per-participant `on_behalf_of_organisation_id` references `organisations`. Rules:
- NULL means "implicitly on behalf of the patient's primary-organisation root ancestor" (i.e. internal to the patient's hospital).
- A value pointing to a DIFFERENT root ancestor's subtree means "external participant" (consulting from another org under same tenant).
- The `is_external_for(user, patient)` predicate introduced in `organisations-base` reads this column when present, otherwise falls back to user's `organisation_id`. The predicate's primary use is UI labelling and audit; visibility filtering uses care-team membership directly, not the predicate.

### D5. Visibility filter rewrite of `GET /patients`

`patients-base` ships tenant-only. This change MODIFIES that behaviour:

- `admin` user: unchanged, sees all patients in tenant.
- `caregiver` user: sees a patient ONLY when they have at least one open `care_team_participants` row on an active `care_teams` row for that patient.

No org-tree fallback. No feature flag. Patient without any care team is invisible to caregivers — admin (or future pathway runtime) must explicitly create team + assign participants. Patient.primary_organisation_id is the row's ownership/filing record, not a visibility input.

The same predicate powers `require_patient_access(patient_id)` for `GET /patients/{id}`, `PATCH`, `DELETE`, `POST /patients/{patient_id}/care-teams`. Admin always passes.

Why no fallback: PoC has no HiX import; new patients always created through our API which calls care-team API separately (or pathway builder, future). Demo always has explicit participant rows. Fallback would be dead code masking real visibility holes.

### D6. API surface

- `GET /patients/{patient_id}/care-teams` — list teams (current + historical) for a patient. Embeds participants with their periods.
- `POST /patients/{patient_id}/care-teams` — create a new team for the patient. Body: `name?`, `category?`, initial participants?
- `PATCH /care-teams/{id}` — change `name`, `category`, `status`, `period_end` (close team). No re-parenting; patient FK immutable.
- `POST /care-teams/{id}/participants` — assign a user. Body: `user_id`, `role_in_care`, `on_behalf_of_organisation_id?`, `period_start?` (defaults `now()`).
- `PATCH /care-teams/{id}/participants/{user_id}` — change `role_in_care` (close + reopen pattern, NOT a row update).
- `DELETE /care-teams/{id}/participants/{user_id}` — unassign (sets `period_end = now()` on the open row; row is NOT deleted).

All routes scoped by `require_role(Role.ADMIN, Role.CAREGIVER)` + `require_patient_access(patient_id)`. `# AUTH-HARDEN` comments on every guarded handler.

### D7. Seed extension

`scripts/seed_care_teams.py`:
- For each seeded patient (~10), create one `care_teams` row (`status=active`, `period_start=now()`, no `period_end`, `name="Rugrevalidatie team"`).
- Insert one `care_team_participants` row per team: `user_id` = seeded caregiver, `role_in_care=primary`, `period_start=now()`, `period_end=NULL`, `on_behalf_of_organisation_id` = caregiver's `organisation_id`.
- Idempotent: re-run with deterministic external refs / lookups; no duplicate teams or participants.

### D8. Audit and history queries

- "Who cared for patient P over time?" → `SELECT * FROM care_team_participants WHERE care_team_id IN (SELECT id FROM care_teams WHERE patient_id = ?) ORDER BY period_start`
- "Patients I see today" → `SELECT DISTINCT patient_id FROM care_teams WHERE id IN (SELECT care_team_id FROM care_team_participants WHERE user_id = :me AND period_end IS NULL) AND status = 'active'`
- "Was Dr X on this patient's team in March?" → period-overlap query on `participants`.

Indices: `(user_id, period_end)` partial WHERE period_end IS NULL (covers "my patients today"); `(care_team_id, period_end)` partial (covers "current team for this patient"); `(patient_id, status)` on `care_teams` (covers patient-scoped lookups).

## Risks / Trade-offs

- **[Risk] Visibility filter becomes a 3-table join + recursive org subtree CTE — query performance.** → Mitigation: indices above + `EXPLAIN ANALYZE` on the list query at PoC scale before merge. Closure table for org descendants is the next optimisation if needed.
- ~~**[Risk] PoC fallback (org-subtree visibility) becomes load-bearing and never gets removed.**~~ Resolved by dropping fallback entirely (see D5).
- **[Risk] Role-in-care change via close+reopen produces row pairs that are easy to misinterpret as duplicates.** → Mitigation: list endpoint sorts and groups per `(care_team_id, user_id)` showing periods explicitly; tests assert ordering and history reconstruction.
- **[Trade-off] No `managingOrganization` column on `care_teams` row.** Per-participant `on_behalf_of_organisation_id` covers all current use cases. If MVP wants the FHIR `CareTeam.managingOrganization` field, add it additively.
- **[Trade-off] Closed `RoleInCare` enum.** Constrains real-world hospital roles (which can be specialty-specific). Widening to a free codeable concept is an additive future change.

## Migration Plan

1. Land Alembic revision: create `role_in_care` enum, create `care_teams` table, create `care_team_participants` table + indexes.
2. Land service + router + visibility filter changes; modify `patients-base` `GET /patients` filter behaviour.
3. Run `seed_care_teams.py` after `seed_patients.py`.
4. Regenerate OpenAPI; regen orchestrator client.
5. Downgrade: drop both tables + enum in correct order; `GET /patients` filter logic reverts to tenant-only (managed in code; Alembic doesn't touch handler logic).

## Open Questions

- ~~**OQ1**: `care_teams.status='inactive'` semantics.~~ Resolved: **status gates visibility**. Inactive team hides its patients from caregivers immediately, regardless of open participant rows. FHIR-aligned (`CareTeam.status='active'` = "currently in use"). Admin emergency off-switch is single flag flip. Read-only post-discharge belongs in future `Encounter` resource, not in CareTeam.
- **OQ2**: Multi-team patient visibility — if patient has 2 teams and caregiver is on team A only, do they see the patient? Yes. Patient visibility unions across teams. Locked.
- ~~**OQ3**: PoC fallback policy.~~ Resolved: no fallback. Visibility = open participant row only.
