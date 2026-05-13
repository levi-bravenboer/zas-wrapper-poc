## ADDED Requirements

### Requirement: AppShell composes the menu chrome with orchestrator data

The orchestrator SHALL provide `AppShell` at `@/platform/embed/AppShell`. `AppShell` MUST render `<SurfaceProvider surface={SURFACES.app}>`, mount the orchestrator data port root, render the `Sidebar` and topbar, and place an `<Outlet />` for the active route. `AppShell` MUST be the only component mounted by `routes/_auth.tsx`.

#### Scenario: AppShell renders sidebar and outlet

- **WHEN** an authed user opens `/dashboard`
- **THEN** the rendered tree is `SurfaceProvider(app) → Sidebar + Outlet → DashboardPage`
- **AND** there is exactly one `<Sidebar>` element in the DOM

#### Scenario: AppShell sets orchestrator data source

- **WHEN** a feature consumes its port inside `AppShell`
- **THEN** the adapter used is `feature.adapters.orchestrator`

### Requirement: SmartShell composes the menu chrome with FHIR data

The orchestrator SHALL provide `SmartShell` at `@/platform/embed/SmartShell`. `SmartShell` MUST mount `<SurfaceProvider surface={SURFACES.smart}>`, then a `SmartProvider` (FHIR client + SMART context), then the menu chrome (`Sidebar` + topbar), then an `<Outlet />`. `SmartShell` MUST NOT require an orchestrator session.

#### Scenario: SmartShell renders sidebar with FHIR data

- **WHEN** a user opens `/s/tasks` after a successful SMART launch
- **THEN** the rendered tree contains `SurfaceProvider(smart) → SmartProvider → Sidebar + Outlet → TasksPage`
- **AND** the FHIR adapter is the active port implementation

#### Scenario: SmartShell rejects unauthenticated FHIR

- **WHEN** a user opens `/s/tasks` without a SMART token
- **THEN** `SmartShell` redirects to `/launch?surface=smart&return=/s/tasks`

### Requirement: EmbedShell composes the bare chrome with FHIR data

The orchestrator SHALL provide `EmbedShell` at `@/platform/embed/EmbedShell`. `EmbedShell` MUST mount `<SurfaceProvider surface={SURFACES.embed}>`, then a `SmartProvider`, then a minimal layout (no `Sidebar`, no topbar) with a single content region. `EmbedShell` MUST set `data-embed="hix"` on the layout root so embed-specific CSS can target it.

#### Scenario: EmbedShell omits sidebar

- **WHEN** a user opens `/embed/tasks` after a SMART launch
- **THEN** no `Sidebar` element is present in the DOM
- **AND** the rendered tree contains `SurfaceProvider(embed) → SmartProvider → main[data-embed="hix"] → TasksPage`

#### Scenario: EmbedShell rejects unauthenticated FHIR

- **WHEN** a user opens `/embed/tasks` without a SMART token
- **THEN** `EmbedShell` triggers the launch flow with `surface=embed` rather than redirecting to `/login`

### Requirement: Shells do not import feature modules

The three shells MUST NOT import any file under `apps/orchestrator/src/modules/`. They MAY only consume the registry through `@/platform/embed` query helpers (e.g. `getFeaturesForSurface`).

#### Scenario: Lint blocks module import from shells

- **WHEN** a contributor adds `import { tasksFeature } from '@/modules/tasks'` inside `platform/embed/AppShell.tsx`
- **THEN** ESLint fails with the `no-restricted-imports` rule

### Requirement: Module code does not import shells or layout

Files under `apps/orchestrator/src/modules/**` MUST NOT import from `apps/orchestrator/src/components/layout/**` or from `@/platform/embed/(AppShell|SmartShell|EmbedShell)`. They MAY import platform hooks (`useSurface`, `useFhirClient`, port helpers).

#### Scenario: Lint blocks layout import from module

- **WHEN** a contributor adds `import { Sidebar } from '@/components/layout/Sidebar'` inside `modules/tasks/TasksPage.tsx`
- **THEN** ESLint fails with the `no-restricted-imports` rule
