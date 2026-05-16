## 0. Chain prerequisite

- [ ] 0.1 Verify `practitioner-role-split` and `caregiver-shell` are archived AND `users-admin-ui` and `patient-profile-ui` are merged

## 1. PractitionerRolePicker

- [ ] 1.1 Create `apps/orchestrator/src/components/pickers/PractitionerRolePicker.tsx` — combobox over `GET /practitioner-roles?practitioner_id=…&is_open=true`; render label `Rol @ Organisatie (Primair?)`
- [ ] 1.2 Props: `practitionerId` (required), `value`, `onChange`, `disabled` when `practitionerId` not yet selected

## 2. Editor scaffold

- [ ] 2.1 Replace `<CareTeamSlot>` internals in `apps/orchestrator/src/features/patient-profile/CareTeamSlot.tsx` with `<CareTeamEditor patientId={patientId}/>`; keep the import path + prop signature
- [ ] 2.2 `<CareTeamEditor>` fetches `GET /patients/{patientId}/care-teams`
- [ ] 2.3 Renders one section per **active** team, then a collapsed `Geschiedenis` accordion containing closed teams

## 3. Per-team rendering

- [ ] 3.1 Team header: name, category badge, status badge, period column, kebab (`Bewerken`, `Sluiten`)
- [ ] 3.2 Participant list table: Naam, Rol, Acting-as (PractitionerRole label), Periode, kebab (`Rol wijzigen`, `Verwijderen`)
- [ ] 3.3 Closed participants on the same team hide under a "Toon historische deelnemers" toggle

## 4. Dialogs + confirms

- [ ] 4.1 `<CreateCareTeamDialog>` — form: name, category, optional initial participants; submit `POST /patients/{patientId}/care-teams`
- [ ] 4.2 `<AddParticipantDialog>` — form: `<UserPicker role=caregiver>` → `<PractitionerRolePicker practitionerId=…>` (default to that user's primary open role), Rol (RoleInCare); submit `POST /care-teams/{id}/participants`
- [ ] 4.3 `<ChangeRoleDialog>` — form: Rol (RoleInCare); submit `PATCH /care-teams/{id}/participants/{user_id}`
- [ ] 4.4 `<RemoveParticipantConfirm>` — destructive confirm; submit `DELETE /care-teams/{id}/participants/{user_id}`
- [ ] 4.5 Team close confirm — destructive; calls `PATCH /care-teams/{id}` with `period_end = now`

## 5. Embedded list response shape

- [ ] 5.1 Backend confirms `GET /patients/{patient_id}/care-teams` participants array carries `acting_as_practitioner_role_id` (already migrated by `practitioner-role-split`)
- [ ] 5.2 Frontend resolves role labels by joining against the typed `PractitionerRole` read from `/practitioner-roles`

## 6. i18n

- [ ] 6.1 New namespace `care-teams-ui` in `en/` and `nl/`

## 7. Tests

- [ ] 7.1 `<CareTeamEditor>` test: renders active teams + collapsed history accordion
- [ ] 7.2 `<AddParticipantDialog>` test: picker defaults to user's primary open PractitionerRole; submit includes `acting_as_practitioner_role_id`
- [ ] 7.3 `<ChangeRoleDialog>` test: produces close-and-reopen rows visible after invalidation
- [ ] 7.4 `<RemoveParticipantConfirm>` test: closes row (sets `period_end`), preserves row in history

## 8. Verification

- [ ] 8.1 Orchestrator lint / typecheck / test
- [ ] 8.2 Backend lint / typecheck / test (regression — no backend code touched, but openapi contract test must still pass)

## 9. Docs + archive

- [ ] 9.1 Update CHAIN tracker: mark `care-teams-ui` `applied`
- [ ] 9.2 `openspec validate care-teams-ui --strict` clean
- [ ] 9.3 Open follow-up: CareTeam.managingOrganization — BL-060 (re-affirm)
- [ ] 9.4 Open follow-up: realtime invalidation for care-team participants — BL-066

## 10. CHAIN CLEANUP — RUN ONLY AFTER ALL 7 SPECS ARCHIVED

- [ ] 10.1 Verify all 7 chain spec directories are under `openspec/changes/archive/` (none remain in `openspec/changes/`)
- [ ] 10.2 Delete `.claude/skills/orchestrator-admin-ux-chain/`
- [ ] 10.3 Delete `openspec/changes/CHAIN-orchestrator-admin-ux.md`
- [ ] 10.4 Commit: `chore(openspec): retire orchestrator-admin-ux chain coordinator`
