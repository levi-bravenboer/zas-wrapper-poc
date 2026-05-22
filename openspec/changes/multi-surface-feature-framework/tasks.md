## 1. Platform scaffold (no behavior change)

- [x] 1.1 Create `apps/orchestrator/src/platform/` with empty subfolders `surface/`, `embed/`, `ports/`, `smart/`, `fhir/` and a top-level `index.ts` barrel _(skipped the top-level `index.ts` to honour the existing project rule against barrels; `modules/index.ts` is the only sanctioned barrel because the registry needs side-effect imports — flag this carve-out in step 6/8 docs)_
- [x] 1.2 Implement `platform/surface/types.ts` exporting `Surface`, `DataSource`, `Shell`, `SurfaceId` types
- [x] 1.3 Implement `platform/surface/registry.ts` exporting the immutable `SURFACES` record with `app`, `smart`, `embed`
- [x] 1.4 Implement `platform/surface/SurfaceProvider.tsx` with `<SurfaceProvider>` and `useSurface()` (throws when outside provider) _(split into `context.ts` + `SurfaceProvider.tsx` + `hooks.ts` to satisfy `react-refresh/only-export-components`)_
- [x] 1.5 Implement helper hooks `useIsEmbed`, `useIsSmart`, `useSurfaceBasePath` on top of `useSurface`
- [x] 1.6 Implement `platform/ports/createPort.ts` generic factory returning `{ Provider, use }` _(file is `.tsx` because it returns JSX)_
- [x] 1.7 Implement `platform/embed/defineFeature.ts` with the typed `FeatureSpec` and the module-scoped registry (`getFeatures`, `getFeaturesForSurface`, `getFeatureById`, `getRequiredScopes`)
- [x] 1.8 Implement `platform/embed/renderFeature.tsx` that selects the adapter from `useSurface()` and memoizes the port _(adapter deps resolved via placeholder `FeatureDeps` contexts; real deps wired by `AppShell` / `SmartShell` / `EmbedShell` in step 3)_
- [x] 1.9 Add unit tests in `platform/__tests__/` for surface registry, createPort throw behavior, defineFeature duplicate-id rejection, renderFeature adapter selection (using a mock feature)
- [x] 1.10 Add `apps/orchestrator/src/modules/index.ts` barrel (empty until features migrate) and import it from `src/main.tsx` before `createRouter`; add a startup assertion when registry is empty in production builds

## 2. Migrate `tasks` feature end-to-end (app surface only)

- [x] 2.1 Create `modules/tasks/` with `TasksPage.tsx`, `ports.ts`, `types.ts`, `adapters/orchestrator.ts`, `index.ts`, `__tests__/TasksPage.test.tsx`
- [x] 2.2 Define `TasksPort` via `createPort` exporting `list` and `complete` signatures returning the domain `Task` type
- [x] 2.3 Implement `orchestratorTasksPort` against the orchestrator API client (placeholder data is fine while no backend route exists)
- [x] 2.4 Move existing placeholder UI from `routes/_auth/tasks.tsx` into `TasksPage`, consuming `useTasksPort().list`
- [x] 2.5 Call `defineFeature` in `modules/tasks/index.ts` with `surfaces: ['app']`, `port`, `adapters.orchestrator`, `titleKey: 'nav.tasks'`, `nav.icon: ListTodo`
- [x] 2.6 Export `tasksFeature` from `modules/index.ts`
- [x] 2.7 Replace `routes/_auth/tasks.tsx` body with a single `renderFeature(tasksFeature)` call
- [x] 2.8 Update `Sidebar` to derive nav items from `getFeaturesForSurface('app')` (keep dashboard hard-wired for now) _(Sidebar now merges `hardWiredNavItems` with `getFeaturesForSurface('app')` and sorts by an `order` field; tasks moved out of `navItems.ts` into the registry-driven set)_
- [x] 2.9 Update or add tests so existing `_auth` + Sidebar + tasks page coverage still passes
- [x] 2.10 Run `pnpm tsc -b --noEmit`, `pnpm eslint .`, `pnpm vitest run` and quote results _(tsc:0, eslint:0 (2 pre-existing warnings in `modules/auth/hooks.test.tsx`), vitest: 15 files / 50 tests passed)_

## 2.11 Transitional wiring (step 2 only, removed in step 3)

