## Why

The orchestrator app is a Vite scaffold today — no routing, no auth, no data layer. Every clinical capability (Holter, Rugrevalidatie, SMART launch, …) needs the same foundations: typed router, query client, auth guard, app shell, design-system entry points. Building these once now prevents five inconsistent re-implementations later and gives every following OpenSpec change a stable place to land.

## What Changes

- Adopt **TanStack Router** with file-based routes: public `/login`, an `_authed` layout gating everything behind a session check, and a placeholder authed landing route (`/`) — actual landing content lands in a follow-up change.
- Adopt **TanStack Query v5** with a configured `QueryClient` and a typed fetcher generated from the backend's OpenAPI schema (`openapi-typescript` + `openapi-fetch`).
- Adopt **TanStack Form** + **Zod** for forms and runtime validation.
- Adopt **Tailwind v4** + **shadcn/ui** + **lucide-react** for design system primitives. Drop the default Vite CSS scaffold. **Light theme only** — dark mode is out of scope.
- Adopt **i18next** + **react-i18next** wired into the provider tree, with a **single `nl` locale** for the POC. Strings live in `src/lib/i18n/locales/nl/<namespace>.json`, namespaced per module. The framework being there means later locales (`fr`, `en`) drop in without code changes.
- Introduce the canonical folder layout: `src/{app, routes, modules, components/{ui,app}, hooks, lib/{api,query,fhir,form,i18n}, config, stores, testing, types, styles}`.
- Introduce a thin **auth/session** module backed by the backend (`POST /auth/login`, `GET /auth/me`, `POST /auth/logout`). POC stub: username + password against a FastAPI session cookie. Real IdP (eHealth / itsme / eID / CSAM) is a later change. **BREAKING** for the placeholder Vite landing page.
- Scaffold a **`smart-launch` module** + `/launch` route as a stub. The route accepts the SMART query params, validates them with Zod, and renders a "not yet wired" placeholder. The module exposes the handshake interface (`exchangeAuthCode`, `useLaunchContext`) so the later SMART change drops real implementations behind unchanged callers.
- **No other modules** ship in this change. `pathways/`, `clinical/*`, `catalog/`, `patients/`, etc. land in their own focused proposals. No empty placeholder folders.
- Wire **MSW** for unit + Playwright tests and add a smoke E2E covering login → authed landing.
- **Defer** TanStack Table, dnd-kit, charts, Sentry — they belong to the modules that need them.
- Enforce module isolation with `eslint-plugin-import` `no-restricted-paths` (modules cannot import siblings, only `_shared/` + top-level `lib`/`components`). **No barrel `index.ts` files** — deep imports only.
- Establish the **testing strategy**, **naming conventions**, **agentic conventions**, and **setup contract** described below so every following change has a single way to test, name, and bootstrap code.

## Testing Strategy

Four layers, each with one tool and one purpose. Nothing overlaps.

| Layer | Tool | What it covers | Where it lives |
| --- | --- | --- | --- |
| **Unit** | Vitest | Pure functions, hooks in isolation, Zod schemas, query-key factories, reducers. No DOM. | next to source — `foo.ts` + `foo.test.ts` |
| **Component** | Vitest + `@testing-library/react` + jsdom + MSW | A React component in isolation, rendered with providers, network mocked by MSW. Assertions through accessible queries (`getByRole`, `getByLabelText`). | next to component — `LoginForm.tsx` + `LoginForm.test.tsx` |
| **Integration** | Vitest + RTL + MSW + TanStack Router test helpers | A whole module flow against MSW (e.g. login → redirected to authed landing). No real browser. | per-module — `src/modules/<name>/__tests__/<flow>.test.tsx` |
| **E2E** | Playwright | Critical golden paths against a real `vite preview` build, MSW running as a service worker in the browser. Smoke + regression only. | `apps/orchestrator/e2e/<flow>.spec.ts` |

Contract testing (frontend ↔ backend) is **not** a separate layer here: the OpenAPI schema is generated from FastAPI, types flow into the frontend, and integration tests assert against MSW handlers built from the same schema. If the schema drifts, types break the build.

Pyramid weight: many unit, several component, a handful of integration per module, ≤10 E2E specs total. No headless-browser-for-everything anti-pattern.

