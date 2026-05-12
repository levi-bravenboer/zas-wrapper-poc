## 1. Bootstrap & demolition

- [x] 1.1 Delete scaffold `App.tsx`, `App.css`, `assets/`, default `index.css` from `apps/orchestrator/src/`
- [x] 1.2 Create canonical folder tree under `src/`: `app/`, `routes/`, `modules/`, `components/`, `hooks/`, `lib/`, `config/`, `stores/`, `types/`, `styles/`, `test/`, `mocks/`
- [x] 1.3 Add `tsconfig` path alias `@/*` → `src/*` and verify Vite + TS resolve it
- [x] 1.4 Enable strict flags: `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`
- [x] 1.5 Add `routeTree.gen.ts` to `.gitignore`

## 2. Dependencies

- [x] 2.1 Install runtime deps: `@tanstack/react-router`, `@tanstack/react-query`, `@tanstack/react-form`, `zod`, `openapi-fetch`, `i18next`, `react-i18next`, `lucide-react`, `zustand`, `clsx`, `tailwind-merge`
- [x] 2.2 Install Tailwind v4: `tailwindcss`, `@tailwindcss/vite`
- [x] 2.3 Install dev deps: `@tanstack/router-plugin`, `openapi-typescript`, `@tanstack/router-devtools`, `@tanstack/query-devtools`
- [x] 2.4 Install test deps: `vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `msw`, `@playwright/test`
- [x] 2.5 Install lint/format: `@biomejs/biome`, `eslint-plugin-import`, `eslint-plugin-react-x`, `eslint-plugin-react-dom`, `eslint-plugin-testing-library`, `eslint-plugin-vitest`, `eslint-plugin-i18next`
- [x] 2.6 Commit lockfile after a clean install under Node 22.13+

## 3. Tooling & config

- [x] 3.1 Add TanStack Router Vite plugin + Tailwind v4 plugin to `vite.config.ts`
- [x] 3.2 Create `biome.json` (format + import sort only, lint disabled)
- [x] 3.3 Update `eslint.config.js`: add plugins, disable stylistic rules, add `no-restricted-paths` blocking `modules/* → modules/*`, scope `import/no-default-export` to non-`routes/**` paths
- [x] 3.4 Add `vitest.config.ts` with jsdom env, `setupFiles` for jest-dom + MSW node server, coverage thresholds (80% on `lib/`, `modules/*/api.ts`, `modules/*/hooks.ts`, `modules/*/schemas.ts`)
- [x] 3.5 Add `playwright.config.ts` with one project, dev-server webServer, MSW worker
- [x] 3.6 Wire moon tasks in `apps/orchestrator/moon.yml`: `test`, `test-e2e`, `typegen`, `format` (extend existing `dev`, `build`, `typecheck`, `lint`, `preview`)
- [x] 3.7 Add `.env.example` with `VITE_API_BASE_URL`, `VITE_API_MODE=mock`

## 4. Styles & design system

- [x] 4.1 Create `src/styles/tokens.css` with theme-agnostic CSS vars (`--color-surface-1`, `--color-text-1`, spacing, radius)
- [x] 4.2 Create `src/styles/globals.css` importing tokens + Tailwind v4 `@theme` block referencing tokens
- [x] 4.3 Bootstrap shadcn config; copy `Button`, `Input`, `Label`, `Form`, `Card`, `Toast` primitives into `src/components/ui/`
- [x] 4.4 Add `cn()` helper in `src/lib/style/cn.ts` (clsx + tailwind-merge)
- [x] 4.5 Add `Icon` re-export module if needed; ban inline SVGs in lint rules notes

## 5. Providers & app root

- [x] 5.1 Create `src/app/queryClient.ts` exporting a configured `QueryClient` (retry: 1, staleTime: 30s)
- [x] 5.2 Create `src/app/providers.tsx` composing `QueryClientProvider`, `RouterProvider`, `I18nextProvider`, root `ErrorBoundary`, toaster
- [x] 5.3 Create `src/app/errorBoundary.tsx` rendering localized fallback
- [x] 5.4 Rewrite `src/main.tsx` to mount `<Providers />` only
- [x] 5.5 Update `index.html` `lang="nl"` and document `<title>`

## 6. Routing

- [x] 6.1 Create `src/routes/__root.tsx` with shared layout shell
- [x] 6.2 Create `src/routes/index.tsx` (public landing placeholder) — consolidated into `_auth/index.tsx` since both target `/`; `_auth` guard redirects unauthed visitors to `/login`
- [x] 6.3 Create `src/routes/login.tsx` with `validateSearch` schema for `?redirect`
- [x] 6.4 Create `src/routes/_auth.tsx` guard route that calls `useSession()` in `beforeLoad` and redirects to `/login?redirect=...`
- [x] 6.5 Create `src/routes/_auth/index.tsx` authed landing placeholder
- [x] 6.6 Create `src/routes/launch.tsx` route stub (delegates to smart-launch module)

## 7. API client

- [x] 7.1 Commit a baseline `src/lib/api/schema.d.ts` (from current backend `/openapi.json`)
- [x] 7.2 Create `src/lib/api/client.ts` exporting a configured `openapi-fetch` client with `credentials: 'include'`
- [x] 7.3 Add one-shot 401 retry middleware re-fetching `/auth/me` with in-memory lock
- [x] 7.4 Implement `orchestrator:typegen` moon task running `openapi-typescript http://localhost:8000/openapi.json -o src/lib/api/schema.d.ts`
- [x] 7.5 Add `createQueryKeys` helper in `src/lib/query/keys.ts`

