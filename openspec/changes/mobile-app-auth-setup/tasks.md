## 1. Scope ledger updates (do first — governs everything downstream)

- [x] 1.1 Update `openspec/scope.md`: drop the "no patient consumes it in the demo" framing on the Patient-features-and-delivery-channel row; add `F10 Patient login` to PoC In-Scope with the acceptance "seeded patient logs in on the mobile app and lands on the `(app)` home with a Dutch greeting; backend `POST /mobile/auth/login/password` issues `BACKEND_SESSION`; orchestrator patient-user admin UI is NOT part of this PoC slice"; refresh the F5 and F9 rows in the PoC → MVP Delta accordingly.
- [x] 1.2 Update `openspec/roadmap.md` so the patient-surface MVP item reads "login shipped in PoC via `mobile-app-auth-setup`; concrete patient features, federated identity, and orchestrator patient-user admin UI remain MVP work."
- [x] 1.3 Update `openspec/backlog.md` `BL-022`: append "Login promoted to PoC via `mobile-app-auth-setup` on 2026-06-02; consent + Luscii download activation remains MVP-tier."

## 2. Backend — shared auth services

- [x] 2.1 Create `apps/backend/app/auth/login_service.py` with `authenticate_password(*, email, password, tenant_id, role_filter, db) -> User`. Single `InvalidCredentials` exception for every failure mode. Constant-time dummy password verification on user-not-found and role-mismatch paths.
- [x] 2.2 Create `apps/backend/app/auth/tenant_resolver.py` with `resolve_tenant_slug(slug, db) -> UUID` raising `UnknownTenant` on miss. Slug match is case-sensitive.
- [x] 2.3 Verified: `tenants.slug` already exists on main (`varchar(63) NOT NULL UNIQUE` with regex CHECK). Seeded value is `zas` via `ZAS_TENANT_SLUG` in `scripts/seed_tenant.py`. No migration needed.
- [x] 2.4 Refactor the caregiver `POST /auth/login/password` router to call `authenticate_password()` with `role_filter = lambda r: r != Role.PATIENT`. Existing scenarios stay green; no wire-level change.
- [x] 2.5 Add `surface: Literal['mobile','caregiver','admin']` field to the structured login audit-log helper. Caregiver routes pass `surface='caregiver'`; mobile routes pass `surface='mobile'`. Single shared logger.
- [x] 2.6 Tighten the existing `GET /auth/me` to filter `role <> 'patient'`; return `401` if the cookie's user is a patient.

## 3. Backend — identity migration

- [x] 3.1 Generate an alembic revision `add_patient_role_and_patient_id_to_users` via `moon run backend:make-migration "add patient role and patient id to users"`.
- [x] 3.2 In the revision:
  - `op.execute("ALTER TYPE role ADD VALUE IF NOT EXISTS 'patient'")` (Postgres enum extension).
  - `op.add_column('users', sa.Column('patient_id', sa.Uuid(), nullable=True))`.
  - `op.create_foreign_key('users_patient_id_fkey', 'users', 'patients', ['patient_id'], ['id'], ondelete='RESTRICT')`.
  - `op.create_index('users_patient_id_unique', 'users', ['patient_id'], unique=True, postgresql_where=sa.text('patient_id IS NOT NULL'))`.
  - `op.create_check_constraint('users_role_patient_link', 'users', "(role = 'patient' AND patient_id IS NOT NULL) OR (role <> 'patient' AND patient_id IS NULL)")`.
  - Drop the existing `(tenant_id, lower(email))` unique index; create a new partial unique index on `(tenant_id, lower(email), role)`.
- [x] 3.3 Update the `User` ORM model (`apps/backend/app/db/models/user/user.py`) to add `patient_id` UUID column with `Mapped[Optional[UUID]]` and the `Patient` relationship. Update the `Role` enum (`apps/backend/app/core/enums/user.py`) to include `PATIENT`.
- [x] 3.4 Update the Pydantic `User` schema (`apps/backend/app/schemas/user/user.py`) to include `patient_id: UUID | None = None`.

## 4. Backend — mobile auth routes

