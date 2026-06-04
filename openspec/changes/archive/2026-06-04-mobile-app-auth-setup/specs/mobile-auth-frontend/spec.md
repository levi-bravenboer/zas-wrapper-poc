## ADDED Requirements

### Requirement: Auth module exists at `src/modules/auth` with the documented shape

`apps/digital-front-door/src/modules/auth/` SHALL exist and SHALL contain the files documented in `apps/digital-front-door/AGENTS.md` "Module shape" section:

- `index.ts` — barrel re-exporting `atoms`, `types`, `api`, `queries`, `mutations`, plus a top-level `resetAuth()` function
- `types.ts` — `PatientSession` re-export from the generated OpenAPI types and a local `LoginInput` type
- `api.ts` — pure fetch fns `login(input)` and `me()`; no TanStack imports
- `queries.ts` — `authQueries.me()` `queryOptions` factory; key namespace `['auth']`
- `mutations.ts` — `authMutations.login()` config; on `onSuccess` invalidates `authQueries.me()`
- `atoms.ts` — `currentSessionAtom` (hot cache, not the source of truth)
- `hooks/use-session.ts`, `hooks/use-login.ts`
- `components/login-form.tsx`

The module SHALL be the first concrete `src/modules/<x>/` in the app. Tests for the module SHALL live under `__tests__/modules/auth/` mirroring the source layout.

#### Scenario: Module file shape matches the AGENTS.md contract

- **WHEN** an engineer inspects `apps/digital-front-door/src/modules/auth/`
- **THEN** the listed files all exist with the documented exports

#### Scenario: Barrel re-exports work

- **WHEN** another module does `import { authQueries, authMutations, currentSessionAtom, resetAuth } from '@/modules/auth'`
- **THEN** TypeScript resolves all four imports without reaching into module internals

#### Scenario: No raw useQuery in app routes

- **WHEN** ESLint runs on `src/app/**`
- **THEN** no `useQuery(authQueries.me())` call appears outside `src/modules/auth/hooks/`
- **AND** `src/app/_layout.tsx` consumes the auth module through `useSession()`

### Requirement: `requestAuthed` helper centralises authed fetches with cookie credentials

`apps/digital-front-door/src/lib/api.ts` SHALL export a `requestAuthed<T>(path, init?)` function. The function SHALL prepend the base URL resolved from `EXPO_PUBLIC_API_BASE_URL`, set `credentials: 'include'` on every request, set `Accept: 'application/json'` unless overridden, and apply the existing `AbortSignal.timeout(DEFAULT_TIMEOUT_MS)` default. On HTTP `401` it SHALL throw an `UnauthenticatedError` (subclass of `ApiError`); on other non-2xx responses it SHALL throw `ApiError(status)`. All authed module fetches SHALL use `requestAuthed`. `apiHealthCheck()` SHALL remain on the existing unauthenticated `fetch` path.

#### Scenario: Cookie credentials are included on every authed request

- **WHEN** `requestAuthed('/mobile/auth/me')` is called
- **THEN** the underlying `fetch` is called with `credentials: 'include'`

#### Scenario: 401 surfaces a typed exception

- **WHEN** the backend responds `401` to a `requestAuthed` call
- **THEN** the call rejects with `UnauthenticatedError`
- **AND** `UnauthenticatedError instanceof ApiError` is `true`

### Requirement: Mobile login form

`apps/digital-front-door/src/modules/auth/components/login-form.tsx` SHALL render a `<View>` containing an email `<TextInput>`, a password `<TextInput>` with `secureTextEntry`, a submit `<Pressable>`, and a `<Text>` region for error messages. All labels and messages SHALL be sourced from the `auth` i18n namespace at `src/lib/i18n/locales/nl-BE/auth.json`. The form SHALL be styled with NativeWind utility classes only; no `StyleSheet` and no inline `style` objects.

On submit the form SHALL call `useLogin().mutate({ tenant, email, password })` where `tenant` is read from `expoConfig.extra.tenantSlug` (sourced from `EXPO_PUBLIC_TENANT_SLUG`). While the mutation is pending the submit button SHALL show the `Bezig met aanmelden…` label and be disabled. On `UnauthenticatedError` (mapped from backend 401) the error region SHALL render `Ongeldige inloggegevens` via `<Text role="alert">`. On other errors it SHALL render `Verbindingsfout, probeer opnieuw`. On 400 with body `{ detail: "Unknown tenant" }` it SHALL render `Tenant niet bekend`.

#### Scenario: Form renders all labels from the auth i18n namespace

- **WHEN** the form mounts under `<I18nextProvider lng="nl-BE">`
- **THEN** the rendered tree contains exactly the Dutch labels `Email`, `Wachtwoord`, and `Aanmelden`
- **AND** no English literal strings appear in the rendered output

#### Scenario: Invalid credentials show the localised error

- **WHEN** the user submits invalid credentials and the backend responds `401`
- **THEN** a `<Text role="alert">` element is rendered with the text `Ongeldige inloggegevens`

#### Scenario: Form uses NativeWind classes only

- **WHEN** a search of `login-form.tsx` for `StyleSheet` or `style={{` returns
- **THEN** zero matches are found

