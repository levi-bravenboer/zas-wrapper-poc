# `src/platform/`

The platform layer hosts the multi-surface feature framework. It is upstream of `src/modules/` and `src/components/` — features depend on the platform, never the reverse (enforced by `import-x/no-restricted-paths` in `eslint.config.js`).

## Surfaces

A surface is the runtime context a clinical view executes in. Three are defined in `surface/registry.ts`:

| Surface | `data`       | `shell` | `basePath`  | When                                              |
| ------- | ------------ | ------- | ----------- | ------------------------------------------------- |
| `app`   | orchestrator | menu    | `/`         | Standalone web app, our chrome, our API           |
| `smart` | fhir         | menu    | `/s`        | SMART-on-FHIR launch, our chrome, FHIR data       |
| `embed` | fhir         | bare    | `/embed`    | HiX iframe, host chrome, FHIR data                |

`useSurface()` returns the active `Surface`. `useIsEmbed()`, `useIsSmart()`, `useSurfaceBasePath()` are derived helpers.

## Ports + adapters

A page consumes a typed **port** and never sees raw FHIR or orchestrator DTOs. The port shape is defined once per feature; each surface supplies an **adapter** that satisfies it.

```ts
// modules/tasks/ports.ts
export type TasksPort = {
  readonly list: () => Promise<readonly Task[]>
  readonly complete: (id: string) => Promise<void>
}
export const tasksPort = createPort<TasksPort>('Tasks')
```

```ts
// modules/tasks/adapters/orchestrator.ts
export function orchestratorTasksPort(deps: OrchestratorDeps): TasksPort {
  return { /* uses deps.api */ }
}

// modules/tasks/adapters/fhir.ts
export function fhirTasksPort(deps: FhirDeps): TasksPort {
  return { /* uses deps.client */ }
}
```

`renderFeature` reads `useSurface()` and mounts the right adapter — page code never branches on surface.

## Defining a feature

```ts
// modules/<id>/index.ts
export const <id>Feature = defineFeature({
  id: '<id>',
  path: '/<id>',
  titleKey: 'nav.<id>',
  page: <Pascal>Page,
  port: <id>Port,
  surfaces: ['app', 'smart', 'embed'] as const,
  adapters: {
    orchestrator: orchestrator<Pascal>Port,
    fhir: fhir<Pascal>Port,
  },
  smart: { scopes: ['patient/<Type>.read'], requires: ['patient'] },
  nav: { icon: Square, order: 99 },
})
```

Then re-export from `modules/index.ts` so the module's side-effect import runs at boot.

Each declared surface needs a 3-line route shim:

```ts
// routes/<surface-dir>/<id>.tsx — e.g. routes/_auth/tasks.tsx, routes/s/tasks.tsx
export const Route = createFileRoute('/<surface-prefix>/<id>')({
  component: () => renderFeature(<id>Feature),
})
```

## When NOT to use `defineFeature`

Some pages are intentionally app-only forever and bypass the registry entirely:

- `/_auth/admin/*` — organisations, users, practitioner roles
- `/_auth/settings`
- `/_auth/pathways/*` — proprietary care-pathway workflow with no FHIR equivalent
- `/_auth/index` (dashboard redirect)

Hand-write these routes under `routes/_auth/*`, prepend `// surface-opt-out: app-only` as the first line so future scanners recognise the exception, and skip `defineFeature`. The new-feature skill (`.claude/skills/new-feature/`) short-circuits when the target path matches an opt-out prefix.

The canonical opt-out list lives in `openspec/changes/multi-surface-feature-framework/page-surface-catalogue.md` (post-archive: under `openspec/changes/archive/<date>-multi-surface-feature-framework/`).

## Writing tests

- Unit-test ports + adapters in isolation under `platform/__tests__/` or `modules/<id>/__tests__/`.
- Render-test shells with `shellTestUtils.tsx` (creates a `createMemoryHistory`-backed router with the target surface wired up).
- For the embed surface specifically, `__tests__/host.test.ts` shows how to fake `window.parent.postMessage` and verify origin checks.

## Adding a new feature

Run `pnpm gen:feature` — it scaffolds the file set above, regenerates `routeTree.gen.ts`, and updates the modules barrel + `nav.json`. See `scripts/gen-feature.ts` and `.claude/skills/new-feature/SKILL.md`.