- [x] 4.1 Create `apps/backend/app/api/routers/mobile/auth/__init__.py` exporting an `auth_router` that includes both new routes.
- [x] 4.2 Create `apps/backend/app/schemas/auth/mobile_session.py::PatientSession` with exactly `{id: UUID, given_name: str, patient_id: UUID, tenant_id: UUID}`. No other fields. Tagged for OpenAPI under `mobile`.
- [x] 4.3 Create `apps/backend/app/api/routers/mobile/auth/password_router.py` with `POST /mobile/auth/login/password`:
  - Pydantic request `MobileLoginRequest { tenant: str, email: EmailStr, password: str }`.
  - Resolve tenant slug via `resolve_tenant_slug`; map `UnknownTenant` to `HTTPException(400, "Unknown tenant")`.
  - Call `authenticate_password(..., role_filter=lambda r: r == Role.PATIENT)`; map `InvalidCredentials` to `401 {"detail": "Invalid credentials"}`.
  - On success: `issue_session_cookie(response, user)`; project to `PatientSession`; return `200 {session: PatientSession}`.
- [x] 4.4 Create `apps/backend/app/api/routers/mobile/auth/me_router.py` with `GET /mobile/auth/me`:
  - Depend on the existing session-cookie middleware that loads `request.state.session_user`.
  - If the loaded user's role is not `patient`, return `401 {"detail": "Unauthenticated"}`.
  - Otherwise project to `PatientSession` and return `200`.
- [x] 4.5 Register `mobile/auth/auth_router` in `apps/backend/app/api/__init__.py` alongside the existing `mobile_router` from `digital-front-door-setup`.
- [x] 4.6 Update CORS config to allow the Expo metro web dev origin (`http://localhost:8081`) with `allow_credentials=True`, alongside the existing orchestrator origin.

## 5. Backend — seeding

- [x] 5.1 Add `BACKEND_BOOTSTRAP_PATIENT_PASSWORD` reading to `scripts/seed_users.py`. If unset, log a clear error to stderr naming the variable and exit non-zero.
- [x] 5.2 Add `seed_patient_users()` step run after caregiver seeding. Picks the first 1–2 seeded patients (deterministic by `external_ref` or insert order). Creates `users` rows with `role='patient'`, hashed env-var password, deterministic email `patient@zas.local`, display names derived from the patient's `given_name family_name`.
- [x] 5.3 Print resulting `{email, given_name}` pairs to stdout so demo-runners can paste credentials.

## 6. Backend — tests

- [ ] 6.1 `tests/db/test_users_table.py` — add migration-level tests: enum carries `patient`; CHECK rejects bad inserts; partial UNIQUE rejects two users for one patient; relaxed email uniqueness accepts caregiver + patient same-email, rejects two patients same-email.
- [ ] 6.2 `tests/auth/test_login_service.py` — unit tests for `authenticate_password()` covering all five rejection causes returning `InvalidCredentials`; success path; timing-parity assertion (rough: same number of password-hash calls per cause).
- [x] 6.3 `tests/api/test_mobile_auth_login.py` — endpoint tests: happy path, 401 wrong password, 401 caregiver-on-mobile-endpoint, 401 inactive, 401 soft-deleted, 400 unknown tenant; assert `Set-Cookie: BACKEND_SESSION`; assert `surface: 'mobile'` in audit log.
- [x] 6.4 `tests/api/test_mobile_auth_me.py` — endpoint tests: happy path with cookie, 401 missing cookie, 401 cookie-but-role-not-patient; assert `PatientSession` shape exactness.
- [x] 6.5 `tests/api/test_auth_login_password.py` (existing) — add scenario: caregiver route rejects `role = 'patient'` user with the same generic `401`.
- [x] 6.6 `tests/api/test_auth_logout.py` (existing) — add scenario: mobile-issued cookie is cleared by `POST /auth/logout`.
- [ ] 6.7 `tests/api/test_seed_users.py` — assert seed fails without `BACKEND_BOOTSTRAP_PATIENT_PASSWORD`; succeeds with it set and links users to patients.
- [ ] 6.8 Run `moon run backend:test-host` end-to-end; confirm all pass.

## 7. Backend — OpenAPI regen

- [x] 7.1 Run `moon run backend:openapi` to regenerate `apps/backend/openapi.json`.
- [x] 7.2 Inspect the diff: `/mobile/auth/login/password`, `/mobile/auth/me`, and `PatientSession` schema are present under the `mobile` tag. No unrelated drift.

## 8. Mobile — env + transport

