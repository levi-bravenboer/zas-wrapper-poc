## ADDED Requirements

### Requirement: Orchestrator surfaces care-team management on the patient detail screen

The orchestrator SHALL expose care-team management for a patient under `/_auth/patients/$patientId` as the `Care team` tab of a tabbed detail shell. The tab SHALL list every care team the patient has had (active and historical), each team rendered as a panel showing `category` (if any), `period.start` / `period.end`, `status`, and its participants. Each participant row SHALL render `display_name`, `role_in_care`, `period.start`, `period.end`, and the `on_behalf_of_organisation` name resolved via the existing `GET /organisations` lookup. Active participants (rows with `period.end IS NULL`) SHALL appear above closed rows.

The UI SHALL provide mutations for:

- **Create care team** — opens a dialog collecting `category` (free text, optional) and `status` (default `active`), POSTs `/_auth/patients/$patientId/care-teams` per `care-teams-base`.
- **Add participant** — opens a dialog collecting `user_id` (typeahead against `GET /users` once that endpoint exists; PoC: free-form picker against a tenant-scoped users list), `role_in_care`, `period.start`, optional `on_behalf_of_organisation_id`. POSTs `/_auth/care-teams/{id}/participants`.
- **Change role-in-care** — PATCHes `/_auth/care-teams/{id}/participants/{user_id}`; the backend closes the current row and opens a new one per `care-teams-base`.
- **Unassign participant** — DELETEs `/_auth/care-teams/{id}/participants/{user_id}`; sets `period.end = now()`.

All mutations SHALL be react-query mutations whose `onSuccess` invalidates:

1. `['care-team', 'list', patientId]`
2. `paginatedQueryKey('/patients')` (from `add-datatable-base`).

Invalidating the patients overview key SHALL be unconditional, because adding or removing a participant changes who sees the patient under the `care-teams-base` visibility rule.

#### Scenario: Care-team tab lists active + historical teams

- **WHEN** a caregiver opens `/_auth/patients/$patientId`
- **THEN** the `Care team` tab MUST be the first tab and MUST render one panel per team returned by `GET /patients/$patientId/care-teams`, with active participants (no `period.end`) listed above closed rows

#### Scenario: Adding a participant invalidates the patients overview

- **WHEN** a caregiver opens the `Add participant` dialog, fills in `user_id` + `role_in_care` + `period.start`, and submits
- **THEN** the orchestrator MUST POST `/_auth/care-teams/{id}/participants`, and on success MUST invalidate both `['care-team', 'list', patientId]` and `paginatedQueryKey('/patients')`

#### Scenario: Changing role-in-care closes and reopens the participant row server-side

- **WHEN** a caregiver picks a new `role_in_care` for an existing participant and confirms
- **THEN** the orchestrator MUST PATCH `/_auth/care-teams/{id}/participants/{user_id}`, the response MUST contain a closed previous row plus a new open row, and the UI MUST display both (closed below, open above)

#### Scenario: Participant org affiliation falls back to user.organisation_id

- **WHEN** a participant row has `on_behalf_of_organisation_id IS NULL`
- **THEN** the participant row MUST display the participant's `user.organisation_id` name (resolved via the same `GET /organisations` lookup), italicised to indicate the fallback

### Requirement: Every clinical-entity page renders `EntityContextHeader`

The orchestrator SHALL provide a shared `EntityContextHeader` component under `src/components/layout/EntityContextHeader.tsx` that renders three slots: (1) patient identity (`family_name`, `given_name`, age), (2) active care team name + period, (3) the logged-in caregiver's `on_behalf_of_organisation` for the active care team. Every route nested under `/_auth/patients/$patientId/**` (the patient detail and every future clinical-entity sub-route) SHALL mount `EntityContextHeader` at the top of the route body.

The component SHALL accept props `{ patient, activeCareTeam, onBehalfOfOrganisation }`; it MUST NOT perform its own data fetching. Data fetching SHALL live at the route level. When the logged-in caregiver has no participant row on any active team for the patient, the `on_behalf_of_organisation` slot SHALL render an em-dash.

"Active care team" SHALL be the team whose `period.end IS NULL` with the most recent `period.start`. Tie-breaks are decided by `id` ascending. The selector logic SHALL live in `src/modules/care-team/selectors.ts` so route components stay thin.

#### Scenario: Patient detail mounts the header

- **WHEN** a caregiver opens `/_auth/patients/$patientId`
- **THEN** the route body MUST mount `<EntityContextHeader>` above the tab list, with `patient` supplied by `GET /patients/{patient_id}` and `activeCareTeam` supplied by the care-team list selector

#### Scenario: Caregiver outside the patient's care team sees no acting-on-behalf slot

- **WHEN** an admin user with no participant row on any of the patient's active teams opens the detail page
- **THEN** the `on_behalf_of_organisation` slot MUST render `"—"` and MUST NOT throw

#### Scenario: Active team selection is deterministic across reloads

- **WHEN** a patient has two open care teams `T1 (period.start = 2026-05-01)` and `T2 (period.start = 2026-05-02)`
- **THEN** `EntityContextHeader` MUST show `T2` as the active team on every reload (most recent start wins; `id` ascending tie-breaks)

### Requirement: Every future clinical-entity proposal SHALL thread care-context

This change codifies a convention every later clinical-entity change MUST honour. A clinical entity is any backend resource that is patient-scoped and clinically meaningful: encounters, observations, conditions, medications, allergies, procedures, notes, clinical reports.

Every new clinical-entity backend route SHALL accept `patient_id` from the URL path (`/patients/{patient_id}/<entity>/…`) or body, and SHALL apply the same care-team visibility rule by depending on `require_patient_access` from `care-teams-base`. A backend route that bypasses `require_patient_access` for a clinical entity is a spec violation.

Every new clinical-entity orchestrator route SHALL be nested under `/_auth/patients/$patientId/<entity>/` and SHALL mount `EntityContextHeader` as its first child.

Every new clinical-entity mutation SHALL invalidate (a) the entity's own paginated key and (b) `['care-team', 'list', patientId]` if and only if the mutation creates or closes a care-team participant row as a side effect (rare).

Every future clinical-entity proposal SHALL reference `care-context` in its `Capabilities` section, either reaffirming conformance ("no `care-context` deltas; this entity follows the convention as-is") or filing a delta with a `Reason`.

#### Scenario: New entity backend route depends on `require_patient_access`

- **WHEN** a future change proposes a `GET /patients/{patient_id}/<entity>` route
- **THEN** the route handler MUST list `require_patient_access` (or a dep that consumes it) as a FastAPI dependency, and the proposal MUST state this in its design or capabilities section

#### Scenario: New entity orchestrator route mounts `EntityContextHeader`

- **WHEN** a future change proposes a `/_auth/patients/$patientId/<entity>` route
- **THEN** the route body MUST mount `<EntityContextHeader>` as its first child, and the proposal MUST state this in its design or capabilities section

#### Scenario: Proposal omitting the reference fails review

- **WHEN** a future clinical-entity proposal's `Capabilities` section does not list `care-context`
- **THEN** the review MUST block the proposal until the section either adds a `care-context` delta or includes a "no `care-context` deltas; convention followed as-is" line
