# caregiver-shell Specification

## Purpose
TBD - created by archiving change caregiver-shell. Update Purpose after archive.
## Requirements
### Requirement: Hybrid sidebar nav with role-gated admin section

The orchestrator SHALL render a single sidebar inventory consisting of three groups:

1. **Top** (visible to all authed users): `Dashboard` → `/_auth/`, `Patiënten` → `/_auth/patients`, `Inbox` → `/_auth/inbox` (placeholder).
2. **Beheer** (collapsible, visible only to `session.user.role === 'admin'`): `Gebruikers` → `/_auth/admin/users`, `Organisaties` → `/_auth/admin/organisations`, `Affiliaties` → `/_auth/admin/practitioner-roles`.
3. **Pinned bottom** (visible to all authed users): `Instellingen` → `/_auth/settings`.

The inventory SHALL live in a single file under `apps/orchestrator/src/components/nav/sidebar-items.ts` and SHALL be filtered by role at render time — entries whose `requiresRole` list does not include the current session role MUST NOT appear in the DOM. The admin route group `_auth/admin/*` SHALL additionally enforce admin-only access at the layout level, so deep-linking by a non-admin redirects to `/_auth/`.

#### Scenario: Caregiver does not see the Beheer group

- **WHEN** a session with `role === 'caregiver'` renders the sidebar
- **THEN** no nav entry whose path starts with `/_auth/admin/` is present in the DOM, and the `Beheer` group header is not rendered

#### Scenario: Admin sees the Beheer group

- **WHEN** a session with `role === 'admin'` renders the sidebar
- **THEN** the `Beheer` group header is rendered with the three nested entries `Gebruikers`, `Organisaties`, `Affiliaties` in that order

#### Scenario: Caregiver deep-link to admin route is redirected

- **WHEN** a caregiver navigates directly to `/_auth/admin/users`
- **THEN** the admin route group's layout MUST redirect them to `/_auth/` without rendering the placeholder content

### Requirement: Landing route renders dashboard with KPI tiles and quick links

The orchestrator SHALL render at `/_auth/` (replacing the prior redirect to `/_auth/patients`) a `<DashboardLanding>` component composed of three KPI tiles and a set of quick-link cards. KPI counts SHALL be fetched via existing list endpoints with `page_size=1`, reading `Page.total` from the response. A fetch failure on any individual tile SHALL render an em-dash (`—`) for that count, never throw or render an error boundary.

- KPI tiles: `Open care teams` (count from `GET /care-teams?is_open=true`), `Patients in your reach` (count from `GET /patients`), `Recent assignments` (count from `GET /care-team-participants?period_start_gte=<7d ago>`).
- Quick-link cards (all sessions): `Patiënten` → `/_auth/patients`.
- Quick-link cards (admin only): `Gebruikers`, `Organisaties`, `Affiliaties` linking to the corresponding admin routes.

#### Scenario: Landing renders for caregiver without admin cards

- **WHEN** a caregiver loads `/_auth/`
- **THEN** the page renders the three KPI tiles and the `Patiënten` quick-link card, and MUST NOT render any quick-link card pointing to `/_auth/admin/*`

#### Scenario: Landing renders for admin with admin cards

- **WHEN** an admin loads `/_auth/`
- **THEN** the page renders the three KPI tiles plus quick-link cards for `Patiënten`, `Gebruikers`, `Organisaties`, `Affiliaties`

#### Scenario: KPI tile fetch failure renders em-dash

- **WHEN** the request to `GET /care-teams?is_open=true&page_size=1` returns a non-2xx response
- **THEN** the `Open care teams` tile MUST render `—` in place of a number; the rest of the dashboard MUST stay interactive

### Requirement: FilterableListPage scaffolding wraps every chain list surface

The orchestrator SHALL export a generic component `<FilterableListPage<T>>` at `apps/orchestrator/src/components/list/FilterableListPage.tsx` exposing exactly the following named slots:

