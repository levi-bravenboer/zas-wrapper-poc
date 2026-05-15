## 0. Chain prerequisite

- [x] 0.1 Verify `organisations-base` AND `patients-base` are applied to the branch this implementation rebases onto; bail if not (see `openspec/changes/CHAIN.md`)

## 1. Enums

- [x] 1.1 Create `app/core/enums/care_team.py` with `RoleInCare` (`primary | consulting | observer`) and `CareTeamStatus` (`active | inactive`); re-export from `app/core/enums/__init__.py`

## 2. ORM models

- [x] 2.1 Create `app/models/care_team.py` (`CareTeam(TenantOwnedEntity)`) with `patient_id` FK (RESTRICT), `name`, `status`, `period_start`, `period_end`, `category`
- [x] 2.2 Create `app/models/care_team_participant.py` (`CareTeamParticipant`) with denormalised `tenant_id`, FK `care_team_id` (CASCADE), FK `user_id` (RESTRICT), `role_in_care`, `period_start`, `period_end`, `on_behalf_of_organisation_id` (FK organisations, nullable, RESTRICT), `assigned_by`, `unassigned_by`
- [x] 2.3 Add `CareTeam.participants` relationship with `selectinload`; cascade `all, delete-orphan` matches DB CASCADE
- [x] 2.4 Register both models in metadata import root

## 3. Migration

- [x] 3.1 Generate Alembic revision creating `role_in_care` + `care_team_status` Postgres enum types
- [x] 3.2 Create `care_teams` table with all columns + FK + indexes
- [x] 3.3 Create `care_team_participants` table + FKs + indexes:
  - partial unique `(care_team_id, user_id) WHERE period_end IS NULL`
  - `(user_id, period_end)` partial WHERE period_end IS NULL
  - `(care_team_id, period_end)` partial WHERE period_end IS NULL
- [x] 3.4 Verify downgrade drops tables, indexes, enum types in correct order
- [ ] 3.5 Migration test: fresh DB → head → expected DDL present

## 4. Pydantic schemas

- [x] 4.1 Create `app/schemas/care_team/care_team.py`: `CareTeamRead` (with embedded participants), `CareTeamCreate` (`name?`, `category?`, `participants?: list[ParticipantCreate]`), `CareTeamUpdate` (`name?`, `category?`, `status?`, `period_end?`)
- [x] 4.2 Create `app/schemas/care_team/participant.py`: `ParticipantRead`, `ParticipantCreate` (`user_id`, `role_in_care`, `on_behalf_of_organisation_id?`), `ParticipantRoleChange` (just `role_in_care`)
- [x] 4.3 Unit tests: schema validation, enum round-trip

## 5. Service layer

- [x] 5.1 Create `app/services/care_team/__init__.py` and `care_team_service.py` (`CareTeamService`)
- [x] 5.2 Implement `list_for_patient(actor, patient_id)` — current + historical teams with participants
- [x] 5.3 Implement `create_for_patient(actor, patient_id, payload)` — tenant + patient + participant tenant checks
- [x] 5.4 Implement `update(actor, care_team_id, payload)`
- [x] 5.5 Implement `add_participant(actor, care_team_id, payload)` — enforces partial unique by checking open row
- [x] 5.6 Implement `change_participant_role(actor, care_team_id, user_id, new_role)` — close current open row + open new row in one transaction
- [x] 5.7 Implement `unassign_participant(actor, care_team_id, user_id)` — sets `period_end`, `unassigned_by`
- [x] 5.8 Implement `visible_patient_ids_for(user)` — returns set of patient ids the user can see via open participant rows (used by `patients-base` filter)
- [x] 5.9 Implement `has_open_membership(user_id, patient_id)` predicate — used by `require_patient_access`
- [x] 5.10 Create `app/services/care_team/deps.py` with `CareTeamServiceDep`

## 6. Patients-base visibility rewrite (MODIFIES patients-base)

- [x] 6.1 Edit `app/services/patient/patient_service.py` `list_in_tenant`: when actor is caregiver, restrict to `CareTeamService.visible_patient_ids_for(user)` only — no org-subtree fallback
- [x] 6.2 Edit `app/services/patient/deps.py` `require_patient_access`: same predicate; admin bypass kept
- [x] 6.3 Update existing patients-base tests for new caregiver visibility semantics (admin tests unchanged)
- [x] 6.4 Assert no `care_team_strict_visibility` setting and no org-subtree fallback branch in code (predicate is participant-row-only)

