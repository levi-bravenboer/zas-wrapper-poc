## Context

Today's audit machinery (`app/db/audit.py` + `app/db/base.py`):

- `AuditableEntity` adds `created_by` / `updated_by` / `deleted_by` FK columns; `TenantOwnedEntity` adds `tenant_id`.
- `install_audit_hooks()` registers ONE `Session.before_flush` listener that reads `session.info[SESSION_ACTOR_KEY]` and stamps those FK columns on new/dirty auditable rows.
- The actor slot is written by entry points before any flush: HTTP `get_session` (`app/db/engine.py`) resolves the authenticated user and sets `session.info[SESSION_ACTOR_KEY]`; scripts use `script_session(actor=...)`; tests use the `session_actor` fixture.
- Sessions are async (`asyncpg`), `autoflush=False`, `expire_on_commit=False`, auto-commit-on-return / rollback-on-exception unit-of-work. Services and repositories MUST NOT call `commit()`.

This change layers an **append-only event trail** on top of that machinery. It reuses the actor slot and the same `before_flush` listener — no parallel hook, no second session-context mechanism.

## Goals / Non-Goals

**Goals:**
- One append-only `audit_events` table — single source of truth for data-change diffs, authentication events, and explicit domain events.
- Answer from one store: "everything that touched resource X", "everything actor Y did", "the tenant's timeline", "all events of action Z (or all failures) in a time range".
- Automatic data-diff capture for opted-in models with zero per-call code at the write site — riding the change's own transaction.
- One `emit()` helper for explicit domain + auth events, plus a separately-committed variant for security events that must outlive a failed request.
- Fully typed: enums for the closed sets, typed Pydantic payloads for the two jsonb columns.
- A typed, paged, admin-only read API for the (separately built) UI.

**Non-Goals:**
- A UI. Read API only.
- Versioning / revert / time-travel.
- Automatic read/access (SELECT) auditing.
- Retention / partitioning / external forwarding (flagged follow-ups).
- Tamper-evident hash chaining.
- Auditing every model — a starter opt-in set only.

## Decisions

### D1 — `AuditEvent` inherits `Base` directly, not `Entity`

`AuditEvent` is immutable. It must NOT carry `updated_at`, `deleted_at`, or soft-delete — meaningless on an append-only log and an invitation to mutate. It inherits the declarative `Base` directly with an explicit minimal column set.

Consequences:
- Not an `AuditableEntity` → the existing stamp hook ignores it, and the diff hook MUST skip it (never `__audited__`) → no self-recursion.
- Does not participate in `__realtime_resource__` conformance (that targets `Entity` subclasses).

### D2 — Closed sets are enums; the metadata column is `context`

Three Postgres enums (house convention — `app/core/enums/`, `alembic-postgresql-enum`):

```python
class ActorType(StrEnum):
    user = "user"; system = "system"; service = "service"; anonymous = "anonymous"

class AuditAction(StrEnum):              # VERB only — see D3
    created = "created"; updated = "updated"; deleted = "deleted"
    login = "login"; logout = "logout"
    exported = "exported"; published = "published"; access_granted = "access_granted"

class AuditResult(StrEnum):
    success = "success"; failure = "failure"
```

