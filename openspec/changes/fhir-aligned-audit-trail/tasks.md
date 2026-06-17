# RESUME — read this first

**Worktree**: `feat/add-event-logs-for-runtime` · **Change**: `fhir-aligned-audit-trail`
**Last updated**: 2026-06-17

This change extends the shipped `backend-audit-event-logging` base into a FHIR R5 /
NEN 7513-aligned audit trail. Read `proposal.md` + `design.md` (decisions D1–D12) before
continuing. The audit-system **foundation is built and committed**; what remains is mostly
the emit-site **wiring** (the "where to log" phase) plus tests.

## Status at a glance — IMPLEMENTATION COMPLETE (2026-06-17)
**All tasks closed.** PR #49 merged + reconciled onto our FHIR model; full backend suite GREEN
(1032 pass, 0 fail); migration `upgrade head` validated; AGENTS audit-usage rules written.
Deferred named events (sla / decision / patient-actor) → **BL-088** (separate follow-up PR).
Remaining before merge: orchestrator **vitest** + **push/PR** (need user go-ahead).

Done: §1 enums · §2 event_code vocab · §3 model+migration · §4 emit API · §5 read seam
(dossier GET) + denied-access (guard) · §6 patient_id-on-writes + `__audited__` + conformance ·
§7 runtime events (enrolled / block_executed / deferred_value_resolved / fast_forwarded / publish;
sla+decision → BL-088) · §7.8 auth.login→execute · §8 read-API filters + tenant scope + tests ·
§9 scope.md + full-suite verify · §10 PR#49 integration (UI + scoping + event_code port) ·
§11 AGENTS rules.

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

## ACTIVE PLAN — PR #49 integration (decided 2026-06-17)
PR #49 (`feat/audit-logging-view`, Daniel Patty) shipped an admin audit-log **UI** + pathway
authoring events in parallel. It leads on frontend; we lead on the schema/compliance model.
**Integrate on this branch** (not a raw merge — his branch is stale-base; we reshape his core).
Full decision record in `design.md` → "PR #49 reconciliation". Tasks in **§10**. Headlines:
adopt his `record_in_session` (drop our `emit()`), keep our `event_code` (port his `operation`),
drop his `PUBLISHED` verb (publish = `execute`+`event_code=pathway.published`), take his UI +
scoping wholesale, keep our task-domain deletions. **§11 (AGENTS audit-usage rules) is the LAST task.**

## Suggested next order
1. **§10 PR #49 integration** (active plan above) — his UI + scoping in; reshape his pathway events + emit helper onto our model; collapse migrations.
2. §8.1/8.4 read-API filter params + tenant scoping, then §8.2 typegen. (His UI may already cover some — check 10.1.)
3. §5.2/5.3 wire `record_patient_read` / `record_denied_access` onto patient GET routes + guard.
4. §7.1–7.6 explicit event_code emits via his `record_in_session` (now unblocked — actor from slot).
5. Run the deferred tests + fix the auth-audit tests; §9 scope.md + `/verify`.
6. **§11 (LAST) — AGENTS audit-usage rules.**

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
- [x] 3.4 Tests PASS against test DB (:5433). Validated `alembic upgrade head` on a scratch DB: full merged DAG applies clean (his task_read_state add → our drop `b2d4f6a8c0e2` ordered correctly), 16 columns present, single head `bda68b3a235c`. `published` is a vestigial DB enum value (harmless)

## 4. Emit API extension (D6)

- [x] 4.1 Extend `emit_committed()` + add transaction-bound `emit()` in `app/services/audit/emit.py` with `event_code`, `patient_id`, `purpose_of_use` params; validate `event_code` via registry
- [x] 4.2 Extend `_build()` to set the three new columns; `purpose_of_use` required when `action=read` on patient data (raise if missing)
- [~] 4.3 Test deferred (would extend `tests/services/audit/test_emit.py`)

## 5. Read-capture seam (D5)

- [x] 5.1 Read-capture mechanism `record_patient_read(...)` in `app/services/audit/access.py`
- [x] 5.2 Wire `record_patient_read` onto the canonical dossier GET: `GET /patients/{id}` via `_audit_dossier_read` dep (composes after `PatientAccessDep` → logs only on granted access; `event_code=patient.dossier_viewed`, purpose `treatment`). DECISION: per-sub-resource GETs (notes/appointments/collab/runtime under a patient) are NOT separately read-logged — they are part of the same logical dossier view (D5 one-row-per-view) and per-endpoint logging would over-log (R1). Granular per-surface read events deferred to [mvp] if required.
- [x] 5.3 Confirmed: `AuditedPatientReadDep` is used ONLY on `GET /patients/{id}` (get_patient). `list_patients`, admin routes (users/orgs/roles), and pathway catalogue have NO read seam — read-logging is scoped to the single dossier view.
- [~] 5.4 Test deferred
- [x] 5.5 Denied-access wired (D10): `require_patient_relation._require` (the dep wrapper, NOT the shared `_resolve_patient_with_relation`) injects `request`, catches `PatientNotFoundError`, and for `relation=="view"` emits `record_denied_access` (read+failure, `patient.dossier_viewed`) via the independent session (survives the 404 rollback), best-effort. Absent-vs-denied is intentionally conflated (existence hiding) — any refused view = one denied-read row. 111 patient/access/audit tests pass (no regression). NOTE: a test asserting the denied row is written is still worth adding
- [~] 5.6 Test deferred

