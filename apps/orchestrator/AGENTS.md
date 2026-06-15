# AGENTS.md — apps/orchestrator

Frontend app: clinician composer surface. Inherits all rules from the root `AGENTS.md`; this file overrides where it differs.

> **PoC entry point**: `/login` is the only entry. SMART-on-FHIR launch returns at `[mvp]` via the future `hix-smart-launch` change.

> **Before implementing any task, re-read `openspec/scope.md` to confirm in-tier** (`[poc]` for PoC work). Out-of-tier ideas go to `openspec/backlog.md`. Full openspec rules: `openspec/AGENTS.md`. The FHIR-Readiness Rules section below mirrors the backend's future state; PoC scope excludes live FHIR — treat the rules as seam preservation, not a current build target.

## Stack

- React 19.2
- Vite 8 (Rolldown — requires Node >= 22.13)
- TypeScript 6 strict (+ `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`)
- TanStack Router (file-based) + TanStack Query v5 + TanStack Form
- Zod, openapi-fetch + openapi-typescript
- Tailwind v4 (`@tailwindcss/vite`) + shadcn/ui primitives + lucide-react + sonner
- Brand: ZAS Antwerpen teal (`#266b5e`) primary, Linear-flavour restraint (light theme only, single accent, tight neutrals)
- Typography: Geist Variable + Geist Mono Variable, self-hosted via `@fontsource-variable/geist*` (no Google Fonts CDN)
- i18next + react-i18next (single `nl` locale)
- Vitest + Testing Library + jsdom + MSW + Playwright
- Biome (format + import sort) + ESLint 10 flat config

## Commands

```bash
moon run orchestrator:dev
moon run orchestrator:build
moon run orchestrator:typecheck
moon run orchestrator:lint
moon run orchestrator:format
moon run orchestrator:test
moon run orchestrator:test-e2e
moon run orchestrator:typegen
```

Type-check only: `npx tsc -b --noEmit`.

### Running tests

Always run through `moon`, never `vitest` / `playwright` directly. Args after `--` pass through to the underlying runner.

```bash
# Full vitest suite
moon run orchestrator:test

# Single file
moon run orchestrator:test -- src/modules/auth/__tests__/login.test.tsx

# Filter by test name (substring, regex)
moon run orchestrator:test -- -t "invalid credentials"

# Full Playwright suite
moon run orchestrator:test-e2e

# Single E2E spec
moon run orchestrator:test-e2e -- tests-e2e/login.spec.ts

# Single E2E by title
moon run orchestrator:test-e2e -- -g "logs in"
```

Watch mode is not run by agents — CI / verification flow expects a single deterministic run.

## Folder rules

```
src/
  app/         providers, router, queryClient, errorBoundary — never anything else
  routes/      TanStack Router files. Default export allowed here only. Thin: loader + page composition.
    <segment>/-components/  route-only components (- prefix ignored by router)
  modules/<name>/
    api.ts hooks.ts schemas.ts keys.ts constants.ts
    components/   module-internal components
    __tests__/    integration tests for module flows
  components/
    ui/         shadcn primitives — closed set: Alert, Avatar, Badge, Breadcrumb, Button, Card, Chart, Checkbox, Command, Dialog, DropdownMenu, Form, Icon, Input, Label, Select, Separator, Sheet, Sidebar, Skeleton, Switch, Table, Tabs, Textarea, Toaster, Tooltip. Files are lowercase / kebab (`button.tsx`, `dropdown-menu.tsx`) per shadcn CLI convention; exports remain PascalCase. Adding outside this set requires an OpenSpec change.
    layout/     cross-route chrome — AppLayout, Sidebar, navItems, SectionPlaceholder
    app/        app-wide composed blocks
  hooks/        cross-feature hooks only
  lib/
    api/        openapi-fetch client + schema.d.ts
    query/      createQueryKeys helper
    form/       TanStack Form + Zod adapters
    fhir/       FHIR-ready helpers (returns at `[mvp]`)
    i18n/       i18next bootstrap + locales/nl/<ns>.json
    style/      cn()
    utils/
  config/       env parsing, feature flags
  stores/       zustand stores — UI-only, ephemeral
  styles/       tokens.css + globals.css
  test/         setup.ts + renderWithProviders.tsx
  mocks/        handlers/ + server.ts + browser.ts
  types/        ambient declarations (*.d.ts) + cross-module shared types organised by domain (types/<domain>/)
```

### Hard rules

