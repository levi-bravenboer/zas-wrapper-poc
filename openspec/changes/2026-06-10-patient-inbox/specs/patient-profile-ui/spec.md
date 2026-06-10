## MODIFIED Requirements

### Requirement: Patient detail route renders header + adjacent care-team card + clinical tab strip

The orchestrator SHALL render at `/_auth/patients/$patientId` a `<PatientProfilePage>` containing:

1. A sticky header (`<PatientDetailHeader>`) showing patient name, INSZ pill, date of birth, primary organisation chip, and a kebab actions slot.
2. A header-adjacent `<CareTeamSlot patientId={...} />` card. On viewports ≥ `md` it renders to the right of the header; below `md` it stacks underneath the header. The card SHALL NOT live inside the tab strip.
3. A shadcn `Tabs` component with exactly three tabs in this order — `Metingen` (id `measurements`), `Labresultaten` (id `lab_results`), `Afspraken` (id `appointments`). The default active tab SHALL be `measurements`.

The route SHALL be guarded by the existing `Role.ADMIN | Role.CAREGIVER` requirement and SHALL honour the `require_patient_access` predicate established by `patients-base` + `practitioner-role-split`. A caregiver outside the visibility predicate hitting this route SHALL receive a `404 Not Found` from the backend `GET /patients/{id}` call, surfaced as a "Patiënt niet gevonden" empty-state in the page.

The prior `Overzicht`, `Zorgteam`, and `Geschiedenis` tabs from the `patient-profile-ui` revision SHALL NOT appear in the tab strip. Their content moves as follows: demographics + identifiers are already in the sticky header; care-team content moves into the header-adjacent `<CareTeamSlot>` card; audit history moves behind a new kebab entry (see the kebab-history requirement below).

#### Scenario: Tabs render in clinical order

- **WHEN** a caregiver loads `/_auth/patients/<their-patient-id>`
- **THEN** the page MUST render exactly three tab triggers labelled `Metingen`, `Labresultaten`, `Afspraken` in that order, and the active tab MUST default to `Metingen`

#### Scenario: Header tabs do NOT include legacy meta tabs

- **WHEN** the page renders
- **THEN** the tab strip MUST NOT contain triggers labelled `Overzicht`, `Zorgteam`, or `Geschiedenis`

#### Scenario: CareTeamSlot renders adjacent to header, not inside a tab

- **WHEN** the page renders on a viewport ≥ `md`
- **THEN** `<CareTeamSlot>` MUST render as a header-adjacent card to the right of `<PatientDetailHeader>` and MUST NOT appear inside any tab body; the CareTeamSlot's import path (`apps/orchestrator/src/features/patient-profile/CareTeamSlot.tsx`) and prop signature (`{ patientId: string }`) MUST be unchanged from the prior revision

#### Scenario: Outside-visibility caregiver sees not-found

- **WHEN** a caregiver loads the detail route for a patient they cannot see (no care-team membership AND no PractitionerRole root overlap)
- **THEN** the page MUST render a "Patiënt niet gevonden" empty-state and MUST NOT render the tabs, header, or care-team card

#### Scenario: Sticky header populates from the GET /patients/{id} response

- **WHEN** the page mounts
- **THEN** `<PatientDetailHeader>` MUST render `family_name, given_name`, the INSZ identifier value (if any), `birth_date`, and the resolved primary organisation name from the `GET /organisations` cache

## ADDED Requirements

### Requirement: Afspraken tab renders Upcoming + History sections, read-only

The `Afspraken` tab SHALL render two sections sourced from `GET /appointments?filter[patient_id][eq]=<id>`:

