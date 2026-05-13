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
| Backend error code | `<fhir-issue>.<domain>.<reason>` (mirrors backend) | `security.auth.invalid_credentials` |
| FHIR query key | `["fhir", "<ResourceType>", ...]` capitalised | `["fhir", "Patient", id]` |
| FHIR-centred module | lowercase FHIR resource type | `modules/patient/`, `modules/observation/` |

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

- Launch flow lives behind `/launch` (stub today). Never log launch tokens or `state` parameters.
- Treat all FHIR payloads as PHI. No real patient data in fixtures, screenshots, or test data.

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
  <smart helpers> # existing SMART-on-FHIR launch utilities
```

### Modules + query keys

- A module centred on **one FHIR resource** is named `modules/<lowercase-resource>/` — `modules/patient/`, `modules/observation/`, `modules/careplan/`.
- Modules not centred on a single FHIR resource keep orchestrator-domain names — `modules/auth/`, `modules/smart-launch/`, `modules/tasks/`, `modules/pathway-composer/`.
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
