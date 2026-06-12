## MODIFIED Requirements

### Requirement: Patient detail route renders header + adjacent care-team card + clinical tab strip

The orchestrator SHALL render at `/_auth/patients/$patientId` a `<PatientProfilePage>` built on the existing `<EntityDetailPage>` chrome:

1. `<PageHeader>` (via `<EntityDetailPage>`) showing the back-link eyebrow, an h1 of `family_name, given_name`, and a subtitle row with `<Badge variant="default">INSZ: <mono /></Badge>` + a muted `Geboren …` span + `<Badge variant="soft">{organisation.name}</Badge>`. Actions slot = `<Button>Bewerken</Button>` + a kebab.
2. A header-adjacent `<CareTeamSlot patientId={...} />` card. On viewports ≥ `md` it renders to the right of the header; below `md` it stacks underneath. The card SHALL NOT live inside the tab strip.
3. `<EntityDetailTabs>` (underline variant) with exactly two tabs in this order — `Metingen` (id `measurements`), `Labresultaten` (id `lab_results`). Default active tab = `measurements`. NO Afspraken tab ships — appointment surfacing lives in `/_auth/tasks` (per `tasks-base`).

The same `<EntityDetailPage>` + `<EntityDetailTabs>` primitives are also consumed by `/_auth/tasks/$taskId` (the tasks-context detail route), guaranteeing visual parity between the two surfaces. No bespoke `<PatientDetailView>` or `<PatientDetailHeader>` primitive ships in this change.

The route SHALL be guarded by the existing `Role.ADMIN | Role.CAREGIVER` requirement and SHALL honour the `require_patient_access` predicate established by `patients-base` + `practitioner-role-split`. A caregiver outside the visibility predicate hitting this route SHALL receive a `404 Not Found` from the backend `GET /patients/{id}` call, surfaced as a "Patiënt niet gevonden" empty-state in the page.

The prior `Overzicht`, `Zorgteam`, and `Geschiedenis` tabs from the `patient-profile-ui` revision SHALL NOT appear in the tab strip. Their content moves as follows: demographics + identifiers are absorbed into the `<PageHeader>` subtitle row (INSZ Badge + Geboren + org Badge); care-team content moves into the header-adjacent `<CareTeamSlot>` card; audit history moves behind a new kebab entry (see the kebab-history requirement below).

#### Scenario: Tabs render in clinical order

- **WHEN** a caregiver loads `/_auth/patients/<their-patient-id>`
- **THEN** the page MUST render exactly two tab triggers labelled `Metingen`, `Labresultaten` in that order, and the active tab MUST default to `Metingen`

#### Scenario: Header tabs do NOT include legacy meta tabs or Afspraken

- **WHEN** the page renders
- **THEN** the tab strip MUST NOT contain triggers labelled `Overzicht`, `Zorgteam`, `Geschiedenis`, or `Afspraken`

#### Scenario: CareTeamSlot renders adjacent to header, not inside a tab

- **WHEN** the page renders on a viewport ≥ `md`
- **THEN** `<CareTeamSlot>` MUST render as a header-adjacent card to the right of the `<PageHeader>` and MUST NOT appear inside any tab body; the CareTeamSlot's import path (`apps/orchestrator/src/modules/patient/components/CareTeamSlot.tsx`) and prop signature (`{ patientId: string }`) MUST be unchanged from the prior revision

#### Scenario: Outside-visibility caregiver sees not-found

- **WHEN** a caregiver loads the detail route for a patient they cannot see (no care-team membership AND no PractitionerRole root overlap)
- **THEN** the page MUST render a "Patiënt niet gevonden" empty-state and MUST NOT render the tabs, header, or care-team card

#### Scenario: Sticky header populates from the GET /patients/{id} response

- **WHEN** the page mounts
- **THEN** the `<PageHeader>` MUST render `family_name, given_name` as the h1, the INSZ identifier value (if any) inside a `<Badge variant="default">`, the formatted `birth_date`, and the resolved primary organisation name inside a `<Badge variant="soft">` — all sourced from the `GET /patients/{id}` response + the `GET /organisations` cache