1. **Upcoming** (`Aankomend`) — always expanded, top of tab. Filters: `status='booked'` AND `starts_at >= now()`. Sort: `starts_at` ascending. Each row shows the kind icon, the title, formatted `starts_at` (Dutch locale, browser-local timezone), `modality` icon, and an inline truncated participant strip (lead first, then up to two more — overflow as `+N`).
2. **History** (`Geschiedenis`) — collapsible (collapsed by default), beneath the Upcoming section. Filters: everything else for this patient (any status that is not `booked`-and-future, including past `booked`, `fulfilled`, `cancelled`, `noshow`, `arrived`, `checked_in`, `entered_in_error`, `proposed`, `pending`, `waitlist`, and past `booked`). Sort: `starts_at` descending. Same row shape as Upcoming, plus a muted status chip per row (e.g. "Voltooid", "Geannuleerd", "Niet verschenen").

The Afspraken tab v1 is FULLY READ-ONLY. No create button, no edit, no delete, no status-change action. The backend `POST` / `PATCH` / `DELETE /appointments` endpoints exist (specified in `appointment-base`) but the orchestrator frontend MUST NOT wire any UI to them in this revision. Future pathway runtime and/or a dedicated UI change will land write actions.

When both sections are empty the tab body SHALL render a `<TabEmptyState>` with headline `"Nog geen afspraken"` and hint `"Verschijnen hier wanneer de pathway runtime live is of een collega ze aanmaakt"`.

#### Scenario: Upcoming section lists only booked-and-future, ascending

- **WHEN** the patient has a `booked` appointment in 2 days, a `booked` appointment in 5 days, a past `booked` appointment, and a `cancelled` appointment in 3 days
- **THEN** the Upcoming section MUST list exactly the two future-booked appointments, with the 2-day one first

#### Scenario: History section lists everything else, descending

- **WHEN** the patient has a past `booked` appointment (`starts_at = -2d`), a `fulfilled` appointment (`starts_at = -5d`), and a `cancelled` appointment (`starts_at = +3d`)
- **THEN** the History section MUST list all three with the past `booked` first, then the `cancelled` (placed by `starts_at` descending), then the `fulfilled`

#### Scenario: History section is collapsed by default

- **WHEN** the Afspraken tab opens
- **THEN** the History section MUST be visually collapsed (label + chevron only); clicking the label MUST expand it

#### Scenario: No write actions are rendered

- **WHEN** the Afspraken tab renders any number of appointments
- **THEN** no button, kebab, menu item, or link MUST exist for create, edit, delete, cancel, mark-complete, or any status change

#### Scenario: Both sections empty renders TabEmptyState

- **WHEN** the patient has zero appointments of any status
- **THEN** the tab body MUST render `<TabEmptyState>` with headline `"Nog geen afspraken"` and hint `"Verschijnen hier wanneer de pathway runtime live is of een collega ze aanmaakt"`

#### Scenario: Row formats starts_at in browser-local timezone

- **WHEN** an Upcoming row renders for `starts_at = "2026-06-12T14:00:00Z"` while the browser is in `Europe/Brussels`
- **THEN** the formatted time MUST match the Brussels local rendering (Dutch locale) of that instant, not the literal UTC value

### Requirement: Metingen and Labresultaten tabs render TabEmptyState in v1

The `Metingen` and `Labresultaten` tabs SHALL each render a `<TabEmptyState>` component with: a tab-appropriate icon, a Dutch headline, and a muted hint line. No tab body SHALL render mock data, a skeleton that implies loading, or a placeholder list of fake items. Backend wiring for these two tab bodies is explicitly OUT of scope for this change.

Headline + hint copy SHALL be:

- `Metingen` — headline `"Nog geen metingen gekoppeld"`, hint `"Wordt geleverd door de monitoring-koppeling"`.
- `Labresultaten` — headline `"Nog geen labresultaten gekoppeld"`, hint `"Wordt geleverd door de HiX-koppeling"`.

#### Scenario: Metingen renders its empty state

- **WHEN** a caregiver activates the `Metingen` tab
- **THEN** the tab body MUST render `<TabEmptyState>` with the headline `"Nog geen metingen gekoppeld"` and hint `"Wordt geleverd door de monitoring-koppeling"`

