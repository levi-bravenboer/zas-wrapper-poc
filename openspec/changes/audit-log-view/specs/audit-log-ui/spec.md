## ADDED Requirements

### Requirement: Admin-only audit log page

The orchestrator SHALL expose a read-only audit log page at `/_auth/admin/audit-log`, rendered only for users with the admin role via the existing `/_auth/admin/*` route guard. The route file SHALL carry the `// surface-opt-out: app-only` marker (admin pages bypass the feature generator), and a navigation entry SHALL appear under the "Beheer" group, admin-gated. The page SHALL be read-only — it provides no create/edit/delete actions on audit events.

#### Scenario: Non-admin is redirected

- **WHEN** a non-admin user navigates to `/_auth/admin/audit-log`
- **THEN** the admin route guard redirects them away (as for every other `/_auth/admin/*` page) and the audit log is not rendered

#### Scenario: Admin sees the audit log in the nav

- **WHEN** an admin user is signed in
- **THEN** an "Auditlog" entry appears under the "Beheer" navigation group and opens the audit log page

### Requirement: Audit events are listed in a scannable table

The page SHALL render the system-wide audit trail from `GET /audit-events` using the standard `DataTable` list stack (`usePaginatedQuery`, `useRouteSearchTableState`, `DataTableToolbar`, `DataTablePagination`). The table SHALL show columns: Time (`created_at`), Actor, Action, Resource, and Result. The Actor cell SHALL show `actor_label`, falling back to a parenthesised actor type (e.g. "(systeem)", "(anoniem)") when no label exists. The Resource cell SHALL show `resource_type` plus a short slice of `resource_id`, and SHALL render "—" when `resource_type` is null (e.g. login events). Action and Result SHALL render as labelled badges, with failures visually distinguished. All copy SHALL come from a Dutch `audit-admin-ui` i18n namespace.

#### Scenario: A pathway publish event is listed

- **WHEN** the trail contains a `published` event on a Pathway by "Dr. Lee"
- **THEN** a row shows the time, "Dr. Lee", a "Gepubliceerd" action badge, "Pathway ·<short id>", and a success result

#### Scenario: A failed login is visually distinguished

- **WHEN** the trail contains a `login` event with `result = failure` and no resource
- **THEN** the row shows "(anoniem)" as actor, a "Login" badge, "—" in the Resource column, and a failure-styled Result badge

### Requirement: The trail is sorted by time, newest first

The list SHALL default to sorting by `created_at` descending. Because the backend exposes `created_at` as the only orderable field, only the Time column SHALL be sortable; other column headers SHALL NOT offer sorting.

#### Scenario: Default order is newest-first

- **WHEN** the audit log loads with no explicit sort
- **THEN** events are ordered by `created_at` descending (most recent first)

### Requirement: The trail is filterable

The toolbar SHALL offer filters that map onto the existing `GET /audit-events` filter support: Action as a multi-select (mapping to the backend `in` operator) over created / updated / deleted / login / published; Result as a single select over success / failure; Resource type as a single select over the emitted types (Pathway, User, Patient); and a `created_at` date range (`gte` / `lte`). Filter and pagination state SHALL persist in the URL search params so a filtered view is shareable and back-button-safe. No free-text search box and no actor user-picker SHALL be present in v1.

#### Scenario: Filtering by action and date range

- **WHEN** an admin selects action = published and a `created_at` range
- **THEN** the list requests `GET /audit-events` with the corresponding `action[in]` and `created_at[gte]/[lte]` filters and shows only matching events

#### Scenario: Filter state is reflected in the URL

- **WHEN** an admin applies any filter or changes the page
- **THEN** the selection is encoded in the URL search params and is restored on reload / back-navigation

### Requirement: Row detail reveals the raw event payload

Clicking a row SHALL expand it to show the event's full detail: pretty-printed raw JSON of `context` and `changes`, plus `request_id` and the full identifiers. No per-event-type humanisation of the payload is required in v1.

#### Scenario: Expanding a publish event shows its context

- **WHEN** an admin clicks a `published` Pathway row
- **THEN** the expanded detail shows the raw `context` (operation/version/label fields) and `request_id`

### Requirement: Paginated with standard page sizes

The list SHALL use `DataTablePagination` with a default page size of 25 and selectable sizes of 10 / 25 / 50, driven by the backend `Page` response. Pagination is offset-based; under concurrent inserts on this append-only, time-descending log, rows MAY drift by one between page loads — an accepted v1 limitation (keyset/cursor pagination is deferred).

#### Scenario: Default page size

- **WHEN** the audit log first loads
- **THEN** at most 25 events are shown and a pager exposes page-size options 10 / 25 / 50

### Requirement: Loading, empty, and error states

The page SHALL surface the standard `DataTable` loading, empty, and error states. An empty result SHALL show a friendly empty message; a failed request SHALL show an error state with a retry affordance rather than a blank table.

#### Scenario: Empty trail

- **WHEN** `GET /audit-events` returns no items for the current filters
- **THEN** the page shows the empty-state message, not an error