- **No barrel `index.ts`** anywhere. Deep imports only — `import { useSession } from '@/modules/auth/hooks'`.
- **No cross-module imports.** Promote shared code to `lib/`, `components/`, or `hooks/`. Enforced by `eslint-plugin-import` `no-restricted-paths`.
- **Path alias `@/*` → `src/*`** is the only alias. No `../../../` chains.
- **Named exports** everywhere except `routes/**` (TanStack Router file-based requirement).
- **Tests live next to source** for unit/component; integration tests under `modules/<name>/__tests__/`; E2E in `tests-e2e/`.

## Casing table

| Thing | Casing | Example |
| --- | --- | --- |
| Component file + export | PascalCase, named export | `LoginForm.tsx` → `export function LoginForm()` |
| `components/ui/*` file | lowercase / kebab (shadcn CLI), PascalCase export | `dropdown-menu.tsx` → `export function DropdownMenu()` |
| Hook | camelCase, `use` prefix | `useSession.ts` |
| Module folder | lowercase / kebab-case | `auth/`, `pathway/` |
| Route file | TanStack convention, kebab segments | `routes/_auth/index.tsx` |
| Zod schema | PascalCase + `Schema` suffix | `LoginRequestSchema` |
| Inferred type | matches schema, no suffix | `type LoginRequest = z.infer<typeof LoginRequestSchema>` |
| Constants | SCREAMING_SNAKE_CASE in `constants.ts` | `DEFAULT_LANDING_PATH` |
| Env var | `VITE_` prefix for client-exposed | `VITE_API_BASE_URL` |
| Query key | camelCase factory + tuple | `authKeys.me()` |
| Event prop | `on*` | `onSubmit` |
| Internal handler | `handle*` | `handleSubmit` |
| Backend field | leave as backend sends it | `resource_type` |
| Backend error code | `<fhir-issue>.<domain>.<reason>` (mirrors backend) | `security.auth.invalid_credentials` |
| FHIR query key | `["fhir", "<ResourceType>", ...]` capitalised | `["fhir", "Patient", id]` |
| FHIR-centred module | lowercase FHIR resource type | `modules/patient/`, `modules/observation/` |

## Typing rules

Pick the **lowest tier that fits**. Promote up only when the type genuinely needs the wider scope.

1. **OpenAPI-generated first.** If the backend exposes it, import from `lib/api/schema.d.ts`. Never hand-roll a type that openapi-typescript already emits.
   ```ts
   import type { components } from '@/lib/api/schema'
   type User = components['schemas']['User']
   ```
   Re-run `moon run orchestrator:typegen` when the backend contract changes.

2. **Zod-inferred for boundaries.** For runtime-validated payloads (route search, HTTP bodies, env) define the schema in `<module>/schemas.ts` and infer the type: `type LoginRequest = z.infer<typeof LoginRequestSchema>`.

3. **Co-located when single-consumer.** Component props, hook return shapes, file-local discriminated unions live in the same `.tsx`/`.ts`. Export only if a sibling imports.

4. **Module-shared in `<module>/types.ts`.** Used by 2+ files within one feature/platform module. Lives next to its owner: `modules/tasks/types.ts`, `platform/embed/types.ts`.

5. **Cross-module shared in `types/<domain>/`.** Only when a type is consumed by 2+ unrelated modules and has no single owner. Group by domain: `types/auth/`, `types/feature/`, `types/surface/`. One file per concern, named exports, no barrels.

6. **Ambient declarations in `types/*.d.ts`.** Module augmentation only — `css.d.ts` for `React.CSSProperties` `--*` keys, `fontsource.d.ts` for asset imports. Never domain types here.

### Cast rules

- No `any` without a one-line `// reason:` comment.
- No `as unknown as X` / `as never` outside fundamental boundaries: variance erasure (heterogeneous registries), class-instance stubs in test fixtures, third-party library quirks. Each cast carries a comment explaining why TS cannot express it.
- Prefer `satisfies` over `as` for shape constraints with literal-narrowing.
- Prefer type guards (`function isX(v): v is X`) over assertion casts at runtime boundaries.

## Coding rules

- TypeScript `strict: true`. No `any` without a one-line `// reason:` comment.
- No `enum` — use `as const` object + derived union.
- Function components only. `function` declarations, not arrows, for top-level components.
- All HTTP through `lib/api/client.ts`. Never raw `fetch` in modules outside `api.ts`.
- All server reads via `useQuery`; writes via `useMutation`. No `useState` for server data, no `useEffect` for fetching.
- All forms via TanStack Form + Zod resolver.
- Validate at boundaries: HTTP payloads, route search params, env.
- Every user-visible string goes through `t('namespace.key')`. Namespaces = module names.
- No `console.log` in committed code. Use `lib/utils/log.ts` when added.

