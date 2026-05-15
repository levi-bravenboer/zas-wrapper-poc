## Context

F1 Login is the PoC's only entry point. The backend already implements a working email + password auth surface (`auth-stub` spec, `app/api/routers/auth/auth_router.py`, `app/services/auth/`): `POST /auth/login` accepts `{ email, password }`, mints a signed `BACKEND_SESSION` cookie via `itsdangerous.URLSafeTimedSerializer`, exposes `GET /auth/me` and `POST /auth/logout`, ships `CurrentUserDep`, allows credentials in CORS, and seeds `admin@zas.local` + `caregiver@zas.local`. The frontend (`apps/orchestrator`) ships the `/login` screen, the `/_auth` TanStack Router layout guard, `modules/auth/{api,hooks,schemas,keys,guard}.ts`, and a styled `LoginForm` — but the form's submit handler is a placeholder (BL-035 carve-out) that fakes a session in the React Query cache and never talks to the backend.

The MVP target is Belgian IdPs: eID, itsme®, eHealth, CSAM. All four are OIDC (or OIDC-shaped) redirect flows: browser → `GET /auth/login/{provider}/start` → 302 to IdP → IdP authenticates the user → 302 back to `GET /auth/login/{provider}/callback?code=...&state=...` → backend exchanges code for tokens → backend mints the same session cookie → 302 to the post-login destination. This shape is *not* a form POST returning JSON. The credential check is not the swap point — the route surface is.

`AuthService` is already provider-agnostic for everything after credential verification: it mints + verifies cookies and re-loads `SessionUser` rows. The `Authenticator` Protocol is a swap point for credential verification *within a form-POST flow*. Neither abstraction covers route shape, so today's `POST /auth/login` is the actual MVP friction point.

The PoC has one tenant (`zas`); multi-tenant provider config is `[mvp]`. eID subjects (`R-number` / SSIN) and itsme® subjects (issuer + sub) are external identifiers that need a home on the `User` row before any OIDC provider can land — adding two nullable columns now is one alembic migration; doing it later means a second migration that double-touches the same hot table.

## Goals / Non-Goals

**Goals:**

- One end-to-end working PoC login path: `caregiver@zas.local` + seeded password lands on `/`, survives refresh, logs out cleanly.
- Provider-namespaced route layout so adding eID / itsme® / CSAM at MVP is *additive*, never a rename.
- `GET /auth/providers` drives the login screen — adding a provider at MVP means appending a registry entry + an alembic seed, not editing the frontend's login route component.
- `User` row supports both password-authenticated and IdP-authenticated identities without a second migration. PoC populates the password fields; MVP populates the external fields; the row is the same row.
- Session model unchanged: one signed cookie, provider-agnostic. eID subjects do not leak into the cookie.
- Frontend login screen behaviour wires up against the real backend; visuals and layout unchanged from the BL-035 carve-out.

**Non-Goals:**

- Any concrete OIDC provider implementation. No eID / itsme® / CSAM client code, no IdP-side configuration, no JWKs verification, no PKCE handling. Seams only.
- Multi-tenant provider configuration. PoC ships a single provider registry hard-coded per tenant.
- Role mapping from IdP claims. Deferred to the future `oidc-login-providers` change.
- Linking flows (existing password user adopts eID). Deferred.
- Real IdP secrets management or settings shape. Deferred.
- Patient-facing auth (`HiX Patient Portal`, future Luscii subject auth). Out of PoC scope.
- "Remember me", MFA, rate limiting, lockouts. None in PoC.

## Decisions

### `LoginProvider` Protocol is the seam, not `Authenticator`

`Authenticator` (in `app/services/auth/authenticator.py`) abstracts "given a credential, return a `User`". That is the wrong granularity for OIDC: OIDC has two HTTP touchpoints (`start`, `callback`) and a redirect dance the credential check does not model. The new `LoginProvider` Protocol owns the route handlers:

```python
class LoginProvider(Protocol):
    key: str               # 'password', 'eid', 'itsme', 'csam'
    label: str             # human-readable for the provider list endpoint
    kind: Literal['password', 'oidc']
```

Per-kind methods land on concrete classes (PoC has only `PasswordLoginProvider` with `async authenticate(...) -> SessionUser`; OIDC providers will add `async start(...) -> RedirectResponse` and `async callback(...) -> SessionUser`). The router wires concrete provider methods into concrete routes — there is no `kind`-dispatch sprawl at the router level, just one route per (provider × method) pair.

Alternatives considered:

- **Unify under one `login(request) -> Response` Protocol** that returns either JSON or a redirect. Rejected: leaks HTTP concerns into the service layer, makes the password path's JSON response harder to type, and Python typing on heterogeneous responses is noisy.
- **Skip `LoginProvider`; keep `Authenticator` and add ad-hoc routes for OIDC later**. Rejected: defers exactly the design decision this change is about. The whole point is that the route shape is the swap point.

### Route namespace is `/auth/login/{provider_key}` (and `/{method}` for OIDC)

