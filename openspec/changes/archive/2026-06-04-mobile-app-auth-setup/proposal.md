## Why

**Tier**: `[poc]`

The `digital-front-door` scaffold (merged via `digital-front-door-setup`) ships an empty Expo SDK 56 mobile app with a placeholder `(auth)/login.tsx`. This change adds the **first real feature** on top of that shell — patient authentication — and lands the FHIR-aligned identity model every subsequent patient feature will depend on.

Two outcomes:

1. **Mobile login lands.** A seeded demo patient can open the app, log in with email + a fixed PoC password (sourced from a backend env var, not per-user-chosen), and be routed from `(auth)/login` to the `(app)` shell. The `(app)` home placeholder shows a localized "Welkom, <given name>" — and nothing else clinical. No logout UI yet; cookie sessions expire after the existing caregiver session lifetime.
2. **The patient-vs-FHIR identity model is settled.** `users` is the authentication entity (caregivers + admins + patients share the table); `patients` stays a pure FHIR `Patient` clinical subject with no credential columns. The link is a **nullable `users.patient_id` FK** to `patients.id`, 1:1, enforced by a UNIQUE partial index and a CHECK constraint keyed off the existing `role` enum. The enum gains a `patient` value; "is this principal a patient?" reduces to `role = 'patient'` — no new discriminator column.

**Auth transport — cookie session, not JWT.** The existing caregiver `BACKEND_SESSION` cookie subsystem (issuer, middleware, audit, logout) is reused unchanged. The mobile login issues the same cookie; RN `fetch` carries it natively on iOS / Android; web target uses `credentials: 'include'` with CORS configured. Net new backend code is a thin password-service extraction (so both caregiver and mobile login share one path), two thin routers, one tenant-slug resolver, and one lean response model. No parallel JWT pipeline, no second secret, no new middleware, no new audit shape.

This is the first patient feature change after the scaffold, so it exercises the MDR check deferred via D16 of `digital-front-door-setup`. **Result:** auth screens show only the patient's email field, the password field, error text, and "Welkom, <given name>". No measurements, vitals, decision support, or Luscii content. **MDR-safe — no `openspec/mdr-watchlist.md` entry is added by this change.**

## What Changes

### Re-tier patient authentication from `[mvp]` to `[poc]`

- Update `openspec/scope.md`:
  - Remove the "no patient consumes it in the demo" framing from the "Patient features & delivery channel" row.
  - Add `F10 Patient login` to PoC In-Scope with acceptance "seeded patient logs in on the mobile app and lands on the `(app)` home with a Dutch greeting; backend `POST /mobile/auth/login/password` issues a session cookie; orchestrator users-admin-ui changes are NOT part of this PoC slice."
  - Refresh the `F5` / `F9` rows in the PoC → MVP Delta accordingly.
- Update `openspec/roadmap.md` so the patient-surface MVP item reads: "login shipped in PoC via `mobile-app-auth-setup`; concrete patient features (pathway view, task complete, Luscii deep-link), federated identity (eID / itsme / eHealth), and the orchestrator patient-user admin UI remain MVP work."
- Update `openspec/backlog.md` `BL-022` (patient-view enrollment activation): "Login promoted to PoC via `mobile-app-auth-setup` on 2026-06-02; consent + Luscii download activation flow remains MVP-tier."

### Backend — FHIR-aligned identity model

**Migration on `users`** (one alembic revision):

- `ALTER TYPE role ADD VALUE 'patient'` — non-destructive Postgres enum extension.
- `ADD COLUMN patient_id UUID NULL REFERENCES patients(id) ON DELETE RESTRICT`.
- `CREATE UNIQUE INDEX users_patient_id_unique ON users(patient_id) WHERE patient_id IS NOT NULL` — 1:1 cardinality, partial so caregivers (NULL patient_id) don't collide.
- `ADD CONSTRAINT users_role_patient_link CHECK ((role = 'patient' AND patient_id IS NOT NULL) OR (role <> 'patient' AND patient_id IS NULL))`.
- **Relax email-uniqueness** so a caregiver and a patient in the same tenant may share an email: drop the existing `(tenant_id, lower(email))` unique index and replace with `(tenant_id, lower(email), role)`. Existing `(tenant_id, external_idp, external_subject)` uniqueness is unchanged.

