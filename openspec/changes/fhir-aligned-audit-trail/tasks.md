# RESUME — read this first

**Worktree**: `feat/add-event-logs-for-runtime` · **Change**: `fhir-aligned-audit-trail`
**Last updated**: 2026-06-17

This change extends the shipped `backend-audit-event-logging` base into a FHIR R5 /
NEN 7513-aligned audit trail. Read `proposal.md` + `design.md` (decisions D1–D12) before
continuing. The audit-system **foundation is built and committed**; what remains is mostly
the emit-site **wiring** (the "where to log" phase) plus tests.

## Status at a glance
- **DONE & committed**: §1 enums, §2 event_code vocab, §3 model+migration, §4 emit API,
  §5 read/denied mechanisms (`access.py`), §6 patient_id-on-writes + `__audited__` opt-ins +
  conformance, §7.6b `runtime.fast_forwarded`, §7.8 `auth.login`→execute, §8 read-schema fields.
- **NOT done** (pick up here): §7.1–7.6 explicit runtime/builder event_code emits,
  §8.1/8.2/8.4 read-API filters + tenant scope + typegen, §9 scope.md + verify, all test
  *execution* (`[~]` items: tests written, never run).

## Key decision (do not re-litigate — see design D-notes)
The §7 explicit `event_code` emits (`runtime.enrolled`/`block_executed`/`sla_escalated`/
`decision_branched`/`deferred_value_resolved`) are a **legibility layer**: `PathwayEnrollment`
and `PathwayBlockExecution` are already `__audited__`, so the `before_flush` hook already
records these transitions as actor'd, patient_id'd field-diffs. The explicit emits add a
named, compliance-readable event on top — **not new data**. They were intentionally paused
because each needs `actor` threaded into service methods that today take only `tenant_id`
(touches `EnrollmentService` signatures + the temporal callers in `app/temporal/activities.py`).
`runtime.fast_forwarded` WAS done because it is the one event auto-diff cannot capture
(admin bulk-advance intent). Resume §7 only if the named-event legibility is wanted now.

## Legend
`[x]` done & committed · `[~]` code/spec done, **test run deferred** (no DB this pass) ·
`[ ]` not started · `(WHERE)` emit-site wiring · `(DEFERRED)` blocked on external work.

## How to run the deferred tests (DB needed)
From `apps/backend`, point at the host-mapped test DB (the default URL uses the docker-internal
`test_db` host which does not resolve from the host):
```
BACKEND_DATABASE_URL="postgresql+asyncpg://zas:zas@localhost:5433/zas_test" \
  uv run python -m pytest tests/core/test_audit_enums.py tests/services/audit/test_registry.py \
  tests/db/test_audit_event_model.py tests/_conformance/test_audited_models.py -q
```
Tests in `[~]` items also need updating: existing auth-audit tests assert `action=login` and
will fail now that login writes `action=execute`+`event_code=auth.login` (§7.8).

## Migration NOT applied
`alembic/versions/20260617_1200_fhir_aligned_audit_columns.py` is written but **not run** against
the shared dev DB (applying mutates the stack other worktrees share — get the go-ahead first).
It is additive/online-safe. Tests build schema via `Base.metadata.create_all`, so they do not
need the migration applied.

## Suggested next order
1. §8.1/8.4 read-API filter params + tenant scoping (self-contained, high value), then §8.2 typegen.
2. §5.2/5.3 wire `record_patient_read` / `record_denied_access` onto patient GET routes + guard.
3. §7.1–7.6 explicit event_code emits (only if named-event legibility wanted; needs actor threading).
4. Run the deferred tests + fix the auth-audit tests; §9 scope.md + `/verify`.

---

## 0. Prerequisites

- [x] 0.1 Re-read `openspec/changes/backend-audit-event-logging/` — this change extends, never replaces
- [x] 0.2 Q1-sub RESOLVED: Note/Attachment/Task/Appointment/Enrollment carry `patient_id`; only `PathwayBlockExecution` is parent-resolved (via enrollment)
- [x] 0.3 Q2 (login→execute: new-only, no rewrite) + Q3 (purpose role-derived default `treatment`) resolved

## 1. Enums (D1, D4, D8)

- [x] 1.1 Extend `AuditAction` in `app/core/enums/audit.py`: add `read`, `execute`; keep `created/updated/deleted/login` (login deprecated for new writes)
- [x] 1.2 Add `PurposeOfUse` StrEnum: `treatment | operations | patient_request | emergency | break_the_glass`; re-export from `app/core/enums/__init__.py`
- [x] 1.3 Extend `ActorType`: add `patient` (D8). NOT adding `service` yet
- [~] 1.4 Test written (`tests/core/test_audit_enums.py`); run deferred

## 2. event_code vocabulary (D2)

- [x] 2.1 Add `KNOWN_EVENT_CODES` frozenset + `is_known_event_code()` to `app/services/audit/registry.py` (namespaced codes per design emit-map)
- [~] 2.2 Test written (`tests/services/audit/test_registry.py`); run deferred

## 3. DB model + migration (D3, D7)

