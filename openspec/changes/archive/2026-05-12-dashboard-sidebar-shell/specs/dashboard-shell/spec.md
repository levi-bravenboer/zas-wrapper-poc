## ADDED Requirements

### Requirement: Persistent sidebar layout for authed routes

The orchestrator SHALL render a persistent left sidebar plus main content area for every route under `_auth`. The sidebar MUST remain mounted across child route transitions (no remount on navigation). The layout MUST live in `src/components/layout/AppLayout.tsx` and be rendered by `src/routes/_auth.tsx`.

#### Scenario: Sidebar persists across navigation

- **WHEN** an authed user navigates from `/dashboard` to `/taken`
- **THEN** the sidebar DOM node is preserved and only the main content area swaps
- **AND** no full page reload occurs

#### Scenario: Layout owned by single file

- **WHEN** a contributor needs to change sidebar chrome
- **THEN** they edit `src/components/layout/AppLayout.tsx` (or its `Sidebar.tsx` child) and the change applies to every authed route

### Requirement: Sidebar nav inventory

The sidebar SHALL display exactly five primary nav items in this order, each with a Lucide icon and a Dutch label translated via the `nav` i18n namespace:

1. Dashboard → `/dashboard` → `Home` icon → `t('nav.dashboard')`
2. Taken → `/taken` → `ListTodo` icon → `t('nav.taken')`
3. Zorgpaden → `/zorgpaden` → `Workflow` icon → `t('nav.zorgpaden')`
4. Mijn patiënten → `/patienten` → `Users` icon → `t('nav.patienten')`
5. Instellingen → `/instellingen` → `Settings` icon → `t('nav.instellingen')`

Items MUST be defined as a typed `NavItem[]` constant exported from `src/components/layout/navItems.ts` so tests can iterate it.

#### Scenario: Sidebar renders the full inventory

- **WHEN** the layout mounts for an authed user
- **THEN** the sidebar contains five anchor elements in the order above
- **AND** each anchor's accessible name equals the translated Dutch label

#### Scenario: Adding an item is one source of truth

- **WHEN** a contributor pushes a new entry into `navItems.ts`
- **THEN** it appears in the sidebar without any sidebar component edit
- **AND** missing translation keys log a dev warning rather than throwing

### Requirement: Active route highlighting

The sidebar SHALL visually distinguish the nav item whose `to` matches the current route. Match MUST be derived from TanStack Router (`useRouterState` or `Link`'s `activeProps`), not from `window.location`. The active style MUST use semantic tokens (`bg-accent`, `text-accent-foreground`) — no arbitrary color values.

#### Scenario: Current route highlights its item

- **WHEN** the user is on `/zorgpaden`
- **THEN** the Zorgpaden anchor has `aria-current="page"`
- **AND** it renders with the active background/foreground tokens
- **AND** no other nav item is marked active

#### Scenario: Highlight follows navigation

- **WHEN** the user clicks the Taken item from `/dashboard`
- **THEN** the Taken item becomes active and the Dashboard item loses its active state before the next paint

### Requirement: Section placeholder pages

Each non-dashboard section (`/taken`, `/zorgpaden`, `/patienten`, `/instellingen`) SHALL render a placeholder page consisting of an `<h1>` with the section's Dutch label and a single paragraph reading `t('nav.placeholder')`. Placeholder pages MUST live under `src/routes/_auth/<segment>.tsx`. The `/dashboard` route MUST render a dedicated `DashboardPage` component (placeholder for now, but with its own component name and file to receive real content later).

#### Scenario: Placeholder section renders header + body

- **WHEN** an authed user navigates to `/instellingen`
- **THEN** the main area renders an `<h1>` with text "Instellingen"
- **AND** a paragraph with the placeholder copy

#### Scenario: Dashboard route is not a generic placeholder

- **WHEN** an authed user navigates to `/dashboard`
- **THEN** the rendered component is `DashboardPage` from `src/routes/_auth/dashboard.tsx`
- **AND** the file does NOT reuse the generic placeholder component shared by the other four sections
