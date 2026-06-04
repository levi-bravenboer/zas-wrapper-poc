## Context

The `digital-front-door` scaffold is on `main` (PR #30, archived spec). It ships:

- Expo SDK 56 mobile app at `apps/digital-front-door` with placeholder `(auth)/login.tsx` and `(app)/index.tsx`.
- `src/modules/<x>/` convention documented in the per-app `AGENTS.md`; **no module has been built yet**.
- `expo-secure-store` seam in `src/lib/secure-storage.ts`; cookie auth doesn't need it for tokens but the seam stays available for autofill / fallback.
- `/mobile/*` backend prefix claimed by `digital-front-door-setup` D18.
- Light theme locked.
- ESLint flat config at error severity; per-app `AGENTS.md` documents the TanStack `queryOptions` pattern, the Jotai-per-module convention, and the kebab-case filename rule.

Backend has a caregiver cookie auth subsystem (`POST /auth/login/password`, `GET /auth/me`, `POST /auth/logout`, `BACKEND_SESSION` cookie, session middleware, structured audit log). Capabilities `user-base`, `auth-stub`, `auth-session`, `patients-base` are on main.

This change is the first patient feature. It does two things in one PR — lands the FHIR-aligned identity model on `users` (since every future patient feature needs it) and lights up the auth flow end-to-end (login form, gated routing, session). Every other patient feature change after this one starts from a working logged-in state.

## Goals / Non-Goals

**Goals:**
- A seeded demo patient can log in on iOS, Android, and the Expo web preview.
- `users` table carries the link to `patients` without introducing a parallel auth subsystem.
- Caregiver and patient password verification share one code path; both surfaces issue the same session cookie via the same helper.
- `patients-base` invariant ("Patient is a clinical subject, never an authenticatable identity") is preserved unambiguously.
- Mobile app exercises the full `src/modules/<x>/` shape end-to-end so subsequent feature changes have a working pattern to copy.
- MDR-safe: zero clinical data displayed.

**Non-Goals:**
- JWT bearer tokens, refresh tokens, server-side token revocation (`BL-042` covers MVP).
- eID / itsme / eHealth federated identity (`oidc-login-providers` MVP change).
- Orchestrator patient-user admin UI (deferred to `mobile-patient-users-admin-ui`).
- Patient-side onboarding flows: consent, terms of use, password reset, email verification, biometric unlock.
- RelatedPerson / family-member login — needs the FHIR `Person` layer.
- Logout UI; only the shared `POST /auth/logout` endpoint is wired.
- Rate-limiting / lockout (`BL-043` MVP).
- Multi-tenant disambiguation UX in the mobile app (one build per hospital; tenant slug baked at build time).

## Decisions

### D1 — Auth transport: **reuse the existing `BACKEND_SESSION` cookie**

The mobile app authenticates by sending `credentials: 'include'` on every authed request. The backend issues `Set-Cookie: BACKEND_SESSION=...; HttpOnly; SameSite=Lax; Secure; Path=/` (existing cookie attributes, no change). React Native's native `fetch` honors `Set-Cookie` automatically on iOS and Android via the OS cookie store. The web target uses CORS `credentials: 'include'`.

**Why not JWT bearer**: a parallel JWT pipeline would mean two middlewares, two secret stores, two audit shapes, and two revocation strategies. The caregiver cookie subsystem is mature; reusing it cuts net new backend auth code roughly in half and removes the need to design a token revocation story (`BL-042` already plans server-side session revocation for both surfaces at MVP).

**Risks tracked in D14 / Risks section.**

### D2 — One shared `authenticate_password()` service

Move the existing caregiver login's password-verification body into a new module-level function `apps/backend/app/auth/login_service.py::authenticate_password(...)`. Both the caregiver router (refactored) and the new mobile router call it; they differ only in the `role_filter` argument they pass.

```python
async def authenticate_password(
    *,
    email: str,
    password: str,
    tenant_id: UUID,
    role_filter: Callable[[Role], bool],
    db: AsyncSession,
) -> User:
    user = await user_repo.find_by_email_in_tenant(db, tenant_id, email)
    if user is None or not user.is_active or user.deleted_at is not None:
        raise InvalidCredentials()
    if not role_filter(user.role):
        raise InvalidCredentials()
    if not verify_password_hash(password, user.password_hash):
        raise InvalidCredentials()
    return user
```

A single `InvalidCredentials` exception covers every rejection cause so the response surface stays uniform — no user-enumeration leak via differing error messages. Audit logging fires inside the service with a `reason` field that is logged but never returned to the client.

The caregiver router refactor is part of this change. Justification: "second caller, first abstraction." The seam now exists for every future provider (eID, itsme, magic-link) to plug into.

### D3 — Identity model: extend `role` enum, link via `users.patient_id`

- `ALTER TYPE role ADD VALUE 'patient'`. Postgres enum extension is non-destructive and irreversible — recorded in the migration's `op.execute(...)` with no `downgrade` for the value (alembic's `downgrade` recreates the type without the value, requires recreating the column).
- `ADD COLUMN patient_id UUID NULL REFERENCES patients(id) ON DELETE RESTRICT`.
- `CREATE UNIQUE INDEX users_patient_id_unique ON users(patient_id) WHERE patient_id IS NOT NULL` — 1:1 patient↔user, partial so caregiver rows (NULL `patient_id`) don't collide.
- `ADD CONSTRAINT users_role_patient_link CHECK ((role = 'patient' AND patient_id IS NOT NULL) OR (role <> 'patient' AND patient_id IS NULL))`.

