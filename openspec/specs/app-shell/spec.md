# app-shell Specification

## Purpose
TBD - created by archiving change orchestrator-app-shell. Update Purpose after archive.
## Requirements
### Requirement: Canonical folder layout

The orchestrator SHALL adopt a fixed top-level folder layout under `apps/orchestrator/src/` consisting of `app/`, `routes/`, `modules/`, `platform/`, `components/`, `hooks/`, `lib/`, `config/`, `stores/`, `types/`, `styles/`, `test/`, and `mocks/`. New code MUST land in one of these directories. The `platform/` directory hosts the multi-surface framework (`surface/`, `embed/`, `ports/`, `smart/`, `fhir/`) and MUST NOT import from `modules/`.

#### Scenario: New module lives under modules/

- **WHEN** a contributor adds a new feature domain (e.g. `pathway-composer`)
- **THEN** it lives under `src/modules/<domain>/` with its own `ports.ts`, `adapters/`, `schemas.ts`, page component, and `index.ts` calling `defineFeature`
- **AND** it does NOT import directly from sibling `modules/*` folders
- **AND** it does NOT import from `components/layout/**`

#### Scenario: Cross-module sharing promotes to lib or platform

- **WHEN** code is needed by two or more modules
- **THEN** it is promoted to `src/lib/<topic>/`, `src/platform/<topic>/`, or `src/components/` and imported from there

#### Scenario: Platform does not depend on modules

- **WHEN** a file under `src/platform/**` imports from `src/modules/**`
- **THEN** ESLint fails with the `no-restricted-imports` rule

### Requirement: Provider tree composed once

The orchestrator SHALL compose its root provider tree (Query client, Router, i18n, theme, error boundary, toaster) exactly once in `src/app/providers.tsx`, rendered from `src/main.tsx`. Each route segment additionally composes a single layout shell (`AppShell`, `SmartShell`, or `EmbedShell`) inside the root tree; multiple shells MUST NOT nest. Tests MUST reuse a `renderWithProviders` helper that mirrors the root tree, with an optional `surface` argument to mount the matching shell for surface-specific tests.

#### Scenario: App boot wires every provider

- **WHEN** `main.tsx` mounts the root
- **THEN** the rendered tree contains the `QueryClientProvider`, `RouterProvider`, `I18nextProvider`, error boundary, and toaster in that order
- **AND** the active route segment mounts exactly one of `AppShell`, `SmartShell`, or `EmbedShell`

#### Scenario: Tests reuse the provider tree with a surface

- **WHEN** a Vitest test renders a feature page intended for the embed surface
- **THEN** it calls `renderWithProviders(<page/>, { surface: 'embed', port: mockPort })` and the embed shell is mounted

### Requirement: Root error boundary

The app SHALL wrap its root in an error boundary that catches render errors and shows a localized "iets ging mis" surface with a retry action. The boundary MUST log errors to the console in dev and to a no-op reporter in POC.

#### Scenario: Render error surfaces the fallback

- **WHEN** a descendant component throws during render
- **THEN** the boundary renders the localized error surface with a "probeer opnieuw" button
- **AND** the underlying route remains unmounted until retry

### Requirement: Strict TypeScript baseline

The orchestrator SHALL compile under TypeScript 6 strict mode with `noUncheckedIndexedAccess`, `noImplicitOverride`, and `exactOptionalPropertyTypes` enabled. Path alias `@/*` MUST resolve to `src/*`.

#### Scenario: Strict flags enforced

- **WHEN** `moon run orchestrator:typecheck` runs
- **THEN** the build fails on any implicit `any`, unchecked array access, or missing override

#### Scenario: Path alias resolves

- **WHEN** a file imports `@/lib/api/client`
- **THEN** TypeScript and Vite resolve it to `src/lib/api/client.ts`

### Requirement: Surface-aware Shell mount

