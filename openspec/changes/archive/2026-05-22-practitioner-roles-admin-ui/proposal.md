**Tier**: chain — orchestrator-admin-ux #5

## Why

`practitioner-role-split` shipped the data shape + the seven admin endpoints under `/practitioners` and `/practitioner-roles`. Today an admin can only exercise those via curl. The demo story — "an external GP works at clinic A and consults at Zas Hospital under Cardiology" — needs a real UI to open, demote, and close affiliations.

This change is the last admin-only surface before `patient-profile-ui` and `care-teams-ui`. It MUST land after both `users-admin-ui` (#3) and `organisations-admin-ui` (#4) because its forms pick a user (`#3`) and an organisation (`#4`); building those pickers before the surfaces exist would force re-rolls.

## What Changes

- **Add capability `practitioner-roles-admin-ui`** covering:
  - Route `/_auth/admin/practitioner-roles` rendering an admin list of `PractitionerRole` rows, filterable by `practitioner_id`, `organisation_id`, `is_open`, `code`. Composes `<FilterableListPage<PractitionerRoleRead>>` + `<DataTable<PractitionerRoleRead>>`. URL deep-links (`?practitioner_id=…` / `?organisation_id=…`) prefill the filter so links from the user-detail page and organisation-detail sheet land scoped.
  - Open-role dialog `<OpenRoleDialog>` reachable via primary CTA `Nieuwe affiliatie`. Form: practitioner picker, organisation picker, code, specialty?, is_primary, period_start (default `now`).
  - Per-row kebab actions: `Bewerken` (edits code, specialty, is_primary), `Beëindigen` (destructive confirm; sets `period_end = now`). Closed rows show only a `Bekijken` action.
- **No new backend endpoints**: the seven shipped by `practitioner-role-split` cover everything.
- **MODIFIES `practitioner-role-split`**: documents the admin UI's specific filter/list semantics on top of the existing endpoints (additive scenarios, no behaviour change).
- **Frontend pickers are reusable**: `<UserPicker role=caregiver>` and `<OrganisationPicker>` live in a shared `apps/orchestrator/src/components/pickers/` directory so `care-teams-ui` (#7) can compose them too.

## Capabilities

### New Capabilities

- `practitioner-roles-admin-ui`: list + open/edit/close UI plus shared pickers.

### Modified Capabilities

- `practitioner-role-split`: additive UI scenarios (no spec contract changes).

## Impact

- **Chain prerequisites**: `practitioner-role-split` archived, `caregiver-shell` archived, `users-admin-ui` merged, `organisations-admin-ui` merged.
- **Code**:
  - Frontend: replace placeholder `_auth/admin/practitioner-roles.tsx`.
  - Frontend: `apps/orchestrator/src/features/practitioner-roles/PractitionerRoleListPage.tsx`, `OpenRoleDialog.tsx`, `EditRoleDialog.tsx`, `CloseRoleConfirm.tsx`.
  - Frontend (shared): `apps/orchestrator/src/components/pickers/UserPicker.tsx`, `OrganisationPicker.tsx`, `PractitionerPicker.tsx`.
  - Frontend: `i18n/<lang>/practitioner-roles-admin-ui.json`.
- **APIs**: zero new endpoints.
- **DB**: no schema changes.
- **Demo**: admin opens a `gp` role for an external user at `Zas Hospital`, marks it primary, closes a stale one.
- **Chain position**: change #5 of the chain.

## Risks and mitigations

- **R1 — primary demotion happens server-side; UI must not double-fire.** The backend's `POST /practitioner-roles` and `PATCH` with `is_primary=true` already demote within the transaction. **Mitigation**: the dialog form sends a single request; no client-side pre-demote.
- **R2 — picker performance with large user lists.** `<UserPicker>` paginates via `usePaginatedQuery('/users', state)`; defaults to `role=caregiver` filter. No autocomplete fetching > 100 results at a time.
- **R3 — closed-row edits.** Closing is one-way per spec. **Mitigation**: kebab on closed rows exposes only `Bekijken`; the backend additionally enforces.

## Out of scope

- Bulk role import — backlog.
- Per-affiliation invitations / IdP linking — backlog.
- History timeline view — backlog (might land in patient-profile-ui follow-up).