## Code style

These are house rules. Apply when writing or refactoring `.ts` / `.tsx`. Prefer the shorter form unless the longer form is required for clarity or a concrete reason (annotated with `// reason:`).

### Control flow

- **Guard clauses / early returns.** Exit early on preconditions; keep the happy path flat. React caveat: every hook must be called before any conditional return — guards go *after* hooks.
- **Switch over long if/else chains** when mapping one value to N branches.
- **Lookup table over switch** when each case is data or a component: `const VIEWS = { list: ListView, grid: GridView }; const View = VIEWS[mode] ?? FallbackView`.
- **`for..of` over `forEach`** when the body needs `await`, `break`, or `return`.
- **`Promise.all([a, b])`** when awaits are independent.

### Component shape

- Order inside a component: hooks → derived values (`useMemo`/local consts) → handlers → return.
- Destructure props in the signature: `function Foo({ id, label }: Props)`. No `props.x` access.
- Single-use components return early for loading/error before main JSX.
- Custom hook (`use*`) for shared stateful logic. One hook = one concern.
- No premature memoization. Add `useMemo` / `useCallback` / `React.memo` only after observing a render problem; document why next to it.

### Naming

- Type for props: `[Component]Props`.
- Prop callbacks: `on*` (e.g. `onSelect`). Internal handler impl: `handle*` (e.g. `handleSelect`).
- Booleans: `is*` / `has*` / `can*` / `should*`.
- Custom hooks: `use*`.
- Event types in handlers: `React.MouseEvent<HTMLButtonElement>` — never bare or `any`.

### Idioms — null/undefined

- `??` for defaulting on null/undefined. Use `||` only when `0`/`''`/`false` should also fall back.
- `?.` for safe access through unknown chains.
- `??=` / `||=` / `&&=` for "set if missing" / "set if empty" / "update if truthy": `cache.x ??= compute()`.

### Idioms — boolean coercion

- `!!arr?.length` over `arr.length > 0` — short and null-safe.
- `Boolean(x)` only when `!!` hurts readability inline.

### Idioms — arrays (ES2023+)

- `arr.at(-1)` over `arr[arr.length - 1]`.
- `.toSorted()` / `.toReversed()` / `.toSpliced()` — non-mutating; use these in React state derivations.
- `.findLast(...)` over manual reverse loops.
- `Object.groupBy(items, (x) => x.kind)` (ES2024) over hand-rolled reducers.
- `Array.from({ length: n }, fn)` over `Array(n).fill().map(...)`.

### Idioms — destructuring

- Rename: `const { user_id: userId } = row`.
- Default: `const { count = 0 } = props`.
- Skip: `const [, second] = pair`.
- Rest: `const { id, ...rest } = obj`.

### Idioms — objects

- Shorthand: `{ id, label }` not `{ id: id, label: label }`.
- Spread merge: `{ ...base, x: 1 }`.
- Computed key: `{ [code]: value }`.
- `Object.fromEntries(arr.map(...))` for shape transforms.

### Idioms — TypeScript

- `as const` for literal narrowing: `['a','b'] as const`.
- `satisfies` over `: T` when you want the check without widening: `const cfg = { ... } satisfies Config`.
- Derive unions from data: `type Mode = (typeof MODES)[number]`.
- `import type { X }` for types — erased at build.
- Discriminated unions over flag booleans: `{ kind: 'ok' } | { kind: 'err'; message: string }`.
- Type predicates for narrowing at boundaries: `function isUser(x: unknown): x is User`.
- Use `Pick` / `Omit` / `Partial` / `Required` / `NonNullable` — don't retype shapes.

### Idioms — functions

- Arrow with implicit return for one-liners: `const double = (n: number) => n * 2`.
- Destructure single-param objects in the arg list.
- Avoid intermediate variables when the value is used exactly once and the expression stays readable.

### JSX gotchas

- `cond && <X />` is fine **only** if `cond` is boolean. Never `&&` a number — `0 && <X/>` renders `0`. Use `cond ? <X /> : null` or coerce: `!!cond && <X />`.
- Nested ternaries: at most 2 levels. Beyond that, extract to a small function or use a lookup table.
- Don't `key={index}` when the list can reorder, insert, or delete. Use a stable id.