**Why `role` not `principal_kind`:**
- One discriminator, not two.
- Existing RBAC code (`if user.role == Role.CAREGIVER`) keeps working; patient principals just don't match any clinician role.
- `patients-base` is satisfied because the `users` row is the auth entity, not the `patients` row. The patient row gains no credential columns.

**FHIR alignment:** at MVP, a `persons` table (FHIR Person) replaces this direct FK; `users.person_id` becomes the FK and `person_links` rows point at one or more of `Patient`, `Practitioner`, `RelatedPerson`. This change is forward-compatible: the patient-id link migrates to a Person link without breaking any client.

### D4 — Email uniqueness relaxed to `(tenant_id, lower(email), role)`

Existing `(tenant_id, lower(email))` unique index dropped; new partial index covers `(tenant_id, lower(email), role)`. A caregiver and a patient in the same tenant may share an email. Two patients in the same tenant cannot share an email; same for caregivers.

**Why**: realistic for healthcare — staff treated as patients use the same address. Strict uniqueness would force them into two emails artificially.

**Trade-off**: orchestrator code that looks up "the user for this email in this tenant" must now also pass a role hint or accept multiple rows. The caregiver path filters by `role <> 'patient'`; the mobile path filters by `role = 'patient'`. No orchestrator surface currently does cross-role lookup.

### D5 — Tenant slug at the boundary, not the cookie

Mobile login body carries `{ tenant: string, email, password }`. Backend resolves slug → `tenant_id` via `apps/backend/app/auth/tenant_resolver.py::resolve_tenant_slug()`. Unknown slug → `400`.

Tenant identity is stored on the session itself, not in the mobile request after login. Once the cookie is issued, subsequent requests rely on the session-bound `tenant_id` loaded by the existing middleware — no per-request tenant header from the mobile app.

**Why a slug, not a UUID, in the body**: slugs are stable across environments; UUIDs change per-deployment. The slug `zas` resolves correctly in dev, staging, and prod without app rebuilds.

**Why bake the slug at build time** (`EXPO_PUBLIC_TENANT_SLUG=zas` in `apps/digital-front-door/.env.example`): one mobile build per hospital is the production target (hospitals are GDPR data controllers; each owns its own brand and app listing). PoC follows that shape so MVP doesn't rewrite tenant resolution.

### D6 — Route naming: symmetric `/<surface>/auth/login/<kind>` and `/<surface>/auth/me`

| Concern | Caregiver | Mobile patient |
|---|---|---|
| Password login | `POST /auth/login/password` | `POST /mobile/auth/login/password` |
| Provider discovery | `GET /auth/providers` (existing; PoC has one entry) | `GET /mobile/auth/providers` (MVP, when eID lands) |
| Session info | `GET /auth/me` (caregiver-shaped, filters `role <> 'patient'`) | `GET /mobile/auth/me` (`PatientSession`, filters `role = 'patient'`) |
| Logout | `POST /auth/logout` | shared — same endpoint, same cookie |