`Shell.tsx` SHALL branch on the active surface read from `useSurface()` / the `SURFACES` registry in `src/platform/surface/registry.ts`. Surfaces whose `shell` field is `"menu"` (`app`, `smart`) MUST render the sidebar shell defined below. Surfaces whose `shell` field is `"bare"` (`embed`) MUST render only a bare content slot — no sidebar, no chrome — so the orchestrator can be embedded inside HiX without competing chrome. `Shell.tsx` is the single mount point that performs this branch; route files MUST NOT decide per-route whether to render the sidebar.

#### Scenario: app surface renders sidebar shell

- **WHEN** an authed user opens `/` (surface `app`)
- **THEN** the rendered tree is `Shell` → `Sidebar` + `SidebarInset` content slot

#### Scenario: smart surface renders sidebar shell

- **WHEN** an authed user opens `/s/` (surface `smart`)
- **THEN** the rendered tree is `Shell` → `Sidebar` + `SidebarInset` content slot

#### Scenario: embed surface renders bare shell

- **WHEN** an authed user opens `/embed/<route>` (surface `embed`)
- **THEN** the rendered tree is `Shell` → bare content slot
- **AND** no element with role `navigation` belonging to the sidebar exists in the DOM
- **AND** no element with the `glass` sidebar styling is present

### Requirement: Sidebar-only shell on menu surfaces

On `app` and `smart` surfaces the orchestrator SHALL render its authed routes as a sidebar-only shell. No global top bar is permitted. The sidebar SHALL be flush full-height (`inset: 0 auto 0 0`) with square edges and no outer margin. The page content SHALL fill the remaining horizontal viewport. The shell wrapper component lives at `src/components/layout/Shell.tsx`.

#### Scenario: Authed route renders inside Shell

- **WHEN** an authed user opens `/`
- **THEN** the rendered tree is `Shell` → sidebar + content slot
- **AND** no element with role `banner` exists outside the sidebar

#### Scenario: Sidebar reaches viewport edges

- **WHEN** the shell mounts at any viewport ≥ 1024px on a menu surface
- **THEN** the sidebar's bounding box starts at `x = 0`, `y = 0`, `height = 100vh`
- **AND** has no border-radius

### Requirement: Base page composition

Every authed page SHALL compose itself through the shell rather than mounting layout chrome ad-hoc. On menu surfaces (`app`, `smart`) the composition MUST be `Shell` → `SidebarInset` → `PageHeader` → page body. On the bare surface (`embed`) the composition MUST be `Shell` → bare content slot → page body, with no `PageHeader` and no sidebar. Pages MUST NOT render their own `<aside>` navigation, their own top bar, or their own breadcrumb — those concerns belong to `Shell` and `PageHeader`.

#### Scenario: Menu-surface page uses PageHeader

- **WHEN** the `/` route renders
- **THEN** its tree under `SidebarInset` starts with a single `PageHeader` followed by the page body
- **AND** no `<h1>` is rendered outside that `PageHeader`

#### Scenario: Embed-surface page omits PageHeader

- **WHEN** a route on the `embed` surface renders
- **THEN** no `PageHeader` is present in the rendered tree
- **AND** the page body is the only child of the bare content slot

#### Scenario: No ad-hoc layout chrome

- **WHEN** `moon run orchestrator:lint` runs
- **THEN** no file under `src/routes/**` or `src/modules/**` renders an `<aside>` element or imports `Sidebar` directly from `@/components/ui/`

### Requirement: Collapsible sidebar with persistence

