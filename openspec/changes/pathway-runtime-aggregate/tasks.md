## 0. Prerequisite gate

- [ ] 0.1 Verify `pathway-input-logic-and-timing` is archived. Halt if not.
- [ ] 0.2 Verify parent `pathway-model-redesign` decision D5 unchanged.

## 1. Storage — runtime aggregate

- [ ] 1.1 Alembic migration: create `pathway_enrollment` (`id`, `patient_id`, `pathway_version_id`, `anchor_date`, `state`, `created_at`, `created_by_user_id`).
- [ ] 1.2 Alembic migration: create `pathway_block_execution` (`id`, `enrollment_id`, `block_template_id`, `scheduled_at`, `started_at`, `completed_at`, `due_at`, `state`, `result_json`).
- [ ] 1.3 Alembic migration: create `pathway_deferred_field_value` (`id`, `enrollment_id`, `block_template_id`, `attr`, `value_json`, `set_at`, `set_by_user_id`).
- [ ] 1.4 Indexes: `(enrollment_id, state)` on executions; `(enrollment_id, block_template_id, attr)` unique on deferred values.

## 2. Domain — runtime aggregate

- [ ] 2.1 `app/domain/pathway/runtime/enrollment.py`: `PathwayEnrollment` aggregate with executions + deferred values.
- [ ] 2.2 `app/domain/pathway/runtime/execution.py`: `BlockExecution` state machine — `pending → eligible → active → completed | skipped | failed`.
- [ ] 2.3 `app/domain/pathway/runtime/deferred_value.py`: `DeferredFieldValue` typed by the spec's `kind`.

## 3. Enrollment creation flow

- [ ] 3.1 `POST /enrollments`: validate `anchor_date`, validate every required `DeferredFieldSpec` has a value supplied.
- [ ] 3.2 Per block in the version, compute `BlockExecution.scheduled_at`:
  - Relative `TimingPolicy` → `anchor_date + offset`.
  - `AtEnrollmentPickedDatePolicy` → mirror from supplied deferred value (also persisted to `pathway_deferred_field_value`).
  - `FixedDurationPolicy` → schedules from anchor_date; `completed_at` left null until runtime sets it.
  - `DueWithinPolicy` → sets `due_at = anchor_date + window`.
- [ ] 3.3 Initial eligibility pass: blocks with empty `input_logic` transition to `eligible` immediately; others stay `pending`.

## 4. Runtime engine

- [ ] 4.1 `app/services/pathway/runtime/engine.py`:
  - `evaluate_eligibility(enrollment_id)` — re-evaluate every `pending` execution's `input_logic` rules against current state; transition matches to `eligible`.
  - `start(execution_id)` — `eligible → active`; set `started_at = now`.
  - `complete(execution_id, result)` — validate `result` against subclass `RESULT_TYPE`; `active → completed`; set `completed_at = now`, `result_json = result`; re-run `evaluate_eligibility(enrollment_id)`.
  - `skip(execution_id, reason)` — admin-only path; transition `pending | eligible → skipped`.
- [ ] 4.2 DecisionBlock evaluation on `complete`:
  - `mode="xor"` → engine picks the single matching output per the block's typed predicate; downstream blocks referencing other outputs transition to `skipped`.
  - `mode="and"` → all outputs fire; downstream blocks referencing any output become eligible per their own `input_logic`.
- [ ] 4.3 Unit tests for every predicate evaluator + every state transition.

## 5. API surface

- [ ] 5.1 `POST /enrollments` — create + initial eligibility.
- [ ] 5.2 `GET /enrollments/{id}` — enrollment + executions + deferred values.
- [ ] 5.3 `POST /enrollments/{id}/executions/{exec_id}:start`.
- [ ] 5.4 `POST /enrollments/{id}/executions/{exec_id}:complete` with typed `result` matching the block subclass's `RESULT_TYPE`.
- [ ] 5.5 `PATCH /enrollments/{id}/deferred-values/{attr}` — late-supply deferred value (must be allowed by spec; transitions blocked behind the value re-evaluate).

## 6. Validators + invariants

- [ ] 6.1 Enrollment cannot enter `active` while any required `DeferredFieldSpec` has no value.
- [ ] 6.2 `BlockExecution.result_json` shape must match subclass `RESULT_TYPE`; reject on type mismatch.
- [ ] 6.3 For `at_enrollment_picked_date` blocks: assert `DeferredFieldValue.value == BlockExecution.scheduled_at` integration test.

## 7. Tests

- [ ] 7.1 Engine state-machine tests: every transition, every guard.
- [ ] 7.2 Enrollment flow tests: happy path, missing deferred values, invalid result shape.
- [ ] 7.3 DecisionBlock XOR + AND fan-out tests.
- [ ] 7.4 Anchor-date relative scheduling test: every `TimingPolicy` variant produces correct `scheduled_at`.

## 8. Sync + cleanup

- [ ] 8.1 `/openapi-sync` for enrollment + execution + deferred-value endpoints.
- [ ] 8.2 `/verify backend` and `/verify orchestrator`.
- [ ] 8.3 Update `CHAIN-pathway-model.md`: slot #3 ready-to-apply. Mark parent `pathway-model-redesign` ready to archive.