The `/mobile/*` prefix carries the surface (one CORS rule, one MDR boundary). Inside the surface, the path mirrors the caregiver naming exactly — including the kind suffix `/password`. When `oidc-itsme` lands, both surfaces add `/auth/login/oidc` symmetrically.

No `POST /mobile/auth/logout` parallel: one endpoint clears the cookie regardless of who issued it.

### D7 — Response model: lean `PatientSession`

`PatientSession`: `{ id: UUID, given_name: string, patient_id: UUID, tenant_id: UUID }`. No family name, no DOB, no gender, no role enum (implied), no clinical fields, no Luscii references.

**Why minimum**: every additional field is something a future change must justify under MDR. The lean shape keeps the door closed on accidental clinical leaks. When a feature actually needs `family_name` or `birth_date` on the patient's own home screen, it ships in that feature change's MDR check.

`SessionUser` (caregiver) shape is unchanged. We do not rename it to `CaregiverSession` in this change — out of scope blast radius is too wide (every orchestrator client, every typegen consumer). Asymmetry documented in `auth-session` design notes; future polish change can rename.

### D8 — Backend code layout

```
apps/backend/app/auth/
  login_service.py             NEW    authenticate_password(...)
  tenant_resolver.py           NEW    resolve_tenant_slug(...)
  password.py                  EXISTS verify_password_hash / hash_password
  session.py                   EXISTS issue_session_cookie / read_session_cookie / middleware
  providers.py                 EXISTS LoginProvider Protocol + auth_providers table

apps/backend/app/api/routers/
  auth/
    password_router.py         REFACTOR  POST /auth/login/password (calls authenticate_password)
    me_router.py               TWEAK     GET  /auth/me (adds role <> patient filter)
    logout_router.py           UNCHANGED POST /auth/logout
    providers_router.py        UNCHANGED GET  /auth/providers
  mobile/
    auth/
      __init__.py              NEW
      password_router.py       NEW POST /mobile/auth/login/password
      me_router.py             NEW GET  /mobile/auth/me
```

The mobile router files are thin (≤ 25 lines each). They:
1. Validate the request body via Pydantic.
2. Resolve tenant slug (login route only).
3. Call `authenticate_password()` (login route) OR read `request.state.session_user` (me route).
4. Issue cookie (login route, via existing `issue_session_cookie`) OR project to `PatientSession` (me route).
5. Return the response.

No new middleware. The existing session middleware loads the user regardless of surface; the `me` route filters by role inside the handler.

### D9 — Mobile transport: `requestAuthed` over `fetch` with `credentials: 'include'`

`apps/digital-front-door/src/lib/api.ts` gains:

```ts
export async function requestAuthed<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${resolveBaseUrl()}${path}`, {
    ...init,
    credentials: 'include',
    headers: { Accept: 'application/json', ...init.headers },
    signal: init.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  })
  if (res.status === 401) throw new UnauthenticatedError()
  if (!res.ok) throw new ApiError(`Request failed (${res.status})`, res.status)
  return (await res.json()) as T
}
```

All future `src/modules/<x>/api.ts` files call `requestAuthed`. `apiHealthCheck()` stays on raw `fetch` (no `credentials`) because the health endpoint is intentionally unauthenticated.

`UnauthenticatedError` is a typed subclass of `ApiError`. The login mutation rethrows it as a Dutch i18n message; everything else maps it to "session expired, please log in again" via the gated layout's error boundary.

**Why `credentials: 'include'` is enough:**
- Native iOS / Android: the OS cookie jar attaches the cookie automatically; `credentials: 'include'` is a no-op there but harmless.
- Web target: the browser requires the flag for CORS-credentialed requests.
- One code path covers both.

### D10 — Gated routing via `useSession()`

`src/app/_layout.tsx` mounts the existing providers (ErrorBoundary, SafeArea, KeyboardProvider, QueryClient, Jotai, i18n init) and then renders a routing-gate component that:

1. Reads `useSession()` (a `useQuery(authQueries.me())` wrapper).
2. While `isLoading` (initial fetch in flight): keeps the splash visible.
3. On 200: `router.replace('/(app)')`.
4. On 401: `router.replace('/(auth)/login')`.

The gate runs once at boot; later transitions are driven by:
- Login success → `queryClient.invalidateQueries(authQueries.me())` → `me()` refetches → gate re-routes to `/(app)`.
- Future logout → call `resetAuth()` from the auth-module barrel → clears query cache + atom → gate re-routes to `/(auth)/login`.

This is `useQuery`-driven, not Jotai-atom-driven. The atom `currentSessionAtom` is a convenience cache for non-React contexts; the source of truth is the TanStack Query cache (which itself is hydrated from the cookie via `me()`).

### D11 — i18n namespace `auth` with Dutch-only resources

Per `nl-BE`-only rule from `digital-front-door-setup` D8. New file `apps/digital-front-door/src/lib/i18n/locales/nl-BE/auth.json` with the canonical Dutch labels and error messages. The orchestrator's existing `Ongeldige inloggegevens` Dutch string is reused for consistency.

i18next `ns` config grows to `['common', 'auth']`. Updates `src/lib/i18n/index.ts`.

### D12 — Seeding gated by env var

`scripts/seed_users.py` (existing) gains a `seed_patient_users()` step run after the existing caregiver seeding. The step:

1. Reads `BACKEND_BOOTSTRAP_PATIENT_PASSWORD` env var. If unset → exit with a clear error. (Test envs set it; prod must set it consciously; dev `.env.example` includes a sample value.)
2. Looks up 1–2 already-seeded patient rows (by deterministic `external_ref` or first-seeded order).
3. Creates `users` rows: `role='patient'`, `patient_id=<patient>`, `email=<deterministic, e.g., patient@zas.local>`, hashed `BACKEND_BOOTSTRAP_PATIENT_PASSWORD`.
4. Logs the resulting email + patient name to stdout so demo-runners can paste credentials into the app.

### D13 — Tests organisation

Backend `tests/api/test_mobile_auth_*.py` parallel to existing `test_auth_*`. Unit tests for `authenticate_password()` live at `tests/auth/test_login_service.py`. Migration test extends the existing `tests/db/test_users_table.py` (or equivalent) with cases for the new CHECK and partial unique index.

Mobile tests follow the AGENTS.md mirror tree: `__tests__/modules/auth/api.test.ts`, `__tests__/modules/auth/hooks/use-login.test.ts`, `__tests__/modules/auth/components/login-form.test.tsx`, `__tests__/app/_layout.test.tsx` (gated-routing integration). Default mocks in `jest.setup.ts` already mock the API module; this change replaces the test-mock implementation with a per-test override for the new flows.

### D14 — MDR boundary check (per-change, required by D16 of digital-front-door-setup)

**Question:** does any UI in this change display clinical data?

- Login form: email field, password field, submit button, error region. **No.**
- Home placeholder: "Welkom, {given_name}". **No.** A first name is demographic, not clinical.
- No vitals, no measurements, no decision support, no Luscii content, no pathway state.

**Conclusion:** MDR-safe. No `openspec/mdr-watchlist.md` entry. The check is recorded here so the per-feature obligation is visibly satisfied.

### D15 — Logout endpoint shared, UI deferred

The existing `POST /auth/logout` clears the `BACKEND_SESSION` cookie regardless of who issued it. The mobile app calls it (with `credentials: 'include'`) from `resetAuth()` whenever a logout UI lands — but no in-app button is added in this change because the home screen is still a placeholder; the next feature change will introduce a nav drawer / settings surface where a "Uitloggen" button naturally lives.

`resetAuth()` is shipped in `src/modules/auth/index.ts` so the convention has a concrete first implementation. It:
1. Calls `POST /auth/logout`.
2. Clears `currentSessionAtom`.
3. Invalidates `authQueries.me()`.

### D16 — Production migration path

Forward-compatibility receipts:

- **Identity model**: the direct `users.patient_id` FK migrates to a Person-table layer at MVP. Schema migration replaces the FK with a `users.person_id` FK; the `users_role_patient_link` CHECK becomes a constraint on `persons.link_count > 0` against patient-typed links. No data loss; backfill is mechanical.
- **Tenant resolution**: stays slug-keyed at build time. Production swaps the slug per-hospital build; nothing else moves.
- **Auth transport**: cookie session subsystem stays. eID / itsme / eHealth ride on top of the same `LoginProvider` Protocol with new kind-routes (`/mobile/auth/login/oidc/itsme`, etc.); the cookie they issue is identical.
- **Hardening gates** (`BL-042` revocation, `BL-043` rate-limit, `BL-044` MFA, `BL-046` DPIA): every gate applies to both surfaces because the subsystem is shared.

The cost of this change at MVP is therefore a single migration plus two new IdP route handlers — not a transport rewrite.

## Risks / Trade-offs

- **RN cookie persistence on Android cold-start** → Mitigation: a smoke test on a real Android device before the demo. Fallback if it bites: write the session token (server-issued opaque ID) into `secureStorage` and re-attach via `Cookie` header on cold-start. The `secureStorage` seam stays installed precisely for this fallback; no architecture change required if we have to flip.
- **CORS configuration for web preview** → Mitigation: backend CORS config gains the Expo metro web preview origin (`http://localhost:8081` by default) with `allow_credentials=True`. Documented in the design + tasks; backend CORS test covers it.
- **Email-uniqueness relaxation surprises legacy callers** → Mitigation: orchestrator code never does cross-role email lookups today. The relaxation is additive: existing `(tenant_id, lower(email))` lookups for caregiver flows continue to find one row because caregivers and patients share the email only if both kinds exist — the caregiver route's filter ensures we still pick the caregiver row. Caregiver UI never sees the patient row.
- **Patient enumeration via login-error timing** → Mitigation: single `InvalidCredentials` exception with constant-time password verification (already done by the existing caregiver path via argon2id verification). No early return before password compare; the `role_filter` rejection runs a dummy compare to preserve timing.
- **Tenant slug typo silently lands on wrong hospital** → Mitigation: backend `400` with explicit "Unknown tenant" body. The mobile app's i18n maps it to `Tenant niet bekend`. Dev / staging / prod tenants are managed via the same `tenants` table — the slug is checked, not trusted blindly.
- **MDR drift via "first name" interpretation** → Mitigation: first name is demographic per FHIR `Patient.name.given`; it is not clinical content. Recorded in D14.
- **Refactoring the caregiver login router as part of this change** → Mitigation: the caregiver path keeps all existing scenarios (auth-stub + auth-session specs) green; the refactor is internal. The change adds tests for `authenticate_password()` directly so the path-level behaviour is doubly covered.