PoC: `POST /auth/login/password`. MVP (reserved, NOT implemented): `GET /auth/login/{provider}/start`, `GET /auth/login/{provider}/callback`. The provider key is the URL segment, not a query parameter. Reason: REST-shaped, gives each provider its own OpenAPI operation id (`login_password`, future `start_login_eid`, `callback_login_eid`), and keeps router code one-handler-per-route instead of a single handler that switches on `?provider=`.

`GET /auth/me` and `POST /auth/logout` stay un-namespaced because they are provider-agnostic. The session cookie holds only the `user_id`; nothing in the cookie or the session-read path needs to know which provider minted it.

### `GET /auth/providers` is the discovery endpoint

Frontend reads `[{ key, label, kind }]` and renders a strategy per entry. Reason: adding a provider at MVP becomes a one-line backend registry change + a frontend strategy implementation, with zero changes to the route component. The endpoint is unauthenticated (the list is non-sensitive: it is implied by the login screen) and is the first request the login screen issues.

PoC payload (concrete):

```json
[{ "key": "password", "label": "E-mail + wachtwoord", "kind": "password" }]
```

MVP-shape payload (illustrative, not shipped):

```json
[
  { "key": "itsme", "label": "Aanmelden met itsme®", "kind": "oidc" },
  { "key": "eid",   "label": "Aanmelden met eID",     "kind": "oidc" },
  { "key": "password", "label": "E-mail + wachtwoord", "kind": "password" }
]
```

### `User.password_hash` becomes nullable; add `external_idp` + `external_subject`

OIDC-authenticated rows have no password. Today's `users.password_hash` is `NOT NULL`. Migration drops `NOT NULL` on `password_hash` and adds two columns:

