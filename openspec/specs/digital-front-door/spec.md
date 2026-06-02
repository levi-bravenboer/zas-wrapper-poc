# digital-front-door Specification

## Purpose

Patient-facing Expo SDK 56 mobile app shell at `apps/digital-front-door` — iOS, Android, and web targets. This capability covers the shell only (boot, routing, lint/typecheck/dev/build task graph, stack invariants, MDR-safe scaffold). Concrete patient features are added by subsequent feature changes; each MUST run its own MDR check.

## Requirements


### Requirement: App tree exists at `apps/digital-front-door`

The repository SHALL contain a self-contained Expo SDK 56 application at `apps/digital-front-door/`. The application SHALL be its own pnpm package with its own `package.json` and `pnpm-lock.yaml`; the repository SHALL NOT introduce a root `pnpm-workspace.yaml` to host it.

#### Scenario: App directory present
- **WHEN** an engineer lists `apps/`
- **THEN** `digital-front-door/` appears alongside `backend/` and `orchestrator/`

#### Scenario: Self-contained package manifest
- **WHEN** an engineer inspects `apps/digital-front-door/`
- **THEN** the directory contains its own `package.json` and `pnpm-lock.yaml`
- **AND** no root-level `pnpm-workspace.yaml` is added to the repository

### Requirement: Stack pinned to Expo SDK 56

The app SHALL declare `expo` version `~56.0.x` and SHALL ship with React 19.2.3, React Native 0.85, expo-router `~56.x`, and target Node 22.13.x. The New Architecture (Fabric + TurboModules) SHALL be enabled; `experiments.typedRoutes` and `experiments.reactCompiler` SHALL be enabled in `app.config.ts`. iOS deployment target SHALL be 16.4+; Android minimum SHALL remain 7+. `react-native-reanimated` 4.x and its sibling `react-native-worklets` SHALL be installed as bundled-by-template SDK 56 dependencies; the Reanimated babel plugin SHALL NOT be added to `babel.config.js` manually — `babel-preset-expo` auto-configures it for SDK 56.

#### Scenario: SDK version declared
- **WHEN** an engineer reads `apps/digital-front-door/package.json`
- **THEN** `expo` is pinned to `~56.0.x`
- **AND** `react` is pinned to `19.2.3`
- **AND** `react-native` is pinned to `0.85.x`
- **AND** `expo-router` is pinned to `~56.x`
- **AND** `react-native-reanimated` is `~4.3.x` and `react-native-worklets` is present

#### Scenario: Experiments enabled
- **WHEN** an engineer reads `apps/digital-front-door/app.config.ts`
- **THEN** `experiments.typedRoutes` is `true`
- **AND** `experiments.reactCompiler` is `true`

#### Scenario: App config in TypeScript
- **WHEN** an engineer inspects the app configuration
- **THEN** the configuration lives in `app.config.ts` (not `app.json`)
- **AND** it imports `ExpoConfig` and `ConfigContext` from `expo/config`

### Requirement: App identity locked for PoC

The app SHALL declare `name: "Digitale voordeur"`, `slug: "digital-front-door"`, and `scheme: "digitale-voordeur"`. iOS `bundleIdentifier` and Android `package` SHALL be `com.reaktor.zas.digitalfrontdoor` as a pre-publish placeholder. `userInterfaceStyle` SHALL be `"light"`. Targets SHALL include iOS, Android, and web (dev convenience only).

#### Scenario: Display name is Dutch
- **WHEN** an engineer reads `app.config.ts`
- **THEN** `name` is `"Digitale voordeur"`

#### Scenario: Placeholder bundle identifier documented
- **WHEN** an engineer reads `apps/digital-front-door/AGENTS.md`
- **THEN** it states that `com.reaktor.zas.digitalfrontdoor` is a dev-only placeholder
- **AND** it states the final iOS bundle identifier and Android package name are picked at the MVP publish-prep change

### Requirement: Platforms enabled

The app SHALL build and run on iOS, Android, and web. Web SHALL be configured with the `metro` bundler in `app.config.ts`. Web is a dev convenience, not a shipping channel.

