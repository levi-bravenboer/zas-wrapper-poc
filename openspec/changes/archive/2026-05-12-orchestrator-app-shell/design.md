## Context

`apps/orchestrator/` is a Vite + React 19 + TS scaffold today: default landing page, no routing, no auth, no data layer. Every following capability (SMART launch, pathway composer, clinical trajectories) needs the same foundations. Building them once now prevents drift across modules and gives reviewers a single place to argue about cross-cutting decisions.

Constraints:

- Belgian clinical context: NL UI by default, FR/EN landing later. PHI handling rules from `AGENTS.md`.
- POC scope: June demo focus on Holter + Rugrevalidatie. The shell must enable those without locking in choices the production version will reject.
- Backend (`apps/backend`, FastAPI + uv) is the source of truth for HTTP contracts. The frontend regenerates types from its OpenAPI schema.
- All work runs through **moon** (`orchestrator:*` tasks).

Stakeholders: clinician composer team (frontend), backend team (FastAPI contracts), NewWave Care (auth + IdP integration later), Luscii (patient app embedding later), procurement reviewers (REQ traceability).

## Goals / Non-Goals

**Goals:**

- Land the canonical folder tree, package set, and provider tree once so future module changes drop in without bikeshedding.
- Lock naming, casing, testing strategy, and agentic conventions in code, lint, and `AGENTS.md`.
- Ship a working login → authed landing flow with MSW handlers so the frontend never blocks on a real backend.
- Scaffold the SMART-launch module's *interface* (parse params, validate, expose `useLaunchContext`) without implementing the token exchange.
- Wire one Playwright smoke E2E so the convention is real, not aspirational.

**Non-Goals:**