- `external_idp` (`VARCHAR(64)`, nullable) — provider key, e.g. `'itsme'`, `'eid'`, `'csam'`. Constrained at the application layer to known provider keys; not a Postgres enum (so adding a provider at MVP doesn't need an enum migration).
- `external_subject` (`VARCHAR(255)`, nullable) — the IdP-issued subject identifier (itsme® `sub`, eID `R-number` / SSIN, CSAM `sub`).

A partial unique index `(tenant_id, external_idp, external_subject) WHERE external_subject IS NOT NULL` guarantees one external identity per tenant. The existing `(tenant_id, lower(email))` unique index stays — both keys coexist; either OR both can match a row.

CHECK constraint `(password_hash IS NOT NULL) OR (external_subject IS NOT NULL)`: every user has at least one way to authenticate. Enforced at the DB layer because the alternative (application-layer invariant) is the kind of thing that gets bypassed during fixture creation in tests.

Alternatives considered:

- **Separate `user_external_identities` table.** Defensible if we expect multi-IdP linking (one user, multiple IdPs). PoC and MVP have a 1:1 mapping. Premature normalization; revisit when a real linking story lands.
- **Stash `external_*` in a JSONB column.** Loses the unique constraint, defers schema decisions that the OIDC provider work needs anyway.

### `PasswordAuthenticator` rejects null `password_hash`

`PasswordAuthenticator.authenticate(email, password)` already returns `None` for inactive users and password mismatches. It now also returns `None` for rows whose `password_hash IS NULL`. Reason: an eID-only user must not be able to log in via the password route by virtue of the lookup happening to find them.

### Frontend provider registry mounts strategies

`modules/auth/providers.ts` exports a strategy map keyed by `kind`:

```ts
const strategies: Record<ProviderKind, ProviderStrategy> = {
  password: PasswordStrategy,
  // oidc: OidcRedirectStrategy — added by the MVP change
}
```

The login route component does:

```tsx
const { data: providers } = useProviders()
return providers.map((p) => <strategies[p.kind] key={p.key} provider={p} />)
```

PoC ships only `PasswordStrategy` (the existing `LoginForm`). MVP adds `OidcRedirectStrategy` which renders a button that `window.location.assign(/auth/login/{key}/start)`s on click. No route-component edits at MVP.

When PoC's provider list contains exactly one entry of `kind === 'password'`, the screen renders the same form layout it does today. The strategy-list rendering becomes visible only when a second provider lands — at which point the existing visual is the password block, unchanged.

### `?redirect=` validation

`routes/login.tsx` already parses `redirect` as `z.string().optional()`. On successful login (any provider), the destination is computed by an inline `safeRedirect(raw)` helper: returns `'/'` when raw is undefined, does not start with `/`, starts with `//`, contains `\`, or equals `/login`; otherwise returns raw. For PoC's password provider, the navigation happens in the mutation's `onSuccess`. For future OIDC providers, the redirect target is round-tripped via the OIDC `state` param (out of scope here, documented in the deferred change).

### Cookie security flags unchanged

The session cookie keeps `HttpOnly=True`, `SameSite=Lax`, `Path=/`, `Secure=True` only in production. Reason: `SameSite=Lax` is required for the OIDC callback to retain the cookie across the redirect from the IdP back to the backend. `Strict` would drop it. Already correct; calling it out so a future change does not "harden" it into broken.

### Inline failure UX, no toast

`LoginForm` keeps a local `error: 'invalid' | 'unknown' | null`. `401` from `POST /auth/login/password` → `'invalid'` + clear password field. Anything else → `'unknown'`. Errors render in a `<p role="alert">` directly under the submit button (text only, no shadcn `Alert` primitive — keeps the existing layout intact for the BL-035 visuals-unchanged guarantee).

### Re-typegen gates the swap

`moon run orchestrator:typegen` runs against a backend with the new route shape before `api.ts` swaps to `openapi-fetch`. The regenerated `schema.d.ts` is committed in this change. Reason: the swap is meaningless without the contract source-of-truth; CI typecheck is the canary.

### Demo credential

`caregiver@zas.local` + `BACKEND_BOOTSTRAP_CAREGIVER_PASSWORD` (fallback `changeme`). Documented in `apps/orchestrator/README.md`. No real patient data invariant means a known-weak demo credential is not a leak risk.

## Risks / Trade-offs

- **[Risk] Breaking `POST /auth/login` route name affects any code that already calls it** → Mitigation: grep the monorepo for `/auth/login` string before the rename. Today only `modules/auth/api.ts`, MSW handler, and backend tests reference it. All three are edited in this change.
- **[Risk] `password_hash` going nullable could mask a buggy insert path that forgets the field** → Mitigation: DB CHECK constraint `(password_hash IS NOT NULL) OR (external_subject IS NOT NULL)`; `PasswordHasher.hash` continues to be called explicitly in `scripts/seed_users.py`.
- **[Risk] `LoginProvider` Protocol is dead weight in PoC (one implementation)** → Mitigation: the Protocol itself is ~15 LOC. The registry is ~10 LOC. The routes are one-handler-per-route regardless. The cost is small; the alternative — a second auth-shape rewrite at MVP — is large.
- **[Risk] Frontend strategy registry adds indirection users don't see in PoC** → Mitigation: `providers.ts` is ~30 LOC total. The login route component becomes shorter (`providers.map(...)` instead of `<LoginForm />`). Real cost is one extra file in `modules/auth/`.
- **[Risk] `GET /auth/providers` adds a request to the critical path** → Mitigation: cached as `staleTime: Infinity` in the React Query layer; provider list does not change without a deploy. The login screen renders a skeleton until the providers resolve (~10ms in PoC, single in-process backend response).
- **[Risk] Same-origin redirect check is hand-rolled** → Mitigation: keep the check tight (must start with `/`, no `//`, no `\`, no `/login`); TanStack Router rejects malformed `to` anyway.
- **[Risk] OIDC implementation work could find this seam wrong** → Mitigation: this change explicitly does not ship OIDC code, only the route namespace + provider registry. If the MVP work finds the namespace shape wrong, that is one route rename (and a corresponding `auth-stub` delta) — not a re-architecture.
- **[Trade-off] No retry on transient 5xx** → Accepted for PoC. The form re-submits idempotently.

## Migration Plan

This change reshapes a route that has been called exactly never (placeholder bypass), reshapes a table whose only consumers are this repo, and adds discovery + provider routes that nobody depends on yet. The blast radius is the worktree itself.

1. Run backend locally (`moon run :up`) with seed users.
2. Author alembic migration (`moon run backend:make-migration "add external idp fields to users"`); inspect autogenerated SQL; ensure CHECK constraint + partial unique index are present.
3. `moon run backend:migrate`; confirm seeded rows still pass (`SELECT * FROM users` shows `password_hash` set, `external_*` null).
4. Land backend code changes (`LoginProvider` Protocol, `PasswordLoginProvider`, registry, router refactor, `GET /auth/providers`).
5. Run `moon run backend:test`; resolve fallout (existing auth tests will need their POST URL updated).
6. Regenerate `schema.d.ts` (`moon run orchestrator:typegen`); commit alongside the frontend changes.
7. Apply frontend changes (schemas align, `api.ts` swap, providers registry, LoginForm wiring, MSW update, i18n).
8. Run `moon run orchestrator:typecheck` / `lint` / `format` / `test` / `test-e2e`.
9. Manual smoke via the running orchestrator + backend.

Rollback: revert the merge commit. No data migration to reverse beyond the alembic `downgrade`, which is autogenerated and round-trips clean.

## Open Questions

- Should `GET /auth/providers` honour an `Accept-Language` header for `label` values, or do we ship NL-only and translate client-side from `key`? Default: ship NL labels in the payload (matches the single-locale PoC) and revisit when a second locale lands.
- Do we want to seed an inactive eID-shaped user now (just to exercise the CHECK constraint), or wait for the OIDC change to add fixtures? Default: do not seed; the CHECK constraint is tested in the migration's pytest fixture instead.
- `password_hash` nullability changes the `User.password_hash` Python type from `str` to `str | None`. Any non-auth consumer of this field today? Grep says no (only `PasswordAuthenticator` and the seed script read it). If a future caller appears, it must handle the optional.