- `title` (required, string or node) — page title rendered as `h1`.
- `description` (optional, node) — secondary copy under the title.
- `primaryAction` (optional, node) — right-aligned CTA next to the filter row (e.g. `Gebruiker toevoegen`).
- `filters` (optional, node) — left-aligned filter chips / dropdowns row.
- `table` (required, node) — the `<DataTable<T>>` instance the consumer composes.
- `emptyState` (optional, node) — alternative content rendered ONLY when the consumer's `<DataTable<T>>` reports zero rows AND zero applied filters.

The component SHALL NOT own data, query state, or pagination — those remain in the consumer's `<DataTable<T>>` instance and its `usePaginatedQuery` call. Slot props MUST be plain ReactNodes (no render-props); the scaffolding is layout, not control.

The existing `/_auth/patients` page SHALL be refactored to compose this scaffolding around its current `<DataTable<PatientRead>>`. The refactor MUST preserve URL keys, default sort, row-click navigation, kebab actions, and realtime invalidation byte-for-byte. The existing patients-page test suite MUST pass without edits.

#### Scenario: Empty state renders only when table is empty and filters are unset

- **WHEN** the consumer's `<DataTable>` reports zero rows AND no `q` / `filter[...]` keys are present in the URL
- **THEN** `<FilterableListPage>` renders the `emptyState` slot in place of the `table` slot

#### Scenario: Empty filtered result does NOT trigger emptyState

- **WHEN** the consumer's `<DataTable>` reports zero rows AND any `filter[...]` key is present in the URL
- **THEN** `<FilterableListPage>` renders the `table` slot (so the user sees "no results match your filter" copy from the DataTable itself), not the `emptyState` slot

#### Scenario: Existing patients page renders without behavioural drift

- **WHEN** the patients page test suite runs against the refactored `_auth/patients/index.tsx`
- **THEN** every assertion (URL keys, default sort, row click target, kebab `Verwijderen` confirm, realtime invalidation) MUST pass without test-file edits

### Requirement: Admin route group layout enforces admin-only access

The orchestrator SHALL register a TanStack Router route group at `apps/orchestrator/src/routes/_auth/admin/route.tsx` whose `beforeLoad` (or component-level guard) asserts `session.user.role === 'admin'`. Non-admin sessions hitting any path under `/_auth/admin/*` MUST be redirected to `/_auth/`. Placeholder routes for `users.tsx`, `organisations.tsx`, `practitioner-roles.tsx` SHALL exist under this group and render copy of the form `"Komt binnenkort — wordt geleverd door <spec>"`; downstream chain specs (`users-admin-ui`, `organisations-admin-ui`, `practitioner-roles-admin-ui`) replace each placeholder with the real route.

#### Scenario: Layout gate redirects non-admins

- **WHEN** a caregiver loads `/_auth/admin/users`
- **THEN** the router MUST navigate to `/_auth/` before the route component mounts

#### Scenario: Placeholder route renders for admin

- **WHEN** an admin loads `/_auth/admin/users` before the `users-admin-ui` change has shipped
- **THEN** the page renders "Komt binnenkort — wordt geleverd door users-admin-ui" and a link back to `/_auth/`

### Requirement: i18n namespaces for shell, dashboard, and Beheer

The orchestrator SHALL register two new i18n namespaces — `caregiver-shell` (nav labels, Beheer group header, admin-only badge copy) and `dashboard` (KPI tile labels, quick-link card copy, fallback strings) — under `apps/orchestrator/src/i18n/<lang>/`. Both Dutch (`nl`) and English (`en`) translation files MUST exist; missing keys MUST cause a TypeScript error via the existing typed-i18n setup. No user-visible string in any new component MAY bypass the `t()` helper.

#### Scenario: Both languages present for every key

- **WHEN** the i18n type-check runs over `apps/orchestrator/src/i18n/`
- **THEN** every key declared in `en/caregiver-shell.json` and `en/dashboard.json` MUST have a matching entry in `nl/caregiver-shell.json` and `nl/dashboard.json` (and vice versa)

#### Scenario: No raw Dutch in new component source

- **WHEN** the existing eslint rule for raw user-visible strings runs over `components/nav/Sidebar.tsx`, `components/list/FilterableListPage.tsx`, and `features/dashboard/DashboardLanding.tsx`
- **THEN** zero violations MUST be reported (every label flows through `t(...)`)