## 8. i18n

- [x] 8.1 Create `src/lib/i18n/index.ts` initializing i18next with `nl` resource and namespace per module
- [x] 8.2 Create `src/lib/i18n/locales/nl/common.json` with error boundary, generic toasts, app chrome
- [x] 8.3 Create `src/lib/i18n/locales/nl/auth.json` with login labels, errors
- [x] 8.4 Create `useLocale()` + `changeLocale()` API typed for future `'nl' | 'fr' | 'en'`
- [x] 8.5 Enable `eslint-plugin-i18next` no-literal-string rule, scoped to component files

## 9. Auth module

- [x] 9.1 Create `src/modules/auth/keys.ts` with `authKeys.me()` etc.
- [x] 9.2 Create `src/modules/auth/api.ts` with `login`, `logout`, `me` typed callers
- [x] 9.3 Create `src/modules/auth/schemas.ts` with `loginSchema` (Zod)
- [x] 9.4 Create `src/modules/auth/hooks.ts`: `useSession`, `useLogin`, `useLogout`
- [x] 9.5 Create `src/modules/auth/components/LoginForm.tsx` (TanStack Form + Zod + shadcn primitives)
- [x] 9.6 Hook `LoginForm` into `routes/login.tsx`; redirect to `redirect` search param on success

## 10. SMART launch stub

- [x] 10.1 Create `src/modules/smart-launch/constants.ts` with `LAUNCH_LANDING_PATH`
- [x] 10.2 Create `src/modules/smart-launch/schemas.ts` with `launchSearchSchema` (Zod: `iss`, `launch`, `state?`)
- [x] 10.3 Create `src/modules/smart-launch/store.ts` (Zustand) holding launch context
- [x] 10.4 Create `src/modules/smart-launch/hooks.ts` exporting `useLaunchContext`
- [x] 10.5 Create `src/modules/smart-launch/api.ts` exporting `exchangeAuthCode(code, state)` throwing `'not-implemented'`
- [x] 10.6 Wire `routes/launch.tsx` to validate, set store, redirect to `LAUNCH_LANDING_PATH`

## 11. Mocks (MSW)

- [x] 11.1 Create `src/mocks/handlers/auth.ts` covering `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- [x] 11.2 Create `src/mocks/handlers/index.ts` aggregating handlers (deep-import only — no barrel re-exports)
- [x] 11.3 Create `src/mocks/server.ts` (Node) for Vitest
- [x] 11.4 Create `src/mocks/browser.ts` + `public/mockServiceWorker.js` for Playwright/dev
- [x] 11.5 Gate worker start on `VITE_API_MODE === 'mock'`

## 12. Tests

- [x] 12.1 Create `src/test/renderWithProviders.tsx`
- [x] 12.2 Unit: `lib/api/client.test.ts` covering 401 retry path
- [x] 12.3 Component: `modules/auth/components/LoginForm.test.tsx` (form validation, submit, error)
- [x] 12.4 Integration: `modules/auth/hooks.test.tsx` covering `useSession` 200 + 401 → null
- [x] 12.5 Integration: `modules/smart-launch/launch.test.tsx` covering valid + invalid params
- [x] 12.6 E2E: `tests-e2e/smoke-login.spec.ts` driving login → authed landing
- [x] 12.7 Verify coverage gate fails when threshold breached, passes on baseline

## 13. Docs & conventions

- [x] 13.1 Update `apps/orchestrator/README.md`: new commands, structure tree, moon-first stance
- [x] 13.2 Update `apps/orchestrator/AGENTS.md`: folder rules, casing table, coding rules, agentic testing workflow
- [x] 13.3 Add an ADR note at `apps/orchestrator/docs/adr/0001-router-and-client.md` summarising D1–D4 from `design.md`
- [x] 13.4 Cross-link from root `AGENTS.md` to orchestrator section

## 14. Verify & archive

- [x] 14.1 Run `moon run orchestrator:typecheck` — must pass
- [x] 14.2 Run `moon run orchestrator:lint` — must pass
- [x] 14.3 Run `moon run orchestrator:test` — must pass with coverage thresholds
- [x] 14.4 Run `moon run orchestrator:test-e2e` — smoke must pass
- [x] 14.5 Run `moon run orchestrator:build` — must produce `dist/`
- [x] 14.6 Run `npx openspec validate orchestrator-app-shell --strict` — must pass
- [x] 14.7 Run `npx openspec status --change orchestrator-app-shell` — all artifacts green
