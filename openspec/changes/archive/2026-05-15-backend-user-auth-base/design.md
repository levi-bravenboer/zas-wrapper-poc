## Context

Backend has a stub auth surface (`auth-stub` spec) defined but unimplemented, plus a freshly-proposed `tenants` table (`backend-tenant-base`). No `users` table, no `auth_service.py`, no role primitive. PoC needs `F1 Login` to power every clinician-facing route and `F8 Admin` to assign caregiver role — both require a real user row with a stable `role` and a `tenant_id` FK.

Constraints:

- Existing layer rules forbid `app/db/models/*` ↔ `app/schemas/*` cross-imports, so shared types (the `Role` enum) cannot live in either.
- `auth-stub` already specifies signed cookie + `itsdangerous` + 8h TTL + `BACKEND_SESSION` cookie name. We keep all of that.
- MVP swaps password auth for Belgian eID (NewWave Care). Whatever interface we ship in PoC must let an `EidAuthenticator` slot in without breaking call sites.
- Postgres-native enums in Alembic are a known landmine (autogen misses `CREATE TYPE` / `ALTER TYPE ADD VALUE`); `alembic-postgresql-enum` is the consensus fix.
- Single tenant in PoC (`zas`), but every future domain (`pathway`, `patient`, `task`) will FK to `tenants` and scope on `current_user.tenant_id`, so the dep + scoping shape we ship here propagates everywhere.

Stakeholders: this change (backend), every subsequent backend domain (consumer of `CurrentUserDep` + `require_role`), the orchestrator frontend (consumer of `SessionUser` shape — out of scope but contract matters), and MVP eID work (consumer of `Authenticator` Protocol).

## Goals / Non-Goals

**Goals:**

- Persist users in the DB with a hospital scope (`tenant_id` FK).
- Land a single canonical `Role` enum reachable from both ORM and Pydantic layers without violating the seam.
- Provide a thin admin surface (`GET /users`, `PATCH /users/{id}/role`) to satisfy F8.
- Provide `CurrentUserDep` + `require_role(Role)` so subsequent domains can opt in to auth without reinventing it.
- Shape `AuthService` behind an `Authenticator` Protocol so MVP eID slots in without call-site churn.
- Keep migrations sane against Postgres-native enums.

**Non-Goals:**

- Self-service signup, password reset, MFA, email verification.
- Multi-tenant scoping middleware / contextvar plumbing / Postgres RLS — handled in a later hardening change.
- eID integration. Only the Protocol seam lands here.
- Frontend wiring. Orchestrator picks this up in a follow-up.
- Tenant CRUD admin. Tenants stay seed-only in PoC.
- Audit log for role changes. Logged via `app.core.logging` only; durable audit table is post-PoC.

## Decisions

### `User` inherits `TenantOwnedEntity`; bootstrap admin self-references audit FKs

`User(TenantOwnedEntity)` picks up the abstract-base hierarchy introduced in `backend-tenant-base`: id, timestamps, soft delete, `tenant_id` (NOT NULL), `created_by` / `updated_by` (NOT NULL, FK `users.id`), `deleted_by` (nullable, FK `users.id`). The `users.id`-FK is self-referential — that is the whole point — and `ON DELETE RESTRICT` on every FK ensures no row vanishes underneath an audit reference.

The bootstrap admin breaks the chicken-and-egg this creates: a fresh DB has zero `users` rows, so the very first insert cannot satisfy the `created_by` NOT NULL constraint via the audit hook (the hook needs an actor; the actor needs a row). `scripts/seed_users.py` solves this by:

1. Defining `ADMIN_USER_ID: UUID = UUID("<stable literal>")` at module level.
2. Looking up the `zas` tenant (must already be seeded).
3. Checking whether a user with the admin's `(tenant_id, lower(email))` exists; if so, no-op.
4. Otherwise, constructing the admin `User` ORM instance with `id = ADMIN_USER_ID`, `tenant_id = ZAS_TENANT_ID`, AND `created_by = updated_by = ADMIN_USER_ID` set explicitly. The audit hook skips fields that are already non-`None`, so the self-FK survives the flush. The DB enforces `RESTRICT`; the self-FK is valid because the row's own `id` matches the FK value at commit time.
5. Building an in-process `SessionUser` from the just-inserted admin and calling `script_session(actor=admin_session_user)` (or rebinding `session.info[SESSION_ACTOR_KEY]`) for the demo caregiver insert. The audit hook auto-fills `tenant_id` / `created_by` / `updated_by` from the admin actor — no explicit per-field wiring at the caller.