## 7. Router

- [x] 7.1 Create `app/api/routers/care_team/__init__.py` and `care_team_router.py`
- [x] 7.2 Implement `GET /patients/{patient_id}/care-teams` (`operation_id="list_patient_care_teams"`) with `require_patient_access`
- [x] 7.3 Implement `POST /patients/{patient_id}/care-teams` (`operation_id="create_care_team"`) 201
- [x] 7.4 Implement `PATCH /care-teams/{id}` (`operation_id="update_care_team"`)
- [x] 7.5 Implement `POST /care-teams/{id}/participants` (`operation_id="add_care_team_participant"`) 201
- [x] 7.6 Implement `PATCH /care-teams/{id}/participants/{user_id}` (`operation_id="change_participant_role"`)
- [x] 7.7 Implement `DELETE /care-teams/{id}/participants/{user_id}` (`operation_id="unassign_care_team_participant"`) 204
- [x] 7.8 Apply `require_role(Role.ADMIN, Role.CAREGIVER)` guard with `# AUTH-HARDEN` comment on every handler
- [x] 7.9 Register in `app/api/__init__.py`

## 8. Seed

- [x] 8.1 Create `scripts/seed_care_teams.py` — for each seeded patient, create one active CareTeam + one open participant (caregiver as primary)
- [x] 8.2 Idempotent: lookup before insert via `(patient_id, status='active')` for team and `(care_team_id, user_id, period_end IS NULL)` for participant
- [x] 8.3 Wire into `scripts/seed_all.py` AFTER `seed_patients.py`

## 9. Integration tests

- [x] 9.1 `tests/api/test_care_teams_list.py`: returns teams + embedded participants; cross-tenant patient → 404; caregiver outside team → 404
- [x] 9.2 `tests/api/test_care_teams_create.py`: caregiver creates team with self as participant; admin creates team for any patient in tenant
- [x] 9.3 `tests/api/test_care_teams_participants.py`: assign, change role (asserts two rows after PATCH), unassign (asserts period_end set, row preserved)
- [x] 9.4 `tests/api/test_care_teams_authz.py`: cross-tenant user assignment rejected; non-admin cannot bypass `require_patient_access`
- [x] 9.5 `tests/db/test_care_team_participant_uniqueness.py`: two concurrent open rows for same (team, user) rejected; repeat over closed periods OK
- [x] 9.6 `tests/db/test_care_team_history.py`: close+reopen produces exactly two rows with correct period sequence
- [x] 9.7 `tests/api/test_patients_visibility.py`: admin sees all; caregiver sees only patients with open participant row; caregiver does NOT see patient absent membership even if same org subtree; patient with zero care teams invisible to caregivers
- [x] 9.8 `tests/services/test_visibility_predicate.py`: `visible_patient_ids_for` returns expected sets across combinations
- [x] 9.9 `tests/source/test_auth_harden_markers.py`: extend existing test to also cover `care_team_router.py`

## 10. OpenAPI + frontend client

- [ ] 10.1 Regenerate OpenAPI schema export
- [ ] 10.2 Regenerate orchestrator typed client (`pnpm typegen`)
- [ ] 10.3 Contract test: 6 care-team routes present with expected request/response shapes
- [ ] 10.4 Commit generated client diff in its own commit

## 11. Docs, verification, follow-ups

- [ ] 11.1 Update `openspec/changes/CHAIN.md`: mark `care-teams-base` ready-to-apply when prerequisites are applied
- [ ] 11.2 Update `openspec/mdr-watchlist.md`: care-team membership is administrative, not clinical reasoning — MDR-safe
- [ ] 11.3 Open follow-up: pathway builder + runtime (assigns patients to orgs/teams automatically)
- [ ] 11.4 Open follow-up: `Encounter.participant` per-visit modelling (future clinical-data change)
- [ ] 11.5 Open follow-up: `EpisodeOfCare` wrapping CareTeam (future)
- [ ] 11.6 Open follow-up: free codeable concept for `role_in_care` (additive enum widening)
- [ ] 11.7 Open follow-up: `CareTeam.managingOrganization` column if MVP demands it
- [ ] 11.8 Run `apps/backend` test + lint + type-check; quote results
- [ ] 11.9 Run `apps/orchestrator` build + type-check after client regen; quote results
- [ ] 11.10 `openspec validate care-teams-base --strict` clean