- [x] 2.11 Wrap `routes/_auth.tsx`'s `component` with `<SurfaceProvider surface={SURFACES.app}><OrchestratorDepsProvider deps={{ api }}><AppLayout /></OrchestratorDepsProvider></SurfaceProvider>` so `renderFeature(tasksFeature)` finds the active surface and orchestrator deps. The `AppShell` introduced in step 3 absorbs this wrapping and `_auth.tsx` reverts to mounting the shell directly.

## 3. Add Smart and Embed shells with mocked FHIR

- [x] 3.1 Implement `platform/embed/AppShell.tsx` wrapping `<SurfaceProvider surface={SURFACES.app}>` + sidebar/topbar + `<Outlet/>` _(AppShell also wires `OrchestratorDepsProvider` so `_auth.tsx` can revert to a single shell mount; the step-2 transitional wrap is gone)_
- [x] 3.2 Implement `platform/embed/SmartShell.tsx` wrapping surface provider + mock `SmartProvider` + sidebar/topbar + outlet
- [x] 3.3 Implement `platform/embed/EmbedShell.tsx` wrapping surface provider + mock `SmartProvider` + bare layout (`<main data-embed="hix">`) + outlet
- [x] 3.4 Add `routes/_smart.tsx` and `routes/_embed.tsx` layout routes that mount the corresponding shells _(TanStack `_`-prefixed files create pathless layouts, so the spec's `_smart`/`_embed` filenames would not yield the required `/s` and `/embed` URL prefixes. Used path-bearing `routes/s.tsx` and `routes/embed.tsx` instead. Document the deviation in the routing spec in step 8)_
- [x] 3.5 Add a mock `SmartProvider` in `platform/smart/SmartProvider.tsx` yielding hard-coded `{ patient: 'Patient/123', encounter: 'Encounter/abc' }` and a stub `client` _(exported as `MockSmartProvider`; real provider lands in step 4)_
- [x] 3.6 Add a stub `fhirTasksPort` in `modules/tasks/adapters/fhir.ts` returning static rows so the embed surface renders
- [x] 3.7 Update `tasksFeature` to `surfaces: ['app', 'smart', 'embed']` and add `adapters.fhir`, `smart: { scopes: ['patient/Task.read'], requires: ['patient'] }`
- [x] 3.8 Add `routes/_auth/tasks.tsx`, `routes/_smart/tasks.tsx`, `routes/_embed/tasks.tsx` stub files (committed by hand for this step) _(actual filenames `routes/s/tasks.tsx` and `routes/embed/tasks.tsx` — see 3.4 deviation note)_
- [x] 3.9 Add tests verifying `/embed/tasks` renders without `Sidebar` and `/s/tasks` renders with `Sidebar` _(both assertions live in `platform/__tests__/SmartShell.test.tsx`)_
- [x] 3.10 Run `pnpm tsc -b --noEmit`, `pnpm eslint .`, `pnpm vitest run` and quote results _(tsc: 0; eslint: 0 errors, 2 pre-existing warnings in `modules/auth/hooks.test.tsx`; vitest: 16 files / 52 tests passed)_

## 4. Real SMART launch flow

- [x] 4.1 Add `fhirclient` (and any needed types) to `apps/orchestrator/package.json`; run `pnpm install` _(added `fhirclient@^2.6.3` as dep, `@types/fhir@^0.0.42` as devDep)_
- [x] 4.2 Replace mock `SmartProvider` with a real provider that reads from the in-memory SMART store and throws / re-launches when no token _(throws `SmartTokenMissingError`; relaunch wiring handled by the error boundary in step 4.13. `MockSmartProvider` deleted; `platform/smart/useLaunchContext.ts` is the public re-export per spec)_
- [x] 4.3 Implement `exchangeAuthCode(code, state)` against `fhirclient`, populating `{ client, ctx, token }` and clearing PKCE state from `sessionStorage` _(deviation: implemented as `exchangeAuthCode()` with no args because `fhirclient.oauth2.ready()` reads `code`/`state` straight from `window.location` and handles PKCE storage itself. Errors wrap in `SmartExchangeError`; sessionStorage keys under `smart-pkce` cleared in a `finally`)_
- [x] 4.4 Rewrite `routes/launch.tsx` to validate `iss`/`launch`/`surface`/`return` via Zod, kick off PKCE, and redirect the browser to the authorize endpoint _(`beginLaunch` wraps `FHIR.oauth2.authorize`; CLIENT_ID read from `VITE_SMART_CLIENT_ID`. Localized errors via `smart` i18n namespace)_
- [x] 4.5 Add `routes/launch.callback.tsx` to validate `code`/`state`/`error?`, invoke `exchangeAuthCode`, store context, and navigate to the surface-aware destination _(redirect target via `SURFACES[surface].basePath` + optional `returnPath`. Provider error renders localized retry UI per spec scenario)_
- [~] 4.6 ~~Replace stub `fhirTasksPort` with a real adapter mapping FHIR `Task` via a zod schema~~ **Deferred to post-PoC FHIR integration change.** PoC scope tightened to "frontend base that *can* host FHIR-backed screens once embedded in HiX". `fhirTasksPort` stays a stub returning static rows; real schema/mapping/read-write happens when an actual EPD wiring task lands.
- [~] 4.7 ~~Implement `useFhirQuery` and `useFhirMutation` helpers~~ **Deferred (same rationale as 4.6).** Plain `useQuery` is sufficient until a real FHIR backend exists to design helper ergonomics against.
- [~] 4.8 ~~Implement `fhirPager`~~ **Deferred (same rationale as 4.6).** No production traffic, no pagination concern yet. `platform/fhir/` directory stays empty until the integration change.
- [ ] 4.9 Add `platform/embed/host.ts` postMessage protocol with origin verification and `EMBED_HOST_ORIGIN` env wiring
- [ ] 4.10 Add `createMemoryHistory` fallback inside `EmbedShell` when `window !== window.parent`
- [ ] 4.11 Add Vite `manualChunks` config splitting an `embed` chunk; ensure devtools are excluded from it
- [ ] 4.12 Document required CSP headers (`frame-ancestors`, no `X-Frame-Options`) in `apps/orchestrator/README.md` referencing `EMBED_FRAME_ANCESTORS` env var
- [ ] 4.13 Add launch + callback tests (Zod validation, token store population, redirect target by surface)
- [ ] 4.14 Run `pnpm tsc -b --noEmit`, `pnpm eslint .`, `pnpm vitest run` and quote results

## 5. Feature generator + lint guardrails

- [ ] 5.1 Add `tsx` as a devDependency if not already present
- [ ] 5.2 Implement `apps/orchestrator/scripts/gen-feature.ts` supporting flags `--id`, `--path`, `--surfaces`, `--fhir-scopes`, `--requires`, `--title-nl`, `--dry-run`
- [ ] 5.3 Add a `gen:feature` script to `apps/orchestrator/package.json` invoking the generator with `tsx`
- [ ] 5.4 Implement template writers that produce the file set defined in the `feature-generator` spec
- [ ] 5.5 Implement registry-side mutations: append `export { default as <id>Feature } from './<id>'` to `modules/index.ts` in alphabetical order and add the `nav.<id>` entry to `locales/nl/nav.json`. Do NOT touch `navItems.ts` — the sidebar already merges `getFeaturesForSurface('app')` with the hard-wired group (see `components/layout/AppSidebar.tsx`); appending there would double-register the nav item.
- [ ] 5.6 Add unit tests for the generator covering: app-only file set, embed-only file set, refusal to overwrite existing module, dry-run output
- [ ] 5.7 Add ESLint `no-restricted-imports` rules forbidding `modules/** → components/layout/**`, cross-module imports, and `platform/** → modules/**`
- [ ] 5.8 Add a custom ESLint rule (or `no-restricted-syntax`) flagging route stub files whose body is not a `renderFeature(...)` call
- [ ] 5.9 Smoke test: run `pnpm gen:feature observations --surfaces app,embed --fhir-scopes "patient/Observation.read" --requires patient --title-nl "Observaties"`, then `pnpm tsc -b --noEmit`, `pnpm eslint .`, `pnpm vitest run`; revert generated files after verification

## 6. Agent rules and commit hook

- [ ] 6.1 Add `## Feature surface gating` section to `AGENTS.md` with the verbatim user prompt, four rules, reference to `pnpm gen:feature`, and a link to `openspec/changes/multi-surface-feature-framework/page-surface-catalogue.md` (until archived; thereafter the archived path) as the source of truth for current page → surface decisions.
- [ ] 6.2 Add `## Feature surface gating` section to `CLAUDE.md` repeating the verbatim user prompt and pointing to `AGENTS.md`
- [ ] 6.3 Add per-app `apps/orchestrator/AGENTS.md` reminder referencing the gating section
- [ ] 6.4 Create `.claude/skills/new-feature/SKILL.md` with frontmatter `name: new-feature` and the four-step workflow (consult `page-surface-catalogue.md` → ask surfaces if not pre-decided → ask scopes → run generator → verify). Skill MUST short-circuit when the requested path matches an admin opt-out prefix (`/_auth/admin/*`, `/_auth/settings`, `/_auth/pathways/*`) and instruct the agent to hand-write the route without `defineFeature`.
- [ ] 6.5 Add `.claude/hooks/check-feature-surfaces.sh` that greps staged diff for new `defineFeature(` calls missing `surfaces:` and exits non-zero
- [ ] 6.6 Wire the hook in `.claude/settings.json` (`PreToolUse` for `Bash` `git commit` matchers) AND/OR add a git `pre-commit` hook installer
- [ ] 6.7 Save a `feedback` memory at `~/.claude/projects/<slug>/memory/feedback_feature_surface_gating.md` with the rule and link from `MEMORY.md`
- [ ] 6.8 Manual verification: open a fresh Claude session, ask "add a new view for medications", confirm the agent asks the surface question before writing code

## 7. Migrate clinical-entity features to the registry

Scope tightened from the original plan: when this change was drafted, `pathways` / `patients` / `settings` / `dashboard` were placeholder routes. Between then and now, separate workstreams shipped them as full modules (`modules/pathway/`, `modules/patient/`, `modules/organisation/`, `modules/practitioner-role/`, `modules/user/`). Per `page-surface-catalogue.md`, only clinical-entity pages benefit from registry-driven multi-surface; admin pages and proprietary workflows stay hand-written and are out of scope for this change. Section 7 is therefore limited to the two pages that genuinely target `smart` / `embed`: `tasks` (restore on `app`) and `patients`.

- [ ] 7.1 Restore `tasks` on the `app` surface: update `modules/tasks/index.ts` `surfaces` to `['app', 'smart', 'embed']`, add `routes/_auth/tasks.tsx` calling `renderFeature(tasksFeature)`, and confirm the sidebar nav item reappears via `getFeaturesForSurface('app')` (catalogue row `tasks`).
- [ ] 7.2 Migrate `patients` to a registry feature:
  - Run `pnpm gen:feature patients --surfaces app,smart --fhir-scopes "patient/Patient.read" --requires patient --title-nl "Patiënten"`.
  - Move list + detail components from `routes/_auth/patients/**` into the generated `modules/patients/` (preserve existing tests).
  - Replace `routes/_auth/patients/index.tsx` + `routes/_auth/patients/$patientId/index.tsx` bodies with `renderFeature(patientsFeature)` and a `useParams` shim for the detail page.
  - Add `routes/s/patients.tsx` + `routes/s/patients/$patientId.tsx` stubs calling `renderFeature(patientsFeature)`.
  - Implement `adapters/fhir.ts` returning stub `Patient` rows (real adapter deferred to the post-PoC FHIR-integration change, matching the 4.6–4.8 carve-out).
- [ ] 7.3 Document the admin opt-out in code: add `// surface-opt-out: app-only` markers at the top of every `routes/_auth/admin/*` file, `routes/_auth/pathways/*` files, `routes/_auth/index.tsx`, and any future hand-written `_auth` route so the lint rule from 5.8 / 6.5 can recognise the exception explicitly.
- [ ] 7.4 Update the section 6 commit hook + new-feature skill to consult `page-surface-catalogue.md`: admin paths (`/_auth/admin/*`, `/_auth/settings`, `/_auth/pathways/*`) MUST skip the surface prompt and MUST NOT generate `defineFeature` scaffolding.
- [ ] 7.5 Run `moon run orchestrator:typecheck`, `moon run orchestrator:lint`, `moon run orchestrator:test` and quote results.
- [ ] 7.6 Manual smoke: load `/_auth/tasks`, `/s/tasks`, `/embed/tasks`, `/_auth/patients`, `/s/patients` and confirm each renders the expected shell + a non-empty list (stub data is fine for FHIR surfaces).

## 8. Documentation and release

- [ ] 8.1 Update `apps/orchestrator/README.md` route table to list `_auth`, `s`, `embed` segments (path-bearing, not pathless `_smart` / `_embed`), reference `page-surface-catalogue.md` for current page → surface decisions, and mention surface gating.
- [ ] 8.2 Add a short `apps/orchestrator/src/platform/README.md` covering surfaces, ports, defining a new feature, and writing tests, plus a "when NOT to use `defineFeature`" subsection that points at the admin opt-out list.
- [ ] 8.3 Add a section to `apps/orchestrator/AGENTS.md` linking to the platform README, the `new-feature` skill, and `page-surface-catalogue.md`.
- [ ] 8.4 Confirm `openspec validate multi-surface-feature-framework --strict` passes
- [ ] 8.5 Archive the change via `openspec archive multi-surface-feature-framework` once shipped
