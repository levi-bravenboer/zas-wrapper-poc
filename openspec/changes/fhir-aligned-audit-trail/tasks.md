## 0. Prerequisites

- [ ] 0.1 Re-read `openspec/changes/backend-audit-event-logging/` (model, emit, registry, before_flush hook) — this change extends, never replaces
- [ ] 0.2 Confirm every patient-scoped model (`Note`, `Attachment`, `Appointment`, `Enrollment`, `BlockExecution`) carries a resolvable patient reference at flush time (design Q1)
- [ ] 0.3 Resolve Q2 (login→execute: dual-write vs new-only) and Q3 (purpose-of-use source) before touching auth/read paths

## 1. Enums (D1, D4, D8)

- [x] 1.1 Extend `AuditAction` in `app/core/enums/audit.py`: add `read`, `execute`; keep `created/updated/deleted/login` (login deprecated for new writes)
- [x] 1.2 Add `PurposeOfUse` StrEnum: `treatment | operations | patient_request | emergency | break_the_glass`; re-export from `app/core/enums/__init__.py`
- [x] 1.3 Extend `ActorType`: add `patient` (D8). NOT adding `service` yet
- [x] 1.4 Test: enum round-trip for new `AuditAction`, `ActorType.patient`, `PurposeOfUse`

## 2. event_code vocabulary (D2)

- [x] 2.1 Add `KNOWN_EVENT_CODES` frozenset + `is_known_event_code()` to `app/services/audit/registry.py` (namespaced codes per design emit-map)
- [x] 2.2 Test: unknown `event_code` rejected at emit; known accepted

## 3. DB model + migration (D3, D7)

- [x] 3.1 Add columns to `AuditEvent` (`app/db/models/audit/audit_event.py`): `event_code text?`, `patient_id uuid?` (NO FK), `purpose_of_use` (PurposeOfUse enum, nullable)
- [x] 3.2 Add indexes: `ix_audit_events_patient (patient_id, created_at DESC)`, `ix_audit_events_event_code (event_code, created_at DESC)`
- [x] 3.3 Alembic migration (`20260617_1200_fhir_aligned_audit_columns.py`, down_revision `md0outc0me01`): `ALTER TYPE audit_action ADD VALUE read/execute`, `ALTER TYPE actor_type ADD VALUE patient` (non-transactional), `CREATE TYPE purpose_of_use`, three `ADD COLUMN`, two indexes. No backfill
- [~] 3.4 Test written (model+index+no-FK asserts); execution deferred (DB run skipped this pass)

## 4. Emit API extension (D6)

- [x] 4.1 Extend `emit_committed()` + add transaction-bound `emit()` in `app/services/audit/emit.py` with `event_code`, `patient_id`, `purpose_of_use` params; validate `event_code` via registry
- [x] 4.2 Extend `_build()` to set the three new columns; `purpose_of_use` required when `action=read` on patient data (raise if missing)
- [~] 4.3 Test deferred (DB run skipped this pass)

## 5. Read-capture seam (D5)

- [x] 5.1 Read-capture mechanism `record_patient_read(...)` in `app/services/audit/access.py` — `action=read`, `event_code`, `patient_id`, `purpose_of_use` (role default `treatment`), one row per logical dossier view
- [ ] 5.2 (WHERE phase) Wire onto patient-data GET routes: patient profile/dossier, pathway runtime, notes, appointments, collaboration
- [ ] 5.3 (WHERE phase) Confirm NO read-logging on admin/template/list routes
- [~] 5.4 Test deferred
- [x] 5.5 Denied-access mechanism `record_denied_access(...)` (D10) — `action=read`, `result=failure`, `patient_id` + `event_code`; wiring onto the patient-access guard is the WHERE phase
- [~] 5.6 Test deferred

## 6. patient_id on write-diffs (Q1)

- [x] 6.1 Extend `before_flush` diff capture (`_patient_of`) to resolve `patient_id` from the flushed instance (Patient→own id; any model with a `patient_id` column→that; parent-only links→null per Q1-sub)
- [x] 6.2 Add `__audited__ = True` opt-ins: `Appointment`, `Pathway`, `PathwayBlock` (Patient/Note/Attachment/Enrollment/BlockExecution/Task already on)
- [~] 6.3 Test deferred
- [x] 6.4 Conformance test (D11): `_EXPECTED` updated; `test_patient_scoped_models_resolve_patient_id` guards patient axis; `PathwayBlockExecution` marked `_PATIENT_VIA_PARENT`

## 7. Domain-event emit sites — `audit-emit-coverage` (D-map)

- [ ] 7.1 Builder: explicit `emit()` `pathway.published` on pathway publish
- [ ] 7.2 Runtime: `runtime.enrolled` at enrollment service (patient_id from enrollment)
- [ ] 7.3 Runtime: `runtime.block_executed` at engine block execution (actor=system)
- [ ] 7.4 Runtime: `runtime.sla_escalated` at SLA escalation / due_at wake (actor=system)
- [ ] 7.5 Runtime: `runtime.decision_branched` at decision resolution (actor=system)
- [ ] 7.6 Runtime: `runtime.deferred_value_resolved` at deferred-value resolution
- [ ] 7.6b Runtime: `runtime.fast_forwarded` at `EnrollmentService.fast_forward` (actor=admin, purpose=operations, patient_id from enrollment) — one summary event alongside the per-step `runtime.block_executed` its loop triggers (D12)
- [ ] 7.7 Tests: each runtime transition emits exactly one event with correct `event_code` + `patient_id`
- [ ] 7.8 Auth (caregiver/admin): migrate login/logout emits to `action=execute` + `event_code=auth.login`/`auth.logout` (Q2; keep legacy `login` rows valid)
- [ ] 7.9 DEFERRED (no PoC call site): patient-actor auth emit (`auth.login`/`auth.logout`, `actor_type=patient`) lands when the mobile backend auth endpoint exists (`feat/mobile-app-auth-setup`). This change ships only the `ActorType.patient` value + capability so wiring needs no schema change

## 8. Read API + client

- [ ] 8.1 Extend `GET /audit-events` filters with `patient_id`, `event_code`, `purpose_of_use` (`app/api/routers/audit/audit_router.py` + schema)
- [ ] 8.2 `/openapi-sync` — regenerate `openapi.json` + orchestrator typegen
- [ ] 8.3 Test: filter by `patient_id` returns the patient-centric trail; filter by `purpose_of_use=break_the_glass` isolates override access
- [ ] 8.4 `GET /audit-events` SHALL scope rows by the caller's `tenant_id` (no cross-tenant audit leak); test a second-tenant caller cannot read tenant-1 rows

## 9. Scope + verify

- [ ] 9.1 Update `openspec/scope.md`: schema + demo emit sites `[poc]`; exhaustive read coverage + purpose enforcement + full model opt-in `[mvp]`
- [ ] 9.2 `/verify` (backend lint + typecheck + tests); in-worktree run backend tests via direct `uv run python -m pytest` (moon cwd caveat)