#### Scenario: All three platforms target
- **WHEN** the Expo dev server starts
- **THEN** iOS simulator, Android emulator, and web preview launchers are all available

### Requirement: NativeWind v4 is the only styling layer

All visual styling in product code SHALL be expressed as Tailwind utility classes on the `className` prop, processed by NativeWind v4. Product code SHALL NOT contain `StyleSheet.create` calls or inline `style={{ ... }}` objects. Animated values and measured-layout overrides are the only exceptions and SHALL be commented inline.

#### Scenario: NativeWind preset wired
- **WHEN** an engineer reads `babel.config.js`
- **THEN** `nativewind/babel` is present in `presets`

#### Scenario: NativeWind Metro integration wired
- **WHEN** an engineer reads `metro.config.js`
- **THEN** the config is wrapped by `withNativeWind(config, { input: './src/styles/global.css' })`

#### Scenario: jsxImportSource configured
- **WHEN** an engineer reads `tsconfig.json`
- **THEN** `compilerOptions.jsxImportSource` is `"nativewind"`

### Requirement: Component primitives via `@rn-primitives/*` wrapped in `src/components/ui/`

Compound components requiring state, focus management, or accessibility semantics SHALL be implemented as wrappers around `@rn-primitives/*` packages and live at `src/components/ui/<name>.tsx`. Wrappers SHALL use `class-variance-authority` (`cva`) for variants and a `cn()` helper at `src/lib/cn.ts` (`twMerge(clsx(...))`). React Native core primitives (`Pressable`, `TextInput`, `View`, `Text`, `ScrollView`, `FlatList`) SHALL be wrapped directly without `@rn-primitives`. Icons SHALL come from `lucide-react-native`.

#### Scenario: cn helper exists
- **WHEN** an engineer opens `src/lib/cn.ts`
- **THEN** it exports a `cn(...inputs: ClassValue[]): string` that calls `twMerge(clsx(inputs))`

#### Scenario: No raw style props in `src/`
- **WHEN** lint runs across `src/**/*.{ts,tsx}`
- **THEN** ESLint reports zero `StyleSheet.create` and zero inline `style={{ ... }}` occurrences (RN-overrides exempted via inline comment)

### Requirement: Routing via expo-router 6 with grouped (auth) / (app) shells

Routes SHALL live at `src/app/`. Top-level groups SHALL separate `(auth)` and `(app)` shells, each with its own `_layout.tsx`. The scaffold SHALL include placeholder routes `(auth)/login.tsx`, `(app)/index.tsx`, and `+not-found.tsx`. Typed routes SHALL be enabled (`experiments.typedRoutes: true`). The root `src/app/_layout.tsx` SHALL mount, in order: error boundary, `SafeAreaProvider`, `KeyboardProvider` (from `react-native-keyboard-controller`), `QueryClientProvider`, `Provider` from Jotai, and the i18n initialiser; it SHALL hide the splash screen via `expo-splash-screen` after i18n initialisation resolves.

#### Scenario: Route tree shape
- **WHEN** an engineer inspects `src/app/`
- **THEN** it contains `_layout.tsx`, `(auth)/_layout.tsx`, `(auth)/login.tsx`, `(app)/_layout.tsx`, `(app)/index.tsx`, and `+not-found.tsx`
- **AND** no other route files are present

#### Scenario: Root layout mounts providers
- **WHEN** an engineer reads `src/app/_layout.tsx`
- **THEN** the rendered tree wraps children in the documented provider order
- **AND** `SplashScreen.preventAutoHideAsync()` is called before the first render
- **AND** `SplashScreen.hideAsync()` is called after the i18n initialiser resolves

### Requirement: Data layer is TanStack Query v5 with per-module `queryOptions` factories