### Requirement: Gated routing in the root layout

`apps/digital-front-door/src/app/_layout.tsx` SHALL render a routing-gate component that consumes `useSession()`. While the underlying `authQueries.me()` query is in its initial-loading state the gate SHALL hold the splash screen via `SplashScreen` (re-using the existing `digital-front-door-setup` splash machinery). On success (200 response, valid `PatientSession`) the gate SHALL call `router.replace('/(app)')`. On `UnauthenticatedError` (401) the gate SHALL call `router.replace('/(auth)/login')`. On other errors the gate SHALL render the existing error fallback.

On a successful login mutation the gate SHALL not be invoked directly; instead `authMutations.login()` SHALL invalidate `authQueries.me()`, the query SHALL refetch, and the gate SHALL re-route based on the new result.

#### Scenario: Boot with no session lands on the login screen

- **WHEN** the app boots and `GET /mobile/auth/me` responds `401`
- **THEN** the splash is hidden after the response arrives
- **AND** the active route is `/(auth)/login`

#### Scenario: Boot with a valid cookie lands on the home placeholder

- **WHEN** the app boots and `GET /mobile/auth/me` responds `200` with a `PatientSession`
- **THEN** the active route is `/(app)`
- **AND** the rendered tree contains the text `Welkom, <given_name>` sourced from `t('app.home.welcome', { name: session.given_name })`

#### Scenario: Successful login transitions from (auth) to (app)

- **WHEN** the login form submits successfully and `authQueries.me()` is invalidated
- **THEN** the active route is `/(app)` after the next render

### Requirement: Mobile build carries the tenant slug

`apps/digital-front-door/app.config.ts` SHALL read `EXPO_PUBLIC_TENANT_SLUG` from `process.env` and expose it under `expoConfig.extra.tenantSlug`. The committed `apps/digital-front-door/.env.example` SHALL include the line `EXPO_PUBLIC_TENANT_SLUG=zas`. The slug SHALL NOT be hardcoded in any other source file; consumers SHALL read it via `Constants.expoConfig?.extra?.tenantSlug`.

#### Scenario: Example env file includes the tenant slug

- **WHEN** `apps/digital-front-door/.env.example` is read
- **THEN** it includes `EXPO_PUBLIC_TENANT_SLUG=zas` on its own line

#### Scenario: App config surfaces the tenant slug under extra

- **WHEN** the Expo runtime evaluates `app.config.ts` with `EXPO_PUBLIC_TENANT_SLUG=zas` set
- **THEN** `Constants.expoConfig.extra.tenantSlug` resolves to `"zas"`

### Requirement: Reset convention has a concrete implementation

`apps/digital-front-door/src/modules/auth/index.ts` SHALL export a `resetAuth()` function that, when invoked: (1) calls `POST /auth/logout` via `requestAuthed` so the cookie is cleared server-side, (2) clears `currentSessionAtom`, (3) invalidates `authQueries.me()` in the shared `QueryClient`. The function SHALL be the first concrete implementation of the per-module `reset<Domain>()` convention documented in `apps/digital-front-door/AGENTS.md`. Future module changes adding persistent state SHALL register their own `reset<Domain>()` and the future logout UI SHALL call all registered resets.

#### Scenario: resetAuth clears the query cache and the atom

- **WHEN** `resetAuth()` is called from a hook with a populated `currentSessionAtom` and a cached `authQueries.me()` entry
- **THEN** `currentSessionAtom` is `null` after the call
- **AND** `queryClient.getQueryData(authQueries.me().queryKey)` is `undefined` after the call
- **AND** a `POST /auth/logout` request was issued

### Requirement: Biometric unlock is forced ON when the device supports it

After a successful email+password login on a device where `LocalAuthentication.hasHardwareAsync()` and `LocalAuthentication.isEnrolledAsync()` both return `true`, the app SHALL write `biometricEnabledAtom = true` and persist `biometricEnabled = "true"` to `secureStorage`. The user SHALL NOT be prompted to opt in; biometric protection is automatic on supported devices. On devices where biometric is unsupported or unenrolled at login time, the flag SHALL remain `false` and the long-session cookie SHALL NOT be issued — those sessions inherit the existing caregiver-default short cookie lifetime.

#### Scenario: First login on a biometric-capable device enables the gate automatically

- **WHEN** a successful login completes on a device where `hasHardwareAsync()` and `isEnrolledAsync()` return `true`
- **THEN** `secureStorage.get('biometricEnabled')` returns `"true"` after the login mutation resolves
- **AND** no opt-in dialog is shown to the user

#### Scenario: Login on a no-biometric device does not enable the gate

- **WHEN** a successful login completes on a device where `hasHardwareAsync()` returns `false`
- **THEN** `secureStorage.get('biometricEnabled')` returns `null`
- **AND** the issued cookie carries the caregiver-default `Max-Age` (not the 30-day mobile lifetime)

### Requirement: Long session lifetime for biometric-protected mobile logins