- [x] 8.1 Append `EXPO_PUBLIC_TENANT_SLUG=zas` to `apps/digital-front-door/.env.example`.
- [x] 8.2 Update `apps/digital-front-door/app.config.ts` `extra` to expose `tenantSlug: process.env.EXPO_PUBLIC_TENANT_SLUG ?? null`.
- [x] 8.3 Extend `apps/digital-front-door/src/lib/api.ts` with `requestAuthed<T>(path, init?)` (sets `credentials: 'include'`, timeout via `AbortSignal.timeout`, surfaces `UnauthenticatedError` on 401 / `ApiError` otherwise). Add `class UnauthenticatedError extends ApiError`.
- [x] 8.4 Add a `resolveTenantSlug()` helper that reads `Constants.expoConfig?.extra?.tenantSlug` and throws an explicit `ApiError` if absent.

## 9. Mobile — auth module (first concrete `src/modules/<x>/`)

- [x] 9.1 Create `apps/digital-front-door/src/modules/auth/types.ts` re-exporting the generated `PatientSession` and defining a local `LoginInput { tenant: string; email: string; password: string }`.
- [x] 9.2 Create `src/modules/auth/api.ts` with `login(input: LoginInput): Promise<{ session: PatientSession }>` (POSTs JSON via `requestAuthed`) and `me(): Promise<PatientSession>` (GETs via `requestAuthed`).
- [x] 9.3 Create `src/modules/auth/queries.ts` exporting `authQueries.all() = ['auth']` and `authQueries.me()` returning a `queryOptions` factory.
- [x] 9.4 Create `src/modules/auth/mutations.ts` exporting `authMutations.login()` config; on `onSuccess`, invalidates `authQueries.me()` on the shared `queryClient`.
- [x] 9.5 Create `src/modules/auth/atoms.ts` with `currentSessionAtom: PrimitiveAtom<PatientSession | null>` defaulting to `null`. Document in code comments that this is a hot cache; source of truth is the TanStack Query cache.
- [x] 9.6 Create `src/modules/auth/hooks/use-session.ts` wrapping `useQuery(authQueries.me())` and returning `{ session, isAuthenticated, isLoading, error }`.
- [x] 9.7 Create `src/modules/auth/hooks/use-login.ts` wrapping `useMutation(authMutations.login())` and exposing `{ login, isLoading, error }`.
- [x] 9.8 Create `src/modules/auth/components/login-form.tsx` per spec — Dutch labels via `t('auth.…')`, NativeWind-only styling, controlled inputs, error region with `role="alert"`.
- [x] 9.9 Create `src/modules/auth/index.ts` barrel re-exporting `atoms`, `types`, `api`, `queries`, `mutations`, plus `export function resetAuth(): Promise<void>` that calls `POST /auth/logout` via `requestAuthed`, clears `currentSessionAtom`, and invalidates `authQueries.me()`.

## 10. Mobile — i18n namespace

- [x] 10.1 Create `apps/digital-front-door/src/lib/i18n/locales/nl-BE/auth.json` with keys: `form.email`, `form.password`, `form.submit`, `form.submitting`, `errors.invalidCredentials`, `errors.network`, `errors.unknownTenant`. All values Dutch.
- [x] 10.2 Update `apps/digital-front-door/src/lib/i18n/locales/nl-BE/common.json` to add `app.home.welcome` with value `Welkom, {{name}}`.
- [x] 10.3 Update `apps/digital-front-door/src/lib/i18n/index.ts` to register the `auth` namespace alongside `common` and load the new resource bundle.

## 11. Mobile — gated routing + screens

- [x] 11.1 Refactor `src/app/_layout.tsx`: after `initI18n()` resolves, mount the existing provider stack; introduce an inner `RoutingGate` component that consumes `useSession()` and triggers `router.replace('/(app)')` or `router.replace('/(auth)/login')` based on the result. Keep splash visible until `useSession()` has resolved at least once.
- [x] 11.2 Replace `src/app/(auth)/login.tsx` body with `<LoginForm />` from `@/modules/auth`.
- [x] 11.3 Replace `src/app/(app)/index.tsx` body with a `<HomePlaceholder />` that reads `useSession()` and renders `t('app.home.welcome', { name: session.given_name })`. No other content. NativeWind-only.

## 12. Mobile — tests

