# app-shell Specification

## Purpose
TBD - created by archiving change orchestrator-app-shell. Update Purpose after archive.
## Requirements
### Requirement: Canonical folder layout

The orchestrator SHALL adopt a fixed top-level folder layout under `apps/orchestrator/src/` consisting of `app/`, `routes/`, `modules/`, `components/`, `hooks/`, `lib/`, `config/`, `stores/`, `types/`, `styles/`, `test/`, and `mocks/`. New code MUST land in one of these directories.

#### Scenario: New module lives under modules/

- **WHEN** a contributor adds a new feature domain (e.g. `pathway-composer`)
- **THEN** it lives under `src/modules/<domain>/` with its own `routes/`, `components/`, `hooks/`, `api.ts`, and `schemas.ts` as needed
- **AND** it does NOT import directly from sibling `modules/*` folders

#### Scenario: Cross-module sharing promotes to lib

- **WHEN** code is needed by two or more modules
- **THEN** it is promoted to `src/lib/<topic>/` or `src/components/` and imported from there

### Requirement: Provider tree composed once

The orchestrator SHALL compose its root provider tree (Query client, Router, i18n, theme, error boundary, toaster) exactly once in `src/app/providers.tsx`, rendered from `src/main.tsx`. Tests MUST reuse a `renderWithProviders` helper that mirrors the same tree.

#### Scenario: App boot wires every provider

- **WHEN** `main.tsx` mounts the root
- **THEN** the rendered tree contains the `QueryClientProvider`, `RouterProvider`, `I18nextProvider`, error boundary, and toaster in that order

#### Scenario: Tests reuse the provider tree

- **WHEN** a Vitest test renders a component that uses Query or i18n
- **THEN** it calls `renderWithProviders` from `src/test/` instead of bare `render`

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

