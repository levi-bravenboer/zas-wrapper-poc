## ADDED Requirements

### Requirement: defineFeature is the only way to register a feature

The orchestrator SHALL expose `defineFeature(spec)` from `@/platform/embed`. Every clinical view that participates in routing or the sidebar nav MUST be registered via `defineFeature`. Direct route registration that bypasses the registry is forbidden for clinical views (system routes like `/login`, `/launch`, `/launch/callback`, `/`) are exempt).

#### Scenario: Feature appears in registry after import

- **WHEN** `modules/tasks/index.ts` runs and calls `defineFeature({ id: 'tasks', ... })`
- **THEN** `getFeatures()` includes a spec with `id === 'tasks'`

#### Scenario: Duplicate feature id rejected

- **WHEN** two modules call `defineFeature` with the same `id`
- **THEN** the second call throws `Error("feature 'tasks' already registered")` at import time

#### Scenario: System routes exempt

- **WHEN** the route `/login` is defined under `routes/login.tsx`
- **THEN** it is allowed to exist without a `defineFeature` entry

### Requirement: Feature spec shape

A `FeatureSpec` MUST contain the fields:

- `id` (kebab-case string, unique)
- `path` (leading-slash kebab-case route path, e.g. `/tasks`)
- `titleKey` (i18n key starting with `nav.`)
- `page` (React component, may be `lazy()`-wrapped)
- `port` (the result of `createPort<T>(name)`)
- `surfaces` (non-empty subset of `['app','smart','embed']`)
- `adapters` (object whose keys match the data sources required by `surfaces`)
- `smart` (object `{ scopes: string[], requires: Array<'patient'|'encounter'|'user'> }`, required if any FHIR surface is declared)
- `nav` (optional `{ icon: LucideIcon, order?: number }` for sidebar rendering)

#### Scenario: Missing surfaces field fails type-check

- **WHEN** a contributor writes `defineFeature({ id, path, titleKey, page, port, adapters })` with no `surfaces`
- **THEN** TypeScript reports an error: `Property 'surfaces' is missing`

#### Scenario: Surfaces drive required adapters

- **WHEN** `surfaces` includes `'app'` but `adapters.orchestrator` is missing
- **THEN** TypeScript reports an error on the spec

#### Scenario: SMART block required for FHIR surfaces

- **WHEN** `surfaces` includes `'smart'` or `'embed'` but `smart` is undefined
- **THEN** TypeScript reports an error on the spec

### Requirement: Registry exposes query helpers

The registry SHALL export:

- `getFeatures(): readonly FeatureSpec[]`
- `getFeaturesForSurface(id: Surface['id']): readonly FeatureSpec[]`
- `getFeatureById(id: string): FeatureSpec | undefined`
- `getRequiredScopes(): readonly string[]` returning the deduplicated union of `smart.scopes` across embeddable features

#### Scenario: Sidebar nav consumes registry

- **WHEN** the `Sidebar` component renders inside the `app` surface
- **THEN** it iterates `getFeaturesForSurface('app')` to produce nav items
- **AND** it never imports a feature module directly

#### Scenario: SMART manifest builder consumes registry

- **WHEN** the build step constructs the SMART manifest
- **THEN** it calls `getRequiredScopes()` and writes the result to the manifest's `scope` field

### Requirement: Module barrel imported at boot

`apps/orchestrator/src/modules/index.ts` SHALL re-export every feature module so that `import '@/modules'` registers all features. `src/main.tsx` MUST import `@/modules` before `createRouter` is called.

#### Scenario: Features registered before router build

- **WHEN** the app boots
- **THEN** at the point of `createRouter`, `getFeatures().length` is greater than zero
- **AND** an assertion in `main.tsx` enforces this and throws a descriptive error otherwise