- **Why self-reference, not nullable `created_by`**: nullable defeats the FK guarantee at exactly the place we want the strongest invariant. A self-FK is a one-off pattern documented at the seed script — every other auditable row in the system has a real actor.
- **Why the admin row, not a synthetic "system" row**: PoC has a single tenant and a single admin; a separate "system" user adds noise and a "who can change this" question. When multi-tenant lands, the same admin-bootstrap pattern repeats per tenant.

### Tenant + audit auto-fill via `session.info[SESSION_ACTOR_KEY]`

The audit hook introduced in `backend-tenant-base` (`apps/backend/app/db/audit.py`) is the source of truth for stamping `tenant_id` / `created_by` / `updated_by` / `deleted_by`. This change wires the actor into `session.info` at every entry point:

- **HTTP**: `app/db/engine.get_session` consumes `OptionalCurrentUserDep` (silent when no cookie / expired token) and writes `session.info[SESSION_ACTOR_KEY] = current_user` when truthy. Authenticated routes therefore audit automatically; unauthenticated routes (login, health) flush rows that are NOT `AuditableEntity` (or none at all).
- **Scripts**: `scripts/_db.script_session(*, actor=None)` writes the slot when supplied. `seed_users` calls `script_session()` (no actor) for the admin self-bootstrap, then `script_session(actor=admin)` (or rebinds via `session.info[SESSION_ACTOR_KEY] = admin`) for the caregiver insert.
- **Tests**: the `session_actor` pytest fixture (introduced in `backend-tenant-base`) is set to a `SessionUser` in tests that exercise auditable row creation. Router-layer tests rely on the login flow producing a valid cookie and therefore set the actor through the HTTP path.

- **Why not put audit logic inside `UserService`**: every domain that creates auditable rows would need the same boilerplate. Centralising at the session boundary fixes it once.
- **Why `OptionalCurrentUserDep`, not `CurrentUserDep`, in `get_session`**: `get_session` runs for every request, including unauthenticated ones. A required dep would block `/auth/login`. The optional shape lets the slot stay `None` for unauthenticated traffic; required-auth routes still use `CurrentUserDep` and get 401 enforcement.

### Role enum lives at `app/core/enums/user.py`

`class Role(StrEnum)` with `ADMIN = "admin"`, `CAREGIVER = "caregiver"`, `EXTERNAL = "external"`. Re-exported from `app/core/enums/__init__.py`.

Role semantics (load-bearing for downstream domain wiring):

- `admin` — ZAS-internal operator. Owns user management (`F8`) and any future tenant-admin surface. Not a clinical role.
- `caregiver` — ZAS-internal clinician. Has both the web app (this orchestrator) and the hospital EHR (HIX) as work surfaces. Downstream pathway / patient routes assume HIX writeback may happen.
- `external` — Non-ZAS clinician (e.g. home-care nurse, partner-clinic caregiver). Caregiver-equivalent **on the web app only** — no HIX integration. Domain routes that need HIX writeback MUST gate on `role == caregiver`, not "any clinician role"; routes that only touch ZAS-side state MAY accept both `caregiver` and `external`.

`assign_role` MUST permit every transition — `external` is a first-class working role, not an "offboard" state. There is no special-case logging or block for the `external` transition.

- **Why**: only neutral location both `app/db/models/user/user.py` (ORM) and `app/schemas/auth/auth.py` / `app/schemas/user/user.py` (Pydantic) can import without breaking the layer seam. Single Python `Enum` ⇒ single Postgres `CREATE TYPE` ⇒ no drift.
- **Alternative — co-locate with ORM model**: forces `app/schemas/*` → `app/db.*`, which is a hard rule violation.
- **Alternative — duplicate in each layer**: produces two enum types, breaks `isinstance`, breaks Postgres native enum identity.
- **Alternative — new `app/domain/<name>.py` layer**: cleanest DDD shape but pays AGENTS.md amendment cost for one enum. Promote later when value objects appear.

