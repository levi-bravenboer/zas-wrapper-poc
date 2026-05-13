# AGENTS.md — apps/orchestrator

Frontend app: clinician composer + SMART-on-FHIR launch surface. Inherits all rules from the root `AGENTS.md`; this file overrides where it differs.

## Stack

- React 19.2
- Vite 8 (Rolldown — requires Node >= 22.13)
- TypeScript 6 strict (+ `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`)
- TanStack Router (file-based) + TanStack Query v5 + TanStack Form
- Zod, openapi-fetch + openapi-typescript
- Tailwind v4 (`@tailwindcss/vite`) + shadcn/ui primitives + lucide-react + sonner
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
    ui/         shadcn primitives (Button, Input, Label, Form, Card, Toast, Icon)
    layout/     cross-route chrome — AppLayout, Sidebar, navItems, SectionPlaceholder
    app/        app-wide composed blocks
  hooks/        cross-feature hooks only
  lib/
    api/        openapi-fetch client + schema.d.ts
    query/      createQueryKeys helper
    form/       TanStack Form + Zod adapters
    fhir/       SMART helpers
    i18n/       i18next bootstrap + locales/nl/<ns>.json
    style/      cn()
    utils/
  config/       env parsing, feature flags
  stores/       zustand stores — UI-only, ephemeral
  styles/       tokens.css + globals.css
  test/         setup.ts + renderWithProviders.tsx
  mocks/        handlers/ + server.ts + browser.ts
  types/        cross-module ambient types
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
| Hook | camelCase, `use` prefix | `useSession.ts` |
| Module folder | lowercase / kebab-case | `auth/`, `smart-launch/` |
| Route file | TanStack convention, kebab segments | `routes/_auth/index.tsx` |
| Zod schema | PascalCase + `Schema` suffix | `LoginRequestSchema` |
| Inferred type | matches schema, no suffix | `type LoginRequest = z.infer<typeof LoginRequestSchema>` |
| Constants | SCREAMING_SNAKE_CASE in `constants.ts` | `LAUNCH_LANDING_PATH` |
| Env var | `VITE_` prefix for client-exposed | `VITE_API_BASE_URL` |
| Query key | camelCase factory + tuple | `authKeys.me()` |
| Event prop | `on*` | `onSubmit` |
| Internal handler | `handle*` | `handleSubmit` |
| Backend field | leave as backend sends it | `resource_type` |

## Coding rules

- TypeScript `strict: true`. No `any` without a one-line `// reason:` comment.
- No `enum` — use `as const` object + derived union.
- Function components only. `function` declarations, not arrows, for top-level components.
- All HTTP through `lib/api/client.ts`. Never raw `fetch` in modules outside `api.ts`.
- All server reads via `useQuery`; writes via `useMutation`. No `useState` for server data, no `useEffect` for fetching.
- All forms via TanStack Form + Zod resolver.
- Validate at boundaries: HTTP payloads, SMART query params, env.
- Every user-visible string goes through `t('namespace.key')`. Namespaces = module names.
- No `console.log` in committed code. Use `lib/utils/log.ts` when added.

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

## SMART-on-FHIR notes

- Launch flow lives behind `/launch` + `/launch/callback`. Uses `fhirclient` PKCE under the hood. Never log launch tokens, the `state` parameter, or any `Authorization` header.
- Treat all FHIR payloads as PHI. No real patient data in fixtures, screenshots, or test data.

## FHIR adapter conventions — TBD (PoC stubs only)

- PoC scope: feature FHIR adapters (`modules/*/adapters/fhir.ts`) return **static stub data**. No `client.request(...)`, no zod resource schemas, no `mapFhirTask`-style helpers yet — see openspec change `multi-surface-feature-framework` and its deferred tasks 4.6–4.8.
- Until the follow-on `fhir-integration` change lands, do **not** invent FHIR adapter patterns. If a task requires hitting a real EHR, stop and ask — that's a scope shift, not a small task.
- Surface-level discipline still applies: pages consume the port (`tasksPort.use()`), never `client` directly. The port abstraction guarantees stubs can be swapped for a real adapter later without page changes.
- When the integration change lands, this section will be replaced with adapter conventions + a `new-feature` skill walkthrough. Don't pre-empt it here.

## TanStack Router dependency pairing

- `@tanstack/router-plugin` and `@tanstack/router-generator` must move together. The plugin re-exports the generator; the standalone `scripts/gen-route-tree.mjs` consumes the generator directly. A version skew between them risks divergence in the generated `routeTree.gen.ts` shape.
- When bumping either, bump both in the same change: `pnpm up @tanstack/router-plugin @tanstack/router-generator` and regenerate the route tree (`node scripts/gen-route-tree.mjs`).
