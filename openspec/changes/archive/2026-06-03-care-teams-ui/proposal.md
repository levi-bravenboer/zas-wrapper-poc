**Tier**: chain — orchestrator-admin-ux #7

## Why

`care-teams-base` shipped six endpoints that nothing in the orchestrator calls yet. `patient-profile-ui` (#6) reserved `<CareTeamSlot patientId>` as the seam where the editor mounts. This change replaces that placeholder with the real editor: caregivers add and remove teammates, change roles, see who is currently on the team and who used to be. It is the **last** spec in the orchestrator-admin-ux chain and carries the cleanup task that retires the chain coordinator skill and the tracker file.

This change is **#7 of the orchestrator-admin-ux chain**. Requires `practitioner-role-split` archived, `caregiver-shell` archived, `users-admin-ui` merged (user picker), `patient-profile-ui` merged (the host page).

## What Changes

- **Add capability `care-teams-ui`** covering:
  - Replace `<CareTeamSlot patientId>` body in `patient-profile-ui` with `<CareTeamEditor>` (same import path + prop signature).
  - Editor sections per active team: header (name, category, status, closed/open chip), participant list (display name, role chip, acting-as affiliation chip, period column), per-participant kebab (`Rol wijzigen`, `Verwijderen`).
  - Top-level CTA on the editor: `Nieuw zorgteam` opens `<CreateCareTeamDialog>`.
  - Add-participant inline action: `<AddParticipantDialog>` picks user (caregiver only) and `<PractitionerRolePicker>` (open roles for that user, default = `is_primary`); submits `POST /care-teams/{id}/participants` with `acting_as_practitioner_role_id`.
  - Closed-team panel under a `Geschiedenis` accordion below the active teams.
  - History accordion shows closed participants (`period_end IS NOT NULL`) below the active list.
- **No new backend endpoints**: six existing routes from `care-teams-base` cover everything (post `practitioner-role-split`'s column rename).
- **MODIFIES `care-teams-base`**: refreshes the list-endpoint requirement to embed `acting_as_practitioner_role_id` instead of `on_behalf_of_organisation_id` in the response (was already covered by `practitioner-role-split`'s migration but documented here for the UI's consumer contract).
- **Chain cleanup task**: deletes `.claude/skills/orchestrator-admin-ux-chain/` and `openspec/changes/CHAIN-orchestrator-admin-ux.md` after all seven specs are archived; commit message `chore(openspec): retire orchestrator-admin-ux chain coordinator`.

## Capabilities

### New Capabilities

- `care-teams-ui`: per-patient care-team editor + history accordion.

### Modified Capabilities

- `care-teams-base`: list response embeds `acting_as_practitioner_role_id` (renamed from `on_behalf_of_organisation_id`); no behaviour change beyond the rename.

## Impact

- **Chain prerequisites**: `practitioner-role-split` archived, `caregiver-shell` archived, `users-admin-ui` merged, `patient-profile-ui` merged.
- **Code**:
  - Frontend: replace `<CareTeamSlot>` internals.
  - Frontend: `apps/orchestrator/src/features/care-teams/CareTeamEditor.tsx`, `CreateCareTeamDialog.tsx`, `AddParticipantDialog.tsx`, `ChangeRoleDialog.tsx`, `RemoveParticipantConfirm.tsx`, `CareTeamHistoryAccordion.tsx`.
  - Frontend: `apps/orchestrator/src/components/pickers/PractitionerRolePicker.tsx` (new picker, reuses `GET /practitioner-roles?practitioner_id=…&is_open=true`).
  - Frontend: `i18n/<lang>/care-teams-ui.json`.
- **APIs**: zero new endpoints.
- **DB**: no schema changes.
- **Demo**: open Janssen's profile → add external GP as `consulting` member acting under their GP-practice role → change role to `primary` → close their participation.
- **Chain position**: final change of the chain.

## Risks and mitigations

- **R1 — acting-as picker shows roles outside the visible tenant.** `practitioner-role-split` makes cross-tenant Practitioners impossible (federation deferred). **Mitigation**: backend `GET /practitioner-roles` is tenant-scoped; the picker rides existing tenant scope.
- **R2 — change-role workflow creates two rows.** Per `care-teams-base` spec, role changes are close-and-reopen. **Mitigation**: `<ChangeRoleDialog>` submit hits `PATCH /care-teams/{id}/participants/{user_id}` (backend handles the close-and-reopen atomically); UI never issues two requests.
- **R3 — history accordion overwhelms.** Patients with many ex-members produce a long history. **Mitigation**: accordion is collapsed by default and renders rows lazily.

## Out of scope

- CareTeam.managingOrganization column — backend-side, BL-060.
- Realtime invalidation on care-team participants — relies on existing global provider; no per-component subscription added.
- Bulk team templates — backlog.

## Cleanup

The final task of this change SHALL delete `.claude/skills/orchestrator-admin-ux-chain/` and `openspec/changes/CHAIN-orchestrator-admin-ux.md` after verifying all seven chain specs are archived under `openspec/changes/archive/`. Commit: `chore(openspec): retire orchestrator-admin-ux chain coordinator`.
