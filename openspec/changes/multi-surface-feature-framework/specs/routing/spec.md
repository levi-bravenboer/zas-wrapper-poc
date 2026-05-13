## MODIFIED Requirements

### Requirement: Authed section routes

The `_auth` segment SHALL host clinical section routes generated from the feature registry (e.g. `/dashboard`, `/tasks`, `/pathways`, `/patients`, `/settings`). Each section MUST be one file under `apps/orchestrator/src/routes/_auth/` whose body is a single `renderFeature(spec)` call (with the exception of `/dashboard` which MAY remain hand-written until it is migrated to a feature module). All `_auth` section routes MUST inherit the guard from `_auth.tsx` and the `AppShell` layout. Route file names and route IDs MUST use English identifiers (kebab-case). Dutch text MUST live only in i18n values.

#### Scenario: Section route inherits guard

- **WHEN** an unauthenticated user opens `/patients`
- **THEN** the `_auth` guard redirects to `/login?redirect=%2Fpatients`

#### Scenario: Section route inherits layout

- **WHEN** an authed user opens `/pathways`
- **THEN** the rendered tree is `AppShell` → section content
- **AND** the sidebar is present in the DOM

#### Scenario: English identifiers enforced

- **WHEN** a contributor adds `routes/_auth/taken.tsx`
- **THEN** lint or codegen rejects the filename because the registry resolves feature paths to English ids

## ADDED Requirements

### Requirement: Surface-prefixed route segments

The orchestrator SHALL host clinical pages under three surface segments matching the surface registry: `routes/_auth/<id>.tsx`, `routes/_smart/<id>.tsx`, and `routes/_embed/<id>.tsx`. The `_smart` segment MUST be guarded by a SMART context guard and wrap content in `SmartShell`; the `_embed` segment MUST wrap content in `EmbedShell`; the `_auth` segment continues to wrap content in `AppShell`. Each `<id>.tsx` file MUST exist if and only if the corresponding feature's `surfaces` array includes that surface.

#### Scenario: Embed route renders without sidebar

- **WHEN** a SMART-authenticated user opens `/embed/tasks`
- **THEN** the route renders `EmbedShell → renderFeature(tasksFeature)` with no `Sidebar` element

#### Scenario: Smart route requires SMART context

- **WHEN** a user opens `/s/tasks` without a SMART token in memory
- **THEN** the `_smart` guard redirects to `/launch?surface=smart&return=/s/tasks`

#### Scenario: Route file presence matches feature surfaces

- **WHEN** `tasksFeature.surfaces = ['app', 'embed']`
- **THEN** `routes/_auth/tasks.tsx` and `routes/_embed/tasks.tsx` exist
- **AND** `routes/_smart/tasks.tsx` does NOT exist

### Requirement: Route stubs derived from feature registry

Every route file under `routes/_auth/<id>.tsx`, `routes/_smart/<id>.tsx`, and `routes/_embed/<id>.tsx` for an embeddable feature SHALL contain only a `createFileRoute` call whose `component` is `renderFeature(spec)`. The stub MUST be produced by `pnpm gen:feature` and MUST NOT be hand-edited beyond import additions emitted by the generator. The router MUST resolve the feature's `path` from the spec; hand-typing a path string different from `spec.path` is forbidden.

#### Scenario: Stub body is one line

- **WHEN** a generated route stub for `tasks` under `_embed` is opened
- **THEN** its `Route` export consists of `createFileRoute('/_embed/tasks')({ component: renderFeature(tasksFeature) })` and no additional logic

#### Scenario: Hand-edited stub flagged by lint

- **WHEN** a stub file has any code other than the imports and the `Route` export
- **THEN** a custom eslint rule reports a violation pointing to the file
