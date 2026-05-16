## MODIFIED Requirements

### Requirement: Orchestrator exposes a patients overview screen built on `DataTable<T>`

The orchestrator SHALL ship `/_auth/patients` as the canonical caregiver/admin patients overview, satisfying PoC feature `F4` (Patients overview). The page SHALL compose `<FilterableListPage<PatientRead>>` (introduced by `caregiver-shell`) around `<DataTable<PatientRead>>` per `apps/orchestrator/AGENTS.md` §25 (Lists & DataTable) — no ad-hoc `<table>`, no hand-rolled `useQuery` wrappers, no inline filter / column / action defs in the route file, and no per-page shell. Data fetching SHALL go through `usePaginatedQuery('/patients', state)` and ride the shared `ListQuery` + `Page[T]` envelope (`page`, `page_size`, `q`, `order_by`, `order`, `filter[<field>][<op>]`). User-visible Dutch strings SHALL live under the `patients` i18n namespace.

The page SHALL render the following columns (left-to-right; first column sticky):

1. **Naam** — `"${family_name}, ${given_name}"`, `sortKey: "family_name"`, sticky.
2. **INSZ** — pill rendering the value of the identifier whose `system === INSZ_SYSTEM`; absent → em-dash. Not sortable, not filterable.
3. **Geboortedatum** — `dd MMM yyyy` (locale `nl-NL`), `sortKey: "birth_date"`.
4. **Geslacht** — short badge (`M` / `V` / `X` / `?` for `male` / `female` / `other` / `unknown`). Not sortable.
5. **Organisatie** — name resolved via `GET /organisations` lookup, keyed off `primary_organisation_id`. Not sortable.
6. **Bijgewerkt** — `dd MMM HH:mm` (locale `nl-NL`), `sortKey: "updated_at"`.

The page SHALL expose:

- **Search** (`q`): placeholder `"Zoek op naam of voornaam…"`, matches backend `searchable_fields = (family_name, given_name)`. Rendered inside the `<FilterableListPage>` `filters` slot.
- **Filter — geboortedatum** (`filter[birth_date][gte]` / `[lte]`): date-range picker, in the `filters` slot.
- **Filter — organisatie** (`filter[primary_organisation_id][eq]`): single-select bound to the tenant-scoped `GET /organisations` list, in the `filters` slot.
- **Default sort**: `family_name asc` (matches `PatientRepository.default_order`).
- **Row click**: navigate `/_auth/patients/$patientId` (rendered by `patient-profile-ui`).
- **Row actions** (kebab): a single `Verwijderen` action calling `DELETE /patients/{id}` behind a destructive confirm dialog. Visible to caregivers and admins.
- **Bulk actions**: none. `selectable={false}`.
- **State persistence**: `useRouteSearchTableState` (URL-driven). MUST NOT be combined with `useLocalTableState`.
- **Realtime**: `realtimeTopic="patients"` (matches `Patient.__realtime_resource__`); the global `RealtimeInvalidationProvider` drives invalidation, no per-table subscription.
- **Empty state**: rendered via `<FilterableListPage>` `emptyState` slot when zero rows and no filters; copy `"Nog geen patiënten in jouw bereik."`.

The route SHALL be guarded by the existing `Role.ADMIN | Role.CAREGIVER` requirement at the router level. The page MUST NOT surface tenant identity in any user-visible copy.

#### Scenario: Page composes FilterableListPage around DataTable

- **WHEN** a caregiver loads `/_auth/patients`
- **THEN** the rendered tree MUST nest `<DataTable<PatientRead>>` inside `<FilterableListPage<PatientRead>>`, and MUST NOT render a bespoke page header or filter bar outside the scaffolding's slots

#### Scenario: Behaviour preserved across refactor

- **WHEN** the existing patient-page test suite runs against the refactored `_auth/patients/index.tsx`
- **THEN** every assertion (URL keys, default sort, row click target, kebab `Verwijderen` confirm, realtime invalidation, no tenant copy) MUST pass without test-file edits

#### Scenario: Empty state surfaces only when filters unset

- **WHEN** the patient list returns zero rows AND no `q` / `filter[...]` keys are present
- **THEN** the `<FilterableListPage>` `emptyState` slot renders `"Nog geen patiënten in jouw bereik."`

#### Scenario: Filtered empty result stays inside DataTable

- **WHEN** the patient list returns zero rows AND at least one `filter[...]` key is present
- **THEN** the `<DataTable>`'s own "no matches" copy renders, not the page-level `emptyState` slot