#### Scenario: Labresultaten renders its empty state

- **WHEN** a caregiver activates the `Labresultaten` tab
- **THEN** the tab body MUST render `<TabEmptyState>` with the headline `"Nog geen labresultaten gekoppeld"` and hint `"Wordt geleverd door de HiX-koppeling"`

#### Scenario: Metingen and Labresultaten render no fake data

- **WHEN** either the `Metingen` or `Labresultaten` tab renders
- **THEN** the tab body MUST NOT contain a list of measurement / lab rows (real or mocked), a loading skeleton, or a `<DataTable>`; only the `<TabEmptyState>` is allowed

### Requirement: Page kebab exposes Geschiedenis dialog

The page kebab on `<PatientProfilePage>` SHALL expose a `Geschiedenis` entry that opens a shadcn `<Dialog>` rendering the existing `<PatientHistoryPanel>` (created / updated / soft-deleted lines, three lines max, em-dash fallback when actor lookup fails — unchanged from the prior revision). The kebab SHALL also continue to expose the `Bewerken` (edit demographics) and `Verwijderen` (soft delete) entries from the prior revision; their behaviour is unchanged.

#### Scenario: Kebab exposes Geschiedenis entry

- **WHEN** a caregiver opens the page kebab
- **THEN** the menu MUST list `Geschiedenis` alongside `Bewerken` and `Verwijderen`

#### Scenario: Geschiedenis opens dialog with history panel

- **WHEN** the caregiver activates the `Geschiedenis` kebab entry
- **THEN** a shadcn `<Dialog>` MUST open containing `<PatientHistoryPanel>` and MUST close on dismiss without navigating away

### Requirement: PatientDetailHeader is a surface-agnostic primitive

The orchestrator SHALL export `<PatientDetailHeader>` from `apps/orchestrator/src/features/patient-profile/PatientDetailHeader.tsx` with props `{ patient: PatientRead; actions?: ReactNode }`. The component MUST NOT import from `@tanstack/react-router`, MUST NOT read URL state directly, and MUST NOT depend on orchestrator-shell-specific layout. The `actions` slot lets the host (orchestrator route today; smart/embed surface later) inject its own kebab / button cluster. This stability lets a future `smart` or `embed` surface re-mount the same header with its own host wrapper.

#### Scenario: Header is router-independent

- **WHEN** the header component is rendered in a test without any router provider, with a `patient` prop and no `actions`
- **THEN** the render MUST succeed and the demographics fields MUST be present in the DOM

#### Scenario: Actions slot is host-injected

- **WHEN** the header is rendered with `actions={<button>Test</button>}`
- **THEN** the rendered DOM MUST contain a `Test` button inside the header layout

## REMOVED Requirements

### Requirement: Demographics + identifiers panel surfaces FHIR-shaped fields

**Reason**: Demographics + identifiers are surfaced by `<PatientDetailHeader>` for v1. The dedicated `Overzicht` tab is dropped. The INSZ pinning + INSZ pill styling carry over to the header.

**Migration**: Sticky header now renders patient name + INSZ pill + DOB + primary organisation chip per the modified detail-route requirement above. Pre-existing readers of `<PatientDemographicsPanel>` / `<PatientIdentifiersPanel>` outside the profile page (none expected; verify in task 4.x) inline the header's fields directly.

### Requirement: History tab summarises audit metadata in three lines max

**Reason**: The `Geschiedenis` tab is dropped from the strip. The audit summary (`<PatientHistoryPanel>`) moves behind the page kebab → `Geschiedenis` dialog. Three-lines-max contract and em-dash fallback are preserved by the new `Page kebab exposes Geschiedenis dialog` requirement above.

**Migration**: No data migration. The `<PatientHistoryPanel>` component is unchanged; only its mount point moves.
