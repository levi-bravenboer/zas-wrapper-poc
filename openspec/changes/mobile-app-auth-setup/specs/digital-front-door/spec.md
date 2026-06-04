## ADDED Requirements

### Requirement: Root layout gates routing on session presence

`apps/digital-front-door/src/app/_layout.tsx` SHALL consume `useSession()` from `@/modules/auth` and gate the active route on the session query result. The splash screen SHALL remain visible while the `authQueries.me()` query is in its initial-loading state. On `200` the layout SHALL `router.replace('/(app)')`; on a 401 outcome (surfaced as `UnauthenticatedError`) it SHALL `router.replace('/(auth)/login')`. The layout SHALL no longer route blindly to a placeholder home.

#### Scenario: Unauthenticated boot routes to /(auth)/login

- **WHEN** the app boots and the initial `GET /mobile/auth/me` resolves with HTTP 401
- **THEN** the splash is hidden after the response
- **AND** the active route is `/(auth)/login`

#### Scenario: Authenticated boot routes to /(app)

- **WHEN** the app boots and the initial `GET /mobile/auth/me` resolves with HTTP 200
- **THEN** the active route is `/(app)`

### Requirement: Authed transport is `credentials: 'include'`, not `Authorization: Bearer`

`apps/digital-front-door/src/lib/api.ts` SHALL provide a `requestAuthed<T>(path, init?)` helper that sets `credentials: 'include'` on every authed request. The helper SHALL NOT attach an `Authorization` header. All authed module fetches in `src/modules/<x>/api.ts` SHALL use `requestAuthed`. `apiHealthCheck()` SHALL remain unauthenticated (no credentials, no helper).

#### Scenario: requestAuthed always sets credentials include

- **WHEN** `requestAuthed('/any/path')` is called
- **THEN** the underlying `fetch` is called with `credentials: 'include'`

#### Scenario: No Authorization header is attached

- **WHEN** the headers of any `requestAuthed` call are inspected
- **THEN** no `Authorization` key is present

### Requirement: `EXPO_PUBLIC_TENANT_SLUG` is part of the scaffold env

`apps/digital-front-door/.env.example` SHALL include `EXPO_PUBLIC_TENANT_SLUG=zas`. `app.config.ts` SHALL surface the value as `extra.tenantSlug`. The mobile auth module SHALL read it via `Constants.expoConfig?.extra?.tenantSlug` and include it in the login request body. The slug SHALL NOT be hardcoded anywhere else in the source tree.

#### Scenario: .env.example carries both env vars

- **WHEN** `apps/digital-front-door/.env.example` is read
- **THEN** the file includes both `EXPO_PUBLIC_API_BASE_URL=http://localhost:8000` and `EXPO_PUBLIC_TENANT_SLUG=zas`

#### Scenario: app.config.ts exposes the slug under extra

- **WHEN** the Expo runtime evaluates `app.config.ts` with `EXPO_PUBLIC_TENANT_SLUG=zas` set
- **THEN** `Constants.expoConfig.extra.tenantSlug` resolves to `"zas"`

### Requirement: i18n configuration includes the `auth` namespace

`apps/digital-front-door/src/lib/i18n/index.ts` SHALL register the `auth` namespace alongside `common`. The new file `apps/digital-front-door/src/lib/i18n/locales/nl-BE/auth.json` SHALL be loaded at i18n init. The login form copy SHALL be sourced from this namespace exclusively.

#### Scenario: i18n init includes the auth namespace

- **WHEN** `initI18n()` resolves
- **THEN** `i18n.options.ns` includes both `'common'` and `'auth'`
- **AND** `i18n.hasResourceBundle('nl-BE', 'auth')` is `true`