## ADDED Requirements

### Requirement: Metingen and Labresultaten tabs render `<EmptyState>` in v1

The `Metingen` and `Labresultaten` tabs SHALL each render the existing `<EmptyState>` component (icon-in-circle + headline + body shape already supported — no `<TabEmptyState>` wrapper introduced) with: a tab-appropriate icon, a Dutch headline, and a muted hint line. No tab body SHALL render mock data, a skeleton that implies loading, or a placeholder list of fake items. Backend wiring for these two tab bodies is explicitly OUT of scope for this change.

Headline + hint copy SHALL be:

- `Metingen` — title `"Nog geen metingen gekoppeld"`, body `"Wordt geleverd door de monitoring-koppeling"`.
- `Labresultaten` — title `"Nog geen labresultaten gekoppeld"`, body `"Wordt geleverd door de HiX-koppeling"`.

#### Scenario: Metingen renders its empty state

- **WHEN** a caregiver activates the `Metingen` tab
- **THEN** the tab body MUST render `<EmptyState>` with the title `"Nog geen metingen gekoppeld"` and body `"Wordt geleverd door de monitoring-koppeling"`

#### Scenario: Labresultaten renders its empty state

- **WHEN** a caregiver activates the `Labresultaten` tab
- **THEN** the tab body MUST render `<EmptyState>` with the title `"Nog geen labresultaten gekoppeld"` and body `"Wordt geleverd door de HiX-koppeling"`

#### Scenario: Metingen and Labresultaten render no fake data

- **WHEN** either the `Metingen` or `Labresultaten` tab renders
- **THEN** the tab body MUST NOT contain a list of measurement / lab rows (real or mocked), a loading skeleton, or a `<DataTable>`; only the `<EmptyState>` is allowed

### Requirement: Page kebab exposes Geschiedenis dialog

The page kebab on `<PatientProfilePage>` SHALL expose a `Geschiedenis` entry that opens a shadcn `<Dialog>` rendering the existing `<PatientHistoryPanel>` (created / updated / soft-deleted lines, three lines max, em-dash fallback when actor lookup fails — unchanged from the prior revision). The kebab SHALL also continue to expose the `Bewerken` (edit demographics) and `Verwijderen` (soft delete) entries from the prior revision; their behaviour is unchanged.

#### Scenario: Kebab exposes Geschiedenis entry

- **WHEN** a caregiver opens the page kebab
- **THEN** the menu MUST list `Geschiedenis` alongside `Bewerken` and `Verwijderen`

#### Scenario: Geschiedenis opens dialog with history panel

- **WHEN** the caregiver activates the `Geschiedenis` kebab entry
- **THEN** a shadcn `<Dialog>` MUST open containing `<PatientHistoryPanel>` and MUST close on dismiss without navigating away

## REMOVED Requirements

### Requirement: Demographics + identifiers panel surfaces FHIR-shaped fields

**Reason**: Demographics + identifiers are absorbed into the `<PageHeader>` subtitle row (INSZ Badge + Geboren + org Badge) per the modified detail-route requirement above. The dedicated `Overzicht` tab is dropped.

**Migration**: `<PageHeader>` now renders `family_name, given_name` + INSZ Badge + Geboren + org Badge. Pre-existing readers of `<PatientDemographicsPanel>` / `<PatientIdentifiersPanel>` outside the profile page (none expected; verified in prereq task 0.4) inline the header's fields directly.

### Requirement: History tab summarises audit metadata in three lines max

**Reason**: The `Geschiedenis` tab is dropped from the strip. The audit summary (`<PatientHistoryPanel>`) moves behind the page kebab → `Geschiedenis` dialog. Three-lines-max contract and em-dash fallback are preserved by the new `Page kebab exposes Geschiedenis dialog` requirement above.

**Migration**: No data migration. The `<PatientHistoryPanel>` component is unchanged; only its mount point moves.
