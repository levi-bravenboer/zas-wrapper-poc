## 1. Root `AGENTS.md` consolidation + `CLAUDE.md` reduction (do first — governs everything downstream)

- [x] 1.1 Move "Pre-approved moon tasks" from root `CLAUDE.md` to root `AGENTS.md`; append the new **Digital Front Door (`apps/digital-front-door`)** subsection listing the moon tasks that will be wired later (`install`, `dev`, `build`, `lint`, `format`, `format-check`, `typecheck`, `test`, `test-coverage`).
- [x] 1.2 Move "Worktree directory" rule from `CLAUDE.md` to `AGENTS.md`.
- [x] 1.3 Move "Feature surface gating" section from `CLAUDE.md` to `AGENTS.md`.
- [x] 1.4 Move "Behavioural Reminders" (semantic commits, verify-before-completion, per-app `AGENTS.md` lookup) from `CLAUDE.md` to `AGENTS.md`.
- [x] 1.5 Move "Moon is the canonical task runner" intro + the "When moon is not the right tool" section from `CLAUDE.md` to `AGENTS.md`.
- [x] 1.6 Move "Pointers" section from `CLAUDE.md` to `AGENTS.md`.
- [x] 1.7 Add `apps/digital-front-door` to the apps inventory at the top of root `AGENTS.md`.
- [x] 1.8 Reduce root `CLAUDE.md` to: a one-paragraph pointer ("read `AGENTS.md` first"); the "Claude-specific Setup" section (OpenSpec, Superpowers, pencil, context7); the "Project slash commands" section; the "Enforcement hooks" section. Nothing else.
- [x] 1.9 Confirm convention: every app under `apps/` uses `AGENTS.md`. No per-app `CLAUDE.md` exists or is created (`find apps -maxdepth 2 -name CLAUDE.md` returns zero).

## 2. OpenSpec scope + ledger updates

- [x] 2.1 Update `openspec/scope.md`: remove `Patient surface [mvp]` from PoC Out-of-Scope; add `F9 Digital front door (shell)` to PoC In-Scope with acceptance "app installs, lints, typechecks, runs on iOS / Android / web; backend `/mobile/health` returns 200"; refresh the PoC → MVP Delta row for F5.
- [x] 2.2 Update `openspec/roadmap.md` so the patient-surface MVP item reads "shell shipped in PoC via `digital-front-door-setup`; feature delivery + delivery-channel decisions remain MVP work."
- [x] 2.3 Update `openspec/backlog.md` entries `BL-014`, `BL-022`, and `BL-030`: append "Shell promoted to PoC via `digital-front-door-setup` on 2026-06-02; feature shape + delivery-channel decisions remain MVP-tier."

## 3. App scaffold (init + folder skeleton + config)

- [x] 3.1 From the worktree root, run `pnpm create expo-app apps/digital-front-door --template default --no-install`. **Drift**: `create-expo-app@latest` pulled **Expo SDK 56** (newer than the SDK 55 baseline drafted earlier); SDK 56 accepted per the user's standing "newest stable" preference. Spec + design updated to reflect.
- [x] 3.2 Wipe the template-generated `src/app/` routes (`index.tsx`, `explore.tsx`, `_layout.tsx`), template `src/components/`, `src/constants/`, `src/hooks/`, and `src/global.css`. Create the empty skeleton `src/{app/(auth),app/(app),components/ui,modules,providers,hooks,lib/i18n/locales/nl-BE,styles}` plus `__tests__/{app,fixtures,utils}`. Delete template `LICENSE`, `README.md`, `scripts/reset-project.js`, and the per-app `CLAUDE.md` (convention: per-app uses `AGENTS.md` only).
- [x] 3.3 Replace `app.json` with `app.config.ts`: name `Digitale voordeur`, slug `digital-front-door`, scheme `digitale-voordeur`, ios `bundleIdentifier` and android `package` `com.reaktor.zas.digitalfrontdoor`, `userInterfaceStyle: 'light'`, `web: { bundler: 'metro' }`, `experiments: { typedRoutes: true, reactCompiler: true }`, `extra: { apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? null }`, platforms `["ios", "android", "web"]`, `ios.deploymentTarget: '16.4'`.
- [x] 3.4 Pin runtime versions in `package.json` (SDK 56 baseline): `expo` `~56.0.x`, `react` `19.2.3`, `react-dom` `19.2.3`, `react-native` `~0.85.x`, `expo-router` `~56.x`, `react-native-reanimated` `~4.3.x`, `react-native-worklets` `~0.8.x`; add `"engines": { "node": ">=22.13.0" }`. Leave the bundled `@expo/ui`, `expo-glass-effect`, `expo-symbols` as the template installed them — we'll prune if any turn out to be unused after the first feature change.
- [x] 3.8 **Toolchain check**: verified `.moon/toolchain.yml` already pins Node `22.13.0` — no bump needed. Orchestrator and backend already build under Node 22.13.
- [x] 3.5 Commit `apps/digital-front-door/.npmrc` with `node-linker=hoisted`.
- [x] 3.6 Create `apps/digital-front-door/.gitignore`: `node_modules/`, `.expo/`, `dist/`, `web-build/`, `.env`, `ios/`, `android/`, `*.log`.
- [x] 3.7 Create `apps/digital-front-door/.env.example` with `EXPO_PUBLIC_API_BASE_URL=http://localhost:8000`.

