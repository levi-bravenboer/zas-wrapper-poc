## Why

F1 Login is the only PoC entry point and is half-built: backend ships a working `POST /auth/login` + cookie-session, frontend ships a styled `/login` screen, but the screen still bypasses the network with a placeholder handler (`BL-035`). At the same time, the MVP target is real Belgian IdPs (eID / itsme® / eHealth / CSAM) — those are OIDC redirect flows, not form POSTs, so the *shape of the login route itself* changes at MVP, not just the credential check. The current `Authenticator` Protocol abstracts credential verification but does not abstract the route shape, so wiring the placeholder against today's `POST /auth/login` would lock us into a contract we know we have to break.

This change perfects the F1 login end-to-end against the existing backend AND introduces the seam that swallows that swap: a `LoginProvider` registry, a provider-namespaced route layout (`/auth/login/password` today, `/auth/login/{provider}/start` + `/callback` reserved for OIDC), a provider-aware `User` model (nullable `password_hash`, `external_idp` + `external_subject`), and a frontend that drives its login affordances off a `GET /auth/providers` discovery endpoint. PoC ships exactly one provider (`password`); MVP adds OIDC providers without reshaping the surface.

**Tier**: [poc]

**Backlog**: promotes the login-screen wiring carve-out of `BL-035 — F1 user + auth domain`. The carve-out's spec lives here; F1 backend domain residue stays on BL-035 if any remains after this change.

**MDR**: no impact. Credential authentication carries no clinical decision logic.

## What Changes

- **BREAKING (internal API):** rename `POST /auth/login` → `POST /auth/login/password` with operation id `login_password`. `GET /auth/me` and `POST /auth/logout` stay as-is (session is provider-agnostic). Two future-reserved routes are documented in `auth-stub` but NOT implemented: `GET /auth/login/{provider}/start` and `GET /auth/login/{provider}/callback`.
- Add `GET /auth/providers` returning a typed list of enabled login providers (`{ key, label, kind: 'password' | 'oidc' }`). PoC returns `[{ key: 'password', label: 'E-mail + wachtwoord', kind: 'password' }]`.
- Introduce a `LoginProvider` Protocol in `app/services/auth/providers/` with a `PasswordLoginProvider` implementation. `AuthService.login` becomes provider-dispatch; cookie mint + session re-load stay where they are.
- **BREAKING (schema):** alembic migration `users.password_hash` becomes nullable; add `users.external_idp` (varchar 64, nullable) + `users.external_subject` (varchar 255, nullable); add partial unique index on `(tenant_id, external_idp, external_subject) WHERE external_subject IS NOT NULL`. PoC seeded users keep `password_hash` set and `external_idp` / `external_subject` null.
- `PasswordAuthenticator` rejects users whose `password_hash IS NULL` (eID-only accounts cannot password-log-in). `LoginProvider` for OIDC will be the only path that authenticates rows with `external_subject` set — wiring is documented, not built.
- Replace `LoginForm` placeholder handler with a real `useLogin` mutation against `POST /auth/login/password`, honouring `?redirect=` (same-origin pathnames only) and rendering inline failure states (`401` → "Ongeldige inloggegevens" + clear password; network / 5xx → "Er ging iets mis, probeer opnieuw"). Visuals and layout MUST NOT change.
- **BREAKING (internal frontend):** align `apps/orchestrator/src/modules/auth/schemas.ts` `SessionUser` to the backend contract (`display_name`, `tenant_id`, single `role`); rename the form field from `username` to `email` with `z.string().email()` validation.
- Swap `apps/orchestrator/src/modules/auth/api.ts` from hand-rolled `fetch` to the shared `openapi-fetch` client so the auth surface is typechecked against the regenerated `schema.d.ts`.
- Add `apps/orchestrator/src/modules/auth/providers.ts` — a typed registry that maps provider `kind` to a render strategy. PoC renders only the `password` strategy (existing form). The login screen mounts strategies in the order returned by `GET /auth/providers`; an empty array renders an explicit error state.
- Update MSW handlers (`mocks/handlers/auth.ts`) to mirror the new contract (`POST /auth/login/password`, `GET /auth/providers`, `display_name` / `tenant_id` / `role`).
- Add a structured **login audit log** (success + failure, timestamp, user id when known, IP, provider key) written from the auth router. PoC implementation = structured stdout log line with a stable event name (`auth.login.success` / `auth.login.failure`); MVP promotes it to a queryable `auth_audit` table (`BL-042`). GDPR Art 32 + eHealth deontological code require authentication-event logging on regulated systems.
- Add **PII discipline for `external_subject`**: spec requires storing the IdP-issued opaque subject (`sub` from CSAM / itsme® / eID broker), never the raw Belgian RRN (Rijksregisternummer). Storing RRN would require Sectoral Committee authorization under Wet 8 augustus 1983; the broker (NewWave Care) keeps RRN on its side. The spec carries the constraint so future providers cannot drift.
- Add **production cookie hardening**: when `Settings.env == "production"`, the session cookie name MUST be prefixed `__Host-` (`__Host-BACKEND_SESSION`). The `__Host-` prefix is honoured by browsers as an extra binding (Secure + Path=/ + no Domain attribute), hardening against subdomain cookie injection. Non-production keeps the unprefixed name so local + Vitest stay unchanged.
- Add a **production boot guard for the seeded password fallback**: `scripts/seed_users.py` MUST refuse to run when `BACKEND_ENV=production` and `BACKEND_BOOTSTRAP_*_PASSWORD` is unset (analogous to the existing session-secret guard). The `"changeme"` fallback is PoC-only.