Server state SHALL be owned by `@tanstack/react-query` v5. A single `QueryClient` SHALL be constructed in `src/lib/queryClient.ts` and mounted via `QueryClientProvider` in `src/app/_layout.tsx`. Each module SHALL expose a `queries.ts` (and optional `mutations.ts`) defining a `queryOptions` factory; modules SHALL provide a per-domain hook in `hooks/use-<name>.ts`. Components and screens SHALL NOT call `useQuery` or `useMutation` directly — this rule SHALL be enforced by ESLint `no-restricted-syntax` against `src/app/**` and `src/components/ui/**`. The scaffold SHALL ship no module-specific queries; the convention SHALL be documented in `apps/digital-front-door/AGENTS.md`.

#### Scenario: QueryClient instantiated once
- **WHEN** an engineer searches the source tree for `new QueryClient`
- **THEN** the only occurrence is in `src/lib/queryClient.ts`

#### Scenario: ESLint rule blocks raw useQuery in app routes
- **WHEN** a hypothetical `useQuery({ ... })` call is added to a file under `src/app/**`
- **THEN** ESLint reports an error with a message directing the author to `src/modules/<x>/hooks/use-*.ts`

### Requirement: API base URL via `EXPO_PUBLIC_API_BASE_URL`

The fetch wrapper at `src/lib/api.ts` SHALL read its base URL from `process.env.EXPO_PUBLIC_API_BASE_URL`. The repository SHALL contain a committed `apps/digital-front-door/.env.example` with `EXPO_PUBLIC_API_BASE_URL=http://localhost:8000`. Developers copy `.env.example` to `.env` (NOT `.env.local`); `.env` SHALL be listed in the app's `.gitignore`.

#### Scenario: Example file committed
- **WHEN** an engineer inspects the repository
- **THEN** `apps/digital-front-door/.env.example` exists with `EXPO_PUBLIC_API_BASE_URL=http://localhost:8000`

#### Scenario: .env gitignored
- **WHEN** `git check-ignore apps/digital-front-door/.env` runs
- **THEN** exit status is 0 (file would be ignored)

### Requirement: Backend exposes `/mobile/*` route prefix and `GET /mobile/health`

The backend SHALL expose an `APIRouter` with `prefix="/mobile"` and a `GET /mobile/health` endpoint returning JSON `{"status": "ok"}` with HTTP 200. The router SHALL live at `apps/backend/app/api/routers/mobile/` and SHALL be registered in `apps/backend/app/api/__init__.py` alongside existing resource routers. The OpenAPI schema SHALL be regenerated to include this endpoint. The convention SHALL be that every future endpoint consumed by `digital-front-door` lives under `/mobile/*`.

#### Scenario: Health endpoint responds 200
- **WHEN** an HTTP client issues `GET /mobile/health` against the running backend
- **THEN** the response status is 200
- **AND** the response body is `{"status": "ok"}`

#### Scenario: Endpoint present in OpenAPI
- **WHEN** an engineer inspects `apps/backend/openapi.json`
- **THEN** `paths["/mobile/health"].get` exists with the `mobile` tag

### Requirement: i18n via `i18next` with `nl-BE` only

The app SHALL initialise `i18next` + `react-i18next` at `src/lib/i18n/index.ts` before the first UI render. The only configured locale SHALL be `nl-BE`. The fallback locale SHALL be `nl-BE`. Locale resources SHALL live at `src/lib/i18n/locales/<locale>/<namespace>.json`; the scaffold SHALL ship `src/lib/i18n/locales/nl-BE/common.json` with at least one key. No user-visible string SHALL be hardcoded in JSX or component props — every string SHALL flow through `t(...)`. Source keys SHALL be English; translated values SHALL be Dutch. Device locale detection SHALL be off.

#### Scenario: Single locale registered
- **WHEN** an engineer reads `src/lib/i18n/index.ts`
- **THEN** `nl-BE` is the only locale in `resources` and is both `lng` and `fallbackLng`

#### Scenario: ESLint enforces no literal strings
- **WHEN** lint runs across `src/**/*.{ts,tsx}`
- **THEN** `i18next/no-literal-string` is enabled at error severity

### Requirement: Session storage seam via `expo-secure-store` with web fallback

The repository SHALL contain `src/lib/secureStorage.ts` exporting `secureStorage` with async `get`, `set`, and `remove` methods. The native implementations SHALL use `expo-secure-store`. The web implementation SHALL fall back to `globalThis.localStorage`. No additional storage library (MMKV, AsyncStorage) SHALL be introduced in this change.