- [x] 3.1 Add columns to `AuditEvent` (`app/db/models/audit/audit_event.py`): `event_code text?`, `patient_id uuid?` (NO FK), `purpose_of_use` (PurposeOfUse enum, nullable)
- [x] 3.2 Add indexes: `ix_audit_events_patient (patient_id, created_at DESC)`, `ix_audit_events_event_code (event_code, created_at DESC)`
- [x] 3.3 Alembic migration (`20260617_1200_fhir_aligned_audit_columns.py`, down_revision `md0outc0me01`) — written, NOT applied (see header)
- [~] 3.4 Test written (`tests/db/test_audit_event_model.py`); run deferred

## 4. Emit API extension (D6)

- [x] 4.1 Extend `emit_committed()` + add transaction-bound `emit()` in `app/services/audit/emit.py` with `event_code`, `patient_id`, `purpose_of_use` params; validate `event_code` via registry
- [x] 4.2 Extend `_build()` to set the three new columns; `purpose_of_use` required when `action=read` on patient data (raise if missing)
- [~] 4.3 Test deferred (would extend `tests/services/audit/test_emit.py`)

## 5. Read-capture seam (D5)

- [x] 5.1 Read-capture mechanism `record_patient_read(...)` in `app/services/audit/access.py`
- [ ] 5.2 (WHERE) Wire `record_patient_read` onto patient-data GET routes: patient profile/dossier, pathway runtime, notes, appointments, collaboration
- [ ] 5.3 (WHERE) Confirm NO read-logging on admin/template/list routes
- [~] 5.4 Test deferred
- [x] 5.5 Denied-access mechanism `record_denied_access(...)` (D10) in `access.py`; wiring onto the patient-access guard is the WHERE phase
- [~] 5.6 Test deferred

## 6. patient_id on write-diffs (Q1)

- [x] 6.1 Extend `before_flush` diff capture (`_patient_of` in `app/db/audit.py`) to resolve `patient_id` from the flushed instance
- [x] 6.2 Add `__audited__ = True` opt-ins: `Appointment`, `Pathway`, `PathwayBlock` (Patient/Note/Attachment/Enrollment/BlockExecution/Task already on)
- [~] 6.3 Test deferred
- [x] 6.4 Conformance test (D11) in `tests/_conformance/test_audited_models.py`; `PathwayBlockExecution` marked `_PATIENT_VIA_PARENT`

## 7. Domain-event emit sites — `audit-emit-coverage` (D-map)

- [ ] 7.1 (WHERE) Builder: explicit `emit()` `pathway.published` on pathway publish
- [ ] 7.2 (WHERE) Runtime: `runtime.enrolled` at `EnrollmentService.create` (patient_id from enrollment) — needs actor threaded in
- [ ] 7.3 (WHERE) Runtime: `runtime.block_executed` at engine block execution (actor=system) — also sets patient_id for `PathwayBlockExecution` (parent-resolved)
- [ ] 7.4 (WHERE) Runtime: `runtime.sla_escalated` at SLA escalation / due_at wake (actor=system)
- [ ] 7.5 (WHERE) Runtime: `runtime.decision_branched` at decision resolution (actor=system)
- [ ] 7.6 (WHERE) Runtime: `runtime.deferred_value_resolved` at deferred-value resolution
- [x] 7.6b Runtime: `runtime.fast_forwarded` at `EnrollmentService.fast_forward` (actor=admin, purpose=operations, patient_id from enrollment) — one summary event; per-step completions already auto-captured (D12)
- [ ] 7.7 Tests: each runtime transition emits exactly one event with correct `event_code` + `patient_id`
- [x] 7.8 Auth: `_emit_login_audit` now writes `action=execute` + `event_code=auth.login` (`auth_router.py`). NOTE: existing auth-audit tests assert `action=login` and must be updated
- [ ] 7.9 (DEFERRED — no PoC call site) patient-actor auth emit lands when the mobile backend auth endpoint exists (`feat/mobile-app-auth-setup`); `ActorType.patient` already shipped

## 8. Read API + client

- [x] 8.0 `AuditEventRead` schema returns `event_code`, `patient_id`, `purpose_of_use` (`app/schemas/audit/audit_event.py`)
- [ ] 8.1 (WHERE) Extend `GET /audit-events` *filter params* with `patient_id`, `event_code`, `purpose_of_use` (`audit_router.py` uses generic `ListQueryParamsDep` + `repo.list_page`; inspect `app/api/_list` + `AuditEventRepository` to add filters)
- [ ] 8.2 `/openapi-sync` — regenerate `openapi.json` + orchestrator typegen
- [ ] 8.3 Test: filter by `patient_id` / `purpose_of_use=break_the_glass`
- [ ] 8.4 (WHERE) `GET /audit-events` SHALL scope rows by the caller's `tenant_id` (admin is tenant-scoped) — no cross-tenant audit leak; test a second-tenant caller

## 9. Scope + verify

- [ ] 9.1 Update `openspec/scope.md`: schema + demo emit sites `[poc]`; exhaustive read coverage + purpose enforcement + full model opt-in `[mvp]`
- [ ] 9.2 `/verify` (backend lint + typecheck + tests); in-worktree run backend tests via direct `uv run python -m pytest` (moon cwd caveat) with the `BACKEND_DATABASE_URL` from the RESUME header