## 4. TypeScript config

- [x] 4.1 Update `tsconfig.json` `compilerOptions`: `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `verbatimModuleSyntax: true`, `jsxImportSource: 'nativewind'`, `paths: { "@/*": ["src/*"] }`. Keep the Expo `extends` chain.

## 5. ESLint + Prettier (set rules early — they govern all subsequent code)

- [x] 5.1 Install ESLint deps: `eslint`, `eslint-config-expo`, `eslint-plugin-i18next`, `eslint-plugin-simple-import-sort`, `eslint-plugin-check-file`, `@tanstack/eslint-plugin-query`, `typescript-eslint`.
- [x] 5.2 Create `eslint.config.js` (flat) with the full rule set from design D14: `simple-import-sort/imports`, `check-file/filename-naming-convention` (kebab-case), `@typescript-eslint/no-explicit-any: error`, `@typescript-eslint/no-non-null-assertion: error`, `@typescript-eslint/consistent-type-imports: error` (inline), `@typescript-eslint/consistent-type-definitions: ['error', 'type']`, `@typescript-eslint/consistent-type-assertions: ['error', { assertionStyle: 'never' }]` (exempted in `__tests__/**`), `@typescript-eslint/use-unknown-in-catch-callback-variable: error`, `@typescript-eslint/prefer-nullish-coalescing: error`, `@typescript-eslint/promise-function-async: error`, `@typescript-eslint/no-restricted-types: error` (`Function`, `{}`, `Object`), `no-console: ['error', { allow: [] }]` (exempted in `src/lib/logger.ts`), `no-restricted-syntax` (TS enum ban, `forwardRef` ban, raw `useQuery`/`useMutation` ban in `src/app/**` and `src/components/ui/**`), `no-restricted-imports` (block `../*`, force `@/...`), `i18next/no-literal-string: error`, `import/no-default-export: error` (exempted in `src/app/**` and `*.config.{js,ts,mjs,cjs}` + `app.config.ts`), `react/function-component-definition: ['error', { namedComponents: 'function-declaration' }]`, `@tanstack/query/exhaustive-deps: error`. Start every type-aware rule at `warn` severity in this initial pass.
- [x] 5.3 Install Prettier deps: `prettier`, `prettier-plugin-tailwindcss`.
- [x] 5.4 Create `.prettierrc`: no semicolons, single quotes, `trailingComma: 'es5'`, `printWidth: 80`, 2-space indent, `arrowParens: 'always'`, plugin `prettier-plugin-tailwindcss`.
- [x] 5.5 Add npm scripts in `package.json`: `lint` (eslint), `lint:fix`, `format` (prettier --write), `format:check` (prettier --check), `typecheck` (tsc --noEmit), `test`, `test:coverage`, `dev`, `build`.

## 6. Per-app `apps/digital-front-door/AGENTS.md` (documents the rules just set + the conventions still to come)

- [x] 6.1 Create `apps/digital-front-door/AGENTS.md` declaring stack (Expo SDK 55, RN 0.83, React 19.2, Node 20.19, pnpm, expo-router 6, NativeWind v4, TanStack Query v5, Jotai, i18next, date-fns, Prettier, ESLint flat, jest-expo, `@rn-primitives/*`, `lucide-react-native`).
- [x] 6.2 Document module folder shape: barrel `index.ts` + `api.ts` + `queries.ts` + `mutations.ts` + `types.ts` + `utils.ts` + `atoms.ts` + `hooks/use-*.ts` + `components/<kebab>.tsx`.
- [x] 6.3 Document filename + export naming table (per design D19).
- [x] 6.4 Document TanStack pattern: one `queryOptions` factory per module, always wrap in `use-*.ts`, no raw `useQuery`/`useMutation` in components/screens (ESLint-enforced), cascade invalidate via `<module>Queries.all()`.
- [x] 6.5 Document Jotai pattern: atoms per module, server state stays in TanStack, auth tokens stay in `secureStorage`, atom naming convention, `reset<Domain>()` on logout.
- [x] 6.6 Document test conventions: mirror tree under `__tests__/`, fixture pattern `make<Entity>(overrides)`, `renderWithProviders` helper.
- [x] 6.7 Document i18n rule: every user-visible string flows through `t()`; source keys English, values Dutch; `nl-BE` only at scaffold; `i18next/no-literal-string` enforced.
- [x] 6.8 Document the `com.reaktor.zas.digitalfrontdoor` placeholder + the rule that the final bundle identifier is picked at the MVP publish-prep change.
- [x] 6.9 Document the `/mobile/*` backend prefix convention.

## 7. Styling (NativeWind v4) + primitive deps

- [x] 7.1 Install `nativewind@^4`, `tailwindcss@^3`.
- [x] 7.2 Create `tailwind.config.js` with `content: ['./src/**/*.{ts,tsx}']`, preset `nativewind/preset`, Tailwind defaults (no custom palette yet — independent tokens per D14b).
- [x] 7.3 Create `src/styles/global.css` with `@tailwind base; @tailwind components; @tailwind utilities;`.
- [x] 7.4 Wire `metro.config.js`: `withNativeWind(getDefaultConfig(__dirname), { input: './src/styles/global.css' })`.
- [x] 7.5 Wire `babel.config.js`: `babel-preset-expo` with `jsxImportSource: 'nativewind'`, plus `nativewind/babel` preset. **SDK 56 change**: do NOT add `react-native-reanimated/plugin` manually — `babel-preset-expo` auto-configures the Reanimated 4 + `react-native-worklets` plugins for us.
- [x] 7.6 Install `class-variance-authority`, `clsx`, `tailwind-merge`; create `src/lib/cn.ts` exporting `cn(...inputs: ClassValue[])` = `twMerge(clsx(inputs))`.
- [x] 7.7 Install `@rn-primitives/portal`, `@rn-primitives/slot` (minimal seed), `lucide-react-native`.