### Avoid

- Default exports — named exports only (better refactor, better tree-shake).
- Mutating array helpers (`sort`, `reverse`, `splice`) on values you didn't just allocate — use the `to*` variants.
- Memoization without a measured cause.
- `enum` — use `as const` object + derived union (also in `## Typing rules`).
- `eval`, `with`, `Function` constructor.

### AHA (Avoid Hasty Abstractions)

- Three similar occurrences before extracting. Two ≠ a pattern.
- Inline duplication beats the wrong abstraction.
- When extracting, name by intent (`useBlockSelection`), not by mechanism (`useStateWithReducerAndCallback`).

### `any` exception

The `// reason:` annotation from the rule above also covers any of these idioms when you knowingly choose the longer or less-idiomatic form. One line, in plain English, why the deviation is intentional.

## Lists & DataTable

- All overviews MUST use `DataTable<T>` from `@/components/data-table`. No ad-hoc `<table>` outside `@/components/ui/table`. Enforced by ESLint (`no-restricted-syntax` on `JSXOpeningElement[name.name="table"]`).
- All paginated lists MUST go through `usePaginatedQuery` from `@/hooks/use-paginated-query`. No hand-rolled `useQuery` wrappers around list endpoints — enforced by ESLint.
- Column defs, filter defs, and row-action defs live at `src/modules/<name>/components/<Name>Columns.tsx`. The route file composes `<DataTable {...defs} />` only. Keep TanStack Table internals out of routes and modules — it is an implementation detail of `DataTable`.
- Pick URL persistence (`useRouteSearchTableState`) OR localStorage (`useLocalTableState`) OR neither (`useDataTableState`) — never compose two. URL wins over localStorage; both fall back to defaults.
- Bulk action UI MUST render inside `<DataTable.BulkBar>`. Bulk mutations live in `modules/<name>/api.ts` and call the backend's `POST /<resource>/<action>` endpoints returning `BulkResult`.
- Lists wanting auto-refresh MUST declare `realtimeTopic` matching the backend model's `__realtime_resource__`. The prop is documentation-only — no subscription is opened by the table; the `RealtimeInvalidationProvider` (mounted once in `src/app/providers.tsx`) drives invalidation via the `[resource]` query-key prefix.
- All user-visible strings come from the `data-table` namespace or the module's own namespace. No inline literals — enforced by the global `t('namespace.key')` rule.

### Compliant example

```tsx
// src/modules/patients/components/PatientsColumns.tsx
import type { ColumnDef, DataTableFilter, DataTableRowAction } from '@/components/data-table'
import type { components } from '@/lib/api/schema'

type Patient = components['schemas']['Patient']

export const patientColumns: ColumnDef<Patient>[] = [
  { id: 'name', header: 'naam', accessor: (p) => p.display_name, sortKey: 'display_name', sticky: true },
  { id: 'status', header: 'status', accessor: (p) => p.status, sortKey: 'status', filterKey: 'status' },
]

export const patientFilters: DataTableFilter<Patient>[] = [
  { type: 'select', key: 'status', label: 'status', options: [{ value: 'active', label: 'actief' }] },
]

export function patientRowActions(p: Patient): DataTableRowAction[] {
  return [{ label: 'archiveer', onClick: () => archivePatient(p.id), destructive: true }]
}
```

```tsx
// src/routes/_auth/patients.tsx
import { createFileRoute } from '@tanstack/react-router'

import { DataTable } from '@/components/data-table'
import { usePaginatedQuery } from '@/hooks/use-paginated-query'
import { useRouteSearchTableState } from '@/hooks/use-route-search-table-state'
import { patientColumns, patientFilters, patientRowActions } from '@/modules/patients/components/PatientsColumns'

function PatientsPage() {
  const [state, dispatch] = useRouteSearchTableState()
  const { data, isLoading, isFetching, error } = usePaginatedQuery<Patient>('/patients', state)
  return (
    <DataTable<Patient>
      data={data?.items ?? []}
      totalPages={data?.total_pages ?? 0}
      state={state}
      onStateChange={dispatch}
      columns={patientColumns}
      filterDefs={patientFilters}
      rowActions={patientRowActions}
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      realtimeTopic="patients"
      selectable
    />
  )
}

export const Route = createFileRoute('/_auth/patients')({ component: PatientsPage })
```