## 6. patient_id on write-diffs (Q1)

- [x] 6.1 Extend `before_flush` diff capture (`_patient_of` in `app/db/audit.py`) to resolve `patient_id` from the flushed instance
- [x] 6.2 Add `__audited__ = True` opt-ins: `Appointment`, `Pathway`, `PathwayBlock` (Patient/Note/Attachment/Enrollment/BlockExecution/Task already on)
- [~] 6.3 Test deferred
- [x] 6.4 Conformance test (D11) in `tests/_conformance/test_audited_models.py`; `PathwayBlockExecution` marked `_PATIENT_VIA_PARENT`

## 7. Domain-event emit sites — `audit-emit-coverage` (D-map)

- [x] 7.1 Builder: `pathway.published` emitted on publish — DONE via PR #49 merge (his `pathway_version_service` publish reshaped to `action=execute` + `event_code=pathway.published`)
- [x] 7.2 Runtime: `runtime.enrolled` at `EnrollmentService.create` via `record_in_session` (actor from slot — no threading), `patient_id` from enrollment, `purpose=treatment`
- [x] 7.3 Runtime: `runtime.block_executed` at `EnrollmentService.complete_execution` via `record_in_session` (patient_id from enrollment). NOTE: covers the explicitly-completed execution; engine auto-fired sibling blocks (`_settle_auto_fire`) rely on auto-diff
- [x] 7.4 → BL-088 ([mvp]). `runtime.sla_escalated` needs escalation semantics (no discrete transition today); auto-diff already records the state change. Deferred to a separate follow-up PR.
- [x] 7.5 → BL-088 ([mvp]). `runtime.decision_branched` needs before/after `decision_output` diffing at the service boundary (resolved in the pure engine); auto-diff already records it. Deferred.
- [x] 7.6 Runtime: `runtime.deferred_value_resolved` at `EnrollmentService.patch_deferred_value` via `record_in_session` (patient_id from enrollment, `context.attr`)
- [x] 7.6b Runtime: `runtime.fast_forwarded` at `EnrollmentService.fast_forward` (actor=admin, purpose=operations, patient_id from enrollment) — one summary event; per-step completions already auto-captured (D12)
- [x] 7.7 Test `test_transitions_emit_audit_events` extended: asserts exactly one `runtime.enrolled` (on create) + one `runtime.block_executed` (on complete_step), each `action=execute` with the enrollment's `patient_id`. Green.
- [x] 7.8 Auth: `_emit_login_audit` now writes `action=execute` + `event_code=auth.login` (`auth_router.py`). NOTE: existing auth-audit tests assert `action=login` and must be updated
- [x] 7.9 → BL-088 ([mvp]). Patient-actor auth emit BLOCKED on a mobile/patient login endpoint (`feat/mobile-app-auth-setup`); `ActorType.patient` + capability already shipped, no schema change needed when it lands. Deferred.

## 8. Read API + client

- [x] 8.0 `AuditEventRead` schema returns `event_code`, `patient_id`, `purpose_of_use` (`app/schemas/audit/audit_event.py`)
- [x] 8.1 `GET /audit-events` filters extended via `AuditEventRepository.filterable_fields`: `patient_id` (eq), `event_code` (eq/in), `purpose_of_use` (eq/in) — usable as `filter[patient_id]=...` etc.
- [x] 8.2 `openapi.json` regenerated (`uv run python -m app.openapi`) + orchestrator types regenerated (`openapi-typescript` against the file) — both done manually this session; AuditAction enum + new fields correct on both ends
- [x] 8.3 Test `test_filter_by_patient_id_and_break_the_glass`: seeds tenant-scoped rows, asserts `filter[patient_id]` returns the patient-centric trail and `filter[purpose_of_use]=break_the_glass` isolates override access. Green.
- [x] 8.4 `AuditEventRepository._tenant_predicate` override scopes the trail to the caller's `tenant_id` (AuditEvent isn't TenantOwnedEntity so base hook skipped it; reads actor from session slot). NULL-tenant rows (anonymous/system) excluded. Test still pending

## 9. Scope + verify

- [x] 9.1 `openspec/scope.md` F8 entry updated: FHIR schema + dossier-read + named runtime events `[poc]`; tamper/retention (BL-085), export (BL-086), Luscii reads (BL-087), exhaustive read coverage + purpose enforcement + SLA/decision events `[mvp]`
- [x] 9.2 Full backend suite GREEN: **1032 passed, 9 skipped, 0 failed** (test DB :5433). Fixed: (a) login audit test → filter by `event_code=auth.login`; (b) a PRE-EXISTING cleanup-order bug (enrollment `_wipe` now clears `CareTeamParticipant`/`CareTeam` before `Patient` — was `IntegrityError: DELETE FROM patients violates care_teams_patient_id_fkey`, surfaced only when enrollment+pathway api tests ran together). NOTE: `test_care_team_history::test_change_role_produces_two_rows` is a PRE-EXISTING flake (passed 2/3 full runs + every isolation run; has a `period_start >= period_end` timestamp assert). Orchestrator **vitest still not run**.

