## MODIFIED Requirements

### Requirement: Orchestrator exposes a patients inbox surface

The orchestrator SHALL ship `/_auth/patients` as the canonical caregiver/admin patients overview, satisfying PoC feature `F4` (Patients overview). The page SHALL render `<PatientInbox>` (introduced by this change), NOT `<DataTable<PatientRead>>`. `<PatientInbox>` SHALL be a triage-oriented surface:

- **Avatar slab** (left, 40px): patient initials (first letter of `given_name` + first letter of `family_name`) on a deterministically-tinted background derived from `patient.id` hash. The slab MUST NEVER render a patient photo (project-wide no-PHI invariant).
- **Identity column**: line 1 = `family_name, given_name`. Line 2 = muted `INSZ • birth_date • organisation tree-path`.
- **Sort-driven meta column** (right): populated by the active sort strategy's `rowMeta(patient)`. For the `next_appointment` strategy this is a two-line mini-card; for `newly_added` it is a single muted relative-time chip. Exact content is specified by the sort-registry requirement below.
- **Primary action chevron** (far right). The entire row is the click target navigating to `/_auth/patients/$patientId`. There is NO per-row kebab in v1.

The page SHALL use TanStack Query keyed by `[...patientsListKeyPrefix, { sort }]` and SHALL register the same realtime invalidation topic the prior `<DataTable<PatientRead>>` page registered. The visibility predicate and tenant scope from the prior revision are unchanged.

The page SHALL paginate via `useInfiniteQuery`. Backend `page_size` SHALL remain 25; the frontend SHALL render rows from all fetched pages as a single continuous list followed by a `"Meer laden"` button when `total_pages > fetched_pages`. The page SHALL NOT render a classic numbered pager.

The page SHALL NOT expose filters, search, bulk actions, or row-level kebab actions in this revision.

When the visible list is empty, the page SHALL render copy `"Nog geen patiënten zichtbaar"` plus a sub-line referencing care-team membership; it MUST NOT render a placeholder row or a skeleton table.

#### Scenario: Inbox renders rows, not a table

- **WHEN** a caregiver loads `/_auth/patients` with at least one visible patient
- **THEN** the page MUST render `<PatientInbox>` with one `<PatientInboxRow>` per patient and MUST NOT render `<DataTable>` or any `<th>` column header strip

#### Scenario: Avatar slab renders initials, never a photo

- **WHEN** a row renders for patient `{ given_name: "Jan", family_name: "Kowalski" }`
- **THEN** the avatar slab MUST render the text `"JK"` (uppercased) on a tinted background and MUST NOT render an `<img>` element

#### Scenario: Avatar background is deterministic per patient

- **WHEN** the same patient row renders twice in two browser sessions
- **THEN** the avatar slab background colour MUST be identical (derived from a hash of `patient.id`); reloading the page MUST NOT change it

#### Scenario: Row click routes to the real detail page

- **WHEN** a caregiver clicks anywhere on a `<PatientInboxRow>`
- **THEN** the orchestrator MUST navigate to `/_auth/patients/$patientId` and the destination MUST render `<PatientProfilePage>` (sticky header + care-team card + three clinical tabs)

#### Scenario: Infinite scroll loads next page

- **WHEN** the tenant has 30 visible patients and the caregiver clicks `"Meer laden"`
- **THEN** the page MUST fetch the next page via `useInfiniteQuery` and append rows in place (existing rows stay rendered); when all pages are fetched, the `"Meer laden"` button MUST disappear

#### Scenario: Realtime invalidation contract preserved

- **WHEN** the realtime topic registered by the prior list-page revision fires after a patient mutation
- **THEN** every TanStack Query entry under `patientsListKeyPrefix` MUST invalidate and the inbox MUST refetch from page 1

#### Scenario: Empty list renders Dutch caregiver-facing copy

- **WHEN** a caregiver with no care-team memberships and no PractitionerRole overlap loads `/_auth/patients`
- **THEN** the page MUST render copy `"Nog geen patiënten zichtbaar"` plus a sub-line explaining care-team membership and MUST NOT render an empty `<DataTable>` shell

### Requirement: Patients list supports FHIR-aligned discrete search parameters

The `GET /patients` route SHALL ride on the shared `ListQuery` envelope (`page`, `page_size`, `q`, `order_by`, `order`, bracket-key `filter[<field>][<op>]=<value>`) introduced by `add-datatable-base`, and SHALL expose the FHIR `Patient` search dimensions through that envelope as follows:

- Pagination via `page` (int, default 1) and `page_size` (int, default 25, max 100); response envelope is `Page[PatientRead]` with `items`, `page`, `page_size`, `total`, `total_pages`.
- `filter[family_name][contains]=<value>` — case-insensitive substring on `patients.family_name` (FHIR `family`).
- `filter[given_name][contains]=<value>` — case-insensitive substring on `patients.given_name` (FHIR `given`).
- `filter[birth_date]=<ISO date>` (or `[gte]`/`[lte]`) — equality / range on `patients.birth_date` (FHIR `birthdate`).
- `filter[primary_organisation_id][eq|in]=<uuid>` — scoping by primary organisation.
- `q=<value>` — free-text search across `family_name`/`given_name` via `searchable_fields`.
- `identifier=<value>` — a flat router query param (NOT a `filter[...]` key) that short-circuits the rest of the query with an exact match on `patient_identifiers.value` joined through `patient_id` within the caller's tenant.

`order_by` SHALL accept at minimum `family_name`, `given_name`, `birth_date`, `created_at`, and `next_appointment_starts_at` (a synthetic key projected from `next_appointment.starts_at`). When `order_by=next_appointment_starts_at` is requested, rows whose projected `next_appointment` is `null` MUST be ordered last regardless of the `order` direction (NULLS LAST for both ASC and DESC). Unknown `order_by` values MUST be rejected with `422` by the shared `ListQuery` validator.

When `identifier` is provided, it SHALL short-circuit all other filters and `q` (return the at-most-one matching row). When `identifier` is absent, the `filter[...]` entries SHALL be AND-combined and intersected with `q`. All matches SHALL be tenant-scoped via the session actor's `tenant_id` enforced by `BaseListRepository._tenant_predicate`. Filter field names align with FHIR R4 `Patient` search (`family`, `given`, `birthdate`, `identifier`) so MVP HiX adapter wiring is a direct mapping.

#### Scenario: order_by next_appointment_starts_at orders ascending with nulls last

- **WHEN** `GET /patients?order_by=next_appointment_starts_at&order=asc` is called and the tenant contains patients with various upcoming appointments plus at least one patient with no upcoming appointment
- **THEN** the response items MUST be ordered by ascending `next_appointment.starts_at` and the patient(s) with `next_appointment IS NULL` MUST appear at the END of the list, after all non-null rows

#### Scenario: order_by next_appointment_starts_at descending also trails nulls

- **WHEN** `GET /patients?order_by=next_appointment_starts_at&order=desc` is called
- **THEN** rows with `next_appointment IS NULL` MUST still appear after all non-null rows (NULLS LAST regardless of direction)

#### Scenario: order_by created_at supports newly-added sort

- **WHEN** `GET /patients?order_by=created_at&order=desc` is called
- **THEN** the response items MUST be ordered from most-recently-created to oldest

#### Scenario: order_by rejects unknown fields

- **WHEN** `GET /patients?order_by=gender` is called
- **THEN** the response MUST be `422 Unprocessable Entity`

#### Scenario: Identifier short-circuits other filters

- **WHEN** `GET /patients?identifier=<value>&filter[family_name][contains]=zzz` is called and a patient in the caller's tenant has that identifier value
- **THEN** the response MUST contain that patient regardless of the `family_name` mismatch

#### Scenario: Multiple filters AND together

- **WHEN** `GET /patients?filter[family_name][contains]=jans&filter[birth_date]=1985-03-12` is called
- **THEN** the response MUST contain only patients whose `family_name` contains `jans` AND whose `birth_date` equals `1985-03-12`

#### Scenario: Search never crosses tenant boundary

- **WHEN** `GET /patients?identifier=<value>` is called and a patient with that identifier exists in a different tenant
- **THEN** the response MUST be empty

#### Scenario: Default pagination size applied

- **WHEN** `GET /patients` is called with no `page_size` param and the tenant has more than 25 patients
- **THEN** the response MUST contain at most 25 items and MUST report `page=1`, `page_size=25`, the correct `total`, and a `total_pages` consistent with `ceil(total / page_size)`

#### Scenario: Unknown filter field is rejected

- **WHEN** `GET /patients?filter[gender]=male` is called (gender is intentionally not in `PatientRepository.filterable_fields`)
- **THEN** the response MUST be `422 Unprocessable Entity` from the shared `ListQuery` validator