`patients` table is unchanged. The `patients-base` invariant ("Patient is a clinical subject, never an authenticatable identity") still holds: credentials live on the `users` row that references the `patients` row via `users.patient_id`. `patients-base` spec gains a clarifying scenario (a `patients` row may be referenced by `users.patient_id` without itself becoming authenticatable).

### Backend — code layout (single source of password + session logic)

Shared services in `apps/backend/app/auth/`:

```
apps/backend/app/auth/
  login_service.py       # NEW — authenticate_password(...): the single password verification path
  tenant_resolver.py     # NEW — resolve_tenant_slug(...): slug → tenant_id
  password.py            # existing — verify_password_hash, hash_password
  session.py             # existing — issue_session_cookie, read_session (cookie middleware)
  providers.py           # existing — LoginProvider Protocol + registry
```

`authenticate_password()` accepts `email`, `password`, `tenant_id`, and a `role_filter: Callable[[Role], bool]`. It loads the user, rejects on `is_active=false` / `deleted_at IS NOT NULL` / role mismatch / bad password via a single `InvalidCredentials` exception. Both caregiver and mobile login routes call this function — the only difference is the `role_filter` they pass. The caregiver router (existing) is refactored to call `authenticate_password()` instead of inlining its current logic; this is the "second caller, first abstraction" moment.

`resolve_tenant_slug()` accepts a string slug, returns the `tenant_id` UUID or raises `UnknownTenant` (mapped to HTTP 400). PoC seeds one tenant with slug `zas`.

The `LoginProvider` registry stays **one row per kind** (today: one row, `password`). The role filter is a per-route concern, not a per-provider registration. When `oidc-itsme` lands at MVP, both surfaces gain `/auth/login/oidc` and `/mobile/auth/login/oidc` symmetrically against the same registry row.

### Backend — routes (symmetric naming)

```
auth/                                          # caregiver surface (existing, small refactor)
  POST /auth/login/password                    → issue cookie, role_filter: r != patient
  GET  /auth/me                                → SessionUser (caregiver-shaped; filters role != patient)
  POST /auth/logout                            → clears cookie (shared with mobile)

mobile/auth/                                   # patient surface (new)
  POST /mobile/auth/login/password             → issue cookie, role_filter: r == patient
  GET  /mobile/auth/me                         → PatientSession (lean; filters role == patient)
```

Mobile path mirrors the caregiver naming exactly (`/<surface>/auth/login/<kind>` and `/<surface>/auth/me`). No `POST /mobile/auth/logout` — both surfaces share `POST /auth/logout`.

Request / response shapes:

- `POST /mobile/auth/login/password` body: `{ tenant: string, email: string, password: string }`. Response: `200 { session: PatientSession }` with `Set-Cookie: BACKEND_SESSION=...`. `401` for wrong credentials or wrong role. `400` for unknown tenant slug. `403` for inactive / soft-deleted user (returned as generic `401` if we choose enumeration-safety; see design open question).
- `GET /mobile/auth/me`: requires the session cookie; reads `request.state.session_user` set by existing session middleware; rejects with `401` if the loaded user's role is not `patient`. Response: `PatientSession`.
- `PatientSession` shape (minimum payload only): `{ id, given_name, patient_id, tenant_id }`. No family name, no DOB, no gender, no clinical fields.
- `SessionUser` shape: unchanged. The existing caregiver `GET /auth/me` adds a `role <> 'patient'` filter so a patient cookie cannot resolve to a caregiver session.

The existing `/auth/login/password` route is hardened with the inverse role filter (`role <> 'patient'`) so a leaked patient email cannot use the caregiver path.

Audit log: every login attempt (caregiver or mobile, success or failure) uses the existing structured-log shape. Mobile attempts get a `surface: 'mobile'` field added to the existing schema — single-line addition to the logging helper, no parallel logger.

### Backend — seeding

`seed_users` adds 1–2 demo patient users linked to the existing seeded patients. Password sourced from a new env var `BACKEND_BOOTSTRAP_PATIENT_PASSWORD`. If unset, seeding **fails loudly** so production can never silently ship with a default. The orchestrator's admin user-creation UI does **not** gain a patient-user creator in this PoC change; demo patients are seeded.

### Mobile — first real `src/modules/<x>/`

Create `apps/digital-front-door/src/modules/auth/` exercising the full module shape documented in `apps/digital-front-door/AGENTS.md`:

- `index.ts` — barrel re-exporting `atoms`, `types`, `api`, `queries`, `mutations`, plus a top-level `resetAuth()` function (the documented logout-reset convention's first concrete implementation, even though no logout UI ships).
- `types.ts` — `PatientSession` type generated from OpenAPI; `LoginInput` type local.
- `api.ts` — pure fetch fns `login`, `me`. Uses `src/lib/api`'s shared `requestAuthed(path, init?)` helper that adds `credentials: 'include'` (NOT `Authorization: Bearer`). No TanStack imports.
- `queries.ts` — `authQueries.me()` `queryOptions` factory; key namespace `['auth']`.
- `mutations.ts` — `authMutations.login()` config.
- `atoms.ts` — `currentSessionAtom` (last `PatientSession` from `me()`; null when logged out). No JWT-mirror atom; the cookie is the source of truth.
- `hooks/use-session.ts` — wraps `useQuery(authQueries.me())`; returns `{ session, isAuthenticated, isLoading }`.
- `hooks/use-login.ts` — `useMutation` wrapper that on success invalidates `authQueries.me()` and lets the gated layout react.
- `components/login-form.tsx` — email + password fields, submit button, error region. All copy via the new `auth` i18n namespace. Small RN form with controlled inputs; no external form library.

Extend `src/lib/api.ts`:
- Add `requestAuthed(path, init?)` that injects `credentials: 'include'` and merges headers. All authed mobile calls go through it; `apiHealthCheck()` stays unauthenticated.
- Add `EXPO_PUBLIC_TENANT_SLUG` to the `expoConfig.extra` resolution next to `apiBaseUrl`. Read once; the login body carries it.

Replace `src/app/(auth)/login.tsx` placeholder body with `<LoginForm />`. Replace `src/app/(app)/index.tsx` placeholder text with a `<HomePlaceholder />` component that reads `useSession()` and renders `"Welkom, {given_name}"`. No logout button; no other clinical fields.

Gate routing in `src/app/_layout.tsx`: on first render after i18n init resolves, fire `authQueries.me()`. While loading, hold the splash via the existing `expo-splash-screen` machinery. On 200 → `router.replace('/(app)')`; on 401 → `router.replace('/(auth)/login')`. On login mutation success → invalidate `authQueries.me()` → effect redirects to `/(app)`.

Add a new i18n namespace `auth` at `src/lib/i18n/locales/nl-BE/auth.json` with labels (`Email`, `Wachtwoord`, `Aanmelden`), submit-state (`Bezig met aanmelden…`), errors (`Ongeldige inloggegevens`, `Verbindingsfout, probeer opnieuw`, `Tenant niet bekend`).

Add `EXPO_PUBLIC_TENANT_SLUG=zas` to `apps/digital-front-door/.env.example`.

### Orchestrator — pickup-only

For this PoC change, orchestrator gets the **smallest sensible surface**:

- The regenerated OpenAPI client picks up the new `/mobile/auth/*` routes and the `PatientSession` shape via the standard `/openapi-sync` flow. No new orchestrator UI.
- A users-admin-ui patient-user list view, the patient picker, and the `patient-profile-ui` "linked login" indicator are **deferred to a follow-up change** (`mobile-patient-users-admin-ui`). PoC demo uses seeded patient users via `seed_users` + env var.

### Tests

- Backend pytest (host runner):
  - migration applies cleanly; CHECK rejects bad inserts; UNIQUE partial index rejects two users per patient
  - email uniqueness relaxation: caregiver + patient with same email in the same tenant insert successfully
  - `POST /mobile/auth/login/password`: happy path, 401 wrong password, 401 caregiver-on-mobile-endpoint, 401 inactive, 401 soft-deleted, 400 unknown tenant
  - `GET /mobile/auth/me`: happy path, 401 missing cookie, 401 cookie-but-role-not-patient
  - `POST /auth/login/password` rejects `role = 'patient'`
  - `POST /auth/logout` clears the cookie issued by either surface
  - `authenticate_password()` unit tests for each rejection cause
  - `seed_users` fails when `BACKEND_BOOTSTRAP_PATIENT_PASSWORD` is unset; succeeds with 1–2 patient users when set
- Mobile jest:
  - `modules/auth/api.test.ts` — fetch URL + body + `credentials: 'include'` assertions for both `login` and `me`
  - `modules/auth/hooks/use-login.test.ts` — mutation success invalidates `me` query
  - `modules/auth/components/login-form.test.tsx` — renders Dutch labels, submits, surfaces 401 error
  - `app/_layout.test.tsx` integration — gated routing on `me()` resolution

## Capabilities

### New Capabilities

- `mobile-auth`: patient authentication surface for the mobile app — the `/mobile/auth/*` routes, tenant-slug resolution, the shared `authenticate_password()` service with `role = 'patient'` filter, the `PatientSession` payload, and the reuse of the existing `BACKEND_SESSION` cookie subsystem.
- `mobile-auth-frontend`: the mobile app's `src/modules/auth/` module — exercises the AGENTS.md module shape end-to-end, owns the login form, the gated routing in the root layout, the `requestAuthed` middleware in `src/lib/api.ts`, and the convention's first concrete `resetAuth()` implementation.

### Modified Capabilities

- `user-base`: `role` enum gains `patient`; `users.patient_id` UUID FK added (nullable, ON DELETE RESTRICT); UNIQUE partial index on `patient_id`; CHECK linking `role = 'patient'` to `patient_id IS NOT NULL`; email-uniqueness relaxed from `(tenant_id, lower(email))` to `(tenant_id, lower(email), role)`.
- `auth-stub`: `authenticate_password()` extracted as the single password verification path; `LoginProvider` registry stays one row per kind; caregiver and mobile routes call the service with their respective role filters.
- `auth-session`: caregiver cookie flow unchanged; mobile login issues the same `BACKEND_SESSION` cookie via the same `issue_session_cookie()` helper; both surfaces share `POST /auth/logout`. Documents that server-side revocation (`BL-042`) remains MVP-tier.
- `patients-base`: re-affirms that the `patients` row carries no credential columns; adds a scenario stating that a `patients` row may be referenced by `users.patient_id` FK without becoming authenticatable.
- `digital-front-door`: scaffold capability gains the gated-routing behaviour in the root layout, the `auth` module import, the `requestAuthed` middleware in `src/lib/api.ts`, and the `EXPO_PUBLIC_TENANT_SLUG` env knob.

## Impact

- **Database**: one alembic revision on `users`. Forward-compatible (one enum extension, one nullable FK, one partial unique index, one CHECK, one unique-index swap). No backfill — existing rows keep their `role`, new `patient_id` is NULL.
- **Backend code**: `apps/backend/app/auth/login_service.py` (new), `apps/backend/app/auth/tenant_resolver.py` (new), `apps/backend/app/api/routers/mobile/auth/` (new, two thin routers), small refactor on the existing caregiver password router to call the new service, seed script update gated by `BACKEND_BOOTSTRAP_PATIENT_PASSWORD`.
- **OpenAPI**: `apps/backend/openapi.json` regenerates; orchestrator `typegen` runs in lockstep via `/openapi-sync`.
- **CORS**: existing CORS config gains the mobile dev origins for the web target (Expo's metro web preview port) so `credentials: 'include'` works in browsers. Native mobile (iOS / Android) is unaffected by CORS.
- **Mobile**: new `src/modules/auth/`; edits to `src/app/_layout.tsx`, `src/app/(auth)/login.tsx`, `src/app/(app)/index.tsx`, `src/lib/api.ts`; new `src/lib/i18n/locales/nl-BE/auth.json`; new env var in `.env.example` + `app.config.ts` extras.
- **Orchestrator**: no UI changes; OpenAPI types pick up new shapes.
- **Scope ledger**: `openspec/scope.md`, `openspec/roadmap.md`, `openspec/backlog.md` (BL-022 annotation).
- **MDR**: no `mdr-watchlist.md` entry — auth flow shows no clinical data.
- **CI**: existing `digital-front-door-{quality,test,build,vuln-audit}` + `backend-*` jobs cover the delta; no new workflow jobs.
- **Out of scope (separate changes)**:
  - Orchestrator patient-user admin UI + linked-login indicator → `mobile-patient-users-admin-ui`.
  - eID / itsme / eHealth federated patient login → `oidc-login-providers` (MVP).
  - Server-side session revocation / mid-session kill → `BL-042` (MVP).
  - Biometric unlock (Face ID / fingerprint) → MVP.
  - RelatedPerson / family-member login (FHIR `Person` layer) → MVP.
  - Password reset / magic-link / email verification → MVP.
  - Patient pathway view, task list, Luscii deep-link → subsequent feature changes.
  - Logout UI — this change ships `resetAuth()` and the shared `POST /auth/logout` is callable, but the in-app button lands in the next feature change once a nav surface exists.