### Postgres-native enum with `alembic-postgresql-enum`

ORM column is `Mapped[Role] = mapped_column(sa.Enum(Role, name="role", native_enum=True, create_constraint=True))`. `alembic_postgresql_enum` is imported in `alembic/env.py` (import side-effect registers autogen hooks).

- **Why**: native enum keeps domain invariants in the schema; the helper package neutralizes Alembic's known native-enum autogen gaps (refs: `sqlalchemy/alembic#278`, `#1254`, `#796`).
- **Alternative — `VARCHAR` + CHECK**: cheaper migration, drift-free, but loses Postgres-side enum identity used by joins, casts, and tooling. Healthcare-grade DB hygiene argues against.
- **Alternative — `native_enum=False` (sa-side check constraint only)**: half-measure; we either commit to native enums or skip them.

### Identity field is `email`, unique per `(tenant_id, lower(email))`

`email: VARCHAR(255)` (citext is not installed; we enforce case-insensitive uniqueness via a functional unique index `UNIQUE (tenant_id, lower(email))`).

- **Why**: eID claim carries an email; aligning now avoids a migration when MVP plugs in `EidAuthenticator` and needs to match incoming claims to existing rows.
- **Alternative — `username`**: matches the current `auth-stub` spec but throws away the migration alignment with eID. Existing spec hasn't been implemented yet, so the rename has zero call-site cost today.
- **Alternative — `citext` extension**: avoids the `lower()` index, but extension management costs more than the functional-index pattern saves at PoC scale.

### Passwords use `argon2-cffi` via a `PasswordHasher` wrapper

`app/services/auth/password.py` exposes `class PasswordHasher: def hash(plain) -> str; def verify(hashed, plain) -> bool`. Wraps `argon2.PasswordHasher` so the dependency surface is narrow and swappable.

- **Why**: argon2 is the current OWASP-recommended algorithm; `argon2-cffi` is the de-facto Python binding; wrapper makes the hasher injectable into `AuthService` (testable via fakes).
- **Alternative — `passlib[bcrypt]`**: passlib is in maintenance mode and triggers deprecation warnings on Python 3.13. Avoid.

### `Authenticator` Protocol seam

```python
# app/services/auth/authenticator.py
class Authenticator(Protocol):
    async def authenticate(self, *, email: str, password: str) -> User | None: ...
```

`PasswordAuthenticator(repo: UserRepository, hasher: PasswordHasher)` is the PoC impl. `AuthService(authenticator: Authenticator, settings: Settings, repo: UserRepository)` takes the Protocol — not the impl — by constructor.

- **Why**: MVP `EidAuthenticator` (different inputs, different verification path) can implement the same Protocol or a parallel one without touching `AuthService` callers. The seam is at the right altitude — the cookie / session lifecycle is provider-agnostic.
- **Open**: when eID lands, the input signature changes (claim payload, not `email/password`). At that point we'll widen the Protocol to a discriminated `AuthCredential` union or split it into provider-specific methods. Out of scope here.

### Session shape: cookie carries `{user_id, exp}`; user re-loaded each request

Cookie payload stays minimal (just `user_id`, signed with `itsdangerous`). `get_current_user` looks up the User by id on every request and rejects when `is_active is False`.

- **Why**: deactivation / role change takes effect immediately; cookie can't go stale. One indexed PK lookup per request is cheap. Defends against the most common "I revoked them but they still had a cookie" issue.
- **Alternative — embed role + tenant_id in cookie**: faster (no DB hit) but role changes only take effect on next login. Worse UX for admin role assignment.

### `SessionUser` Pydantic DTO carries `tenant_id` + `role`

`SessionUser { id: UUID, email: EmailStr, display_name: str, tenant_id: UUID, role: Role }`. Returned from `POST /auth/login`, `GET /auth/me`. Frontend uses it for UI gating; backend services receive it via `CurrentUserDep`.