## ADDED Requirements

### Requirement: PatientRead embeds an optional next-appointment summary

`PatientRead` SHALL include a nullable embedded field `next_appointment: NextAppointmentSummary | None`. `NextAppointmentSummary` SHALL contain exactly: `{ id: UUID, title: str, starts_at: datetime, ends_at: datetime, kind: AppointmentKind, modality: AppointmentModality }`.

The projection SHALL select the appointment row matching ALL of:
- `appointments.patient_id = patients.id`
- `appointments.status = 'booked'`
- `appointments.starts_at >= now()`
- `appointments.deleted_at IS NULL`
- `appointments.tenant_id = patients.tenant_id` (defence-in-depth; should be redundant given patient FK)

with the smallest `starts_at` value (ties broken by `id`). When no such row exists, `next_appointment` SHALL be `null`. The field SHALL appear on every `GET /patients` list item and on `GET /patients/{id}`, regardless of the active `order_by`.

Implementation MAY use a lateral join (`LEFT JOIN LATERAL (... LIMIT 1) ON TRUE`) or a correlated subquery; the choice is implementation detail provided the contract above holds.

#### Scenario: Patient with one upcoming booked appointment exposes its summary

- **WHEN** a patient has a single `booked` appointment with `starts_at` 2 days from now
- **THEN** the patient's `next_appointment` field MUST be a non-null object whose `id`, `title`, `starts_at`, `ends_at`, `kind`, `modality` match that appointment row

#### Scenario: Patient with multiple upcoming booked appointments exposes earliest

- **WHEN** a patient has booked appointments at `t1 < t2 < t3`, all in the future
- **THEN** the patient's `next_appointment.id` MUST be the id of the `t1` row

#### Scenario: Patient with only non-booked or past appointments exposes null

- **WHEN** a patient has only `cancelled`, `fulfilled`, `noshow`, or past-`starts_at` appointments
- **THEN** the patient's `next_appointment` MUST be `null`

#### Scenario: Patient with soft-deleted future appointment exposes null

- **WHEN** a patient has only one future `booked` appointment whose `deleted_at IS NOT NULL`
- **THEN** the patient's `next_appointment` MUST be `null`

#### Scenario: next_appointment present on detail endpoint

- **WHEN** `GET /patients/{id}` is called
- **THEN** the response body MUST include `next_appointment` (object or `null`)

#### Scenario: next_appointment cannot leak cross-tenant data

- **WHEN** a patient in tenant A is queried and an appointment row in tenant B somehow references the patient (should be impossible, defence-in-depth)
- **THEN** the join MUST filter the appointment row out and `next_appointment` MUST be `null`

### Requirement: Orchestrator ships a patient-inbox sort registry

The orchestrator SHALL define `apps/orchestrator/src/features/patient-inbox/sorts/index.ts` exporting `patientSortStrategies: readonly PatientSortStrategy[]`. A `PatientSortStrategy` SHALL be an object with: `id: string`, `label: () => string` (returning a `t()`-resolved Dutch label), `queryParams: () => Partial<ListQuery>`, and `rowMeta: (p: PatientRead) => ReactNode`.

The v1 registry SHALL contain exactly two strategies in this order:

1. **`next_appointment`** — default. `queryParams` SHALL produce `{ order_by: 'next_appointment_starts_at', order: 'asc' }`. `rowMeta(p)` SHALL render:
   - When `p.next_appointment != null`: a two-line mini-card. Line 1 = `kind` icon + `title` (single-line truncated at 240px). Line 2 = formatted `starts_at` in the browser's local timezone using Dutch locale (e.g. `"Do 12 jun • 14:00"`) + `modality` icon (online vs on_site).
   - When `p.next_appointment == null`: muted plain text `"Geen geplande afspraak"` (no card chrome, no border, no icon).
2. **`newly_added`** — `queryParams` SHALL produce `{ order_by: 'created_at', order: 'desc' }`. `rowMeta(p)` SHALL render a muted relative-time line `"toegevoegd N dagen geleden"` (with `0` mapped to `"vandaag toegevoegd"`, `1` to `"gisteren toegevoegd"`).

A `useSelectedSort()` hook SHALL read the active sort id from the URL search param `sort` (TanStack Router), fall back to `next_appointment` when the param is absent or unknown (warn-log on unknown), and expose `setSort(id)` which updates the search param via `navigate({ search })`.