```ts
// src/modules/patients/api.ts
import { api } from '@/lib/api/client'

export async function archivePatients(ids: string[]) {
  const { data, error } = await api.POST('/patients/archive', { body: { ids } })
  if (error) throw new Error('archive failed')
  return data // BulkResult: { succeeded: UUID[], failed: BulkFailure[] }
}
```

### Realtime invalidation

- `<RealtimeInvalidationProvider>` is mounted exactly once in `src/app/providers.tsx`. It opens a single SSE connection to `${API_BASE_URL}/events` while a session exists and turns each `RealtimeEvent` into `queryClient.invalidateQueries({ queryKey: [event.resource], exact: false })`.
- `realtimeTopic="<resource>"` on `DataTable` is opt-in metadata that matches the backend's `__realtime_resource__`. No subscription is opened by the table — the provider already invalidates queries keyed by `[resource]`, and `paginatedQueryKey('/resource', query)` starts with `'resource'` to participate in those invalidations.
- After ≥5 SSE failures in a rolling 60 s window the provider flips `refetchOnWindowFocus` to `true` and toasts via the `data-table` namespace (`realtime.offline`) so users still get fresh data on refocus.

## Surfaces — ask before building a new page

The orchestrator ships three surfaces, defined in `src/platform/surface/registry.ts`:

| Surface | Base path | Shell | Data backend | Use case |
| --- | --- | --- | --- | --- |
| `app` | `/` | `menu` (sidebar) | orchestrator | ZAS caregiver web app |
| `smart` | `/s/` | `menu` (sidebar) | fhir | SMART-on-FHIR launch (PoC stub, MVP live) |
| `embed` | `/embed/` | `bare` (no chrome) | fhir | HiX iframe embed |

A page is a single feature module under `modules/<name>/` (page + port + adapters) registered via `defineFeature`. Each surface that exposes the page needs a 3-line route shim:

```ts
// routes/<surface>/<feature>.tsx
import { createFileRoute } from '@tanstack/react-router'
import { tasksFeature } from '@/modules/tasks'
import { renderFeature } from '@/platform/embed/renderFeature'

export const Route = createFileRoute('/<surface>/<feature>')({
  component: renderFeature(tasksFeature),
})
```

`renderFeature` reads `useSurface()` and mounts the right adapter (`orchestrator` for `app`, `fhir` for `smart` + `embed`). `Shell.tsx` reads the same `useSurface()` and renders the sidebar tree for menu surfaces, a bare slot for `embed`.

### Mandatory question

**When prompted to build a new page, ask the user which surfaces it ships on before writing code.** Options:

1. **`app` only** — webapp-internal screen (most PoC pages). One route shim under `routes/_auth/`.
2. **`app` + `embed`** — page that ZAS caregivers use AND that should embed inside HiX. Three shims (`_auth/`, `s/`, `embed/`); feature spec declares `surfaces: ['app', 'smart', 'embed']` and provides both `orchestrator` and `fhir` adapters.
3. **`embed` only** — HiX-only surface, no webapp entry. Rare. Route shim under `routes/embed/` only.

Default assumption is `app` only. If the user says "also for HiX" or "embedded" or mentions iframe / SMART-on-FHIR, surface the question explicitly before scaffolding files. Adding a surface later means writing a new adapter + a new shim; cheaper to decide up front.

### Generator and catalogue

- Platform architecture lives in [`src/platform/README.md`](./src/platform/README.md) — read it before touching surfaces, ports, or shells.
- Run `pnpm gen:feature <id> --surfaces <list> --fhir-scopes <scopes> --requires <ctx> --title-nl <label>` to scaffold a new feature. The generator wires `defineFeature`, ports, adapters, route shims, the modules barrel, and the `nav.<id>` i18n key. See `scripts/gen-feature.ts` and `.claude/skills/new-feature/`.
- The canonical page → surface decisions live in `openspec/changes/multi-surface-feature-framework/page-surface-catalogue.md` (post-archive: under `openspec/changes/archive/<date>-multi-surface-feature-framework/`). Read it before introducing a new view in an existing area.
- **Admin opt-out:** routes under `/_auth/admin/*`, `/_auth/settings`, and `/_auth/pathways/*` are app-only by intent. They MUST NOT call `defineFeature` and MUST NOT pass through `pnpm gen:feature`. Hand-write the route, skip the surface prompt, and add `// surface-opt-out: app-only` as the first line so future scanners recognise the exception.

### Page composition contract

- Menu surfaces (`app`, `smart`): `Shell` → `SidebarInset` → `PageHeader` → page body. Never render `<aside>` or your own breadcrumb.
- Bare surface (`embed`): `Shell` → bare slot → page body. No `PageHeader`, no sidebar.
- All routes mount inside `Shell`. Surface branching lives in `Shell.tsx`, not in route files.

