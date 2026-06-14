## 0. Prerequisites

- [ ] 0.1 Confirm the resolved `Actor` shape exposed via `session.info[SESSION_ACTOR_KEY]` — fields available for `actor_id`, `actor_label`, `tenant_id` (read `app/services/access/identity/`)
- [ ] 0.2 Confirm the auth flow entry points where login success / failure / logout are handled (where `emit` / `emit_committed` calls land)
- [ ] 0.3 Resolve open questions Q1–Q4 in design.md (starter opt-in set; successful-login durability; `actor_label` source; `request_id` promotion)
- [ ] 0.4 Confirm the app session factory handle reachable from the auth flow for `emit_committed` (independent session)

## 1. Enums

- [ ] 1.1 Create `app/core/enums/audit.py`: `ActorType` (user|system|service|anonymous), `AuditAction` (verbs: created, updated, deleted, login, logout, exported, published, access_granted — D3), `AuditResult` (success|failure — D4). Re-export from `app/core/enums/__init__.py`
- [ ] 1.2 Test: enum round-trip for each

## 2. Typed payloads + JSON coercion

- [ ] 2.1 Create `app/services/audit/context.py`: `FieldChange` (`old`/`new`: `JsonValue | None` — D5), `AuditContext` (`extra="allow"`; `ip: IPvAnyAddress?`, `user_agent?`, `request_id: UUID?`, `reason?` — D5)
- [ ] 2.2 Create `app/services/audit/serialize.py` — JSON-safe coercion helper (D11): `UUID→str`, `datetime/date→isoformat`, `Decimal→str`, `Enum→.value`, set/tuple→list, fallback `str()`
- [ ] 2.3 Tests: each type coerced; nested dict/list; round-trips through `json.dumps`; `FieldChange` named fields; `AuditContext` typed keys + extras preserved

## 3. DB model + migration

- [ ] 3.1 Create `app/db/models/audit/audit_event.py::AuditEvent` inheriting `Base` directly (NOT `Entity` — D1). Columns per D6: `id`, `created_at` (server_default now), `actor_type` (ActorType), `actor_id?`, `actor_label?`, `tenant_id?`, `action` (AuditAction), `result` (AuditResult, default success), `resource_type? text`, `resource_id?`, `changes jsonb?`, `context jsonb?` (attr+column `context`, NOT `metadata` — D2). No FKs on `tenant_id`/`actor_id` (D6). No `updated_at`/`deleted_at`
- [ ] 3.2 Register in `app/db/models/__init__.py`
- [ ] 3.3 Alembic migration: three enums + `audit_events` + four indexes (D6): `(resource_type, resource_id, created_at desc)`, `(actor_id, created_at desc)`, `(tenant_id, created_at desc)`, `(action, result, created_at desc)`. Hand-review autogen; add enums/indexes manually if missed. Use `/new-migration`
- [ ] 3.4 Test: ORM registered; table + indexes + enum types exist post-migration; `created_at` server-default populates; no `deleted_at` column

## 4. Audited-resource registry

- [ ] 4.1 Create `app/services/audit/registry.py` — set/lookup of audited resource names; `emit()` validates `resource_type` against it (D3/D10). Populated from models declaring `__audited__` (or an explicit allow-set)
- [ ] 4.2 Test: unknown `resource_type` rejected at emit; known accepted

## 5. `emit()` + `emit_committed()`

- [ ] 5.1 Create `app/services/audit/emit.py::emit(session, *, action: AuditAction, result=AuditResult.success, resource_type=None, resource_id=None, changes: dict[str, FieldChange]|None=None, context: AuditContext|None=None, actor=None)` — resolve actor (arg → session.info → None→anonymous), derive `actor_type`/`actor_id`/`actor_label`/`tenant_id`, validate `resource_type` via registry, coerce payloads, `session.add(AuditEvent(...))`, NO commit (D10)
- [ ] 5.2 Create `emit_committed(session_factory, *, ...)` — own short-lived session, write, commit independently (D10/D12). Single contained exception to "services never commit"
- [ ] 5.3 Tests: actor present / absent (→ anonymous) / explicit override; `actor_type` derivation; row rides + rolls back with surrounding transaction; `emit_committed` persists despite an outer rollback

## 6. Automatic data-diffs in the `before_flush` hook