- [ ] 12.1 `__tests__/modules/auth/api.test.ts` — mock `requestAuthed`; assert `login()` POSTs to `/mobile/auth/login/password` with body shape `{tenant, email, password}`; assert `me()` GETs `/mobile/auth/me`; assert both pass through `credentials: 'include'`.
- [ ] 12.2 `__tests__/modules/auth/hooks/use-login.test.ts` — render hook with `renderWithProviders`; trigger mutation; assert `authQueries.me()` is invalidated on success; assert `UnauthenticatedError` surfaces in `error`.
- [ ] 12.3 `__tests__/modules/auth/components/login-form.test.tsx` — render under `nl-BE`; assert Dutch labels render; assert submit calls mutation; mock 401 → assert `Ongeldige inloggegevens` error region renders.
- [ ] 12.4 `__tests__/app/_layout.test.tsx` — extend the existing smoke test with two integration scenarios: `me()` returns 401 → active route is `/(auth)/login`; `me()` returns 200 → active route is `/(app)`. Mock `authQueries.me()` query function per scenario.
- [ ] 12.5 `__tests__/fixtures/auth.ts` — `makePatientSession(overrides?: Partial<PatientSession>): PatientSession`.

## 13. Orchestrator — typegen + light spec checks

- [ ] 13.1 Run `/openapi-sync` (or `moon run orchestrator:typegen` after backend openapi regen). Verify `apps/orchestrator/src/lib/api/schema.d.ts` now references `/mobile/auth/login/password`, `/mobile/auth/me`, and `PatientSession`.
- [ ] 13.2 No orchestrator UI changes in this PR. Sanity-run `moon run orchestrator:typecheck` to confirm the new types don't break the existing tree.

## 14. Verification (everything must be green)

- [ ] 14.1 `moon run digital-front-door:install`, `:typecheck`, `:lint`, `:format-check`, `:test`, `:build` all exit 0.
- [ ] 14.2 `moon run backend:test-host` exits 0; the new auth tests pass.
- [ ] 14.3 `moon run backend:typecheck`, `:lint`, `:format` exit 0.
- [ ] 14.4 `moon run backend:openapi` is clean (no diff after regeneration).
- [ ] 14.5 `moon run orchestrator:typecheck` exits 0 with the regenerated schema.
- [ ] 14.6 `moon run :ci` mobile + backend tasks all green. Orchestrator failures unrelated to this change are documented in the PR.
- [ ] 14.7 Real-device smoke check on at least one mobile platform (iOS simulator OR Android emulator OR Expo web preview): seeded demo credentials, submit form, observe home screen with Dutch greeting. Note the platform tried in the PR description.
- [ ] 14.8 OpenSpec validation: `openspec validate --all --strict --no-interactive` returns 0 failures.
- [ ] 14.9 Re-read all four artifact files; confirm every locked decision is reflected; archive-readiness check.

## 15. Mobile — biometric unlock + long session