## Router context and guards

- The router is a singleton constructed in `src/app/router.ts`. Its `context` exposes `{ queryClient }` so route loaders and guards can hit the React Query cache without prop drilling.
- The root route is `createRootRouteWithContext<RouterContext>()` so every child route gets `context.queryClient` strictly typed.
- Auth guards MUST read the session via `requireSession(context.queryClient)` from `modules/auth/guard.ts`. This wraps `ensureQueryData` on `authKeys.me()` with a 60 s stale time — fresh navigations skip the network, stale ones refetch once.
- Never call `fetchSession()` directly from a route. Never read auth state from `window.location` or component-level effects.
- Imperative navigation outside React (e.g. inside a mutation `onSuccess`) goes through `router.navigate(...)` imported from `app/router.ts`. In tests, `vi.mock('@/app/router', ...)` to assert calls.

## Agentic testing workflow

1. **TDD for non-trivial behaviour.** Failing test → implementation → refactor.
2. **Same commit, same change.** Tests + production code together.
3. **Match layer to risk** — pure → unit (Vitest), component → component (RTL + jsdom + MSW), cross-module flow → integration (`modules/<name>/__tests__/`), user-visible critical path → E2E (Playwright + MSW SW).
4. **Run via moon** — `moon run orchestrator:test`, never `vitest` directly in commit-bound work.

### Verification before completion

Always quote evidence. Minimum gate:

```
moon run orchestrator:lint
moon run orchestrator:typecheck
moon run orchestrator:test
```

For routes / components / user-visible behaviour, also:

```
moon run orchestrator:test-e2e
moon run orchestrator:build
```

Paste the final summary line of each command into the completion message.

### Must not

- Do not delete or `.skip` a failing test to make a suite pass.
- Do not mock the unit under test — mock collaborators only (HTTP via MSW, time via fake timers).
- Do not assert against mocks (`expect(handler).toHaveBeenCalled()`). Assert on rendered output / navigation / returned data.
- Do not write snapshot tests for components without an ADR.
- Do not stub `fetch` directly — always go through MSW.
- Do not test framework internals (Router / Query). Test integration with them.

### Must do

- Read the existing test file before adding to it; match style.
- Name tests as a sentence — `it('shows an error when login credentials are invalid', …)`.
- Use `renderWithProviders` from `@/test/renderWithProviders` for component + integration tests.
- Use MSW handlers from `src/mocks/handlers/`; override per-test with `server.use(...)`.
- Use synthetic FHIR fixtures (no real patient data).
- Treat flake as a bug — quarantine with `.skip` + tracking issue in the same PR.

## PHI handling

- Launch flow lives behind `/launch` + `/launch/callback`. Uses `fhirclient` PKCE under the hood. Never log launch tokens, the `state` parameter, or any `Authorization` header.
- Treat all FHIR payloads as PHI. No real patient data in fixtures, screenshots, or test data.

## TanStack Router dependency pairing

- `@tanstack/router-plugin` and `@tanstack/router-generator` must move together. The plugin re-exports the generator; the standalone `scripts/gen-route-tree.mjs` consumes the generator directly. A version skew between them risks divergence in the generated `routeTree.gen.ts` shape.
- When bumping either, bump both in the same change: `pnpm up @tanstack/router-plugin @tanstack/router-generator` and regenerate the route tree (`node scripts/gen-route-tree.mjs`).

## FHIR-Readiness Rules

The backend uses `fhir.resources` (R4) as its canonical internal model and serves the orchestrator thinner view-model DTOs today. The orchestrator's job here is to **stay PoC-simple while keeping the door open** for a future raw-FHIR endpoint capability. Rules below mirror the backend's `apps/backend/AGENTS.md#fhir-readiness-rules`.

### Library

- **Canonical FHIR types**: `@types/fhir` (DefinitelyTyped R4, `fhir4.*` namespace). Types-only — no runtime FHIR library today.
- Import FHIR types only through `@/lib/fhir/types` (re-exports `fhir4`). Do not import `fhir/r4` directly.
- **Do not** define local interfaces that duplicate a FHIR resource shape.

### `lib/fhir/` package

```
src/lib/fhir/
  types.ts        # re-exports fhir4.* from @types/fhir
  references.ts   # parseReference / formatReference / Zod schema
  codes.ts        # IssueType, issueTypeOf, codeToI18nKey
  # SMART-on-FHIR launch helpers return at `[mvp]`
```

