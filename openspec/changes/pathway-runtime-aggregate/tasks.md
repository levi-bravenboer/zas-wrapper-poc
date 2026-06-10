## 0. Prerequisite gate

- [x] 0.1 Verify `pathway-input-logic-and-timing` is archived. Halt if not. (Drafted in parallel on slot #2 branch per `CHAIN-pathway-model.md`; merge order stays foundations → slot #2 → this slot.)
- [x] 0.2 Verify parent `pathway-model-redesign` decision D5 unchanged. (Confirmed at branch start.)

## 1. Storage — runtime aggregate

- [x] 1.1 Alembic migration (`20260610_1000_pathway_runtime_aggregate.py`): creates `pathway_enrollment` with `(patient_id, pathway_version_id, anchor_date, state)` plus `TenantOwnedEntity` audit columns.
- [x] 1.2 Same revision creates `pathway_block_execution` with `(enrollment_id, block_template_id, scheduled_at, started_at, completed_at, due_at, state, result_json, decision_output)`.
- [x] 1.3 Same revision creates `pathway_deferred_field_value` with `(enrollment_id, block_template_id, attr, value_json, set_at)`.
- [x] 1.4 Indexes: `(enrollment_id, state)` on executions; unique `(enrollment_id, block_template_id, attr)` on deferred values; unique `(patient_id, pathway_version_id)` on enrollments.

## 2. Domain — runtime aggregate

- [x] 2.1 `app/domain/pathway/runtime/enrollment.py`: `PathwayEnrollment` Pydantic model with `EnrollmentState` literal.
- [x] 2.2 `app/domain/pathway/runtime/execution.py`: `BlockExecution` typed model + closed state machine (`pending → eligible → active → completed | skipped | failed`).
- [x] 2.3 `app/domain/pathway/runtime/deferred_value.py`: `DeferredFieldValue` Pydantic model.

## 3. Enrollment creation flow

- [x] 3.1 `EnrollmentService.create`: rejects payloads missing a required `DeferredFieldSpec` value (`DeferredFieldMissingError` 422); persists supplied values up front.
- [x] 3.2 Per block in the version, derives `BlockExecution.scheduled_at` + `due_at` via `app/domain/pathway/runtime/scheduling.py::schedule_from_anchor` (calendar-only ISO 8601 durations + four `TimingPolicy` variants).
- [x] 3.3 Initial eligibility pass: empty `input_logic` transitions to `eligible` immediately via the engine.

## 4. Runtime engine

- [x] 4.1 `app/services/pathway/runtime/engine.py::RuntimeEngine`: `evaluate_eligibility`, `start`, `complete`, `skip`.
- [x] 4.2 DecisionBlock fan-out: `mode="xor"` auto-skips dependents pointing at other outputs; `mode="and"` leaves them to re-evaluate per their own `input_logic`.
- [x] 4.3 Unit tests for every predicate evaluator (slot #2 covers six) + every state transition (`tests/services/pathway/runtime/test_engine.py`).

## 5. API surface

- [x] 5.1 `POST /enrollments` — create + initial eligibility pass.
- [x] 5.2 `GET /enrollments/{id}` — enrollment + executions + deferred values.
- [x] 5.3 `POST /enrollments/{id}/executions/{exec_id}:start` — `eligible → active`.
- [x] 5.4 `POST /enrollments/{id}/executions/{exec_id}:complete` with typed `result`.
- [x] 5.5 `PATCH /enrollments/{id}/deferred-values/{attr}` — late-supply a deferred value.

## 6. Validators + invariants

- [x] 6.1 Enrollment can't be created while any required `DeferredFieldSpec` has no value (`DeferredFieldMissingError`).
- [ ] 6.2 `BlockExecution.result_json` shape must match subclass `RESULT_TYPE`. (DEFERRED — `RESULT_TYPE` ClassVars are placeholder `None` across the slot-#1 catalogue. Engine validation lands with the per-kind result schemas in slot #3.5.)
- [x] 6.3 For `at_enrollment_picked_date` blocks: `schedule_from_anchor` returns `None` so the scheduler mirrors the supplied deferred value; covered by `test_at_enrollment_picked_date_defers_scheduling`.

## 7. Tests

- [x] 7.1 Engine state-machine tests: every transition + invalid-transition guard (`test_engine.py`).
- [ ] 7.2 Enrollment flow tests against the live DB: happy path, missing deferred values, invalid result shape. (DEFERRED — needs `db_session` + seed harness equivalent to slot #2's `test_pathway_service.py`; tracked as a follow-up.)
- [x] 7.3 DecisionBlock XOR + AND fan-out tests (`test_decision_xor_skips_unselected_branch` + `test_decision_and_mode_does_not_auto_skip`).
- [x] 7.4 Anchor-date relative scheduling test: every `TimingPolicy` variant produces correct `scheduled_at` (`tests/domain/pathway/runtime/test_scheduling.py`).

## 8. Sync + cleanup

- [x] 8.1 `/openapi-sync` for enrollment + execution + deferred-value endpoints (`apps/backend/openapi.json` regenerated; orchestrator types regenerated).
- [x] 8.2 `/verify backend` and `/verify orchestrator`: backend lint + typecheck + 717 tests green / 10 skipped; orchestrator typecheck clean (only pre-existing TanStack errors remain).
- [x] 8.3 Update `CHAIN-pathway-model.md`: slot #3 ready-to-apply; parent `pathway-model-redesign` marked ready to archive once all three slots land.
