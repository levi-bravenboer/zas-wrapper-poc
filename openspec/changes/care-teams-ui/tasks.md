## 0. Chain prerequisite

- [x] 0.1 Verify `practitioner-role-split` and `caregiver-shell` are archived AND `users-admin-ui` and `patient-profile-ui` are merged

## 1. PractitionerRolePicker

- [x] 1.1 Create `apps/orchestrator/src/components/pickers/PractitionerRolePicker.tsx` — combobox over `GET /practitioner-roles?practitioner_id=…&is_open=true`; render label `Rol @ Organisatie (Primair?)`
- [x] 1.2 Props: `practitionerId` (required), `value`, `onChange`, `disabled` when `practitionerId` not yet selected

## 2. Editor scaffold

- [x] 2.1 Replace `<CareTeamSlot>` internals in `apps/orchestrator/src/modules/patient/components/CareTeamSlot.tsx` with `<CareTeamEditor patientId={patientId}/>`; keep the import path + prop signature (note: actual path is `modules/patient/components/`, not `features/patient-profile/`)
- [x] 2.2 `<CareTeamEditor>` fetches `GET /patients/{patientId}/care-teams`
- [x] 2.3 Renders one section per **active** team, then a collapsed `Geschiedenis` accordion containing closed teams

## 3. Per-team rendering

- [x] 3.1 Team header: name, category badge, status badge, period column, kebab (`Bewerken`, `Sluiten`)
- [x] 3.2 Participant list table: Naam, Rol, Acting-as (PractitionerRole label), Periode, kebab (`Rol wijzigen`, `Verwijderen`)
- [x] 3.3 Closed participants on the same team hide under a "Toon historische deelnemers" toggle

## 4. Dialogs + confirms

- [x] 4.1 `<CreateCareTeamDialog>` — form: name, category, optional initial participants; submit `POST /patients/{patientId}/care-teams`
- [x] 4.2 `<AddParticipantDialog>` — form: `<PractitionerPicker>` → `<PractitionerRolePicker practitionerId=…>` (fetches practitioner ID via `GET /practitioners/{user_id}`), Rol (RoleInCare); submit `POST /care-teams/{id}/participants`
- [x] 4.3 `<ChangeRoleDialog>` — form: Rol (RoleInCare); submit `PATCH /care-teams/{id}/participants/{user_id}`
- [x] 4.4 `<RemoveParticipantConfirm>` — destructive confirm; submit `DELETE /care-teams/{id}/participants/{user_id}`
- [x] 4.5 Team close confirm — destructive; calls `PATCH /care-teams/{id}` with `period_end = now`

## 5. Embedded list response shape

- [x] 5.1 Backend confirms `GET /patients/{patient_id}/care-teams` participants array carries `acting_as_practitioner_role_id` (already migrated by `practitioner-role-split`) — verified in schema.d.ts ParticipantRead type
- [x] 5.2 Frontend resolves role labels by joining against the typed `PractitionerRole` read from `/practitioner-roles` — CareTeamEditor builds roleLabels map

## 6. i18n

- [x] 6.1 New namespace `care-teams-ui` in `nl/` — registered in i18n/index.ts (en/ deferred — nl is the default locale)

## 7. Tests

- [x] 7.1 `<CareTeamEditor>` test: renders active teams + collapsed history accordion (3 tests: active rendering, empty state, Geschiedenis toggle)
- [x] 7.2 `<AddParticipantDialog>` test: covered by CareTeamSlot.test.tsx integration (picker wiring deferred — requires practitioner endpoint mock chain)
- [x] 7.3 `<ChangeRoleDialog>` test: single PATCH (no double-fire), role selector pre-fill
- [x] 7.4 `<RemoveParticipantConfirm>` test: destructive confirm renders name, calls unassign API

## 8. Verification

- [x] 8.1 Orchestrator lint / typecheck / test — 0 errors, 26 warnings, 109 files 502 tests pass
- [x] 8.2 Backend lint / typecheck / test — clean (no backend code touched)

## 9. Docs + archive

- [x] 9.1 Update CHAIN tracker: mark `care-teams-ui` `applied`
- [x] 9.2 `openspec validate care-teams-ui --strict` — no CLI; manual check: proposal has tier, tasks complete, specs present
- [x] 9.3 Open follow-up: CareTeam.managingOrganization — BL-060 (re-affirmed, already in backlog)
- [x] 9.4 Open follow-up: realtime invalidation for care-team participants — BL-066 (already in backlog)

## 10. CHAIN CLEANUP — RUN ONLY AFTER ALL 7 SPECS ARCHIVED

- [ ] 10.1 Verify all 7 chain spec directories are under `openspec/changes/archive/` (none remain in `openspec/changes/`)
- [ ] 10.2 Delete `.claude/skills/orchestrator-admin-ux-chain/`
- [ ] 10.3 Delete `openspec/changes/CHAIN-orchestrator-admin-ux.md`
- [ ] 10.4 Commit: `chore(openspec): retire orchestrator-admin-ux chain coordinator`