### Modules + query keys

- A module centred on **one FHIR resource** is named `modules/<lowercase-resource>/` — `modules/patient/`, `modules/observation/`, `modules/careplan/`.
- Modules not centred on a single FHIR resource keep orchestrator-domain names — `modules/auth/`, `modules/pathway/`, `modules/task/`, `modules/admin/`.
- Query-key factories for FHIR-centred modules emit `["fhir", "<ResourceType>", …]` with the **capitalised** FHIR type string. Example: `patientKeys.detail(id) -> ["fhir", "Patient", id]`. This lets a future `/fhir/Patient/{id}` mutation invalidate the exact cache slice.

### References + IDs

- Parse / format `"<Type>/<id>"` reference strings through `@/lib/fhir/references` — never inline.
- URL paths on view-model routes use plain IDs (`/patients/:patient_id`); future `/fhir/*` routes use FHIR-shaped paths (`/fhir/Patient/:id`). Both forms parse through the same helper.

### Error codes + i18n

- Backend `ErrorResponse.code` follows `<fhir-issue-type>.<domain>.<reason>`. Issue types: `not-found`, `invalid`, `security`, `forbidden`, `conflict`, `processing`, `transient`, `informational`.
- HTTP middleware in `lib/api/client.ts` calls `codeToI18nKey(code)` on every non-2xx response and surfaces the localised string via `sonner`.
- Unknown codes fall back to `errors.unknown` and emit a dev-mode `console.warn`. Add the key in `src/lib/i18n/locales/nl/errors.json` to fix.
- Per-call opt-out is available for forms that render the error inline (the middleware accepts a suppress-toast option).

### Pagination

- All list hooks hold `Page<T> = { entries: T[]; total: number; nextCursor: string | null }`.
- `nextCursor` is opaque — never parse it. Adapt with `usePagedQuery` from `@/lib/query/pagination` once the first list lands.
- Today's view-model JSON and tomorrow's raw FHIR `Bundle.link[next]` both map to this shape behind the same hook.

### Fixtures

- Synthetic FHIR fixtures live under `src/mocks/fhir/<resource>.ts`, typed via `fhir4.*`.
- Every file starts with `// Synthetic — no real patient data.` Examples: `demoPatient`, `demoObservation`. Never real-looking names or RRNs.

### Reviewer checklist

When reviewing a PR that touches FHIR-shaped code, confirm:

- [ ] FHIR types imported from `@/lib/fhir/types`, not redefined locally.
- [ ] Reference strings parsed via `@/lib/fhir/references`, not inline regex.
- [ ] Error codes resolved via `@/lib/fhir/codes`; new codes added to `nl/errors.json`.
- [ ] FHIR-centred module follows `modules/<resource-lowercase>/` naming with `["fhir", "<ResourceType>", …]` query keys.
- [ ] List hooks return `Page<T>`; cursor not parsed by consumer.
- [ ] FHIR fixtures synthetic, typed, and located under `src/mocks/fhir/`.

### Out of scope (additive later)

- Runtime FHIR client SDK (`fhirclient`, `fhir-kit-client`).
- Raw FHIR Bundle UI rendering, generic FHIR table component.
- FHIRPath evaluation.
- FHIR-search URL builder.
- Auto-generated i18n key list from the backend's `app/fhir/codes.py`.

Each of these is a feature add behind the `lib/fhir/` seam — no restructure expected.

## Pathway builder

Authoring surface for `F3` care pathways. Module: `src/modules/pathway/`.

### Module layout