### Coverage

Vitest with `v8` provider. Threshold floor: 80% statements on `lib/`, `modules/*/api.ts`, `modules/*/hooks.ts`, schemas. UI components are excluded from the hard threshold — they're covered by component + integration tests, not line counts.

### Fixtures + Mocks

- **MSW handlers** live in `src/testing/handlers/<resource>.ts`, composed in `src/testing/server.ts` (Node, for Vitest) and `src/testing/browser.ts` (Service Worker, for Playwright + dev).
- **FHIR / domain fixtures** live in `src/testing/fixtures/<resource>.ts`. Synthetic data only — never real patient data, never copied from a sandbox.
- **Render helper**: `renderWithProviders(ui, options)` in `src/testing/render.tsx`, wrapping QueryClient, Router (memory history), and AuthProvider with a logged-in stub by default.

## Naming Conventions

| Thing | Convention | Example |
| --- | --- | --- |
| React component file + export | `PascalCase.tsx`, default export matching filename | `LoginForm.tsx` → `export default function LoginForm()` |
| Hook file + export | `use<Thing>.ts`, named export | `useSession.ts` → `export function useSession()` |
| Module folder | `lowercase`, singular noun, kebab if multi-word | `auth/`, `smart-launch/`, `clinical/holter/` |
| Module-internal subfolders | `api/`, `components/`, `hooks/`, `schemas/`, `__tests__/` | fixed set; no others without an ADR |
| Route file | matches TanStack Router file-based convention, kebab-case segments | `routes/_authed/pathways.$id.tsx` |
| Route-local helpers | `routes/<path>/-components/<Name>.tsx` (`-` prefix is ignored by router) | `routes/launch/-components/LaunchBanner.tsx` |
| Test file | mirrors source, `.test.ts(x)` suffix | `useSession.ts` → `useSession.test.ts` |
| Integration test | `__tests__/<flow>.test.tsx`, `<flow>` reads like a sentence | `__tests__/login-flow.test.tsx` |
| Zod schema | `<Thing>Schema` exported from `schemas.ts` | `LoginRequestSchema` |
| Inferred type from schema | `type <Thing> = z.infer<typeof <Thing>Schema>` colocated | `type LoginRequest = z.infer<typeof LoginRequestSchema>` |
| Query key factory | `<resource>Keys` object | `sessionKeys.all`, `sessionKeys.detail(id)` |
| Constants | `SCREAMING_SNAKE_CASE` in a `constants.ts` per module | `MAX_PATHWAY_STEPS` |
| API generated types | `lib/api/schema.d.ts` (generated, gitignored content but file committed empty placeholder) | — |
| Test describe block | one top-level `describe(<Subject>, …)` matching the file under test | `describe('LoginForm', …)` |
| Test names | `it('<verb phrase>', …)` reading as a sentence | `it('submits the form when credentials are valid')` |

## Folder Layout Rules

Canonical tree (all paths relative to `apps/orchestrator/src/`):

```
app/                       # provider tree, router root, error boundary
routes/                    # TanStack Router files. Thin: loader + layout + page composition only.
  <segment>/-components/   # route-only components, ignored by the router (`-` prefix)
modules/<name>/            # one vertical slice of behaviour
  api.ts                   # query/mutation hooks for this module
  hooks.ts                 # non-query hooks
  components/              # module-internal components
  schemas.ts               # Zod schemas + inferred types
  constants.ts             # SCREAMING_SNAKE_CASE values
  routes.tsx               # optional, only if the module owns route segments
  __tests__/               # integration tests for this module's flows
components/
  ui/                      # shadcn primitives (CLI-managed, do not hand-edit)
  app/                     # app-wide composed blocks (AppShell, TopBar, EmptyState)
hooks/                     # cross-feature hooks only — never module-specific
lib/
  api/                     # openapi-fetch client + generated schema.d.ts
  query/                   # QueryClient config, key factories, defaults
  form/                    # TanStack Form + Zod adapter helpers
  fhir/                    # SMART helpers, resource utils
  i18n/                    # i18next bootstrap + locale loader
  utils/                   # pure helpers (formatters, predicates) — sparingly
config/                    # env parsing, feature flags
stores/                    # zustand stores — UI-only, ephemeral. Prefer Query or URL state first.
styles/                    # tailwind.css, design tokens
testing/                   # MSW handlers, fixtures, renderWithProviders
types/                     # cross-module ambient types only
```

