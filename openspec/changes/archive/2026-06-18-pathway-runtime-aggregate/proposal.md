## Why

**Tier**: `[poc]`
**Parent**: `pathway-model-redesign` (resolved design lives there)
**Chain slot**: #3 of 3 — requires `pathway-input-logic-and-timing` archived

The parent change `pathway-model-redesign` decided to keep template state (slot #1/#2) strictly separate from runtime state (D5 hard split). Runtime state lives in three new tables: `pathway_enrollment`, `pathway_block_execution`, `pathway_deferred_field_value`. `PathwayEnrollment.anchor_date` is the single anchor that relative `TimingPolicy` offsets compute from (D5). Deferred field values are stored on `DeferredFieldValue` AND mirrored to `BlockExecution.scheduled_at` for `at_enrollment_picked_date` policies — controlled duplication, written once at enrollment, never recomputed.

This change lands the runtime aggregate and a minimal runtime engine that drives `BlockExecution` state transitions per `input_logic` evaluation.

## What Changes

### `pathway_enrollment` table

Binds a patient to a published `PathwayVersion`. Carries `anchor_date` (the patient-chosen start point for relative offsets) and enrollment-level state (`active`, `paused`, `completed`, `cancelled`).

### `pathway_block_execution` table

One row per `(enrollment, block_template)`. Fields: `scheduled_at`, `started_at`, `completed_at`, `due_at`, `state` (`pending | eligible | active | completed | skipped | failed`), `result_json` (typed per `RESULT_TYPE` of the block kind).

`scheduled_at` derivation:
- Relative `TimingPolicy` → computed from `enrollment.anchor_date + policy.offset` at enrollment time.
- `AtEnrollmentPickedDatePolicy` → supplied as a deferred field value at enrollment; mirrored to `BlockExecution.scheduled_at`.

### `pathway_deferred_field_value` table

One row per `(enrollment, block_template, attr)`. Carries `value_json` (typed per the block subclass's `DeferredFieldSpec.kind`), `set_at`, `set_by_user_id`.

Validator: every required `DeferredFieldSpec` on every block in the version must have a value before the enrollment can transition to `active`.

### Runtime engine — minimal

`app/services/pathway/runtime/engine.py`:

- `evaluate_eligibility(enrollment_id)` walks blocks whose state is `pending`, evaluates each block's `input_logic` against current `BlockExecution` state, transitions matching ones to `eligible`.
- `start(execution_id)` transitions `eligible` → `active`, sets `started_at`.
- `complete(execution_id, result)` transitions `active` → `completed`, sets `completed_at` and `result_json`, then re-runs `evaluate_eligibility` for the enrollment.
- DecisionBlock evaluation: for `mode="xor"`, exactly one output fires; for `mode="and"`, all fire.

No scheduling loop, no worker queue, no realtime push in scope — those are downstream concerns (existing `pathway-runtime-*` proposals in other worktrees cover that surface).

### API surface

- `POST /enrollments` — create enrollment, supply `anchor_date` + deferred field values, returns enrollment with computed `BlockExecution` rows.
- `GET /enrollments/{id}` — enrollment + all executions.
- `POST /enrollments/{id}/executions/{exec_id}:start`
- `POST /enrollments/{id}/executions/{exec_id}:complete` with typed `result`.

### Out of scope

- Scheduling worker / cron evaluation loop → existing `pathway-runtime-*` proposals.
- Realtime push to clients → existing `pathway-runtime-realtime` proposal.
- Patient-facing UI consuming the aggregate → mobile app + orchestrator surfaces, separate changes.

## Impact

- Backend: three new tables, three new alembic migrations, runtime engine module, new API surface under `/enrollments`.
- Frontend: no required change for this slot (consumers are downstream). Optional: orchestrator enrollment-debug view (separate proposal).
- Tests: runtime engine state-machine tests; eligibility evaluation per predicate; deferred-field gating tests.
- Out-of-scope surfaces: scheduler, realtime, patient UI.
