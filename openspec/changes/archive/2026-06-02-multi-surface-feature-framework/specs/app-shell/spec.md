## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Modules do not import layout components

Files under `apps/orchestrator/src/modules/**` MUST NOT import any component from `apps/orchestrator/src/components/layout/**` or any of the three shells from `@/platform/embed`. Shared layout primitives consumed by features (cards, page headers, toolbars) MUST live under `src/components/ui/` or `src/components/page/` rather than `src/components/layout/`.

#### Scenario: Lint blocks layout import

- **WHEN** `modules/tasks/TasksPage.tsx` imports `@/components/layout/AppLayout`
- **THEN** ESLint fails with the `no-restricted-imports` rule and a message pointing to `components/page/` as the correct location

#### Scenario: Page header lives outside layout/

- **WHEN** a feature needs a reusable page-title header
- **THEN** it imports it from `@/components/page/PageHeader` (not from `@/components/layout/`)