### Decision tree: "where does this code go?"

1. **Used by exactly one module?** → `modules/<that-module>/...`
2. **Used by two or more modules?**
   - Pure helper / no React → `lib/utils/` or a more specific `lib/<area>/`.
   - React component, reused → `components/app/`.
   - React hook, reused → `hooks/`.
3. **shadcn primitive (Button, Dialog, Input, …)?** → `components/ui/`. Never hand-edit; rerun the shadcn CLI to update.
4. **Renders a single route, never reused?** → `routes/<segment>/-components/`.
5. **Talks to the backend?** → `modules/<name>/api.ts`. Generic fetcher/interceptor logic goes to `lib/api/`.
6. **Long-lived UI state that survives route changes (sidebar collapse, locale)?** → `stores/` (zustand). Anything that fits in URL state goes there instead.
7. **Test scaffolding?** → `testing/`. Never `__mocks__/`, never per-component fixture sprawl.

### Hard rules

- **No barrel `index.ts`.** Import the file you need: `import { useSession } from '@/modules/auth/hooks'`.
- **No cross-module imports.** Enforced by `eslint-plugin-import` `no-restricted-paths`. Need code in two modules? Promote it to `lib/` / `components/app/` / `hooks/`.
- **No relative imports going up more than one level.** Use the `@/` alias.
- **No code in `app/` past the providers + router root.** App-wide behaviour lives in `lib/` or `components/app/`.
- **Tests next to the file they cover** for unit + component; **integration tests in `modules/<name>/__tests__/`**; **E2E in `apps/orchestrator/e2e/`**.

## Casing Conventions

| Thing | Casing | Example |
| --- | --- | --- |
| Folder name | lowercase, kebab-case if multi-word | `auth/`, `smart-launch/`, `_shared/` |
| React component file | PascalCase, `.tsx` | `LoginForm.tsx`, `AppShell.tsx` |
| Hook file | camelCase, prefix `use` | `useSession.ts`, `useLaunchContext.ts` |
| Non-component TS file | camelCase | `apiClient.ts`, `queryKeys.ts`, `formatDate.ts` |
| Schema file | always `schemas.ts` | — |
| Constants file | always `constants.ts` | — |
| Test file | mirrors source + `.test.ts(x)` | `useSession.test.ts`, `LoginForm.test.tsx` |
| Route file | TanStack Router convention, segments lowercase | `routes/_authed/launch.tsx` |
| Locale file | kebab-case namespace, JSON | `lib/i18n/locales/nl/auth.json` |
| TypeScript type / interface | PascalCase | `type LoginRequest`, `interface SessionUser` |
| Zod schema variable | PascalCase + `Schema` suffix | `LoginRequestSchema` |
| Inferred type from schema | matches its schema, no suffix | `type LoginRequest = z.infer<typeof LoginRequestSchema>` |
| React component name | PascalCase, matches filename | `function LoginForm()` |
| Hook | camelCase, prefix `use` | `useSession()`, `useLaunchContext()` |
| Function / variable | camelCase | `submitLogin`, `currentUser` |
| Boolean | camelCase, convention prefix `is`/`has`/`can`/`should` (not lint-enforced) | `isAuthenticated`, `hasPathway`, `canEdit` |
| Constant value (module-scoped) | SCREAMING_SNAKE_CASE | `MAX_PATHWAY_STEPS`, `SESSION_COOKIE_NAME` |
| Enum-like (use `as const` object, not `enum`) | PascalCase object, SCREAMING_SNAKE values | `const PathwayStatus = { DRAFT: 'draft', ACTIVE: 'active' } as const` |
| CSS class (when raw class needed outside Tailwind) | kebab-case | `app-shell__topbar` |
| Tailwind data attributes | kebab-case | `data-state="open"` |
| Environment variable | SCREAMING_SNAKE_CASE, `VITE_` prefix for client-exposed | `VITE_API_BASE_URL` |
| Query key | camelCase factory + tuple values | `sessionKeys.detail('me')` |
| Event handler prop | camelCase, prefix `on` | `onSubmit`, `onLaunchSuccess` |
| Internal handler in component | camelCase, prefix `handle` | `handleSubmit`, `handleLaunchSuccess` |
| Backend field (FHIR / JSON) | leave as backend sends it | `resource_type`, `effectiveDateTime` — never re-case in transit |