`useSelectedSort` SHALL resolve the active strategy synchronously on first render — there MUST NOT be a render pass where the default strategy is selected while the URL specifies a non-default sort.

Adding a future sort strategy MUST require only a new file under `sorts/` and a new entry in the array — no edits to `<PatientInbox>`, the route, the repository, or `PatientRead`.

#### Scenario: Default sort is next_appointment when no URL param

- **WHEN** a caregiver loads `/_auth/patients` with no `sort` search param
- **THEN** `useSelectedSort()` MUST return the `next_appointment` strategy and the inbox MUST request the list with `order_by=next_appointment_starts_at&order=asc`

#### Scenario: Unknown sort id falls back to default with warning

- **WHEN** a caregiver loads `/_auth/patients?sort=banana`
- **THEN** `useSelectedSort()` MUST return the `next_appointment` strategy and a warn-log MUST fire; the hook MUST NOT throw

#### Scenario: Switching sort updates URL and refetches

- **WHEN** a caregiver activates the `newly_added` sort
- **THEN** the URL MUST update to include `?sort=newly_added`, the TanStack Query key MUST change to `[...patientsListKeyPrefix, { sort: 'newly_added' }]`, and the next render MUST request `order_by=created_at&order=desc`

#### Scenario: Deep-linked sort is active on first paint (no flash of default)

- **WHEN** a caregiver opens `/_auth/patients?sort=newly_added` as the first page load (no prior navigation)
- **THEN** the very first render MUST already show the `newly_added` strategy active in the segmented control AND the initial list fetch MUST use `order_by=created_at&order=desc`; the page MUST NOT first render the `next_appointment` strategy then swap

#### Scenario: Sort persists across row click + browser back

- **WHEN** a caregiver activates `newly_added`, clicks a row to navigate to `/_auth/patients/$patientId`, then uses the browser back button
- **THEN** the inbox MUST render with `newly_added` still active (URL search param preserved through navigation)

#### Scenario: Next-appointment mini-card renders kind icon + title + formatted time + modality icon

- **WHEN** a row renders for a patient with `next_appointment = { title: "Controle na operatie", starts_at: "2026-06-12T14:00:00Z", ends_at: "2026-06-12T14:30:00Z", kind: "consultation", modality: "on_site" }` while the browser is in `Europe/Brussels`
- **THEN** the meta column MUST render a two-line card. Line 1 MUST contain a consultation-kind icon followed by the text `"Controle na operatie"`. Line 2 MUST contain a Dutch-formatted local-time line (matching the browser timezone) followed by an on-site icon

#### Scenario: Missing next-appointment renders muted empty text, not an empty card

- **WHEN** a row renders for a patient with `next_appointment = null` while the `next_appointment` strategy is active
- **THEN** the meta column MUST render plain muted text `"Geen geplande afspraak"` and MUST NOT render a card outline, border, or icon

#### Scenario: newly_added meta uses days-ago copy

- **WHEN** a row renders under the `newly_added` strategy for a patient created today
- **THEN** the meta column MUST render the muted text `"vandaag toegevoegd"`; a patient created yesterday MUST render `"gisteren toegevoegd"`; a patient created 5 days ago MUST render `"toegevoegd 5 dagen geleden"`

#### Scenario: Adding a future strategy requires no route edit

- **WHEN** a future change appends a `priority` strategy file to `sorts/` and adds it to `patientSortStrategies`
- **THEN** the existing route file `apps/orchestrator/src/routes/_auth/patients/index.tsx` MUST NOT require modification; the segmented sort control MUST render the new strategy automatically

### Requirement: PatientInboxRow is a surface-agnostic primitive

The orchestrator SHALL export `<PatientInboxRow>` from `apps/orchestrator/src/features/patient-inbox/PatientInboxRow.tsx` with props `{ patient: PatientRead; sortMeta: ReactNode; onSelect: (patient: PatientRead) => void }`. The component MUST NOT import from `@tanstack/react-router`, MUST NOT read URL state directly, and MUST NOT depend on orchestrator-shell-specific layout. This stability lets a future `smart` or `embed` surface re-mount the same row with its own host wrapper.

#### Scenario: Row is router-independent

- **WHEN** the row component is rendered in a test without any router provider
- **THEN** the render MUST succeed and clicking the row MUST invoke `onSelect(patient)`
