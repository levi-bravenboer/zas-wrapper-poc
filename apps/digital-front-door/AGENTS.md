# AGENTS.md — digital-front-door

Patient-facing mobile app (iOS / Android / web-dev). Monorepo conventions: root `AGENTS.md`. Onboarding: `README.md`.

## Stack

| Layer           | Choice                                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework       | **Expo SDK 56** (RN 0.85, React 19.2.3, expo-router ~56)                                                                                                                             |
| Animations      | `react-native-reanimated` 4.3 + `react-native-worklets` (bundled; **`babel-preset-expo` auto-configures the plugins** — do not add `react-native-reanimated/plugin` manually)        |
| Styling         | **NativeWind v4** + Tailwind v3. No `StyleSheet`, no inline `style={{ ... }}` in product code                                                                                        |
| Primitives      | **`@rn-primitives/*`** wrapped in `src/components/ui/<name>.tsx`. RN core (`Pressable`, `TextInput`, `View`, `Text`, `ScrollView`) wrapped directly. Icons via `lucide-react-native` |
| Variants        | `class-variance-authority` (`cva`) + `cn()` helper at `src/lib/cn.ts`                                                                                                                |
| Data            | **TanStack Query v5** — one `queryOptions` factory per module                                                                                                                        |
| Client state    | **Jotai** — atoms per module                                                                                                                                                         |
| Storage         | **`expo-secure-store`** for tokens (web → `localStorage` fallback)                                                                                                                   |
| i18n            | **`i18next` + `react-i18next`** — **`nl-BE` only** at scaffold                                                                                                                       |
| Dates           | `date-fns` (`nl` locale)                                                                                                                                                             |
| Tests           | `jest-expo` + `@testing-library/react-native` + `expo-router/testing-library`                                                                                                        |
| Lint / format   | ESLint flat config (`eslint-config-expo/flat` base) + Prettier (`prettier-plugin-tailwindcss`)                                                                                       |
| Bundle identity | `com.reaktor.zas.digitalfrontdoor` (dev placeholder), scheme `digitale-voordeur`, name `Digitale voordeur`                                                                           |
| Node            | `>= 22.13.0` (SDK 56 minimum)                                                                                                                                                        |
| iOS target      | `16.4+` · Android `7+`                                                                                                                                                               |

### Identity placeholder — do not ship under

`com.reaktor.zas.digitalfrontdoor` is a **pre-publish dev placeholder**. The final iOS bundle identifier and Android package name are picked at the MVP publish-prep change. Do not submit to the App Store / Play Store under this ID; re-signing + new listings are destructive operations.

## Layout

Feature-based architecture. `src/app/` is routing-only. `src/modules/<x>/` owns each vertical feature. `src/components/ui/` is the design system. `src/lib/` is cross-cutting infra.

```
app.config.ts                 # Expo TS app config (NOT app.json)
babel.config.js               # babel-preset-expo + nativewind/babel
metro.config.js               # withNativeWind(getDefaultConfig(__dirname), ...)
tailwind.config.js
.env.example                  # commit · devs copy to `.env` (gitignored)
.npmrc                        # node-linker=hoisted
eslint.config.js              # flat config
.prettierrc / .prettierignore
jest.config.js / jest.setup.ts
tsconfig.json                 # strict, @/* → src/*, jsxImportSource: nativewind
moon.yml                      # install/dev/build/lint/format/typecheck/test
package.json
pnpm-lock.yaml

src/
  app/                        # expo-router file-based routes ONLY
    _layout.tsx               # root: providers + splash + i18n + health check
    (auth)/_layout.tsx        # unauth stack
    (auth)/login.tsx          # placeholder
    (app)/_layout.tsx         # authenticated stack/tabs
    (app)/index.tsx           # home placeholder
    +not-found.tsx
  components/
    ui/                       # @rn-primitives wrappers + RN core wrappers (button.tsx, card.tsx, …)
  modules/                    # per-feature verticals (see "Module shape" below)
  providers/                  # cross-cutting providers (jotai.tsx, …)
  hooks/                      # cross-cutting hooks
  lib/
    cn.ts                     # twMerge(clsx(...))
    api.ts                    # fetch wrapper, apiHealthCheck()
    queryClient.ts            # single QueryClient
    logger.ts                 # the ONLY file allowed to call console.*
    secureStorage.ts          # expo-secure-store + web localStorage fallback
    dateFormat.ts             # date-fns formatter with nl locale
    i18n/
      index.ts                # i18next init; export initI18n()
      locales/nl-BE/common.json
  styles/global.css           # @tailwind base / components / utilities

assets/                       # icons, splash, tab icons (Expo template defaults until branding)

__tests__/                    # mirror tree
  app/
  modules/<x>/
  components/ui/
  lib/
  fixtures/                   # makeFoo(overrides?: Partial<Foo>): Foo
  utils/
    render-with-providers.tsx
```