- `api.ts` — typed wrappers over the generated client (`listPathways`, `getPathway`, `replacePathway`, `listBlockTypes`, `listPhaseTemplates`, `listEdgeTimingKinds`, `listEdgeOffsetDirections`).
- `hooks.ts` — react-query hooks (`usePathwayList`, `usePathway`, `useCreatePathway`, `useReplacePathway`, `usePathwayBlocks`, `usePathwayPhaseTemplates`, `useEdgeTimingKinds`, `useEdgeOffsetDirections`).
- `keys.ts` — query-key namespace `pathwayKeys.*` (`list`, `detail(id)`, `blocks`, `phaseTemplates`, `edgeTimingKinds`, `edgeOffsetDirections`).
- `useBuilderState.ts` — controlled-state reducer over `PathwayVersionDefinition` (selection, undo/redo, dirty tracking). Single source of truth for the canvas state passed to autosave. Read-only guard: actions other than `select` / `reset` / `mark-saved` / `resize-*` are dropped when `version.status !== 'concept'` — Phase 5 fork-on-edit will hook the intercept here.
- `configSchemas.ts` — per-semantic Zod schemas for `PathwayBlock.config`; `parseBlockConfig(block, semantics)` returns typed config or throws. Inspectors render bespoke forms per semantics, NOT RJSF (audited then dropped per `pathway-config-forms`).
- `edgeTiming.ts` / `formatTiming.ts` — edge-kind union helpers; `readEdgeTiming(edge)` discriminates `completion | marker | immediate | branch`.
- `components/` — `PathwayBuilderShell` (provider + layout), `canvas/` (`BuilderCanvasFrame` + nodes/edges over `@xyflow/react`), `dock/` (block palette), `subbar/` (phase picker), `topbar/` (`BuilderTopbar`, `SaveStatusPill`, `PublishButton`, `EditableTitle`), `drawer/` (`BuilderDrawer` + `inspectors/` per semantics, `EdgeInspector`).
- `hooks/` — `useAutosavePathway` (800ms debounce, visibility-flush, full-definition `PUT`), `useCanvasHandlers` (xyflow → reducer bridge), `useBuilderKeyboard` (Delete/Backspace, undo/redo).

### Canvas package

- `@xyflow/react` 12 (React Flow). Decision D5 of `openspec/changes/pathway-builder-base/design.md` — MIT, React 19 compat, controlled-state mode, custom React-component nodes. Internal `zustand ^4` co-exists with repo's `zustand 5` (separate store instance — flagged risk, not a blocker).
- Styles imported via `@xyflow/react/dist/style.css` in `BuilderCanvasFrame`.

### Save model

- Concept versions autosave at 800ms after the last dirty-marking dispatch, flush on tab `visibilitychange → hidden`. No explicit `Save` button on concept (`builder-ui-spec.md` §17, design D30+D31). Save-state pill replaces the button (`status.{clean|dirty|saving|error}`).
- Published / archived versions are read-only — the reducer's dispatch-boundary guard drops mutations; the topbar `Publish version` button is currently a disabled placeholder for Phase 5 wiring.

### i18n

- Dutch only at this tier — keys under `pathway.*` in `lib/i18n/locales/nl/pathway.json`. Sidebar entry: `nav.pathways`. New inspectors register copy under `pathway.inspector.<semantics>.*`.

### Block dimensions (variable-size blocks)

- Native blocks render at `BLOCK_WIDTH × BLOCK_HEIGHT` (240×64) from `canvasLayout.ts`. External-provider blocks (e.g. `luscii.program`, 360×200 → 540×300) compute their own size per-instance.
- Extension point: `src/modules/pathway/utils/blockDimensions.ts` exports `getBlockDimensions(block, blockType)`. New variable-size providers add a branch here keyed on `blockType.source === 'external' && blockType.provider === '<name>'`, returning their per-instance `{ width, height }`. The dispatch must return the native default otherwise — never break the bare-code path.
- Per-provider clamp computers (e.g. `computeLusciiProgramDimensionsFromCounts`) live next to the provider node component under `components/canvas/nodes/external/<provider>/`. Keep them pure and counts-based so unit tests don't need full payload fixtures.
- The router (`BlockNodeRouter`) reads the dotted `block.type` and forwards to the provider-specific node component; the size dispatch + the router stay in lockstep.

### External-block providers (Luscii, future)

- Provider adapter modules live at `components/canvas/nodes/external/<provider>/`. Each adapter ships: `types.ts` (re-exports of generated schema), `api.ts` (typed wrappers over the generated client), `keys.ts` (TanStack key namespace prefixed by the provider id), `<Provider>BlockNode.tsx` (xyflow node), plus thumbnail / header sub-components.
- Provenance metadata on `PathwayBlockType` (`source`, `provider`, `kind`) flows through `BuilderDock.groupCatalogueBySource` for palette grouping and through `BlockNodeRouter` for component dispatch — never hard-code the dotted type code outside the adapter directory.
- Vendor identifier constants (e.g. `LUSCII_PROVIDER`, `LUSCII_PROGRAM_KIND`, `LUSCII_PROGRAM_BLOCK_TYPE`) live next to the adapter; the backend mirror lives at `apps/backend/app/adapters/<provider>/constants.py`. Wire all routes, catalogue entries, tests, and i18n group labels through those constants — magic strings are a regression.
