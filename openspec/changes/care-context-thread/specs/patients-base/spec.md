## MODIFIED Requirements

### Requirement: Orchestrator exposes a patients overview screen built on `DataTable<T>`

The orchestrator SHALL ship `/_auth/patients` as the canonical caregiver/admin patients overview, satisfying PoC feature `F4` (Patients overview). The page SHALL compose `<DataTable<PatientRead>>` per `apps/orchestrator/AGENTS.md` §25 (Lists & DataTable) — no ad-hoc `<table>`, no hand-rolled `useQuery` wrappers, no inline filter / column / action defs in the route file. Data fetching SHALL go through `usePaginatedQuery('/patients', state)` and ride the shared `ListQuery` + `Page[T]` envelope (`page`, `page_size`, `q`, `order_by`, `order`, `filter[<field>][<op>]`). User-visible Dutch strings SHALL live under the `patients` i18n namespace.

The page SHALL render the following columns (left-to-right; first column sticky):

1. **Naam** — `"${family_name}, ${given_name}"`, `sortKey: "family_name"`, sticky.
2. **Geboortedatum** — `dd MMM yyyy` (locale `nl-NL`), `sortKey: "birth_date"`.
3. **Geslacht** — short badge (`M` / `V` / `X` / `?` for `male` / `female` / `other` / `unknown`). Not sortable.
4. **Organisatie** — name resolved via `GET /organisations` lookup, keyed off `primary_organisation_id`. Not sortable.
5. **Bijgewerkt** — `dd MMM HH:mm` (locale `nl-NL`), `sortKey: "updated_at"`.

The INSZ column is intentionally omitted from the overview to limit PII exposure in shoulder-surfing range. The identifier remains on the row payload for detail views.

The page SHALL expose:

- **Search** (`q`): placeholder `"Zoek op naam of voornaam…"`, matches backend `searchable_fields = (family_name, given_name)`.
- **Filter — geboortedatum** (`filter[birth_date][gte]` / `[lte]`): date-range picker.
- **Filter — organisatie** (`filter[primary_organisation_id][eq]`): single-select bound to the tenant-scoped `GET /organisations` list.
- **Default sort**: `family_name asc` (matches `PatientRepository.default_order`).
- **Row click**: navigate `/_auth/patients/$patientId`. The detail route SHALL be a tabbed shell whose first tab is `Care team`; the shell MUST mount `EntityContextHeader` per the `care-context` capability. The placeholder body MUST be replaced by the tabbed shell when `care-context-thread` ships.
- **Row actions** (kebab): a single `Verwijderen` action calling `DELETE /patients/{id}` behind a destructive confirm dialog. Visible to caregivers and admins.
- **Bulk actions**: none. `selectable={false}`.
- **State persistence**: `useRouteSearchTableState` (URL-driven). MUST NOT be combined with `useLocalTableState`.
- **Realtime**: `realtimeTopic="patients"` (matches `Patient.__realtime_resource__`); the global `RealtimeInvalidationProvider` drives invalidation, no per-table subscription.

The route SHALL be guarded by the existing `Role.ADMIN | Role.CAREGIVER` requirement at the router level; unauthenticated users land back on the login screen via the auth router context. The page MUST NOT surface tenant identity in any user-visible copy (tenants are an implementation detail, not a user-facing concept).

#### Scenario: Page composes `DataTable<PatientRead>` against `/patients`

- **WHEN** a caregiver loads `/_auth/patients`
- **THEN** the page MUST render `<DataTable<PatientRead>>` populated from `usePaginatedQuery<PatientRead>('/patients', state)`, where `state` is produced by `useRouteSearchTableState`, and MUST NOT use a raw `<table>` element nor a bespoke `useQuery` call to `/patients`

#### Scenario: Default sort matches backend default_order

- **WHEN** the page loads with no `order_by` in the URL
- **THEN** the request to `/patients` MUST omit `order_by`, and the rendered list MUST be ordered by `family_name asc` (delegated to `PatientRepository.default_order`)

#### Scenario: Filters and search map onto the shared envelope

- **WHEN** the caregiver picks an organisation in the filter dropdown, sets a birth-date range, and types `"jans"` in the search box
- **THEN** the next `/patients` request MUST carry `filter[primary_organisation_id][eq]=<uuid>`, `filter[birth_date][gte]=<iso>`, `filter[birth_date][lte]=<iso>`, and `q=jans` (URL-encoded), and MUST NOT carry any non-FHIR-aligned query keys

#### Scenario: Row click routes to the tabbed detail shell

- **WHEN** a caregiver clicks a patient row
- **THEN** the orchestrator MUST navigate to `/_auth/patients/$patientId` and the route MUST render a tabbed detail shell whose first tab is `Care team`, with `EntityContextHeader` mounted above the tab list

#### Scenario: Soft-delete row action removes the row after confirm

- **WHEN** a caregiver opens the row kebab, selects `Verwijderen`, and confirms the destructive dialog
- **THEN** the orchestrator MUST call `DELETE /patients/{id}`, invalidate the `patients` query key on success (also triggered by the realtime `patients` topic), and the soft-deleted row MUST disappear from subsequent paginated responses

#### Scenario: No tenant copy is rendered

- **WHEN** any user inspects the page header, empty state, error state, or filter labels
- **THEN** no string MUST contain the word "tenant" (Dutch or English); tenant scoping is enforced server-side and intentionally invisible to caregivers