### Module shape

Every `src/modules/<x>/` exposes a barrel `index.ts` re-exporting `atoms`, `types`, `api`, `queries`, `mutations` (omit whichever is absent).

```
src/modules/<x>/
  index.ts                   # barrel; export * from './atoms', './types', './api', ...
  api.ts                     # pure fetch fns; no TanStack imports here
  queries.ts                 # queryOptions factory + key namespace
  mutations.ts               # mutation configs (optional)
  types.ts                   # domain types
  utils.ts                   # pure helpers
  atoms.ts                   # Jotai atoms (only when needed)
  hooks/
    use-foo.ts               # wraps useQuery(fooQueries.detail(id))
    use-update-foo.ts        # wraps useMutation(fooMutations.update())
  components/
    <kebab>.tsx              # composed components private to this module
```

### Layout rules

- **`src/app/` is routing-only.** Thin layouts + screens composing module components/hooks. No business logic in route files. (`src/app/**` is the only place default exports are allowed in product code.)
- **`src/components/ui/` is domain-free.** No API calls, no module imports, no module-specific i18n keys.
- **`src/lib/` is feature-free.** No domain types, no module imports.
- **`src/modules/<x>/` is the only place vertical features live.** Cross-module reads MUST go through the module barrel (`@/modules/auth`), never internals (`@/modules/auth/atoms`).
- **Cross-folder imports use `@/...`. Same-folder imports use `./`.** ESLint enforces this.

## Naming

All filenames **kebab-case**. Exports follow their kind.

| Item                 | Filename                                         | Export                                                 |
| -------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| Component            | `kebab-case.tsx` (`button.tsx`, `side-menu.tsx`) | `PascalCase` via `export default function Button() {}` |
| Hook                 | `kebab-case.ts(x)` (`use-foo.ts`)                | `useCamelCase`                                         |
| Lib / module utility | `kebab-case.ts` (`api-base.ts`)                  | `camelCase` fns + `PascalCase` types                   |
| Test                 | source name + `.test.ts(x)`                      | —                                                      |
| Native split         | `*.native.ts(x)`                                 | —                                                      |
| Route file           | `kebab-case.tsx` (`+not-found.tsx`, `login.tsx`) | route default export                                   |
| Route group          | `(lowercase)/` (`(auth)/`, `(app)/`)             | —                                                      |
| Dynamic route        | `[param].tsx`                                    | —                                                      |
| Folder               | lowercase + kebab if multi-word                  | —                                                      |
| Type / interface     | —                                                | `PascalCase` (`UserAuthInformation`, `ButtonProps`)    |
| Constant             | —                                                | `SCREAMING_SNAKE_CASE`                                 |

Enforced via `check-file/filename-naming-convention` (warn during scaffold; flipped to error after green build).

## Data layer — TanStack Query

One `queryOptions` factory per module. Always wrap in a `use-*.ts` hook. **Never call `useQuery` / `useMutation` directly in `src/app/**`or`src/components/ui/**`** — ESLint `no-restricted-syntax` blocks it.

```ts
// src/modules/<x>/queries.ts
import { queryOptions } from '@tanstack/react-query'
import { getFoo, listFoos } from './api'

export const fooQueries = {
  all: () => ['foo'] as const,
  detail: (id: string) =>
    queryOptions({
      queryKey: [...fooQueries.all(), 'detail', id],
      queryFn: () => getFoo(id),
    }),
  list: () =>
    queryOptions({
      queryKey: [...fooQueries.all(), 'list'],
      queryFn: () => listFoos(),
    }),
}

// src/modules/<x>/hooks/use-foo.ts
import { useQuery } from '@tanstack/react-query'
import { fooQueries } from '../queries'

export const useFoo = (id: string) => useQuery(fooQueries.detail(id))
```

| Do                                        | Don't                                   |
| ----------------------------------------- | --------------------------------------- |
| One key factory per module (`fooQueries`) | Inline `queryKey: ['foo', id]`          |
| Wrap as `use-foo.ts` hook                 | Call `useQuery` in components           |
| Cascade invalidate via `fooQueries.all()` | Hand-build invalidation keys            |
| Pure fetch fns in `api.ts`                | Mix HTTP + TanStack config              |
| `enabled: !!auth` for conditional auth    | Throw inside `queryFn` for missing auth |

## Client state — Jotai

Server state lives in TanStack Query. UI / session-mirror state lives in Jotai atoms.

| Need                                         | Mechanism                                                                              |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| Ephemeral UI state (modal open, drawer flag) | plain `atom()`                                                                         |
| Mirror of session token / who-am-I           | atom backed by `secureStorage`                                                         |
| Sensitive (auth tokens, encryption keys)     | `expo-secure-store` directly via `src/lib/secureStorage.ts`. **Never in plain atoms.** |
| Server data (user, pathway, tasks)           | **TanStack Query**, not atoms                                                          |

