## ADDED Requirements

### Requirement: CareTeamEditor replaces the CareTeamSlot placeholder

The orchestrator SHALL ship `<CareTeamEditor patientId>` at `apps/orchestrator/src/features/care-teams/CareTeamEditor.tsx`. The `<CareTeamSlot>` component (the seam reserved by `patient-profile-ui`) SHALL retain its file path and prop signature but its body SHALL delegate to `<CareTeamEditor>`. The editor SHALL fetch `GET /patients/{patientId}/care-teams` and render:

1. Zero or more **active team sections** (one per team whose `period_end IS NULL`). Each section has a header (name, category badge, status badge, period column, kebab `Bewerken | Sluiten`) and a participant table.
2. A collapsed-by-default `Geschiedenis` accordion containing closed teams (`period_end IS NOT NULL`).
3. A top-level primary CTA `Nieuw zorgteam` opening `<CreateCareTeamDialog>`.

#### Scenario: Slot seam preserved

- **WHEN** `<PatientProfilePage>` renders the `Zorgteam` tab post-`care-teams-ui`
- **THEN** the import path `apps/orchestrator/src/features/patient-profile/CareTeamSlot.tsx` and prop signature `{ patientId: string }` MUST be unchanged, and the rendered subtree MUST be the real `<CareTeamEditor>` (no "Komt binnenkort" placeholder copy remains)

#### Scenario: Patient with no teams shows empty state + CTA

- **WHEN** a patient has zero care teams
- **THEN** the editor renders the primary CTA `Nieuw zorgteam` and copy `"Nog geen zorgteam voor deze patiënt."`; no active or history sections render

### Requirement: Participant rows surface acting-as PractitionerRole

The participant table within each active team section SHALL render columns: `Naam` (from `User.display_name`), `Rol` (badge from `RoleInCare`), `Acting-as` (label resolved from `acting_as_practitioner_role_id` → `PractitionerRole.code @ Organisation.name`; em-dash when NULL), `Periode` (`period_start` → `period_end` or `→`), kebab. Closed participants on the same active team SHALL hide behind a "Toon historische deelnemers" toggle within the section.

#### Scenario: Acting-as renders with role label

- **WHEN** a participant row has `acting_as_practitioner_role_id` set
- **THEN** the Acting-as column MUST render a chip with text matching `PractitionerRole.code @ Organisation.name` (resolved by joining against `/practitioner-roles` typed client cache)

#### Scenario: Acting-as renders em-dash when unset

- **WHEN** a participant row has `acting_as_practitioner_role_id = NULL` (legacy backfill fallback)
- **THEN** the Acting-as column MUST render `—`

#### Scenario: Historical participants hidden by default

- **WHEN** an active team has both open and closed participants
- **THEN** the participant table MUST render only open participants by default; the closed ones MUST be reachable via "Toon historische deelnemers" toggle

### Requirement: Add-participant dialog picks user then their PractitionerRole

The orchestrator SHALL render `<AddParticipantDialog>` opened from the team header. The form SHALL contain in order: `<UserPicker role=caregiver>` (required), `<PractitionerRolePicker practitionerId=…>` (required once a user is picked; default = that user's primary open role), `Rol` (RoleInCare enum, default `consulting`). Submit calls `POST /care-teams/{id}/participants` with body `{ user_id, role_in_care, acting_as_practitioner_role_id }`. On success, the team's participant list MUST refresh (via TanStack Query invalidation).

#### Scenario: Default acting-as is the user's primary open role

- **WHEN** the user picker selects practitioner `P` who has open roles `R1 (primary)`, `R2 (other)`
- **THEN** the `<PractitionerRolePicker>` MUST be set to `R1.id` by default; submitting without changing it MUST POST `acting_as_practitioner_role_id = R1.id`

#### Scenario: Picker disabled until user selected

- **WHEN** no user is selected
- **THEN** the `<PractitionerRolePicker>` MUST be visibly disabled and SHALL NOT issue any network request

#### Scenario: User with no open PractitionerRole still acceptable

- **WHEN** the picked user has zero open `PractitionerRole` rows
- **THEN** the dialog MUST allow submitting with `acting_as_practitioner_role_id = null` and the backend MUST accept it (NULL is permitted per `practitioner-role-split` migration)

### Requirement: Role-change dialog produces close-and-reopen rows server-side

The orchestrator SHALL render `<ChangeRoleDialog>` opened from a participant row's kebab. The form SHALL contain one field: `Rol` (RoleInCare enum). Submit calls `PATCH /care-teams/{id}/participants/{user_id}` with `{ role_in_care }`. The backend SHALL execute the close-and-reopen transaction; the UI MUST NOT issue two requests. After invalidation, the participant table MUST show the old open row as closed and the new open row with the new role.

#### Scenario: Role change yields a closed + open pair after invalidation

- **WHEN** the admin changes role from `primary` to `consulting` for participant `P` on team `T`
- **THEN** the next render MUST display two rows for `P` on `T` (one closed `primary`, one open `consulting`), with the closed row visible only under the "Toon historische deelnemers" toggle

#### Scenario: No double-fire on close-and-reopen

- **WHEN** the dialog submits the role change
- **THEN** exactly one network request MUST be issued (`PATCH /care-teams/{id}/participants/{user_id}`); no preceding `DELETE` or `POST` MUST occur

### Requirement: Remove and team-close confirms use destructive UX

The orchestrator SHALL render `<RemoveParticipantConfirm>` (destructive) for participant-row kebab → `Verwijderen`. Submit calls `DELETE /care-teams/{id}/participants/{user_id}`; on success the row's `period_end` populates and the row drops under "Toon historische deelnemers". A team header kebab → `Sluiten` SHALL open a destructive confirm that calls `PATCH /care-teams/{id}` with `{ period_end: now }`; on success the entire team section moves under the `Geschiedenis` accordion.

#### Scenario: Removed participant moves to history

- **WHEN** the admin confirms `Verwijderen` for an open participant
- **THEN** after invalidation, the row MUST disappear from the open list and reappear under "Toon historische deelnemers" with `period_end` set

#### Scenario: Closed team relocates to Geschiedenis accordion

- **WHEN** the admin confirms `Sluiten` on an active team
- **THEN** after invalidation, the team section MUST be rendered inside the `Geschiedenis` accordion, not the active list
