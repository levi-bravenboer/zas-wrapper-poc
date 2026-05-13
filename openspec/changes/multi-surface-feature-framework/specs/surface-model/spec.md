## ADDED Requirements

### Requirement: Surface descriptor

The orchestrator SHALL define a `Surface` model with three concrete instances exported from `apps/orchestrator/src/platform/surface/`:

| id      | data           | shell  | basePath  |
| ------- | -------------- | ------ | --------- |
| `app`   | `orchestrator` | `menu` | `/`       |
| `smart` | `fhir`         | `menu` | `/s`      |
| `embed` | `fhir`         | `bare` | `/embed`  |

The descriptor type MUST be `{ id, data, shell, basePath }` and the runtime constant MUST be a non-mutable record `SURFACES`. No fourth surface MAY be introduced without an OpenSpec change.

#### Scenario: Surface registry exports three entries

- **WHEN** a module imports `SURFACES` from `@/platform/surface`
- **THEN** the value has exactly three keys: `app`, `smart`, `embed`
- **AND** each entry exposes `data`, `shell`, `basePath` matching the table above

#### Scenario: Surface type narrows correctly

- **WHEN** a function consumes `Surface['id']`
- **THEN** TypeScript narrows it to the union `'app' | 'smart' | 'embed'`

### Requirement: SurfaceProvider supplies the active surface

Each route shell SHALL mount a `<SurfaceProvider surface={SURFACES.<id>}>` exactly once around its subtree. Consumers MUST read the active surface only through `useSurface()`, which throws when called outside any provider.

#### Scenario: AppShell mounts app surface

- **WHEN** a page renders under `routes/_auth/*`
- **THEN** `useSurface()` returns `SURFACES.app`

#### Scenario: EmbedShell mounts embed surface

- **WHEN** a page renders under `routes/_embed/*`
- **THEN** `useSurface()` returns `SURFACES.embed`

#### Scenario: Missing provider fails fast

- **WHEN** a component outside any shell calls `useSurface()`
- **THEN** it throws `Error('useSurface called outside SurfaceProvider')`

### Requirement: Surface-derived helpers

The platform SHALL export `useIsEmbed()`, `useIsSmart()`, and `useSurfaceBasePath()` derived from `useSurface()`. Pages MUST use these helpers instead of inspecting `window.location` or comparing path strings directly.

#### Scenario: useIsEmbed true only in embed surface

- **WHEN** `useIsEmbed()` is called from a page under `routes/_embed/`
- **THEN** it returns `true`
- **AND** in `routes/_auth/` or `routes/_smart/` it returns `false`

#### Scenario: Base path drives in-app links

- **WHEN** a feature renders an internal link to another feature with path `/patients`
- **THEN** the link's `to` prop is composed as `useSurfaceBasePath() + '/patients'` so the link stays within the active surface