The free-form metadata column is named **`context`**, not `metadata` (`metadata` is reserved on SQLAlchemy's declarative `Base`). `changes` = the structured diff; `context` = everything else about the event.

### D3 — `action` is the VERB enum; the noun lives in `resource_type` (text)

`action` carries the **operation verb** as an enum — NOT a dotted `resource.verb` string. Dotted strings are combinatorial (every audited model × {created, updated, deleted}), so enumerating them would force a Postgres `ADD VALUE` migration for every newly-audited model, killing the "opt in with one line, no migration" property (D9).

Instead: `action` = verb enum, `resource_type` = free **text** noun (the model name). Compose `{resource_type}.{action}` for display. A new audited model reuses `created/updated/deleted` → **no enum migration**. Only a genuinely new operation (e.g. `exported`) adds an enum value — rare, slow-growing.

`resource_type` stays text (NOT a pg enum) for the same reason, but is validated at `emit()` against an app-level registry of audited resource names (D10) — type-safe at the boundary, migration-free on new models.

### D4 — Outcome is `result`, orthogonal to the verb

Success/failure is a dedicated `result` enum, NOT encoded into the verb. There is no `login_failed` action — a failed login is `action=login, result=failure`. Keeps verbs orthogonal to outcome and makes "all failures" one predicate (`WHERE result='failure'`) instead of action-name matching.

### D5 — Typed payloads for the two jsonb columns

The jsonb columns are the rot-prone weak spots; both get typed Pydantic models at the emit + read boundary (storage stays `jsonb`):

```python
class FieldChange(BaseModel):                       # changes: dict[str, FieldChange]
    old: JsonValue | None
    new: JsonValue | None

class AuditContext(BaseModel, extra="allow"):       # context
    ip: IPvAnyAddress | None = None
    user_agent: str | None = None
    request_id: UUID | None = None
    reason: str | None = None                        # break-glass / override justification
```

`FieldChange` replaces the positional `[old, new]` list (easy to mis-order) with named fields. `AuditContext` types the known keys (real `IPvAnyAddress`, not str) while `extra="allow"` keeps per-feed flexibility.

### D6 — Full record

| column | type | notes |
|---|---|---|
| `id` | `UUID` PK | `default=uuid4` |
| `created_at` | `timestamptz` | `server_default=now()`; event time |
| `actor_type` | `ActorType` | `anonymous` for unauthenticated / login-failure |
| `actor_id` | `UUID` NULL | denormalised, **no FK**; null for system/service/anonymous |
| `actor_label` | `text` NULL | identity captured at event time (email) — legible after rename/delete |
| `tenant_id` | `UUID` NULL | denormalised, indexed, **no FK**; null pre-tenant |
| `action` | `AuditAction` | verb enum (D3) |
| `result` | `AuditResult` | default `success` (D4) |
| `resource_type` | `text` NULL | noun, registry-validated (D3/D10) |
| `resource_id` | `UUID` NULL | affected row PK |
| `changes` | `jsonb` NULL | `dict[str, FieldChange]` |
| `context` | `jsonb` NULL | `AuditContext` |

No `updated_at` / `deleted_at` (immutable). No FKs on `tenant_id` / `actor_id` — the trail must outlive tenant archival / user deletion; `actor_label` denormalises identity so the row stays readable.

**Indexes:**
```
(resource_type, resource_id, created_at desc)   -- everything that touched X
(actor_id, created_at desc)                      -- everything Y did
(tenant_id, created_at desc)                      -- tenant timeline
(action, result, created_at desc)                -- "all failed logins last 24h"
```

### D7 — Three feeds, one record

All capture paths write the same `AuditEvent` shape into the same table:

| feed | action | result | changes | actor_type |
|---|---|---|---|---|
| auto-diff create | `created` | success | `{col: FieldChange(None, new)}` | session actor |
| auto-diff update | `updated` | success | `{col: FieldChange(old, new)}` | session actor |
| auto-diff soft/hard delete | `deleted` | success | `{deleted_at: …}` / — | session actor |
| domain event | `published` … | success | optional | user |
| login ok | `login` | success | — | user |
| login fail | `login` | **failure** | — | **anonymous** |

"Everything that touched patient X" = `WHERE resource_type='Patient' AND resource_id=:x`; "everything actor Y did" = `WHERE actor_id=:y` — across all feeds, because they share one table.

### D8 — Automatic data-diffs extend the existing `before_flush` listener

`app/db/audit.py` gains diff capture in the SAME listener that stamps `created_by` / `updated_by`. After stamping, for each opted-in object it builds and `session.add()`s an `AuditEvent` — supported mid-`before_flush`; the new rows join the same flush and commit in the same transaction as the change.

Emission per object:
- `session.new` & `__audited__` → `action=created`, `changes={col: FieldChange(None, new)}`.
- `session.dirty` & `__audited__` & `is_modified` → `action=updated`, `changes` from `inspect(obj).attrs[col].history` (`history.deleted[0]`=old, `history.added[0]`=new).
- dirty with `deleted_at` None→value → `action=deleted` (soft-delete surfaced as delete, not update).
- `session.deleted` & `__audited__` → `action=deleted` (hard delete).

`resource_type = obj.__class__.__name__`; `resource_id = obj.id`. Excluded columns: always `{updated_at}` ∪ `__audit_exclude__`. Actor from `session.info`; `tenant_id` from `obj.tenant_id` (TenantOwnedEntity) else actor. All old/new JSON-coerced (D11).

**Care points:** skip `AuditEvent` (no recursion); `autoflush=False` means reading `.history` won't nest-flush.

### D9 — Opt-in marker: one line, no migration

`Entity` declares `__audited__: ClassVar[bool] = False` and `__audit_exclude__: ClassVar[frozenset[str]] = frozenset()`. A model opts in with `__audited__ = True`. Explicit (not inherited-on) so PHI tables are audited deliberately; a conformance test pins the starter set. Adding a model = one attribute, no schema/enum migration (it reuses `created/updated/deleted`).

```python
class Patient(TenantOwnedEntity):
    __audited__ = True
    __audit_exclude__ = frozenset({"password_hash"})
```

### D10 — `emit()` (transaction-bound) + `emit_committed()` (independent)

```python
async def emit(
    session, *,
    action: AuditAction,
    result: AuditResult = AuditResult.success,
    resource_type: str | None = None,
    resource_id: UUID | None = None,
    changes: dict[str, FieldChange] | None = None,
    context: AuditContext | None = None,
    actor: Actor | None = None,            # default: session.info[SESSION_ACTOR_KEY]
) -> None
```

- Auto-derives `id`, `created_at`, `actor_type`/`actor_id`/`actor_label`, `tenant_id`, JSON coercion.
- `resource_type` validated against the audited-resource registry.
- `session.add(...)`, NO commit — rides the request unit-of-work. If the business action rolls back, its audit row rolls back too. **Correct** — no audit row for a failed transaction.

`emit_committed(session_factory, ...)` — same signature, opens its OWN short-lived session and commits independently of the request transaction. The single deliberate exception to "services never commit", contained in the audit module. See D12.

### D11 — JSON-safe coercion

`changes` / `context` are `jsonb`. A helper coerces before storage: `UUID→str`, `datetime/date→isoformat`, `Decimal→str` (lossless), `Enum→.value`, set/tuple→list, fallback `str()`. Applied to every diff value and caller-supplied `context`.

### D12 — D-AUTH-COMMIT: security events survive a failed request

A failed login returns 401; `get_session` rolls back on the raised exception, discarding any audit row in the request session. A login-failure trail that vanishes on failure is useless. So `user.login` (failure) — and optionally success — use `emit_committed()` (independent session + commit). Normal domain events stay transaction-bound (`emit`).

### D13 — Read side: `AuditEventRepository` + admin-only `GET /audit-events`

- `AuditEventRepository(BaseListRepository[AuditEvent])`: `orderable={created_at}`, `default_order=(created_at, desc)`, `filterable={resource_type:{eq}, resource_id:{eq}, actor_id:{eq}, action:{eq,in}, result:{eq}, created_at:{gte,lte}}`. Override the base soft-delete predicate (no `deleted_at` on this table).
- `GET /audit-events` — `require_role(Role.ADMIN)`; returns `Page[AuditEventRead]`. Typed data source for the separately-built UI. Headline queries map to filters: `?filter[resource_type][eq]=Patient&filter[resource_id][eq]=<id>` and `?filter[actor_id][eq]=<id>`.
- No write/update/delete routes — append-only; only the capture layer writes.

### D14 — Starter opt-in set

`__audited__ = True` on a small high-value set v1 — recommend `User` + `Patient` (identity + core PHI). Expand per-model in follow-ups (one line each). Conformance test pins the set (D9).

### D15 — Retention deferred

v1 keeps everything; no app update/delete path on `audit_events`. Partitioning by `created_at` + a retention/purge policy are flagged follow-ups, designed when volume or a compliance window demands. Documented, not built.

## Risks / Trade-offs

- **R1 — Mid-flush row insertion.** Supported; `AuditEvent` excluded → no recursion. Recursion test.
- **R2 — `changes` blobs are PHI.** Accepted; table PHI-classed; `__audit_exclude__` drops sensitive columns.
- **R3 — Login-failure durability.** Solved by D-AUTH-COMMIT (`emit_committed`).
- **R4 — Volume / no purge.** Accepted v1; retention flagged (D15).
- **R5 — Silent un-audit via opt-in.** Conformance test pins starter set (D9/D14).
- **R6 — Out-of-app writes bypass the hook.** Accepted; a DB-trigger feed into the same table can be added later without touching the read side.
- **R7 — Soft-delete vs update.** Resolved: `deleted_at` None→value → `deleted`, not `updated` (D8).

## Migration Plan

- **Data migration**: one alembic migration creates the three enums + `audit_events` + four indexes. No existing tables touched; `__audited__` is Python metadata.
- **Hook rollout**: extending the existing `before_flush` listener is backwards-compatible — with nothing opted in, behaviour is identical to today. `User` + `Patient` opt-ins land in the same change.
- **Rollback**: revert PR; drop table + enums. No backfill (trail starts at deploy). Existing stamping untouched.

## File layout

Writes and reads use different paths by design: writes go through `emit()` (a functional service module) + the `before_flush` hook, riding the existing unit-of-work — NO write-repository, NO service class. Reads go through `AuditEventRepository` + the router directly — NO read-service. The asymmetry (immutable append vs filtered list) is deliberate.

```
ADD
  app/core/enums/audit.py                         # ActorType, AuditAction, AuditResult
  app/db/models/audit/__init__.py
  app/db/models/audit/audit_event.py              # AuditEvent (Base)
  app/services/audit/__init__.py
  app/services/audit/context.py                   # FieldChange, AuditContext
  app/services/audit/serialize.py                 # JSON-safe coercion
  app/services/audit/registry.py                  # audited resource_type validation
  app/services/audit/emit.py                      # emit() + emit_committed()  ← write API
  app/repositories/audit/__init__.py
  app/repositories/audit/audit_event_repository.py
  app/repositories/audit/deps.py                  # AuditEventRepoDep
  app/schemas/audit/__init__.py
  app/schemas/audit/audit_event.py                # AuditEventRead
  app/api/routers/audit/__init__.py
  app/api/routers/audit/audit_router.py           # GET /audit-events (admin)
  alembic/versions/<ts>_audit_event_logging.py    # 3 enums + table + 4 indexes

MODIFY
  app/db/base.py            # + __audited__ / __audit_exclude__ on Entity (default off)
  app/db/audit.py           # extend existing before_flush with diff capture
  app/core/enums/__init__.py
  app/db/models/__init__.py
  app/api/__init__.py        # include_router(audit_router)
  Patient / User models      # __audited__ = True
```

## Open questions

- **Q1 — Starter opt-in set.** Confirm `User` + `Patient` for v1, or wider (`Appointment`, `Pathway`, `Organisation`, `CareTeam`)?
- **Q2 — Successful-login durability.** `emit` (transaction-bound) or `emit_committed` like failures? (Leaning `emit_committed` for a complete auth trail.)
- **Q3 — `actor_label` source.** Email, display name, or both? Whatever the resolved `Actor` exposes — confirm the field.
- **Q4 — `request_id` promotion.** Keep in `context`, or promote to a first-class indexed `UUID` column for log correlation? (Leaning keep-in-context unless correlation is frequent.)
