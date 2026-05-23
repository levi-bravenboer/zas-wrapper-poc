## ADDED Requirements

### Requirement: Admin practitioner-roles page lists affiliations with deep-link prefill

The orchestrator SHALL render at `/_auth/admin/practitioner-roles` a `<PractitionerRoleListPage>` composing `<FilterableListPage<PractitionerRoleRead>>` + `<DataTable<PractitionerRoleRead>>`. The list SHALL ride `usePaginatedQuery('/practitioner-roles', state)`. Columns (left-to-right; first sticky):

1. **Zorgverlener** — `practitioner.display_name` (sticky, sortable by `practitioner.family_name`).
2. **Organisatie** — tree-path label (`Zas Hospital / Cardiology`).
3. **Rol** — badge from `PractitionerRoleCode`.
4. **Specialiteit** — text or em-dash.
5. **Primair** — badge `Ja | Nee`.
6. **Periode** — `dd MMM yyyy` for `period_start`, `→` when open, otherwise `period_end`.

Filters in the `<FilterableListPage>` `filters` slot SHALL include `<PractitionerPicker>`, `<OrganisationPicker>`, a `Rol` single-select, and an `Open` toggle. The page SHALL honour URL deep-link parameters `?practitioner_id=…` and `?organisation_id=…`, prefilling the corresponding picker on mount.

#### Scenario: Deep-link prefills practitioner picker

- **WHEN** the admin lands on `/_auth/admin/practitioner-roles?practitioner_id=abc`
- **THEN** the `<PractitionerPicker>` MUST be set to `abc` and the request MUST include `filter[practitioner_id][eq]=abc`

#### Scenario: Multiple filters compose into the envelope

- **WHEN** the admin sets practitioner = `P`, organisation = `O`, and `Open = true`
- **THEN** the next request MUST carry `filter[practitioner_id][eq]=P`, `filter[organisation_id][eq]=O`, and `filter[is_open][eq]=true`

### Requirement: Open-role dialog opens a new affiliation through the backend transaction

The orchestrator SHALL render `<OpenRoleDialog>` opened from the page's primary CTA `Nieuwe affiliatie`. The form fields MUST be: `<PractitionerPicker>` (required), `<OrganisationPicker>` (required), `Rol` (enum select, required), `Specialiteit` (optional text), `Primair` (checkbox, default unchecked), `Startdatum` (date input, default `now`).

On submit the dialog SHALL `POST /practitioner-roles` with the corresponding body. When the form selects `Primair = true` and an existing open primary already exists for the same practitioner, the UI MUST NOT issue a pre-demote request — the backend handles demotion inside the same transaction; on success the list query SHALL be invalidated so the demoted row's `is_primary = Ja` chip switches to `Nee` in the next render.

#### Scenario: Promoting a new primary demotes via the backend

- **WHEN** the admin opens a new role with `is_primary = true` for practitioner `P` who has an existing open primary `R1`
- **THEN** the dialog MUST send exactly one `POST /practitioner-roles` request; on success the list view MUST re-render so `R1.is_primary = Nee` and the new row's `is_primary = Ja`

#### Scenario: Duplicate open `(practitioner, organisation)` rejected

- **WHEN** the admin tries to open a second role at the same `(practitioner, organisation)` while an open one already exists
- **THEN** the dialog MUST surface a form-level error from the backend's partial-unique violation, and the dialog MUST stay open

### Requirement: Edit + close actions follow one-way close semantics

The orchestrator SHALL render row-level kebab actions:

- For open rows (`period_end IS NULL`): `Bewerken` (opens `<EditRoleDialog>`), `Beëindigen` (destructive confirm; on confirm calls `DELETE /practitioner-roles/{id}`).
- For closed rows: `Bekijken` only (read-only modal or detail; no edit, no reopen).

`<EditRoleDialog>` SHALL permit editing `Rol`, `Specialiteit`, and `Primair`. Period bounds SHALL NOT be editable through the UI; closing happens only via `Beëindigen`. Toggling `Primair = true` in the edit dialog SHALL rely on the same backend transactional demotion.

#### Scenario: Closed-row kebab hides destructive action

- **WHEN** a row with `period_end IS NOT NULL` renders
- **THEN** its kebab MUST contain `Bekijken` and MUST NOT contain `Beëindigen` or `Bewerken`

#### Scenario: Beëindigen calls DELETE then refreshes

- **WHEN** the admin confirms `Beëindigen` for an open row
- **THEN** the UI MUST issue `DELETE /practitioner-roles/{id}`; on success the list query MUST be invalidated and the row MUST now render with a `period_end` and the closed-row kebab

### Requirement: Shared pickers for users, practitioners, organisations

The orchestrator SHALL ship three pickers under `apps/orchestrator/src/components/pickers/`:

- `<UserPicker>` — combobox over `GET /users`, props `role: Role`, optional `disabledIds`, `value`, `onChange`.
- `<PractitionerPicker>` — combobox over `GET /users?has_practitioner=true`. Backend SHALL expose `has_practitioner` boolean filter on `GET /users` (additive).
- `<OrganisationPicker>` — combobox over `GET /organisations`, rendering hierarchical labels (`parent / child`); resolves the tree client-side from the flat response.

Pickers SHALL be reusable by `care-teams-ui` (#7) without modification.

#### Scenario: has_practitioner filter scopes the practitioner picker

- **WHEN** `<PractitionerPicker>` opens
- **THEN** the underlying request MUST carry `filter[has_practitioner][eq]=true` and the response MUST exclude admin users who never had a Practitioner row materialised

#### Scenario: Pickers persist selection across re-renders

- **WHEN** a parent component remounts a picker with the same `value`
- **THEN** the picker MUST display the selected entity's label without an extra fetch (uses TanStack Query cache from the original paginated list)