**Naming.**

- Atom: `xxxAtom` suffix (`userAuthAtom`).
- Derived booleans: descriptive (`isAuthenticatedAtom`).
- Atom factory: `atomWith*` (`atomWithSecureStorage`).

**Access patterns.**

- React component → `useAtom` / `useAtomValue` / `useSetAtom`.
- Outside React (services, `mutationFn`) → `getDefaultStore().get/set(atom)` only when arg-passing is infeasible.

**Logout reset.** Each module that owns persistent / auth-derived state exposes a top-level `resetXxx()` in its barrel. The future auth-module logout flow calls every registered reset before clearing tokens.

## i18n

`i18next` + `react-i18next`. Initialised at `src/lib/i18n/index.ts` and awaited by the root layout before splash hide.

- **Locales shipped:** `nl-BE` only.
- **Default + fallback:** `nl-BE`.
- **Source keys are English; values are Dutch.** Example: `t('auth.login.title')` → `"Aanmelden"`.
- **Every user-visible string flows through `t(...)`.** No raw Dutch literals in JSX or component props. Enforced by `i18next/no-literal-string` ESLint rule.
- **Resources** at `src/lib/i18n/locales/<locale>/<namespace>.json`. Scaffold ships `nl-BE/common.json`.
- **Language detection is off.** Device locale is ignored at scaffold.

## Testing

`jest-expo` preset + `@testing-library/react-native`. Tests mirror source tree under `__tests__/`.

| Layer                        | Test?    | How                                   |
| ---------------------------- | -------- | ------------------------------------- |
| `modules/<x>/api.ts`         | ✅       | Mock fetch, assert URL/headers/body   |
| `modules/<x>/queries.ts`     | ❌       | Config only — covered via hook tests  |
| `modules/<x>/hooks/use-*.ts` | ✅       | `renderHook` + mock api               |
| `modules/<x>/atoms.ts`       | ✅       | Direct atom interaction               |
| `modules/<x>/utils.ts`       | ✅       | Pure unit tests                       |
| `modules/<x>/components/*`   | Optional | Only if non-trivial logic             |
| `components/ui/*.tsx`        | ✅       | Render + interaction                  |
| `src/app/**/*.tsx` screens   | ✅       | Integration with providers + mock api |
| `src/lib/*.ts`               | ✅       | Unit                                  |

**Fixtures.** Per domain `__tests__/fixtures/<x>.ts` exposes `make<Entity>(overrides?: Partial<Entity>): Entity`. No inline literal mocks in test bodies.

**Render helper.** `__tests__/utils/render-with-providers.tsx` wraps the rendered tree in a fresh `QueryClient` (`retry: false`, `gcTime: 0`) and Jotai `Provider`. Reach for it any time you need to mount a component using server state.

**Default mocks** in `jest.setup.ts`:

| Layer                   | Default                                        |
| ----------------------- | ---------------------------------------------- |
| `expo-secure-store`     | In-memory mock                                 |
| `react-native-localize` | Fixed `nl-BE`                                  |
| `src/lib/api.ts`        | Module-level mock — never hit the real network |

## Backend contract — `/mobile/*`

Every backend endpoint consumed by this app lives under the **`/mobile/`** prefix. Single CORS rule + auth middleware + MDR boundary apply there. The scaffold ships exactly one endpoint: `GET /mobile/health` → `{"status": "ok"}`. Future patient features add to the prefix in their own changes; new routers live at `apps/backend/app/api/routers/mobile/`.

## MDR boundary

This scaffold ships zero clinical UI. The outer envelope of what `digital-front-door` may render is **deferred** to each future feature change. Each subsequent change MUST:

1. State what data its UI displays.
2. Re-run the MDR check from its proposal.
3. Add an entry to `openspec/mdr-watchlist.md` if any clinical interpretation, measurement display, or decision support is in scope.

Never display measurements, vitals, decision support, or interpreted Luscii care-path content without an MDR review landed in the same PR.

## Commands

All via moon (canonical task runner — see root `AGENTS.md`):

```sh
moon run digital-front-door:install
moon run digital-front-door:dev              # expo start
moon run digital-front-door:build            # expo export --platform web
moon run digital-front-door:lint
moon run digital-front-door:format
moon run digital-front-door:format-check
moon run digital-front-door:typecheck
moon run digital-front-door:test
moon run digital-front-door:test-coverage
```

iOS / Android device runs: `npx expo run:ios` / `npx expo run:android` from inside `apps/digital-front-door/`. No moon task for these — they're rare local-only operations.

## Pre-commit

`moon run digital-front-door:lint` zero errors · `moon run digital-front-door:typecheck` zero errors · `moon run digital-front-door:test` green · `moon run digital-front-door:format-check` clean · i18n keys present. Semantic commit, lowercase after colon, ≤72 chars, present tense, **no AI attribution**.