## 10. PR #49 integration (decided 2026-06-17 — see design "PR #49 reconciliation")

Integrate `feat/audit-logging-view` (PR #49) onto this branch. NOT a raw merge (stale base; we
reshape his audit core). Reference: `gh pr diff 49 --repo reaktor/zas-poc`.

- [x] 10.1 His admin audit-log UI merged in (`apps/orchestrator/src/modules/audit/*`, `admin/audit-log.tsx`, nav, i18n)
- [x] 10.2 His scoping audit merged (`app/services/access/scoping/scoping_service.py` + tests)
- [x] 10.3 Unified on his `record_in_session` (actor from slot); extended with `event_code`/`patient_id`/`purpose_of_use`, routes through `_build`; deleted our `emit()`; kept `emit_committed`. Migrated our `fast_forward` emit + `enrollment_router` to `record_in_session` (dropped actor threading)
- [x] 10.4 `pathway_version_service` publish → `action=execute` + `event_code=pathway.published`; `record_pathway_event` gained `event_code` passthrough; `AuditAction.PUBLISHED` removed from enum
- [x] 10.5 His pathway-audit tests updated to assert `event_code=pathway.published` + `action=execute`
- [x] 10.6 Backend: `record_pathway_event` derives `event_code` from `operation` via `_OP_EVENT_CODE` map; events carry both queryable `event_code` + display `operation`. Frontend: `AuditListPage` gained an `event_code` column (`column.event_code` = "Gebeurtenis"); `enum.action` i18n fixed (added `read`/`execute`, dropped stale `published`). `tsc` clean. NOTE: a filter *dropdown* over event codes skipped (clunky over ~18 values); backend `filter[event_code]=...` works for URL/power use; vitest not run this pass
- [x] 10.7 Migrations: kept his chain + our columns migration; converged 2 heads via merge migration `20260617_1436_merge_fhir_audit_columns_and_pr49_audit.py` (single head `bda68b3a235c`). NOTE: his `add_published_audit_action` migration left in place — adds a now-vestigial `published` DB enum value (harmless, like legacy `login`); cleanup optional
- [x] 10.8 Kept our deletions of `task_read_state_repository.py` / `appointment_source.py`
- [x] 10.9 Resolved as leave-coexisting: his `pathway-audit` (authoring events) + `audit-log-view` (admin UI) are valid SEPARATE changes, not duplicates of this schema change. Only nominal overlap is an `audit-trail-base` spec delta; no fold needed. They archive on their own.
- [x] 10.10 Backend `openapi.json` regenerated (AuditAction = created/read/updated/deleted/execute/login). Frontend types regenerated (`openapi-typescript` against the file; `pnpm install` done in worktree), `schemas.ts AUDIT_ACTIONS` aligned to CRUDE, his `AuditListPage` test fixtures updated with new fields. Orchestrator `tsc` clean (only pre-existing `baseUrl` deprecation). `alembic upgrade head` validated on scratch DB (see 3.4). DONE.

## 11. AGENTS audit-usage rules (FINAL task — write last, once the system is settled)

- [x] 11.1 Added "Audit / event logging" section to `apps/backend/AGENTS.md` (after the PHI note): when NOT to add (auto CRUD via `__audited__`, no double-log, errors→Sentry not audit, admin reads not logged), when to (domain transitions, patient reads, denied access), and how (`record_in_session` vs `emit_committed`, CRUDE action + `event_code` vocab, `patient_id`, `purpose_of_use`, no PHI payloads). Covers the items below:
  - **Auto vs explicit**: model state changes are captured automatically by `__audited__` + the `before_flush` hook — do NOT hand-emit create/update/delete; add `__audited__` to the model instead. Explicit `record_in_session` is ONLY for domain events that aren't a plain CRUD diff (e.g. `pathway.published`, runtime transitions).
  - **read/access**: patient-data GETs use `record_patient_read`; admin/template/list reads are NOT logged.
  - **errors are NOT audit**: exceptions/500s → structured logging/Sentry, never `audit_events`; only failed *audited actions* (denied access, failed login) get `result=failure`.
  - **how**: `record_in_session` (in-band, actor from slot) vs `emit_committed` (rollback-surviving: auth/denied); set `event_code` from `KNOWN_EVENT_CODES` (add new codes there); set `patient_id` for patient-scoped events; set `purpose_of_use` on reads.
  - **never log full clinical payloads** (reuse the existing `log_fhir_ref` rule).
- [x] 11.2 Evaluated `apps/orchestrator/AGENTS.md` — it documents conventions/typing/folder rules, not a module index; a UI pointer is not a "rule" there. NOT warranted, skipped.