- [ ] 6.1 Add `__audited__: ClassVar[bool] = False` + `__audit_exclude__: ClassVar[frozenset[str]] = frozenset()` to `Entity` in `app/db/base.py` (default off — D9)
- [ ] 6.2 Extend the `before_flush` listener in `app/db/audit.py` (same listener that stamps `created_by`/`updated_by`) to emit `AuditEvent` rows for opted-in objects after stamping (D8):
  - `session.new` & `__audited__` → `action=created`, `changes={col: FieldChange(None, new)}`
  - `session.dirty` & `__audited__` & `is_modified` → `action=updated`, `changes` from `inspect(obj).attrs[col].history`
  - dirty `deleted_at` None→value → `action=deleted` (soft-delete)
  - `session.deleted` & `__audited__` → `action=deleted` (hard delete)
  - `resource_type = obj.__class__.__name__`; `resource_id = obj.id`; exclude `{updated_at}` ∪ `__audit_exclude__`; actor from session.info; `tenant_id` from `obj.tenant_id` else actor; coerce values
- [ ] 6.3 Guard: skip `AuditEvent` (never `__audited__`) — no recursion (R1)
- [ ] 6.4 Tests:
  - create/update/delete each → right `action` + `FieldChange` map
  - soft-delete → `deleted` not `updated`
  - excluded columns (`updated_at`, `__audit_exclude__`) absent from `changes`
  - non-`__audited__` model → NO audit row
  - `AuditEvent` writes do not recurse
  - old/new JSON-safe (UUID/datetime/enum)
  - audit row commits in the same transaction; rolls back with it

## 7. Auth event emission

- [ ] 7.1 Failed login → `emit_committed(action=login, result=failure, actor=None, context=AuditContext(ip=.., user_agent=.., reason=..))` — survives the 401 (D12)
- [ ] 7.2 `user.login` success + `user.logout` (durability per Q2 — `emit` vs `emit_committed`)
- [ ] 7.3 Tests: failed login persists despite 401 / rolled-back request; success + logout recorded with actor + context

## 8. Starter opt-in set

- [ ] 8.1 Set `__audited__ = True` on Q1-confirmed starter models (recommend `User`, `Patient`); add `__audit_exclude__` for sensitive/noisy columns (password hash, structural audit FKs)
- [ ] 8.2 Conformance test pinning the starter set (D14) — none silently falls out of audit

## 9. Read API

- [ ] 9.1 Create `app/repositories/audit/audit_event_repository.py::AuditEventRepository(BaseListRepository[AuditEvent])` — allow-lists per D13 (incl. `result:{eq}`); override base soft-delete predicate (no `deleted_at`). Add `app/repositories/audit/deps.py::AuditEventRepoDep` (matches `repositories/user/deps.py`)
- [ ] 9.2 Create `app/schemas/audit/audit_event.py::AuditEventRead` (+ filter params) — `changes: dict[str, FieldChange] | None`, `context: AuditContext | None`
- [ ] 9.3 Create `app/api/routers/audit/audit_router.py::GET /audit-events` — `require_role(Role.ADMIN)`; `Page[AuditEventRead]`; filters `resource_type`, `resource_id`, `actor_id`, `action`, `result`, `created_at` gte/lte; default `created_at desc`. NO write routes
- [ ] 9.4 Tests: filter by resource (type+id), actor, action, result, time range; pagination; default sort; non-admin → 403; no POST/PATCH/DELETE on `/audit-events` (OpenAPI assertion)

## 10. OpenAPI + typed client

- [ ] 10.1 `/openapi-sync` — regenerate `apps/backend/openapi.json` + orchestrator typegen (`GET /audit-events` new operation)

## 11. Verification

- [ ] 11.1 `/verify` (backend) — lint + typecheck + tests green
- [ ] 11.2 Manual smoke: update a `Patient` via a normal request → one `Patient`/`updated` row with correct `FieldChange` map + `actor_id`; soft-delete → `deleted`; failed login → `login`/`failure` row present despite the 401; `GET /audit-events?filter[resource_type][eq]=Patient&filter[resource_id][eq]=<id>` returns the patient's trail; `?filter[actor_id][eq]=<id>` returns that actor's actions; `?filter[result][eq]=failure` returns failures