- Real SMART-on-FHIR handshake — separate change.
- Real IdP integration (eHealth, itsme, eID, CSAM) — separate change.
- Any clinical module (pathways, catalog, clinical/*).
- TanStack Table, dnd-kit, charts, Sentry, dark mode, additional locales.
- Authed landing content past a placeholder — TBD in a follow-up change.

## Decisions

### D1. TanStack Router (file-based) over React Router v7

**Choice:** `@tanstack/react-router` with the Vite plugin emitting a route tree from `src/routes/`.

**Why:** Type-safe routes + search-param schemas + loader integration with TanStack Query are exactly what the composer (URL-as-state) needs. File-based discovery removes route-tree boilerplate. Single ecosystem (Router + Query + Form) reduces mental load.

**Alternatives considered:**

- React Router v7 — larger community but no type-safe search params, no first-class Query integration. Rejected.
- Hand-rolled `react-router-dom@6` — strictly worse than v7. Rejected.
- Next.js / Remix — kill the SPA model and force SSR runtime decisions the POC doesn't want. Rejected.

### D2. openapi-typescript + openapi-fetch over hand-written client / orval / kubb

**Choice:** Generate `lib/api/schema.d.ts` from `apps/backend`'s `/openapi.json` via `openapi-typescript`. Use `openapi-fetch` as the runtime client.

**Why:** Tiny runtime (~2 KB), zero codegen runtime, full type-safety on path + query + body + response. Schema drift breaks TS compile — that *is* the contract test. orval/kubb generate React Query hooks but pin to a regeneration step; openapi-fetch lets each module define its own hooks shaped how the module needs them.

**Mitigation for first-run friction:** commit a last-known-good `schema.d.ts` so a fresh clone compiles without the backend running. `npm run typegen` refreshes it; CI runs `typegen` against the live backend and fails on drift.

### D3. Forms via TanStack Form + Zod

**Choice:** `@tanstack/react-form` with a `zodValidator` adapter exposed from `lib/form/`.

**Why:** Same ecosystem as Router/Query. Field-level subscriptions avoid form-wide re-renders. Zod schemas double as the parser for the corresponding HTTP payload.

**Alternative:** React Hook Form is battle-tested but its API encourages controlled fields + a separate resolver. TanStack Form's headless model maps better to clinical form complexity we'll hit later (dynamic question dependencies).

### D4. shadcn/ui + Tailwind v4, light theme only

**Choice:** Bootstrap shadcn into `src/components/ui/`. Tailwind v4 via `@tailwindcss/vite`. Single light theme.

**Why:** Copy-paste primitives = full ownership. Tailwind v4 ditches PostCSS config. Light-only keeps design review surface in half. Dark mode is a clear "later" — token system makes it cheap if asked.

### D5. State: TanStack Query first, URL state second, Zustand last

**Choice:** Server data → Query. Shareable / linkable UI state → router search params. Ephemeral UI state that survives navigation → Zustand. Component-local → `useState`.

**Why:** Reduces "where does this state live?" debates to a decision tree. Zustand is allowed but kept rare so future state doesn't accumulate in untyped stores.

### D6. i18n: i18next + react-i18next, single `nl` locale

**Choice:** Bootstrap i18next with one resource bundle (`nl`) and namespace-per-module. Every user-visible string goes through `t('namespace.key')`. Locale switching API exists; only `nl` registered.

**Why:** Belgian clinical audience expects NL. Wiring the framework once avoids retrofitting hundreds of strings later. Storage cost is tiny.

### D7. Auth: POC session cookie against FastAPI

**Choice:** `POST /auth/login` with `{ username, password }`, sets `HttpOnly Secure SameSite=Strict` session cookie. `GET /auth/me` returns the current user or 401. `POST /auth/logout` clears the cookie. Frontend never touches the cookie value; it relies on `credentials: 'include'`.

**Why:** Matches production auth shape (cookie-bearing session) without coupling to a real IdP. Easy to swap with eHealth/itsme/eID later — only `/auth/login` becomes a redirect.

**Risks:**

- CSRF protection needs to be on by default once we leave POC. Mitigation: `SameSite=Strict` covers POC; backend adds CSRF token middleware in the IdP change.

### D8. SMART-launch stub now, real handshake later

**Choice:** `/launch` route validates the SMART query params (`iss`, `launch`, `state`) with Zod, stores them, redirects to a placeholder. `modules/smart-launch/` exports `useLaunchContext()` returning `null` for now plus a documented `exchangeAuthCode()` signature that the later change fills in.

**Why:** Keeps the surface stable. The next SMART change replaces internals without touching call sites.

### D9. Testing: four layers, MSW shared across Vitest + Playwright

**Choice:** Vitest + RTL + jsdom + MSW for unit/component/integration; Playwright for E2E with MSW Service Worker. One smoke E2E in this change.

**Why:** Same MSW handlers cover all layers — one source of truth for "what does the backend look like." `renderWithProviders` centralises Query/Router/i18n wiring so tests stay short.

### D10. Module isolation enforced by lint, not folder convention alone

**Choice:** `eslint-plugin-import` `no-restricted-paths` blocks `modules/*` from importing `modules/*` siblings. Allowed imports: `lib/`, `components/`, `hooks/`, `config/`, `stores/`, `types/`, plus the module's own `_shared/` (when one exists).

**Why:** Conventions without enforcement rot. The lint rule is one block of config; the cost of writing it is small; the benefit (zero accidental cross-imports) is large.

### D11. No barrel `index.ts`, deep imports only

**Choice:** Modules and `lib/` subdirs do not re-export through barrels. Every import names the file: `import { useSession } from '@/modules/auth/hooks'`.

**Why:** Barrels hurt tree-shaking, introduce circular-import traps, and obscure call sites from "go to definition." 2026 community lean is decisively away from barrels in Vite/TS projects.

### D12. Format with Biome, lint with ESLint

**Choice:** Biome v2 owns `format` and import sort (replaces Prettier). ESLint 10 owns `lint` with `eslint-plugin-import`, `eslint-plugin-react-x`, `eslint-plugin-react-dom`, `eslint-plugin-testing-library`, `eslint-plugin-vitest`.

**Why:** Biome is ~30× faster than Prettier and handles import sorting natively. ESLint's plugin ecosystem still owns the React/test rules we care about. Hybrid keeps speed gains where they pay off without losing lint signal.

### D13. moon owns the task surface

**Choice:** Every dev/CI command is a moon task: `dev`, `build` (deps on `typecheck`), `typecheck`, `lint`, `format`, `test`, `test-e2e`, `typegen`. Agents and humans invoke moon, never raw npm.

**Why:** Caching + affected-detection only works through moon. Direct npm calls bypass it.

## Risks / Trade-offs

| Risk | Mitigation |
| --- | --- |
| openapi-fetch + manual Query-hook wiring is more boilerplate than orval auto-hooks. | Accept the boilerplate; module authors control hook shape. Add a `createQueryHooks(client, keys)` helper in `lib/query/` if duplication grows past ~5 modules. |
| Schema drift between front and back can land silently in PRs that don't run `typegen`. | CI step in moon runs `orchestrator:typegen` against the live backend (or its locked OpenAPI artefact) and fails on diff. |
| First clones can't run `typegen` if backend isn't up. | Commit the latest `schema.d.ts` so the app builds offline; `typegen` refreshes from a running backend. |
| TanStack Router has a smaller ecosystem; finding examples for advanced patterns may slow us down. | Module authors stay close to TanStack docs and the `frontend-design` skill. Anything non-obvious gets an ADR before merging. |
| Light-only theme will trigger requests for dark mode mid-project. | Tokens are designed for theming from day one; later "add dark mode" change is a token + class-toggle, not a redesign. |
| MSW Service Worker can interfere with real backend calls in dev. | `VITE_API_MODE=mock|live` env switch. Default mock. Playwright explicitly sets mock; integration scripts that hit the real backend set `live`. |
| Biome ↔ ESLint duplication risk (both formatting rules). | Disable ESLint's stylistic rules; ESLint only owns lint. Biome owns formatting + import sort. Documented in the configs. |
| Strict `no-restricted-paths` could block legitimate refactors. | Promote shared code to `lib/` (or `_shared/` within a domain group). Lint rule is one config block — easy to read and adjust per ADR. |
| TanStack File-based router default-export requirement clashes with our "named exports" rule. | Allow default exports in `routes/**` explicitly; the ESLint rule scopes to non-route paths. |

## Migration Plan

This is the first non-scaffold change, so "migration" is mostly demolition + greenfield:

1. Branch from `main`.
2. Replace `apps/orchestrator/src/` with the new tree, delete `App.tsx`, `App.css`, `assets/`.
3. Install all new dependencies in one `npm install`, commit lockfile.
4. Wire moon tasks (`test`, `test-e2e`, `typegen`).
5. Run `moon ci`. Lint + typecheck + unit + E2E must all pass before merge.
6. Update `apps/orchestrator/README.md` and `apps/orchestrator/AGENTS.md` with the new commands + rules.
7. Archive this change once merged.

No production deploy yet. Rollback = revert the merge commit.

## Open Questions

- `/auth/me` shape: minimal user (`id`, `email`, `displayName`, `roles`) vs full clinician profile? **Default decision**: minimal; expand in a later change.
- Should `lib/api/client.ts` retry on 401 by calling `/auth/me` once before redirecting to `/login`? **Default decision**: yes, single retry, with a small in-memory lock to prevent stampedes.
- Where do app-wide error boundaries surface? **Default decision**: `app/root.tsx` wraps everything in a boundary that shows a generic "iets ging mis" toast + a "report" button (no-op for POC).