- [ ] 15.1 Install `expo-local-authentication` (via `npx expo install`).
- [ ] 15.2 Extend `src/modules/auth/atoms.ts` with `biometricEnabledAtom: PrimitiveAtom<boolean>` defaulting to `false`. Document in code comments that the persisted source of truth is `secureStorage`.
- [ ] 15.3 Extend `src/modules/auth/api.ts::login()` body to include `biometric_supported: boolean` resolved at call time via `await LocalAuthentication.hasHardwareAsync() && await LocalAuthentication.isEnrolledAsync()`.
- [ ] 15.4 Extend `src/modules/auth/hooks/use-login.ts::onSuccess`: write `secureStorage.set('biometricEnabled', 'true')` and set `biometricEnabledAtom = true` IFF the device supports biometric at login time.
- [ ] 15.5 Replace the splash-hide step in `src/app/_layout.tsx`: after `me()` resolves 200, read `secureStorage.get('biometricEnabled')`. If `'true'` AND device supports biometric → keep splash → call `LocalAuthentication.authenticateAsync({ promptMessage: t('auth.biometric.prompt') })` → on success hide splash + route `/(app)`; on cancel/fail hide splash + show locked screen.
- [ ] 15.6 Detect biometric removal in the boot gate: when stored flag is `'true'` and `hasHardwareAsync()` or `isEnrolledAsync()` returns `false` → call `resetAuth()` and route `/(auth)/login`.
- [ ] 15.7 Add background-state tracker in `src/app/_layout.tsx`: subscribe to `AppState.addEventListener('change', ...)`. Track timestamp of last background. On foreground transition, if `biometricEnabledAtom = true` AND elapsed >= 30000ms → fire `authenticateAsync`. On cancel/fail: locked-screen overlay.
- [ ] 15.8 Create `src/modules/auth/components/biometric-locked-screen.tsx` rendering Dutch "Probeer opnieuw" + "Gebruik wachtwoord" buttons. NativeWind-only.
- [ ] 15.9 Update `src/modules/auth/components/login-form.tsx` to set `textContentType="username"` + `autoComplete="email"` on email field and `textContentType="password"` + `autoComplete="password"` on password field.
- [ ] 15.10 Extend `resetAuth()` to also clear `secureStorage.set('biometricEnabled', null)` and `biometricEnabledAtom = false`.
- [ ] 15.11 Add new i18n keys in `auth.json`: `biometric.prompt`, `biometric.locked.title`, `biometric.locked.retry`, `biometric.locked.usePassword`. Dutch values.
- [ ] 15.12 Tests: `__tests__/modules/auth/biometric.test.tsx` — biometric-enabled boot fires prompt; cancel routes to locked screen; locked-screen retry refires prompt; locked-screen password CTA calls `resetAuth()`; biometric-removed boot calls `resetAuth()` and routes to login; background-return < 30s does NOT re-prompt; background-return >= 30s does re-prompt. Mock `expo-local-authentication`.

## 16. Backend — biometric-aware cookie lifetime

- [ ] 16.1 Add `biometric_supported: bool = False` field to `MobileLoginRequest` Pydantic schema.
- [ ] 16.2 Extend `issue_session_cookie(response, user, max_age=None)` to accept an explicit `max_age` parameter; caregiver path passes `None` (preserves existing default); mobile path passes `timedelta(days=30)` when `biometric_supported = True` and `None` otherwise.
- [ ] 16.3 Backend test: `/mobile/auth/login/password` with `biometric_supported=true` sets `Max-Age=2592000`; with `biometric_supported=false` sets the caregiver-default Max-Age.

## 17. Backend — `POST /users` body validator for patient role

- [ ] 17.1 Extend `CreateUserRequest` Pydantic schema with `patient_id: UUID | None = None`.
- [ ] 17.2 Add Pydantic validator: `role = patient` requires `patient_id IS NOT NULL`; `role != patient` requires `patient_id IS NULL`. Mismatched combos return 422 with field error.
- [ ] 17.3 Update `user_service.create_user(...)` to pass `patient_id` through to the model. CHECK constraint at DB is the safety net.
- [ ] 17.4 Test: `POST /users` happy path with `role=patient` + `patient_id` succeeds; mismatched 422; `patient_id` referencing non-existent patient → 404 / 422 (consistent error shape).

## 18. Demo seed — patient row + patient user

- [ ] 18.1 Create `scripts/seed_patient_users.py` exposing `seed_patient_users(db, *, bootstrap_admin_id, tenant_id)`:
  - Insert a synthetic `patients` row with `given_name='Test'`, `family_name='Patient'`, `birth_date=date(1980, 1, 1)`, `gender='unknown'`, `primary_organisation_id` resolved from the seeded org, `source='synthetic'`, `external_ref='demo-patient-1'`, `external_system='seed'`. Idempotent via `external_ref` lookup.
  - Read `BACKEND_BOOTSTRAP_PATIENT_PASSWORD` env var with fallback `"changeme"` (matches existing pattern).
  - Insert `users` row with `email='patient@zas.local'`, `role='patient'`, `patient_id=<new patient row>`, `display_name='Test Patient'`, `password_hash=<argon2id>`. Idempotent via `(tenant_id, lower(email), role)`.
  - Print `{email: patient@zas.local, password: <env var name>}` to stdout.
- [ ] 18.2 Register the new seed step in `scripts/seed_all.py` AFTER `seed_patients` (or as part of `seed_users` if simpler — verify FK ordering).
- [ ] 18.3 Test: `tests/scripts/test_seed_patient_users.py` — runs seed with env var set, asserts patient row exists with deterministic external_ref, asserts user row exists linked to it, asserts idempotency on re-run.