When `POST /mobile/auth/login/password` succeeds AND the request body carries a `biometric_supported: true` field, the backend SHALL issue the session cookie with `Max-Age = 30 days`. When the field is `false` or absent, the cookie SHALL use the caregiver-default `Max-Age`. The mobile app SHALL send `biometric_supported = await LocalAuthentication.hasHardwareAsync() && await LocalAuthentication.isEnrolledAsync()` in the login request body.

#### Scenario: Biometric-capable login gets 30-day cookie

- **WHEN** `POST /mobile/auth/login/password` arrives with `biometric_supported: true` and valid credentials
- **THEN** the response `Set-Cookie` header sets `Max-Age=2592000` (30 days)

#### Scenario: No-biometric login gets caregiver-default cookie

- **WHEN** `POST /mobile/auth/login/password` arrives with `biometric_supported: false` and valid credentials
- **THEN** the response `Set-Cookie` header sets the caregiver-default `Max-Age` (unchanged from existing caregiver login behaviour)

### Requirement: Cold-start biometric gate

When the app boots and `authQueries.me()` resolves `200`, the routing gate SHALL inspect `secureStorage.get('biometricEnabled')`. If the stored value is `"true"`, the gate SHALL call `LocalAuthentication.authenticateAsync({ promptMessage: t('auth.biometric.prompt') })` over the still-visible splash. On success the gate SHALL hide the splash and `router.replace('/(app)')`. On cancel or fail the gate SHALL hide the splash and route to a locked screen offering "Probeer opnieuw" and "Gebruik wachtwoord" CTAs.

#### Scenario: Cold start with biometric enabled fires the OS prompt

- **WHEN** the app cold-starts with a valid cookie and `biometricEnabled = "true"`
- **THEN** `LocalAuthentication.authenticateAsync` is called exactly once during the boot sequence
- **AND** the splash screen remains visible until `authenticateAsync` resolves

#### Scenario: Biometric cancel routes to the locked screen with password fallback

- **WHEN** the user cancels the biometric prompt during cold start
- **THEN** a locked screen renders with a "Probeer opnieuw" button that re-fires `authenticateAsync` and a "Gebruik wachtwoord" button that calls `resetAuth()` and routes to `/(auth)/login`

### Requirement: Biometric removed from device forces fresh login

When `secureStorage.get('biometricEnabled')` returns `"true"` and `LocalAuthentication.hasHardwareAsync()` or `LocalAuthentication.isEnrolledAsync()` now returns `false`, the routing gate SHALL call `resetAuth()` (clearing the cookie server-side via `POST /auth/logout` and clearing the local flag) and route to `/(auth)/login` without offering the locked-screen fallback.

#### Scenario: Biometric removal triggers fresh login

- **WHEN** the app cold-starts with `biometricEnabled = "true"` but `hasHardwareAsync()` now returns `false`
- **THEN** `POST /auth/logout` is called
- **AND** `secureStorage.get('biometricEnabled')` returns `null` after the gate resolves
- **AND** the active route is `/(auth)/login`

### Requirement: Background re-prompt after 30 seconds

The app SHALL track the timestamp when it enters background (`AppState.addEventListener('change', ...)`) and the timestamp when it returns to foreground. If `biometricEnabled = "true"` AND `(foreground_timestamp - background_timestamp) >= 30_000` ms, the app SHALL fire `LocalAuthentication.authenticateAsync` before the current route becomes interactive. Shorter background durations or `biometricEnabled = "false"` MUST NOT trigger a re-prompt.

#### Scenario: Background > 30s re-prompts

- **WHEN** the app moves to background and returns to foreground after 31 seconds with `biometricEnabled = "true"`
- **THEN** `authenticateAsync` is called once on return

#### Scenario: Background < 30s does not re-prompt

- **WHEN** the app moves to background and returns to foreground after 5 seconds
- **THEN** `authenticateAsync` is NOT called on return

### Requirement: iOS Keychain password autofill hints

`apps/digital-front-door/src/modules/auth/components/login-form.tsx` SHALL set `textContentType="username"` on the email `<TextInput>`, `textContentType="password"` on the password `<TextInput>`, `autoComplete="email"` on the email input, and `autoComplete="password"` on the password input. These hints SHALL enable iOS Keychain "Save password?" prompts and Android Autofill suggestions.

#### Scenario: Email input declares username textContentType

- **WHEN** the form is rendered
- **THEN** the email `<TextInput>` has `textContentType="username"` and `autoComplete="email"`

#### Scenario: Password input declares password textContentType

- **WHEN** the form is rendered
- **THEN** the password `<TextInput>` has `textContentType="password"` and `autoComplete="password"`

### Requirement: resetAuth clears biometric flag

`resetAuth()` SHALL additionally clear `secureStorage.set('biometricEnabled', null)` and `biometricEnabledAtom = false` in addition to the existing cookie + query-cache clearing. Subsequent logins re-establish the biometric flag per the "forced ON when device supports it" rule.

#### Scenario: resetAuth clears biometric flag in addition to session state

- **WHEN** `resetAuth()` is called on a device with `biometricEnabled = "true"`
- **THEN** `secureStorage.get('biometricEnabled')` returns `null` afterwards
- **AND** `biometricEnabledAtom` value is `false` afterwards