## Migration Plan

Forward:

1. Apply alembic revision (additive — enum value, column, index, constraint, unique-index swap). Existing rows untouched.
2. Seed picks up new patient users iff `BACKEND_BOOTSTRAP_PATIENT_PASSWORD` is set. Existing caregiver / admin seeds unchanged.
3. New routes deploy with the backend.
4. Mobile app picks up the new env var on the next build.

Rollback:

- Migration `downgrade` removes the constraint, index, column, and email-unique-swap; the `patient` enum value cannot be removed cleanly (Postgres limitation) but is harmless because no row carries it after the column is dropped.
- Backend code revert removes the new routers and the service module; the caregiver router refactor reverts to its inlined form.

Production seed safety:

- Production deploy MUST NOT set `BACKEND_BOOTSTRAP_PATIENT_PASSWORD` and MUST run a migration-only deploy first, then a code deploy, then enrolment via the future admin UI. PoC environments may set it.

## Open Questions

- **401 vs 403 for inactive / soft-deleted users on mobile login.** `401` avoids user enumeration; `403` is semantically clearer. Default: `401` for parity with the caregiver path and to avoid leaking "this account exists but is disabled." Confirm before tasks land.
- **`given_name` source.** Loaded from `patients.given_name`. If empty / null, the mobile home falls back to `"Welkom"`. Acceptable for PoC where seeds always populate it; explicit handler.
- **Audit log `surface` field shape.** New field on existing structured-log schema (`surface: 'mobile' | 'caregiver' | 'admin'`). Single-line change to the log helper.
- **CORS for Expo web preview port.** Default Expo metro web port is `8081` in dev. If a developer changes it, CORS needs updating. Documented; not blocking PoC.
- **Future patient-user admin UI scope.** This change does not ship orchestrator UI. The follow-up `mobile-patient-users-admin-ui` change must decide list / create / deactivate / password-reset affordances.
- **Production password rotation for the demo seed.** Out of scope; PoC env var is sufficient. MVP gates this on `BL-042` + `BL-049`.
