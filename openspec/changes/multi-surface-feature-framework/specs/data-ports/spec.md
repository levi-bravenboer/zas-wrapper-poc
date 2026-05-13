## ADDED Requirements

### Requirement: createPort utility

The orchestrator SHALL provide a generic `createPort<T>(name: string)` utility at `@/platform/ports/createPort`. It MUST return `{ Provider, use }` where `Provider` is a typed React context provider and `use()` returns the current value or throws `Error("<name> port missing")` when consumed outside a provider.

#### Scenario: Port utility throws outside provider

- **WHEN** a component calls `useTasksPort()` outside any `TasksPort.Provider`
- **THEN** it throws `Error("Tasks port missing")`

#### Scenario: Port utility supplies typed value

- **WHEN** `createPort<{ list: () => Promise<Task[]> }>('Tasks')` is consumed under a provider
- **THEN** `useTasksPort()` returns a value typed as `{ list: () => Promise<Task[]> }`

### Requirement: Adapter contract per surface

A feature's `adapters` object MUST contain:

- `orchestrator: (deps: { api: ApiClient }) => Port` when `surfaces` includes `'app'`
- `fhir: (deps: { client: FhirClient, ctx: SmartContext }) => Port` when `surfaces` includes `'smart'` or `'embed'`

Adapters MUST be pure factory functions that take only their declared `deps`. They MUST NOT reach for global singletons (`window.fetch` excluded — adapters MAY use it for orchestrator calls that go through `deps.api`).

#### Scenario: Adapter receives client and ctx for FHIR

- **WHEN** `SmartShell` invokes `feature.adapters.fhir`
- **THEN** the call passes `{ client: useSmart().client, ctx: useSmart().ctx }`

#### Scenario: Adapter receives api for orchestrator

- **WHEN** `AppShell` invokes `feature.adapters.orchestrator`
- **THEN** the call passes `{ api: useApi() }`

### Requirement: Pages consume the port, never the source

Page components under `modules/<id>/` MUST consume their data exclusively through the feature's port hook (e.g. `useTasksPort()`). They MUST NOT import `useApi`, `useFhirClient`, or any FHIR resource type at the page layer.

#### Scenario: Lint blocks api/fhir import from page

- **WHEN** `modules/tasks/TasksPage.tsx` imports `useApi` or `useFhirClient`
- **THEN** ESLint fails with a custom `no-restricted-imports` entry that names the violating file path

#### Scenario: Page uses only port

- **WHEN** `TasksPage` queries data
- **THEN** the call goes through `useTasksPort().list(params)` and the result is the domain `Task[]`, not a FHIR `Bundle`

### Requirement: renderFeature resolves the adapter from the surface

The platform SHALL export `renderFeature(spec)` that returns a route component. The returned component MUST:

1. Call `useSurface()` to read the active surface.
2. Select `spec.adapters.orchestrator` when `surface.data === 'orchestrator'`, otherwise `spec.adapters.fhir`.
3. Memoize the resulting port and mount `<spec.port.Provider value={port}><spec.page /></spec.port.Provider>`.

#### Scenario: renderFeature picks orchestrator adapter under AppShell

- **WHEN** `renderFeature(tasksFeature)` is rendered under `AppShell`
- **THEN** the adapter executed is `tasksFeature.adapters.orchestrator`

#### Scenario: renderFeature picks fhir adapter under EmbedShell

- **WHEN** `renderFeature(tasksFeature)` is rendered under `EmbedShell`
- **THEN** the adapter executed is `tasksFeature.adapters.fhir`

#### Scenario: Port memoized across re-renders

- **WHEN** the parent component re-renders without changing surface or client
- **THEN** the port instance passed to the page is referentially stable