Backend (FastAPI Python) follows PEP 8: `snake_case` for functions/variables, `PascalCase` for classes, `SCREAMING_SNAKE_CASE` for module constants. Don't translate field names at the wire — keep the backend's casing in HTTP payloads and let Zod parse it as-is.

## Coding Rules

### TypeScript

- **`strict: true`**, no `any` without a one-line `// reason:` comment next to it.
- **No `enum`** — use `as const` object + union type derived via `(typeof X)[keyof typeof X]`.
- **No namespaces** — files + modules.
- **`type` everywhere** for object shapes and unions. `interface` only when declaration-merging with a third-party type.
- **Path alias `@/*` → `src/*`** is the only alias. Configured in `tsconfig.app.json` `paths` and `vite.config.ts` `resolve.alias`.
- **Throw + custom `Error` subclasses** for failures. TanStack Query catches and surfaces them; React error boundaries handle render-time throws. No Result/Either types — they fight Query's contract.
- **Prefer `??` over `||`** for null coalescing.
- **Prefer optional chaining** over manual undefined checks.

### React

- **Function components only**, defined with **function declarations** (`export function LoginForm() { ... }`) — better names in stack traces + devtools. Arrow components only for tiny inline cases.
- **Event handlers**: prop is `on*` (`onSubmit`, `onLaunchSuccess`); the internal handler implementing it is `handle*` (`handleSubmit`, `handleLaunchSuccess`).
- **No class components**, no `forwardRef` unless a Radix primitive demands it.
- **Named exports** for everything except:
  - TanStack Router file-based route components (must be default export).
  - `React.lazy()` boundaries.
- **No prop drilling past two levels** — promote to context, store, or query.
- **No effects to derive state.** Derived state goes in the render body (`const x = useMemo(...)`) or in a query selector.
- **No `useEffect` for data fetching.** TanStack Query owns that.
- **No `useState` for server data.** TanStack Query owns that.
- **Stable references in deps arrays** — use `useCallback`/`useMemo` only when a child memo or effect requires it; never preemptively.

### Data + Forms

- **All HTTP through `lib/api/client.ts`** (openapi-fetch instance). Never raw `fetch` in modules.
- **All server reads through `useQuery`**; all writes through `useMutation`.
- **All forms through TanStack Form + Zod resolver.** No raw `useState` form glue past a single uncontrolled input.
- **Validate at boundaries**: parse incoming HTTP payloads with Zod, parse SMART query params with Zod, parse env with Zod.

### Imports / Exports

- **`@/` path alias** for everything under `src/`. No `../../../` chains.
- **Import order** (ESLint-enforced): external → `@/` → relative.
- **One named export per concern per file.** Multiple unrelated exports in one file = split.
- **No barrels (`index.ts`).** Deep imports only.

### Strings + i18n

- **Every user-visible string** goes through `t('namespace.key')`. No hardcoded NL/EN strings in JSX, attributes, or aria-labels.
- **Namespaces map 1:1 to modules** (`auth.login.title`, `smart-launch.errors.invalid_state`).
- **Dev-only / log strings** are exempt.

### Comments

- **Default to no comments.** Names carry meaning.
- **One-line comment** allowed when the *why* is non-obvious (workaround, regulatory constraint, performance reason). Never explain the *what*.
- **No JSDoc on internal code.** Types document the signature.
- **`TODO` format**: `// TODO(<owner>, #<issue>): <what>` encouraged; plain `// TODO: …` allowed but lint-warned to nudge upgrades.

### Logging + Errors

- **No `console.log` in committed code.** Lint-enforced. Use the centralized logger in `lib/utils/log.ts` (added in this change), which is a thin wrapper that no-ops in production and prints in dev.
- **Never log full FHIR payloads.** Log resource type + id only.
- **Errors surfacing to users go through `sonner`** + an i18n key, never raw error messages.

## Agentic Testing Conventions