#### Scenario: Seam exists
- **WHEN** an engineer opens `src/lib/secureStorage.ts`
- **THEN** it exports `secureStorage` with `get`, `set`, and `remove` returning `Promise<string | null | void>`
- **AND** the implementation branches on `Platform.OS === 'web'`

### Requirement: Client state library installed: Jotai

`jotai` SHALL be installed at the version compatible with React 19.2. `src/providers/jotai.tsx` SHALL re-export the default `Provider`; the root `_layout.tsx` SHALL mount it. The scaffold SHALL define no atoms. The convention "atoms live per module at `src/modules/<x>/atoms.ts`; server data lives in TanStack Query, not atoms; sensitive auth tokens live in `secureStorage`, not atoms" SHALL be documented in `apps/digital-front-door/AGENTS.md`.

#### Scenario: Provider mounted
- **WHEN** an engineer reads `src/app/_layout.tsx`
- **THEN** the Jotai `Provider` wraps the rendered children

#### Scenario: No atoms in scaffold
- **WHEN** an engineer searches the source tree for `atomWith` or `^export const \w+Atom`
- **THEN** zero matches are found

### Requirement: TypeScript strict configuration

`tsconfig.json` `compilerOptions` SHALL include `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, and `verbatimModuleSyntax: true`. `exactOptionalPropertyTypes` SHALL be off. Path alias `"@/*": ["src/*"]` SHALL be configured. `jsxImportSource` SHALL be `"nativewind"`.

#### Scenario: Strict options present
- **WHEN** an engineer reads `apps/digital-front-door/tsconfig.json`
- **THEN** `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, and `verbatimModuleSyntax` are all `true`
- **AND** `exactOptionalPropertyTypes` is not present or is `false`

#### Scenario: Path alias resolves
- **WHEN** any file under `src/` imports `@/lib/cn`
- **THEN** the TypeScript compiler resolves the import to `src/lib/cn.ts` without error

### Requirement: Lint via ESLint flat config; format via Prettier with Tailwind class sorting

`apps/digital-front-door/eslint.config.js` SHALL extend `eslint-config-expo/flat` and SHALL enable the rule set documented in `apps/digital-front-door/AGENTS.md` (kebab-case filenames, no `any`, no non-null assertion, inline type imports, no `as` casts outside `__tests__/**`, no `console`, `i18next/no-literal-string`, no default export outside route + config files, no `forwardRef`, no TS enum, `simple-import-sort`, no raw `useQuery`/`useMutation` in `src/app/**` and `src/components/ui/**`, no relative cross-folder imports). `apps/digital-front-door/.prettierrc` SHALL configure no semicolons, single quotes, trailing comma `es5`, print width 80, 2-space indent, `arrowParens: 'always'`, and include `prettier-plugin-tailwindcss` for `className` sorting.

#### Scenario: ESLint config extends expo flat preset
- **WHEN** an engineer reads `eslint.config.js`
- **THEN** it imports and spreads `eslint-config-expo/flat`

#### Scenario: Prettier sorts Tailwind classes
- **WHEN** `prettier --check` runs on a TSX file whose `className` contains out-of-order Tailwind utilities
- **THEN** Prettier reports the file as not-formatted
- **AND** running `prettier --write` reorders the classes per `prettier-plugin-tailwindcss` rules

### Requirement: Tests via `jest-expo`; mirror tree under `__tests__/`

The app SHALL configure Jest via `jest-expo` preset. Tests SHALL mirror the source tree under `apps/digital-front-door/__tests__/`. The repository SHALL ship `__tests__/utils/render-with-providers.tsx` returning a `render(...)` call wrapped in a fresh `QueryClient` (`retry: false`, `gcTime: 0`) and a Jotai `Provider`. Default mocks SHALL be configured in `jest.setup.ts` for `expo-secure-store` (in-memory), `react-native-localize` (fixed `nl-BE`), and the network fetcher (module-level mock). Fixtures SHALL be exposed per domain as `__tests__/fixtures/<x>.ts` exporting `make<Entity>(overrides?: Partial<Entity>): Entity`. The scaffold SHALL ship at least one smoke test that mounts the root layout and asserts it renders without throwing.

