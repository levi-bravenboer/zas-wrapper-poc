## 0. Prerequisites

- [x] 0.1 Confirmed actor shape = `SessionUser` (`id`, `email`, `display_name`, `tenant_id`, `role`) via `app/schemas/auth/auth.py`
- [x] 0.2 Confirmed auth entry point = `app/api/routers/auth/auth_router.py::login_password` (existing `log_auth_event` seam, `request` available)
- [x] 0.3 RESOLVED Q1–Q4: starter set = `User`+`Patient`; both logins via `emit_committed`; `actor_label` = display name; `request_id` promoted to indexed column
- [x] 0.4 Confirmed `request.app.state.session_factory` reachable for `emit_committed`

## 1. Enums

- [x] 1.1 Create `app/core/enums/audit.py`: `ActorType` (user|system|service|anonymous), `AuditAction` (verbs: created, updated, deleted, login, logout, exported, published, access_granted — D3), `AuditResult` (success|failure — D4). Re-export from `app/core/enums/__init__.py`
- [x] 1.2 Test: enum round-trip for each

## 2. Typed payloads + JSON coercion

- [x] 2.1 Create `app/services/audit/context.py`: `FieldChange` (`old`/`new`: `JsonValue | None` — D5), `AuditContext` (`extra="allow"`; `ip: IPvAnyAddress?`, `user_agent?`, `reason?` — D5). NOTE: `request_id` is NOT here — it is a first-class column (Q4)
- [x] 2.2 Create `app/services/audit/serialize.py` — JSON-safe coercion helper (D11): `UUID→str`, `datetime/date→isoformat`, `Decimal→str`, `Enum→.value`, set/tuple→list, fallback `str()`
- [x] 2.3 Tests: each type coerced; nested dict/list; round-trips through `json.dumps`; `FieldChange` named fields; `AuditContext` typed keys + extras preserved

## 3. DB model + migration

- [x] 3.1 Create `app/db/models/audit/audit_event.py::AuditEvent` inheriting `Base` directly (NOT `Entity` — D1). Columns per D6: `id`, `created_at` (server_default now), `actor_type` (ActorType), `actor_id?`, `actor_label?`, `tenant_id?`, `action` (AuditAction), `result` (AuditResult, default success), `resource_type? text`, `resource_id?`, `request_id?` (Q4), `changes jsonb?`, `context jsonb?` (attr+column `context`, NOT `metadata` — D2). No FKs on `tenant_id`/`actor_id` (D6). No `updated_at`/`deleted_at`
- [x] 3.2 Register in `app/db/models/__init__.py` (+ `app/db/models/audit/__init__.py` re-export)
- [x] 3.3 Alembic migration (hand-written `20260614_1800_audit_event_logging.py`, down_revision `2dd11b50fcb2`): three enums + `audit_events` + five indexes (D6)
- [x] 3.4 Test: ORM registered; table + indexes + enum types exist post-migration; `created_at` server-default populates; no `deleted_at` column

## 4. Audited-resource registry

- [x] 4.1 Create `app/services/audit/registry.py` — validates `resource_type` against all mapped model names (typo protection, broader than `__audited__`; D3/D10)
- [x] 4.2 Test: unknown `resource_type` rejected at emit; known accepted

## 5. `emit()` + `emit_committed()`

- [x] 5.1 Create `app/services/audit/emit.py::emit(...)` — resolve actor (arg → session.info → None→anonymous), derive `actor_type`/`actor_id`/`actor_label` (display name, Q3)/`tenant_id`, validate `resource_type` via registry, coerce payloads, `session.add(AuditEvent(...))`, NO commit (D10)
- [x] 5.2 Create `emit_committed(session_factory, *, ...)` — own short-lived session, write, commit independently (D10/D12)
- [x] 5.3 Tests: actor present / absent (→ anonymous) / explicit override; `actor_type` derivation; row rides + rolls back with surrounding transaction; `emit_committed` persists despite an outer rollback

## 6. Automatic data-diffs in the `before_flush` hook

- [x] 6.1 Add `__audited__` + `__audit_exclude__` to `Entity` in `app/db/base.py` (default off — D9)
- [x] 6.2 Extend the `before_flush` listener in `app/db/audit.py` with diff capture (D8): created/updated/deleted, soft-delete detection, exclude `{updated_at}` ∪ `__audit_exclude__`, actor + tenant derivation, JSON coercion
- [x] 6.3 Guard: skip `AuditEvent` (never `__audited__`) — no recursion (R1)
- [x] 6.4 Tests:
  - create/update/delete each → right `action` + `FieldChange` map
  - soft-delete → `deleted` not `updated`
  - excluded columns (`updated_at`, `__audit_exclude__`) absent from `changes`
  - non-`__audited__` model → NO audit row
  - `AuditEvent` writes do not recurse
  - old/new JSON-safe (UUID/datetime/enum)
  - audit row commits in the same transaction; rolls back with it

## 7. Auth event emission

- [x] 7.1 Failed login → `emit_committed(action=login, result=failure, actor=None, context=...)` — survives the 401 (D12)
- [x] 7.2 `login` success (both full + role-selection-pending) via `emit_committed` (Q2). NOTE: logout emission deferred — logout endpoint not yet wired (follow-up)
- [x] 7.3 Tests: failed login persists despite 401 / rolled-back request; success recorded with actor + context

## 8. Starter opt-in set

- [x] 8.1 Set `__audited__ = True` on `User` (exclude `password_hash` + audit FKs) + `Patient` (exclude audit FKs) (Q1)
- [x] 8.2 Conformance test pinning the starter set (D14) — none silently falls out of audit

## 9. Read API

- [x] 9.1 Create `AuditEventRepository(BaseListRepository[AuditEvent])` — allow-lists per D13 (incl. `result`, `request_id`); `_soft_delete_predicate` → None. `deps.py::AuditEventRepoDep`. (Base TypeVar widened `Entity`→`Base`.)
- [x] 9.2 Create `app/schemas/audit/audit_event.py::AuditEventRead` — `changes: dict[str, FieldChange] | None`, `context: dict | None`
- [x] 9.3 Create `app/api/routers/audit/audit_router.py::GET /audit-events` — admin-only (`AdminUserDep`); `Page[AuditEventRead]`; registered in `app/api/__init__.py`. NO write routes
- [x] 9.4 Tests: filter by resource (type+id), actor, action, result, time range; pagination; default sort; non-admin → 403; no POST/PATCH/DELETE on `/audit-events` (OpenAPI assertion)

## 10. OpenAPI + typed client

- [~] 10.1 `/openapi-sync` (backend:openapi DONE — `/audit-events` in `openapi.json`; orchestrator typegen PENDING — needs orchestrator `pnpm install` + running server) — regenerate `apps/backend/openapi.json` + orchestrator typegen (`GET /audit-events` new operation)

## 11. Verification

- [x] 11.0 `moon run backend:lint` + `backend:typecheck` green
- [x] 11.1 `/verify` (backend) — lint + typecheck + tests green (tests pending)
- [ ] 11.2 Manual smoke: update a `Patient` via a normal request → one `Patient`/`updated` row with correct `FieldChange` map + `actor_id`; soft-delete → `deleted`; failed login → `login`/`failure` row present despite the 401; `GET /audit-events?filter[resource_type][eq]=Patient&filter[resource_id][eq]=<id>` returns the patient's trail; `?filter[actor_id][eq]=<id>` returns that actor's actions; `?filter[result][eq]=failure` returns failures