Rules that apply to **every AI coding agent** (Claude Code, Codex, OpenCode, …) operating in `apps/orchestrator/`. These extend `AGENTS.md`; the implementation lands a copy under `apps/orchestrator/AGENTS.md` so agents read them locally.

### Workflow

1. **TDD for any non-trivial behaviour change.** Failing test first, then implementation, then refactor. Pure refactors (no behaviour change) skip the failing-test step but still run the existing suite to prove nothing moved.
2. **Same commit, same change.** Tests and the production code they cover ship in one commit. Splitting test-only commits hides intent and breaks bisect.
3. **Match layer to risk.** New pure function → unit. New component branch → component. New cross-module flow → integration. New user-visible critical path → E2E. Do not add an E2E for every change; do not skip integration when modules cross.
4. **Run via moon.** `moon run orchestrator:test`, `moon run orchestrator:test-e2e`. Never invoke Vitest / Playwright directly in commit-bound work — the cache + affected detection rely on moon being the entry point.

### Verification before completion

Agents must not claim a task is done without quoting evidence. Minimum gate before marking done:

```
moon run orchestrator:lint
moon run orchestrator:typecheck
moon run orchestrator:test
```

For changes that touch routes, components, or user-visible behaviour, also:

```
moon run orchestrator:test-e2e          # if a related E2E exists
moon run orchestrator:build             # production build must stay green
```

Paste the final summary line of each command into the completion message. "Tests pass" without output is not acceptable.

### What agents must not do

- **Do not delete or `skip` a failing test to make a suite pass.** Investigate root cause; if the test is wrong, fix or rewrite it explicitly with one-line rationale in the diff.
- **Do not mock the unit under test.** Mock its collaborators (HTTP via MSW, time via `vi.useFakeTimers`, randomness via injected seeds).
- **Do not assert against mocks.** `expect(handler).toHaveBeenCalled()` reveals nothing about user-visible behaviour. Assert on rendered output, navigation, or returned data.
- **Do not write snapshot tests** for components without an ADR. They rot, lose signal, get rubber-stamped on update. Component tests use explicit role/label queries.
- **Do not stub `fetch` directly.** Always go through MSW so the same handler covers Vitest + Playwright + dev mock mode.
- **Do not test framework internals.** Trust TanStack Router / Query — test the integration of your code with them, not their behaviour.
- **Do not increase the E2E count to "feel safer".** E2E is the slowest layer with the lowest signal-per-second. Add only when a flow has crossed module + browser + backend boundaries and a unit/integration test cannot reach it.

### What agents must do

- **Always read the existing test file before adding to it.** Match the file's existing arrange-act-assert layout, query style, and helper usage. Drift in test style is friction debt.
- **Name the test as a sentence.** `it('shows an error when login credentials are invalid')`. If the name needs `and`, split it.
- **Use the `renderWithProviders` helper** for component + integration tests — never bare `render(ui)`. New providers go into the helper, not into each test.
- **Use MSW handlers** from `src/testing/handlers/` and override per-test with `server.use(...)`. Reset between tests is automatic via `setup.ts`.
- **Use synthetic FHIR fixtures** from `src/testing/fixtures/`. Never paste payloads from a sandbox.
- **Treat flake as a bug.** Quarantine with `.skip` + a tracking issue link in the same PR — never re-run until green.
- **Update the proposal / spec / design when behaviour changes.** Behaviour is what the tests describe; spec is what the tests promise.

### When in doubt

Ask. Underspecified test intent produces tests that pass for the wrong reason. A two-line clarification beats an hour of tests that need to be rewritten in review.

## Setup Contract

Bootstrap order for a fresh clone:

1. `nvm use` (picks up `.nvmrc`).
2. `npm install` in `apps/orchestrator/`.
3. `npm run typegen` (alias for `openapi-typescript http://localhost:8000/openapi.json -o src/lib/api/schema.d.ts`). Falls back to a committed last-known-good schema if backend unreachable, so first-time setup never blocks on the backend running.
4. `npm run dev` (Vite + MSW dev worker in mock mode by default — `VITE_API_MODE=live` switches to real backend).
5. `npm run test` (Vitest watch), `npm run test:e2e` (Playwright).