- **Why**: gives every downstream router `current_user.tenant_id` for explicit-param scoping (the seam we agreed on in brainstorm) and `current_user.role` for the `require_role(...)` dep — both in one object, no extra DB lookups in handler code.

### Tenant scoping enforced by **explicit param** through repos

Every multi-tenant repo method takes `tenant_id` as an arg (e.g., `UserRepository.list_in_tenant(tenant_id)`). Services pass `current_user.tenant_id` from the dep. No contextvars, no RLS.

- **Why**: single tenant in PoC means scoping bugs are unobservable today; explicit param survives the refactor when multi-tenant lights up and pairs naturally with `with_loader_criteria` defense-in-depth at MVP without churning call sites.

### Admin role assignment is cross-tenant-blocked, self-allowed

`UserService.assign_role(actor: SessionUser, target_user_id: UUID, role: Role)` raises:

- `CrossTenantAccessError` (403) if `target.tenant_id != actor.tenant_id`.
- `UserNotFoundError` (404) if no row matches `target_user_id`.

Self-targets are permitted — an admin may demote themselves, even when they are the last active admin in the tenant. The resulting lockout is recoverable only via direct DB write, and we accept that trade-off for the PoC.

- **Why**: PoC has a single admin (`admin@zas.local`). A "last-admin" guard adds a per-call `count(role=admin, is_active=true)` query and a bespoke error code for a scenario the PoC ops surface (CLI + psql access) can fix in seconds. The interesting safety check — "is the **caller** still admin on the **next** request?" — is already covered by `get_current_user` re-loading the row each request, so the freshly-demoted admin just loses access on their next call. No stale-cookie escalation possible.
- **Open**: when multi-admin lands at MVP, revisit. A "last-admin lockout" guard belongs in the same change that introduces a second admin user.

### Module layout

```
app/core/enums/
  __init__.py                 # re-exports Role (and future enums)
  user.py                     # class Role(StrEnum)

app/db/models/user/
  __init__.py
  user.py

app/repositories/user/
  __init__.py                 # UserRepository, UserRepoDep
  user_repository.py
  deps.py

app/services/auth/
  __init__.py                 # AuthService, AuthServiceDep, CurrentUserDep, require_role
  auth_service.py
  authenticator.py            # Authenticator Protocol, PasswordAuthenticator
  password.py                 # PasswordHasher wrapper
  errors.py                   # InvalidCredentialsError, UnauthenticatedError, etc.
  deps.py

app/services/user/
  __init__.py
  user_service.py
  errors.py                   # CrossTenantAccessError, UserNotFoundError
  deps.py

app/schemas/auth/
  __init__.py
  auth.py                     # LoginRequest, SessionUser

app/schemas/user/
  __init__.py
  user.py                     # UserRow, AssignRoleRequest

app/api/routers/auth/
  auth_router.py              # POST /auth/login, GET /auth/me, POST /auth/logout

app/api/routers/user/
  user_router.py              # GET /users, PATCH /users/{user_id}/role
```

### Errors

All subclass `app.services.errors.AppError`. Codes follow the FHIR-IssueType pattern from AGENTS.md:

| Error | Code | HTTP |
| --- | --- | --- |
| `InvalidCredentialsError` | `security.auth.invalid_credentials` | 401 |
| `UnauthenticatedError` | `security.auth.unauthenticated` | 401 |
| `ForbiddenRoleError` | `forbidden.auth.role` | 403 |
| `UserNotFoundError` | `not-found.user.not_found` | 404 |
| `CrossTenantAccessError` | `forbidden.user.cross_tenant` | 403 |

### MVP eID path (planned reshape, not in this change)

When Belgian eID lands, the PoC `Authenticator` Protocol will not fit — eID does not produce `(email, password)`. Documented here so the seam is intentional, not accidental.

Expected reshape in the MVP change:

1. Introduce a discriminated `AuthCredential` union in `app/services/auth/credentials.py`:
   ```python
   class PasswordCredential(BaseModel):
       kind: Literal["password"] = "password"
       email: EmailStr
       password: SecretStr

   class EidCredential(BaseModel):
       kind: Literal["eid"] = "eid"
       rrn: str                    # Belgian national register number
       assertion: str              # signed eID assertion / SAML response opaque blob
       # ...additional claim fields per NewWave Care contract

   AuthCredential = PasswordCredential | EidCredential
   ```
