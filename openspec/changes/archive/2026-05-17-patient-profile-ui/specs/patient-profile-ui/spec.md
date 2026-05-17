## ADDED Requirements

### Requirement: Patient detail route renders tabbed profile

The orchestrator SHALL render at `/_auth/patients/$patientId` a `<PatientProfilePage>` containing a sticky header (patient name, INSZ pill, date of birth, primary organisation chip, kebab) and a shadcn `Tabs` component with exactly three tabs in this order:

1. `Overzicht` — demographics panel + identifiers panel.
2. `Zorgteam` — `<CareTeamSlot>` placeholder until `care-teams-ui` ships; today it renders a short list of current care teams plus "Komt binnenkort — wordt geleverd door care-teams-ui" copy.
3. `Geschiedenis` — read-only audit summary (created / updated / soft-deleted timestamps and actor display names).

The route SHALL be guarded by the existing `Role.ADMIN | Role.CAREGIVER` requirement and SHALL honour the `require_patient_access` predicate established by `patients-base` + `practitioner-role-split`. A caregiver outside the visibility predicate hitting this route SHALL receive a `404 Not Found` from the backend `GET /patients/{id}` call, surfaced as a "Patiënt niet gevonden" empty-state in the page.

#### Scenario: Tabs render in order

- **WHEN** a caregiver loads `/_auth/patients/<their-patient-id>`
- **THEN** the page MUST render exactly three tab triggers labelled `Overzicht`, `Zorgteam`, `Geschiedenis` in that order

#### Scenario: Outside-visibility caregiver sees not-found

- **WHEN** a caregiver loads the detail route for a patient they cannot see (no care-team membership AND no PractitionerRole root overlap)
- **THEN** the page MUST render a "Patiënt niet gevonden" empty-state and MUST NOT render the tabs or sticky header

#### Scenario: Sticky header populates from the GET /patients/{id} response

- **WHEN** the page mounts
- **THEN** the sticky header MUST render `family_name, given_name`, the INSZ identifier value (if any), `birth_date`, and the resolved primary organisation name from the `GET /organisations` cache

### Requirement: Demographics + identifiers panel surfaces FHIR-shaped fields

The `Overzicht` tab SHALL render `<PatientDemographicsPanel>` showing `Naam`, `Geboortedatum`, `Geslacht`, `Primaire organisatie` (organisation tree-path) and `<PatientIdentifiersPanel>` showing a list of `{system, value, use}` rows. The INSZ identifier SHALL be pinned to the top of the identifier list and styled as a pill; other identifiers render below in insertion order. When zero identifiers exist (rare; seeds always create INSZ), the panel SHALL render copy `"Geen identificatoren"` and MUST NOT render an empty list.

#### Scenario: INSZ pinned and styled

- **WHEN** a patient has at least one identifier with `system === INSZ_SYSTEM`
- **THEN** the `<PatientIdentifiersPanel>` MUST render that identifier first, with the pill styling used on the list page

#### Scenario: Demographics organisation chip uses tree-path label

- **WHEN** the primary organisation is `Cardiology` under `Zas Hospital`
- **THEN** the organisation chip MUST render `"Zas Hospital / Cardiology"` (or the locale-appropriate separator)

### Requirement: Edit demographics dialog uses existing PATCH endpoint

The page kebab SHALL expose `Bewerken` opening `<EditPatientDialog>` whose form fields are `family_name`, `given_name`, `birth_date`, `gender`. Submit SHALL call `PATCH /patients/{id}` and on success invalidate the `[patients, id]` and `[patients, list]` TanStack Query keys. Identifier mutation is OUT of scope — the dialog MUST NOT expose identifier fields (existing `patients-base` backend rejects identifier mutation with 422).

#### Scenario: Successful edit reflects in sticky header and list

- **WHEN** the admin edits `family_name` from "Jansens" to "Janssen" and submits
- **THEN** the dialog MUST close, the sticky header MUST render "Janssen, …" immediately (cache invalidation), and a subsequent visit to `/_auth/patients` MUST list the updated name

#### Scenario: Identifier fields not present

- **WHEN** the dialog renders
- **THEN** no form input MUST be named `identifiers`, `insz`, `system`, or `value`

### Requirement: History tab summarises audit metadata in three lines max

The `Geschiedenis` tab SHALL render `<PatientHistoryPanel>` producing up to three lines from existing audit columns:

1. `Aangemaakt op {created_at} door {created_by.display_name}` — always rendered.
2. `Laatst bewerkt op {updated_at} door {updated_by.display_name}` — rendered when `updated_at !== created_at`.
3. `Soft-deleted op {deleted_at} door {deleted_by.display_name}` — rendered when `deleted_at IS NOT NULL` (page would otherwise be a 404; only reachable if admin restores in future).

User display-name resolution SHALL use the existing `GET /users` cache; failed resolutions SHALL render an em-dash for the actor name, never throw.

#### Scenario: Two lines when row was never edited

- **WHEN** the patient was just created and not yet edited
- **THEN** the `<PatientHistoryPanel>` MUST render the `Aangemaakt` line only (the `Laatst bewerkt` line is omitted)

#### Scenario: Failed user lookup falls back to em-dash

- **WHEN** the `created_by` user no longer exists in the `GET /users` cache (deleted) and the lookup returns nothing
- **THEN** the line MUST render `Aangemaakt op {created_at} door —` (em-dash) and MUST NOT throw

### Requirement: Soft-delete kebab matches list-page behaviour

The page kebab SHALL expose `Verwijderen` (destructive confirm). On confirm the page SHALL call `DELETE /patients/{id}`, navigate back to `/_auth/patients`, and rely on the global `RealtimeInvalidationProvider` (or explicit invalidation) to remove the row from the list cache. Behaviour MUST mirror the existing list-page kebab action documented in `patients-base`.

#### Scenario: Successful delete returns to list

- **WHEN** the admin confirms `Verwijderen` on the detail page
- **THEN** the UI MUST issue `DELETE /patients/{id}` and on success navigate to `/_auth/patients`; the soft-deleted row MUST NOT appear in the subsequent list response

### Requirement: CareTeamSlot is the seam for care-teams-ui

The orchestrator SHALL export `<CareTeamSlot>` from `apps/orchestrator/src/features/patient-profile/CareTeamSlot.tsx` taking exactly one prop `patientId: string`. Today's implementation SHALL render a short list of current `CareTeam` rows from `GET /care-teams?patient_id=<id>&is_open=true` (read-only) followed by copy `"Komt binnenkort — wordt geleverd door care-teams-ui"`. The `care-teams-ui` change SHALL replace this component's internals (NOT its export name, NOT its prop signature) so consumers of `<PatientProfilePage>` need no edit.

#### Scenario: Component contract is the stable seam

- **WHEN** `care-teams-ui` ships
- **THEN** the import path `apps/orchestrator/src/features/patient-profile/CareTeamSlot.tsx` and the prop signature `{ patientId: string }` MUST remain unchanged, with only the component body replaced