## Capabilities

### New Capabilities

_None._ The seam pieces (`LoginProvider`, providers endpoint, provider registry) land as requirements added to the existing capabilities below — they are extensions to auth surface, not a new capability category.

### Modified Capabilities

- `auth-stub`: route rename to provider-namespaced layout, new `GET /auth/providers`, `LoginProvider` Protocol contract, nullable `password_hash` semantics, reserved (unimplemented) OIDC start / callback route shape.
- `auth-session`: replace placeholder handler with real wiring, align `SessionUser` to backend, contract through `openapi-fetch`, add provider discovery + provider-keyed render strategy, `?redirect=` honour + inline failure UX, visuals-unchanged guarantee.
- `user-base`: `password_hash` becomes nullable; add `external_idp` (varchar 64, nullable) + `external_subject` (varchar 255, nullable); add partial unique index `(tenant_id, external_idp, external_subject) WHERE external_subject IS NOT NULL`; bootstrap seed unchanged.

## Impact

- **Backend (`apps/backend`)**: new `app/services/auth/providers/` package (`base.py` Protocol, `password.py` impl, `registry.py` enumeration); refactored `app/api/routers/auth/auth_router.py` route shape; new `app/schemas/auth/providers.py`; updated `app/services/auth/auth_service.py` to dispatch via the provider registry; updated `app/services/auth/authenticator.py` to reject null `password_hash`; new alembic revision under `apps/backend/alembic/versions/`; updated `app/db/models/user/user.py`; updated `app/repositories/user/user_repository.py` if a lookup by `(external_idp, external_subject)` lands now (it does not — only the seam ships).
- **Backend tests**: new tests for `LoginProvider` dispatch, `GET /auth/providers`, password rejection when `password_hash IS NULL`, migration up/down round-trip.
- **Frontend (`apps/orchestrator`)**: `modules/auth/{api,hooks,schemas,keys,providers,guard}.ts`, `modules/auth/components/LoginForm.tsx`, `routes/login.tsx`, `mocks/handlers/auth.ts`, `lib/i18n/locales/nl/auth.json`, new tests under `modules/auth/components/` + `tests-e2e/`. Regenerated `src/lib/api/schema.d.ts`.
- **Demo runbook**: `apps/orchestrator/README.md` (or equivalent) gains a "Demo login" note (`caregiver@zas.local` + `BACKEND_BOOTSTRAP_CAREGIVER_PASSWORD` env or `changeme` fallback).
- **MVP follow-on (deferred, NOT in this change)**: an `oidc-login-providers` change adds concrete `EidLoginProvider` / `ItsmeLoginProvider` / `CsamLoginProvider` implementations + `/auth/login/{provider}/start` + `/callback` handlers, IdP secrets in settings, and frontend redirect dispatch for `kind === 'oidc'` providers. Tracked under BL-035 residue + the new backlog items BL-042..BL-049 filed by this change.

## Compliance posture

This change ships the F1 PoC end-to-end against the existing backend AND introduces the seam for Belgian IdPs (eID / itsme® / eHealth / CSAM). It is *not* the MVP compliance package — that lives in a coordinated set of follow-on changes. To stop knowledge from rotting in conversation, this proposal records the in-this-change posture vs. open gaps.

**In this change (PoC, compliance-aware):**

- Argon2id password hashing (OWASP-current).
- `HttpOnly`, `SameSite=Lax`, `Secure` (prod), signed cookie via `itsdangerous` with 8h max-age.
- `__Host-` cookie prefix in production (subdomain-injection hardening).
- Production startup guards: session secret default rejected; bootstrap seed passwords required.
- Structured login audit log (success + failure) writable to stdout in PoC; promoted to `auth_audit` table at MVP.
- User schema accommodates IdP-delegated identity without password (`external_idp`, `external_subject`) without requiring it now.
- `LoginProvider` Protocol owns route shape so the MVP swap is additive, not destructive.
- Spec forbids storing the Belgian RRN; only IdP-issued opaque `sub` lands in `external_subject`.

**MVP gaps (filed as BL-NNN, not in this change):**

- `BL-042` server-side session revocation (sessions table + cookie carries opaque session id, not user id).
- `BL-043` brute-force rate limiting + account lockout on `POST /auth/login/password`.
- `BL-044` MFA / strong auth: delegated to itsme® / eID (LoA High); password-only path locked to non-clinical roles or removed.
- `BL-045` RP-initiated logout (call IdP `end_session_endpoint`).
- `BL-046` DPIA pointer + skeleton (`docs/compliance/dpia.md`) for GDPR Art 35 obligation.
- `BL-047` SMART-on-FHIR bearer-token auth path on `/fhir/*` routes (cookies + bearer side-by-side).
- `BL-048` OIDC hardening requirements: PKCE, `state`, `nonce`, JWKS signature, `iss` + `aud` + `exp` validation. Filed against the future `oidc-login-providers` change.
- `BL-049` Password reset / credential lifecycle (or full delegation to IdP if the password provider is retired at MVP).

The MVP gaps are NOT compliance violations today: the PoC ships against synthetic data only (project-wide invariant — `openspec/project.md` Important Constraints). They become blockers the moment any real patient data touches the system, which is also the moment IdP integration is required by ZAS / eHealth Platform regardless.