#### Scenario: jest-expo preset wired
- **WHEN** an engineer reads `apps/digital-front-door/jest.config.js`
- **THEN** the preset is `jest-expo`

#### Scenario: Smoke test passes
- **WHEN** `moon run digital-front-door:test` runs against the scaffold
- **THEN** the suite includes at least one rendering smoke test
- **AND** the suite exits with status 0

### Requirement: Root providers + error boundary + keyboard controller + splash + status bar

`src/app/_layout.tsx` SHALL wrap the route tree, in this order from outer to inner: `<ErrorBoundary>` (from `react-error-boundary`), `<SafeAreaProvider>` (from `react-native-safe-area-context`), `<KeyboardProvider>` (from `react-native-keyboard-controller`), `<QueryClientProvider>`, `<Provider>` (Jotai), and the i18n initialiser. The error boundary SHALL log via `@/lib/logger` and render a minimal Dutch fallback. `expo-splash-screen` `preventAutoHideAsync()` SHALL be called before the first React render; `hideAsync()` SHALL be called after the i18n initialiser resolves.

#### Scenario: Provider nesting order
- **WHEN** an engineer reads `src/app/_layout.tsx`
- **THEN** the nesting order from outer to inner is exactly: ErrorBoundary → SafeAreaProvider → KeyboardProvider → QueryClientProvider → JotaiProvider → i18n initialiser

#### Scenario: Splash controlled
- **WHEN** the app boots
- **THEN** the splash screen remains visible until i18n is ready
- **AND** the splash is hidden via `SplashScreen.hideAsync()` after that

### Requirement: Logger and date helpers in `src/lib/`

`src/lib/logger.ts` SHALL export `log` with `info`, `warn`, and `error` methods. The scaffold implementation SHALL delegate to `console.*`. ESLint SHALL disallow direct `console.*` calls anywhere in `src/**` except inside `src/lib/logger.ts`. `date-fns` SHALL be installed and `src/lib/dateFormat.ts` SHALL expose a thin formatter helper preconfigured with the `nl` locale.

#### Scenario: Logger seam exists
- **WHEN** an engineer opens `src/lib/logger.ts`
- **THEN** it exports `log` with `info`, `warn`, `error` methods

#### Scenario: console banned outside logger
- **WHEN** lint runs across `src/**/*.{ts,tsx}` excluding `src/lib/logger.ts`
- **THEN** zero `console.*` calls are reported

### Requirement: Moon task wiring + workspace registration + CI dependencies

`.moon/workspace.yml` SHALL register `digital-front-door: "apps/digital-front-door"` under `projects`. `apps/digital-front-door/moon.yml` SHALL declare tasks `install`, `dev`, `build`, `lint`, `format`, `format-check`, `typecheck`, `test`, and `test-coverage`, delegating to `package.json` scripts. The root `moon.yml` `:ci` task SHALL gain `digital-front-door:test`, `digital-front-door:typecheck`, `digital-front-door:lint`, and `digital-front-door:format-check` as dependencies. The root `:install` task SHALL gain `digital-front-door:install`.

#### Scenario: Project registered
- **WHEN** an engineer runs `moon query projects`
- **THEN** `digital-front-door` appears in the project list

#### Scenario: CI graph includes mobile checks
- **WHEN** an engineer runs `moon run :ci --dependents`
- **THEN** the mobile lint, typecheck, format-check, and test tasks are in the dependency graph

### Requirement: `apps/digital-front-door/AGENTS.md` documents every locked convention