The sidebar SHALL be collapsible between an expanded width of 240px and a collapsed width of 64px. Toggling SHALL be triggered by the keyboard shortcut `⌘\` on macOS / `Ctrl+\` on other platforms, OR by clicking the rail toggle at the sidebar footer. The collapsed flag MUST persist across reloads in `localStorage` under the key `orchestrator.sidebar.collapsed` as the string `"true"` or `"false"`. Below the `lg` breakpoint (1024px) the sidebar MUST force-collapse and ignore the persisted preference until the viewport returns to ≥ 1024px. Below the `sm` breakpoint (640px) the sidebar MUST render as a drawer (overlay), not as the inline rail.

#### Scenario: Toggle persists across reload

- **WHEN** a user collapses the sidebar via `⌘\` and reloads the page
- **THEN** the sidebar mounts in the collapsed state on next load

#### Scenario: Forced collapse below breakpoint

- **WHEN** the viewport is 900px wide and the persisted preference is `"false"` (expanded)
- **THEN** the sidebar renders collapsed
- **AND** `localStorage["orchestrator.sidebar.collapsed"]` is not modified

### Requirement: Sidebar branding and user blocks

The sidebar SHALL render a brand block at the top containing a gradient mark, the product name "ZAS Orchestrator", and a version pill read from `package.json` at build time. In collapsed mode the name and version SHALL be visually hidden; only the mark remains. The sidebar SHALL render a user block at the bottom containing the current user's avatar, name, and role inside a `.glass` card. Clicking the user block opens a shadcn `DropdownMenu` with the actions: profile, settings (stub in PoC), sign-out.

#### Scenario: Version pill reads from package.json

- **WHEN** the shell mounts
- **THEN** the version pill shows the value of `apps/orchestrator/package.json` `version` (e.g. `v0.3.0`)

#### Scenario: Sign-out action calls useLogout

- **WHEN** a user clicks "Uitloggen" in the user dropdown
- **THEN** the `useLogout` mutation runs and the router navigates to `/login` on success

### Requirement: Global command palette

The shell SHALL mount a global command palette component (`src/components/layout/CommandPalette.tsx`) reachable via the keyboard shortcut `⌘K` on macOS / `Ctrl+K` on other platforms. The palette MUST list available routes (Overzicht in PoC) and resolve to a TanStack Router navigation when an item is selected. The palette MUST be mounted exactly once inside `Shell.tsx`.

#### Scenario: Shortcut opens palette

- **WHEN** an authed user presses `⌘K`
- **THEN** the palette opens with the route list focused

#### Scenario: Single mount point

- **WHEN** `moon run orchestrator:lint` runs
- **THEN** no file under `src/routes/**` or `src/modules/**` imports `CommandPalette`

### Requirement: Hybrid `PageHeader` component

Every authed page SHALL render its page header through the shared `PageHeader` component at `src/components/layout/PageHeader.tsx`. The component SHALL accept the slots: `title` (required, string or node), `sub` (optional), `eyebrow` (optional), `actions` (optional), `tabs` (optional, array of `{ to, label }`). The component SHALL auto-render a breadcrumb above the title when `useMatches()` returns more than two matches (root + auth wrap + content). Crumb labels MUST be read from each match's `staticData.breadcrumb` (string) or the loader's returned `crumb`; URL segments MUST NOT be used as a fallback. Pages MUST NOT compose their own header markup directly.

#### Scenario: Required title

- **WHEN** a page renders `<PageHeader />` with no `title`
- **THEN** TypeScript flags the missing required prop and the build fails

#### Scenario: Auto-crumb at depth > 2

- **WHEN** a route at `/_auth/patient/$id` renders `<PageHeader title="De Smet, J." />`
- **THEN** the rendered tree includes a breadcrumb showing only the route-provided crumb labels (no `_auth` segment, no URL slug)

#### Scenario: No bespoke headers

- **WHEN** `moon run orchestrator:lint` runs
- **THEN** no file under `src/routes/**` or `src/modules/**` renders an `<h1>` outside of a `PageHeader` invocation

### Requirement: Modules do not import layout components

Files under `apps/orchestrator/src/modules/**` MUST NOT import any component from `apps/orchestrator/src/components/layout/**` or any of the three shells from `@/platform/embed`. Shared layout primitives consumed by features (cards, page headers, toolbars) MUST live under `src/components/ui/` or `src/components/page/` rather than `src/components/layout/`.

#### Scenario: Lint blocks layout import

- **WHEN** `modules/tasks/TasksPage.tsx` imports `@/components/layout/AppLayout`
- **THEN** ESLint fails with the `no-restricted-imports` rule and a message pointing to `components/page/` as the correct location

#### Scenario: Page header lives outside layout/

- **WHEN** a feature needs a reusable page-title header
- **THEN** it imports it from `@/components/page/PageHeader` (not from `@/components/layout/`)