## 8. Routing + root providers + lib seams

- [x] 8.1 Install (most are bundled by the SDK 56 template; verify and add only what's missing): `expo-router` (~56), `react-native-safe-area-context`, `react-native-screens`, `expo-splash-screen`, `expo-status-bar`, `react-native-keyboard-controller`, `react-native-reanimated` (~4.3.x, bundled), `react-native-worklets` (bundled), `react-error-boundary`, `@tanstack/react-query`, `jotai`, `expo-secure-store`, `i18next`, `react-i18next`, `expo-constants`, `date-fns`. Use `npx expo install <pkg>` (not `pnpm add`) so the versions stay SDK-compatible.
- [x] 8.2 Create `src/lib/queryClient.ts` exporting a single `QueryClient` (`staleTime: 30_000`, `gcTime: 300_000`, `retry: 1`).
- [x] 8.3 Create `src/providers/jotai.tsx` re-exporting `Provider` from `jotai`.
- [x] 8.4 Create `src/lib/i18n/locales/nl-BE/common.json` with `{ "app": { "placeholder": { "welcome": "Welkom" } } }`.
- [x] 8.5 Create `src/lib/i18n/index.ts` initialising `i18next` with `nl-BE` only; export async `initI18n()` resolving on init.
- [x] 8.6 Create `src/lib/logger.ts` exporting `log = { info, warn, error }` delegating to `console.*` (the only file allowed to call `console`).
- [x] 8.7 Create `src/lib/secureStorage.ts` per design D17 (web → `localStorage` fallback, native → `expo-secure-store`).
- [x] 8.8 Create `src/lib/api.ts` exporting `apiHealthCheck()` (typed `fetch` of `${EXPO_PUBLIC_API_BASE_URL}/mobile/health` returning `{ status: 'ok' }`); throws a typed error if base URL missing.
- [x] 8.9 Create `src/lib/dateFormat.ts` wrapping `date-fns/format` with the `nl` locale.
- [x] 8.10 Create `src/app/_layout.tsx`: call `SplashScreen.preventAutoHideAsync()` at module load; on mount await `initI18n()` then call `SplashScreen.hideAsync()` and fire-and-forget `apiHealthCheck()` (logged, not awaited); wrap children outer→inner: `ErrorBoundary` → `SafeAreaProvider` → `KeyboardProvider` → `QueryClientProvider` → Jotai `Provider`.
- [x] 8.11 Create `src/app/(auth)/_layout.tsx`, `src/app/(auth)/login.tsx`, `src/app/(app)/_layout.tsx`, `src/app/(app)/index.tsx`, `src/app/+not-found.tsx` (each a placeholder using `t('app.placeholder.welcome')`).

## 9. Tests

- [x] 9.1 Install test deps: `jest`, `jest-expo`, `@testing-library/react-native`, `@testing-library/jest-native`.
- [x] 9.2 Create `jest.config.js` (preset `jest-expo`, `setupFilesAfterEach: ['<rootDir>/jest.setup.ts']`, `testMatch: ['**/__tests__/**/*.test.{ts,tsx}']`, coverage collected, no thresholds).
- [x] 9.3 Create `jest.setup.ts` with default mocks: `expo-secure-store` (in-memory), `react-native-localize` (fixed `nl-BE`), module-level mock for `src/lib/api.ts`.
- [x] 9.4 Create `__tests__/utils/render-with-providers.tsx` (fresh `QueryClient` retry off / gcTime 0 + Jotai `Provider`).
- [x] 9.5 Create `__tests__/app/_layout.test.tsx` smoke test asserting the root layout renders without throwing.
- [x] 9.6 Create `__tests__/fixtures/.gitkeep`.

## 10. Moon + workspace registration

- [x] 10.1 Add `digital-front-door: "apps/digital-front-door"` to `.moon/workspace.yml` `projects`.
- [x] 10.2 Create `apps/digital-front-door/moon.yml` declaring tasks `install`, `dev`, `build`, `lint`, `format`, `format-check`, `typecheck`, `test`, `test-coverage` (each delegating to the matching `package.json` script via `pnpm run <name>`).
- [x] 10.3 Update root `moon.yml` `:ci` deps: append `digital-front-door:test`, `digital-front-door:typecheck`, `digital-front-door:lint`, `digital-front-door:format-check`.
- [x] 10.4 Update root `moon.yml` `:install` deps: append `digital-front-door:install`.

## 11. Backend `/mobile/health` endpoint

- [x] 11.1 Create `apps/backend/app/api/routers/mobile/__init__.py` exporting `mobile_router`.
- [x] 11.2 Create `apps/backend/app/api/routers/mobile/health_router.py` with `APIRouter(prefix="/mobile", tags=["mobile"])` and `GET /health -> {"status": "ok"}`.
- [x] 11.3 Register `mobile_router` in `apps/backend/app/api/__init__.py` alongside the existing resource routers.
- [x] 11.4 Run `moon run backend:openapi` to regenerate `apps/backend/openapi.json`.
- [x] 11.5 Add a backend test asserting `GET /mobile/health` returns 200 with the documented body.

## 12. Verification (scaffold must be green)

- [x] 12.1 `moon run digital-front-door:install` succeeds.
- [x] 12.2 `moon run digital-front-door:typecheck` exits 0.
- [x] 12.3 `moon run digital-front-door:lint` exits 0 — flipped to error severity per 12.10, zero warnings remaining.
- [x] 12.4 `moon run digital-front-door:format-check` exits 0.
- [x] 12.5 `moon run digital-front-door:test` exits 0 (smoke test passes — 1/1).
- [x] 12.6 `moon run digital-front-door:build` builds the web target via Expo export (6 static routes, NativeWind CSS bundled, React Compiler enabled). iOS / Android **device** builds skipped — note in PR; rerun locally with `npx expo run:ios` / `npx expo run:android` before any real-device demo.
- [x] 12.7 `moon run backend:test-host -- -k mobile_health` passes — 2/2 tests (`test_mobile_health_returns_ok`, `test_mobile_health_tagged_for_openapi`).
- [x] 12.8 `moon run backend:openapi` is clean (no diff after regeneration).
- [x] 12.9 `moon run :ci` — every `digital-front-door:*` task is green (all four cached after the standalone passes). `backend:test-host` mobile-health passes. Remaining `:ci` failures (`orchestrator:test`, `orchestrator:lint`, `orchestrator:format`, `backend:test` docker variant) are **pre-existing** in this worktree and are unrelated to this change; not in scope here.
- [x] 12.10 Flip the warning-severity ESLint rules from task 5.2 to error severity now that the scaffold is green; rerun `moon run digital-front-door:lint` and confirm exit 0. Done — also fixed 11 pre-existing warnings (i18n literal strings, type assertions, default-member import, expo-router special-filename exemption, test-file relaxations).
- [x] 12.11 Reread `proposal.md`, `design.md`, `specs/digital-front-door/spec.md`, and `tasks.md` — every locked decision is reflected: SDK 56 stack pinned, prefix `/mobile/*` shipped, NativeWind + `@rn-primitives` + `cva` convention documented, TanStack `queryOptions` pattern documented, Jotai pre-installed, `expo-secure-store` seam present, i18next `nl-BE` only, ESLint flipped warn→error with expo-router special-filename exemption, Prettier + tailwindcss-plugin sorting Tailwind classes, jest-expo smoke test green, moon project + CI deps registered, `apps/digital-front-door/AGENTS.md` complete, root `AGENTS.md` consolidated + `CLAUDE.md` slim, scope.md / roadmap.md / backlog.md updated. Change is archive-ready.