The repository SHALL contain `apps/digital-front-door/AGENTS.md` declaring stack (Expo SDK 56 / RN 0.83 / React 19.2 / Node 20.19 / pnpm / expo-router 6 / NativeWind v4 / TanStack Query v5 / Jotai / i18next / date-fns / Prettier / ESLint flat / jest-expo / `@rn-primitives/*` + `lucide-react-native`), layout rules (modules folder shape with barrel and `api.ts` / `queries.ts` / `mutations.ts` / `types.ts` / `utils.ts` / `atoms.ts` / `hooks/use-*.ts` / `components/`), naming conventions (kebab-case files, component-export naming table), TanStack pattern (one key factory per module, always-via-hook, cascade invalidation), Jotai pattern (per-module atoms, never server state, never auth tokens), test conventions (mirror tree, fixtures, render helper), and the Dutch-only i18n rule.

#### Scenario: Per-app AGENTS exists
- **WHEN** an engineer opens `apps/digital-front-door/AGENTS.md`
- **THEN** the file documents the stack, layout, naming, TanStack, Jotai, testing, and i18n conventions listed above

### Requirement: Root `AGENTS.md` consolidated; `CLAUDE.md` reduced to harness-specific notes

Root `AGENTS.md` SHALL contain all tool-agnostic conventions: pre-approved moon tasks per app (now including `digital-front-door:*`), worktree directory rule, feature-surface gating, behavioural reminders, the moon-as-canonical-task-runner rule, and the apps inventory. Root `CLAUDE.md` SHALL be reduced to a thin pointer to `AGENTS.md` plus the truly Claude-harness-specific notes (slash commands at `.claude/commands/`, enforcement hooks at `.claude/settings.json`, the OpenSpec / Superpowers / pencil / context7 skill notes). No per-app `CLAUDE.md` files SHALL exist; every app uses `AGENTS.md`.

#### Scenario: Tool-agnostic content moved
- **WHEN** an engineer searches root `CLAUDE.md` for "Pre-approved moon tasks"
- **THEN** the section is absent
- **AND** the same section is present in root `AGENTS.md`

#### Scenario: No per-app CLAUDE.md
- **WHEN** an engineer runs `find apps -maxdepth 2 -name CLAUDE.md`
- **THEN** zero results

### Requirement: PoC scope re-tier for patient surface

`openspec/scope.md` SHALL be updated to move the patient surface from `[mvp]` PoC Out-of-Scope to `[poc]` PoC In-Scope, adding the new feature `F9 Digital front door (shell)` with the one-line acceptance criterion "app installs, lints, typechecks, runs on iOS / Android / web; backend `/mobile/health` returns 200". `openspec/roadmap.md` SHALL be updated to reflect that the patient-surface shell is shipped in PoC and feature delivery + delivery-channel decisions remain MVP. `openspec/backlog.md` entries `BL-014`, `BL-022`, and `BL-030` SHALL be annotated with "Shell promoted to PoC via `digital-front-door-setup` on 2026-06-02; feature shape and delivery-channel decisions remain MVP-tier."

#### Scenario: Scope updated
- **WHEN** an engineer reads `openspec/scope.md`
- **THEN** `F9 Digital front door (shell)` appears in PoC In-Scope
- **AND** "Patient surface `[mvp]`" no longer appears in PoC Out-of-Scope

#### Scenario: Backlog annotated
- **WHEN** an engineer reads `openspec/backlog.md`
- **THEN** the `BL-014`, `BL-022`, and `BL-030` entries note the promotion to PoC via this change

### Requirement: Scaffold ships zero clinical logic; MDR boundary deferred

The scaffold delivered by this change SHALL NOT display measurements, vitals, decision support, clinical reasoning, or interpreted Luscii care-path content. The repository SHALL NOT add an entry to `openspec/mdr-watchlist.md` as a result of this change. Every future patient-facing feature change SHALL run the MDR check from its proposal and add a watchlist entry if any clinical interpretation, measurement display, or decision support is in scope.

#### Scenario: No clinical UI in scaffold
- **WHEN** an engineer inspects `src/app/` and `src/components/`
- **THEN** the only rendered screens are the placeholder `(auth)/login.tsx`, `(app)/index.tsx`, and `+not-found.tsx`
- **AND** no measurement, vitals, or decision-support component exists

#### Scenario: MDR watchlist untouched
- **WHEN** an engineer diffs `openspec/mdr-watchlist.md` against `main` after this change
- **THEN** no new entry is added by this change
