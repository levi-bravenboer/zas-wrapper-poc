## 1. Temporal infrastructure

- [ ] 1.1 Add a `temporal` service (+ Temporal UI) to `docker-compose.yml`
- [ ] 1.2 Add `temporalio` to backend deps; add settings for Temporal address/namespace/task-queue
- [ ] 1.3 Add a worker entrypoint (same backend image, separate process) registering the workflow + activities
- [ ] 1.4 Wire a Temporal client into backend deps for the API process

## 2. Catalogue prune + domain contracts

- [ ] 2.1 Remove `MilestoneBlock` and `WaitBlock` classes + catalogue entries; migration drops the `milestone`/`wait` kinds
- [ ] 2.2 Set `task.allowed_lane_kinds` to caregiver-only
- [ ] 2.3 Add build/enroll/runtime phase classification to the block model + expose it
- [ ] 2.4 Add per-block runtime-contract metadata (actor, primitive, result, completion)
- [ ] 2.5 Confirm relative timing is expressible via `timing_policy` on the dependent block (former `wait`)
- [ ] 2.6 Add pathway role-set declaration + per-block role reference; expose required roles in the enroll descriptor
- [ ] 2.7 Publish-time connection validation: predicate's referenced block + output/result-field must exist in the upstream runtime contract (reject data predicates on fake-log blocks)

## 3. Runtime workflow + activities

- [ ] 3.1 Implement `PathwayEnrollmentWorkflow` interpreting the pinned version (eligibility/fanout ported from `engine.py`)
- [ ] 3.2 Implement `loadPathwayVersion` + `writeExecutionProjection` activities (SQL projection is activity-written only)
- [ ] 3.3 Implement Temporal Update handlers for caregiver actions; Signal for cancel
- [ ] 3.4 Implement durable timers for relative timing → auto-advance upcoming→actionable; pause/resume halts timers
- [ ] 3.9 Evaluate full predicate vocabulary (IF_DONE/DECISION_OUTPUT/HAS_DATA/VALUE_EQUALS/VALUE_GT) + timer-backed WAIT_AFTER/IF_NOT_DONE_WITHIN escalation; aggregators all_of/any_of/n_of_m
- [ ] 3.5 Implement materialization activities: `createAppointment` (appointment/treatment/mdo, kind mapping, participants) and `projectPathwayTask`
- [ ] 3.6 Implement dead-path cleanup activities (`cancelAppointment`/`withdrawTask`) on xor-prune + cancel
- [ ] 3.7 Implement `emitAuditEvent` activity stub (hook for `feat/audit-event-logging`) at every transition
- [ ] 3.8 Port `engine.py` unit tests as interpreter tests

## 4. Backend API surface

- [ ] 4.1 Enrollment create wires to workflow start; enroll descriptor lists enroll-phase fields + anchor date
- [ ] 4.2 Caregiver-action endpoints send Temporal Updates and return new state (complete, decision-pick, book/perform)
- [ ] 4.3 Lifecycle endpoints: cancel (Signal), pause, resume
- [ ] 4.4 List-by-patient enrollments endpoint (care-team scoped) with executions
- [ ] 4.5 Add `pathway` source to the `/tasks` aggregator (care-team visibility)

## 5. Frontend — enroll flow (orchestrator)

- [ ] 5.1 "Enroll in pathway" entry point on the patient page
- [ ] 5.2 Enroll dialog: pick published version, set anchor date (default today), fill enroll-phase deferred values
- [ ] 5.4 Role-binding step in enroll dialog: one person per required role from the care team (add-to-team if missing); block submit until all bound
- [ ] 5.3 Submit to `POST /enrollments`; surface validation errors (missing required deferred fields)

## 6. Frontend — patient Pathway tab (orchestrator)

- [ ] 6.1 Register the Pathway tab in the patient detail tab set (+ empty state)
- [ ] 6.2 Render per-enrollment sections with Upcoming / Next-actionable / Finished buckets
- [ ] 6.3 Per-block action controls wired to the action endpoints (Done / Book / Perform / Close / Pick branch / Advance)
- [ ] 6.4 Finished steps show result summary + who/when
- [ ] 6.5 Lifecycle controls (cancel / pause / resume) per enrollment

## 7. Integration + verification

- [ ] 7.1 Seed a demo pathway + enroll a demo patient end-to-end through Temporal
- [ ] 7.2 `/openapi-sync` (backend openapi + orchestrator typegen in lockstep)
- [ ] 7.3 `/verify` (lint + typecheck + tests, backend + orchestrator)
- [ ] 7.4 openspec validate --strict