2. Widen the Protocol to take the union: `async def authenticate(self, *, credential: AuthCredential) -> User | None`. Concrete impls (`PasswordAuthenticator`, `EidAuthenticator`) `match` on `credential.kind` or reject mismatched kinds.
3. `AuthService.login` accepts `AuthCredential` instead of `(email, password)`; router has two POST endpoints (`/auth/login` for password, `/auth/login/eid` for eID callback) that build the matching `AuthCredential` and call `AuthService.login`.
4. `users.password_hash` becomes nullable (or moves to a sidecar `user_password_credentials` table) when eID-only users start appearing. Backwards-compatible until the column is dropped.
5. `User.identity_provider` column added (`"password" | "eid"`) so the admin UI can see which provider owns a row.

This is a **planned breaking change** to `auth-stub` at MVP — call sites in this PoC change deliberately do not hide behind that future shape. Anything that consumes `Authenticator` today (only `AuthService`) is the single point that must adapt.

## Risks / Trade-offs

- **Risk**: a future domain forgets the `tenant_id` arg on a repo call → cross-tenant leak. **Mitigation**: at PoC scale unobservable; queued: `with_loader_criteria` defense-in-depth as a separate change before MVP. AGENTS.md will get a "tenant-scoped repo methods MUST take `tenant_id`" rule when that change lands.
- **Risk**: bootstrap admin password fallback (`"changeme"`) accidentally ships to a non-PoC environment. **Mitigation**: `# POC ONLY` banner at the top of `scripts/seed_users.py` + the script logs a `WARNING` when the env var is unset. Alembic no longer carries the banner because alembic no longer seeds.
- **Risk**: `argon2-cffi` C extension build issues on certain platforms. **Mitigation**: backend already runs in our own dockerfile based on python:3.13-slim — wheel availability is stable; CI matches.
- **Risk**: `alembic-postgresql-enum` package abandonment. **Mitigation**: it's a tiny shim; we can vendor the 30-line autogen hook if upstream goes stale.
- **Risk**: native Postgres enum makes adding a new role value a 2-step migration (`ALTER TYPE ... ADD VALUE` must run outside a transaction). **Mitigation**: documented; alembic-postgresql-enum handles the boilerplate. Shipping all three values now (including `external`) lets downstream pathway / patient domains gate on the distinction without a follow-up enum migration.
- **Trade-off**: re-loading user every request costs one PK lookup. **Accepted**: correctness > microseconds.
- **Trade-off**: admin self-demotion is permitted with no last-admin guard. **Accepted**: PoC has a single admin and recoverable-by-DB ops surface; last-admin rule lands with multi-admin support at MVP.

## Migration Plan

- Forward sequence: `backend-tenant-base` revision (creates `tenants`) then this change's revision (creates `users` + `role` enum). DDL only — neither revision inserts data.
- Revision `down_revision` MUST point to the `backend-tenant-base` revision hash.
- Rollback: `alembic downgrade -1` drops `users` and the `role` enum type. `alembic-postgresql-enum` handles the `DROP TYPE` op.
- Seed: dev entrypoint runs `alembic upgrade head && python -m scripts.seed_all`; `seed_all` is extended in this change to chain `seed_zas_tenant → seed_users`. Test entrypoint stays migrate-only. Prod deploy is `alembic upgrade head` followed by an explicit `python -m scripts.seed_all` step.
- Re-seed without migration: `moon run backend:seed-users` (or `moon run backend:seed`). Idempotent — looks up each user by `(tenant_id, lower(email))` and skips if present.

## Open Questions

- Should `GET /users` return inactive users? **Decision**: yes — admin needs to see them to reactivate. Add `?active=true|false` filter (default returns all).
- Should `PATCH /users/{user_id}/role` accept a body like `{role: "caregiver"}` or use a sub-route per role? **Decision**: body form. Sub-route per role inflates the surface for no benefit.
- Operation ID for the admin list — `list_tenant_users` vs `list_users`? **Decision**: `list_tenant_users` to make scoping obvious in OpenAPI / generated clients.
