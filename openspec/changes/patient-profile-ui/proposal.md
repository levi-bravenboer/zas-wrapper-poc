**Tier**: chain — orchestrator-admin-ux #6

## Why

`patients-base` shipped `/_auth/patients/$patientId` as a placeholder ("Detailpagina komt binnenkort"). PoC feature `F5` (Patient profile / detail view) is overdue: caregivers click a patient row, expect to see who they are, what their organisation context is, and which care team currently owns them. Without a real detail page, every workflow we want to demo (assigning a care team, viewing an INSZ, editing demographics) ends in a dead end.

The care-teams editor (`#7 care-teams-ui`) embeds inside this page. Land this surface first so #7 has a host.

This change is **#6 of the orchestrator-admin-ux chain**, parallel with #3 and #4 (no dependency on either; pulls only the shared `<FilterableListPage>` + pickers from `#2`).

## What Changes

- **Add capability `patient-profile-ui`** covering:
  - Real `/_auth/patients/$patientId` page rendering `<PatientProfilePage>`.
  - Layout (using shadcn `Tabs`): `Overzicht` (demographics + identifiers + primary org), `Zorgteam` (placeholder slot filled by `care-teams-ui` later — for now a "Komt binnenkort" panel), `Geschiedenis` (read-only timeline of patient-row updates derived from audit metadata).
  - Edit demographics dialog `<EditPatientDialog>` (existing `PATCH /patients/{id}` endpoint).
  - Soft-delete kebab on the page header (mirrors list-page action).
- **No new backend endpoints** for the demographics part. Reads use existing `GET /patients/{id}` + `GET /care-teams?patient_id=…` (already exposed by `care-teams-base`).
- **Audit timeline source**: the existing `created_at` / `updated_at` / `created_by` / `updated_by` / `deleted_by` columns are enough for a minimal timeline; no audit-log table is added.
- **MODIFIES `patients-base`**: replaces the placeholder requirement in `caregiver-shell`'s patients-page spec delta with a real detail-route requirement and adds a small detail-page scenario set.
- **Regenerate typed client** if any read endpoint signature shifts (none expected; this is a UI-only change).

## Capabilities

### New Capabilities

- `patient-profile-ui`: tabbed patient detail surface, edit demographics, soft delete, embeddable care-team panel slot.

### Modified Capabilities

- `patients-base`: detail route is now real, not a placeholder; row-click destination requirement upgraded.

## Impact

- **Chain prerequisites**: `practitioner-role-split` archived, `caregiver-shell` archived. May ship in parallel with `#3 users-admin-ui` and `#4 organisations-admin-ui`.
- **Code**:
  - Frontend: `apps/orchestrator/src/routes/_auth/patients/$patientId.tsx` — replace placeholder with real route.
  - Frontend: `apps/orchestrator/src/features/patient-profile/PatientProfilePage.tsx`, `PatientDemographicsPanel.tsx`, `PatientIdentifiersPanel.tsx`, `PatientHistoryPanel.tsx`, `EditPatientDialog.tsx`.
  - Frontend: `apps/orchestrator/src/features/patient-profile/CareTeamSlot.tsx` — empty slot today, replaced by `care-teams-ui`.
  - Frontend: `i18n/<lang>/patient-profile.json`.
- **APIs**: zero new endpoints.
- **DB**: no schema changes.
- **Demo**: caregiver clicks a patient, lands on a real profile, can edit name or DOB, sees primary org context.
- **Chain position**: change #6 (parallel with #3 + #4).

## Risks and mitigations

- **R1 — care-team tab is empty until #7 ships.** Mitigation: render an explicit "Komt binnenkort — care-teams-ui" placeholder inside the tab, not a missing tab; users see the planned shape.
- **R2 — audit timeline confuses if updates aren't meaningful.** Mitigation: history panel renders three lines max (created, last edited, soft-deleted if applicable), no detailed diff. Real audit log is backlog.
- **R3 — visibility regression.** A caregiver who can see a patient in the list MUST be able to open the detail page; the existing `require_patient_access` guard already covers this. **Mitigation**: regression test that uses the visibility predicate fixtures from `patients-base`.

## Out of scope

- Care-team editing (lands in `#7`).
- Pathway viewer (separate worktree, separate chain).
- Detailed audit log timeline — backlog.
- Patient merge / unmerge — backlog.