Vitest config in `vitest.config.ts` (separate from `vite.config.ts`) with:
- `environment: 'jsdom'`
- `setupFiles: ['./src/testing/setup.ts']` — installs jest-dom matchers, starts MSW server, resets handlers between tests.
- `globals: false` — explicit `import { describe, it, expect } from 'vitest'`.

Playwright config in `playwright.config.ts` with one project (`chromium`), `webServer` running `npm run preview`, MSW served via `mockServiceWorker.js` in `public/`.

ESLint flat config gains:
- `eslint-plugin-import` with `no-restricted-paths` enforcing module isolation.
- `eslint-plugin-testing-library` + `eslint-plugin-vitest` on `**/*.test.ts(x)` only.
- `eslint-plugin-react-x` + `eslint-plugin-react-dom` for React-specific lint.

## Capabilities

### New Capabilities

- `app-shell`: Boots the React app, mounts the router, providers (Query, i18n, Auth), and renders the top-level light-theme layout (AppShell + TopBar).
- `routing`: Defines the TanStack Router route tree, public vs. `_authed` layouts, search-param schemas, and the route conventions every module follows.
- `auth-session`: Manages clinician session lifecycle — login form, session query, logout, route guards. POC: username + password against FastAPI session cookie. Real IdP arrives later.
- `api-client`: Typed HTTP client generated from the backend's OpenAPI schema (`openapi-typescript` + `openapi-fetch`), wrapped for auth headers, error normalization, and TanStack Query integration.
- `design-system`: Tailwind v4 + shadcn/ui primitives, app-level composed blocks (AppShell, TopBar, EmptyState), light theme tokens.
- `i18n`: i18next + react-i18next wired into providers, namespace-per-module convention, single `nl` locale shipped, extensible to `fr` / `en` without code changes.
- `smart-launch-stub`: `/launch` route + module scaffold. Parses + validates SMART query params with Zod, exposes the handshake interface (`exchangeAuthCode`, `useLaunchContext`), renders a placeholder. Full handshake lands in a later change.
- `testing-foundation`: Vitest + RTL + MSW config, `renderWithProviders` helper, fixture + handler conventions, one Playwright smoke E2E (login → authed landing).

### Modified Capabilities

None — `openspec/specs/` is empty today.

## Impact

- **Code**: replaces the entire `apps/orchestrator/src/` tree (Vite default). Adds ~20 dependencies. No real backend changes beyond three auth stub endpoints, landing in a sibling change; MSW handlers stand in until then.
- **Dependencies added**: `@tanstack/react-router`, `@tanstack/react-router-devtools`, `@tanstack/react-query`, `@tanstack/react-query-devtools`, `@tanstack/react-form`, `zod`, `openapi-fetch`, `openapi-typescript` (dev), `tailwindcss@4`, `@tailwindcss/vite`, `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`, `sonner`, `i18next`, `react-i18next`, `i18next-browser-languagedetector`, plus shadcn/ui CLI + the Radix primitives shadcn drops in. Dev: `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `msw`, `@playwright/test`, `eslint-plugin-import`, `eslint-plugin-testing-library`, `eslint-plugin-vitest`, `eslint-plugin-react-x`, `eslint-plugin-react-dom`, `@biomejs/biome` (format + import sort only — ESLint still owns lint).
- **Explicitly out of scope** (separate later changes): TanStack Table, dnd-kit, charts, Sentry, dark mode, additional locales beyond `nl`, real SMART handshake, real IdP, every `modules/*` beyond `auth/` and `smart-launch/`.
- **Tooling**: ESLint flat config gains `no-restricted-paths` + testing/vitest/react-x plugins; Vite config gains Tailwind v4 plugin + TanStack Router plugin; `tsconfig.app.json` adds `paths` for `@/*`; Vitest + Playwright configs are added; moon `orchestrator:test`, `orchestrator:test-e2e`, `orchestrator:typegen` tasks added.
- **Backend**: assumes three stub auth routes (`POST /auth/login`, `GET /auth/me`, `POST /auth/logout`) land in a sibling change. Until then, MSW handlers cover them.
- **Docs**: `apps/orchestrator/README.md` updated with new commands + structure. `apps/orchestrator/AGENTS.md` updated with module rules, naming, testing strategy, and agentic conventions.
