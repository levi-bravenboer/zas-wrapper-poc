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
- [ ] 2.6 Per-block care-team role-type reference; expose per-block caregiver choice in the enroll descriptor (over flattened block set)
- [ ] 2.8 Named clinical-date declaration + per-block min-lead-time + clinical-date `timing_policy` (forward offsets)
- [ ] 2.9 Subpath inlining: flatten subpath blocks into the pathway version at build/load
- [ ] 2.7 Publish-time connection validation: predicate's referenced block + output/result-field must exist in the upstream runtime contract (reject data predicates on fake-log blocks)

## 3. Runtime workflow + activities

- [ ] 3.1 Implement `PathwayEnrollmentWorkflow` interpreting the pinned version (eligibility/fanout ported from `engine.py`)
- [ ] 3.2 Implement `loadPathwayVersion` + `writeExecutionProjection` activities (SQL projection is activity-written only)
- [ ] 3.3 Implement Temporal Update handlers for caregiver actions; Signal for cancel
- [ ] 3.4 Implement durable timers for relative timing → auto-advance upcoming→actionable; pause/resume halts timers
- [ ] 3.9 Evaluate full predicate vocabulary (IF_DONE/DECISION_OUTPUT/HAS_DATA/VALUE_EQUALS/VALUE_GT) + timer-backed WAIT_AFTER/IF_NOT_DONE_WITHIN escalation; aggregators all_of/any_of/n_of_m
- [ ] 3.5 Implement materialization activities: `createAppointment` (appointment/treatment/mdo, kind mapping, chosen participants) and `projectPathwayTask` — **consume the appointment + notes/files module from `feat/split-appointments-and-tasks`** (don't rebuild booking/notes/files)
- [ ] 3.10 Luscii enroll activity (`POST /v1/patients`, reuse-or-create); `message` mock-send; leave Luscii running on end
- [ ] 3.11 Clinical-date timers (forward offsets `date − N`) + recompute on date edit; min-lead-time honored
- [ ] 3.6 Implement dead-path cleanup activities (`cancelAppointment`/`withdrawTask`) on xor-prune + cancel
- [ ] 3.7 Implement `emitAuditEvent` activity stub (hook for `feat/audit-event-logging`) at every transition
- [ ] 3.8 Port `engine.py` unit tests as interpreter tests

## 4. Backend API surface

- [ ] 4.1 Enrollment create wires to workflow start; enroll descriptor lists enroll-phase fields + anchor date
- [ ] 4.2 Caregiver-action endpoints send Temporal Updates and return new state (complete, decision-pick, book/perform)
- [ ] 4.3 Lifecycle endpoints: cancel (Signal), pause, resume
- [ ] 4.4 List-by-patient enrollments endpoint (care-team scoped) with executions
- [ ] 4.5 Add `pathway` source to the `/tasks` aggregator (care-team visibility)
- [ ] 4.6 Earliest-feasible clinical-date suggestion endpoint (blocking prereqs + min-lead-times)
- [ ] 4.7 Edit still-updatable enrollment values endpoint (authz: caregiver-with-rights/admin); recompute timers on date change

## 5. Frontend — enroll flow (orchestrator)

- [ ] 5.1 "Enroll in pathway" entry point on the patient page
- [ ] 5.2 Enroll dialog: pick published version, set anchor date (default today), fill enroll-phase deferred values
- [ ] 5.4 Enroll dialog caregiver-choice step: pick caregiver(s) per block from the care team (multi for MDO; add-to-team if missing); block submit until all chosen
- [ ] 5.5 Enroll dialog clinical-date step: suggested-earliest `operation_date` (editable, not-earlier-than-feasible)
- [ ] 5.3 Submit to `POST /enrollments`; surface validation errors (missing required deferred fields)

## 6. Frontend — patient Pathway tab (orchestrator)

- [ ] 6.1 Register the Pathway tab in the patient detail tab set (+ empty state)
- [ ] 6.2 Render per-enrollment sections with Upcoming / Next-actionable / Finished buckets
- [ ] 6.3 Per-block action controls wired to the action endpoints (task→Done, appointment→Book/Perform, treatment→Book/Perform+result, mdo/decision→Pick outcome + notes/files); auto blocks render no action
- [ ] 6.4 Finished steps show result summary + who/when
- [ ] 6.5 Lifecycle controls (cancel / pause / resume) per enrollment
- [ ] 6.6 Edit still-updatable values on the tab (clinical dates, deferred values, caregiver choices); locked once consumed

## 6b. Builder (author the bladder-cancer pathway)

- [ ] 6b.1 Per-block care-role picker (shared FHIR `role_in_care`/`PractitionerRole` value set) in the inspectors
- [ ] 6b.2 Named clinical-date declaration + per-block min-lead-time / forward-offset timing authoring
- [ ] 6b.3 Remove `MilestoneInspector` + `WaitInspector` + palette entries
- [ ] 6b.4 Verify subpath (nested-pathway-blocks) + Luscii program picker author the flow as drawn
- [ ] 6b.5 MDO outcome-choices authoring + `message` template-per-channel + timing authoring; notes/files via the shared module
- [ ] 6b.6 Author the full bladder-cancer pathway in the builder end-to-end

## 6c. Seed script

- [ ] 6c.1 Seed script that authors the bladder-cancer pathway (blocks + roles + clinical dates + timing + Luscii program ref)

## 7. Integration + verification

- [ ] 7.1 Seed a demo pathway + enroll a demo patient end-to-end through Temporal
- [ ] 7.2 `/openapi-sync` (backend openapi + orchestrator typegen in lockstep)
- [ ] 7.3 `/verify` (lint + typecheck + tests, backend + orchestrator)
- [ ] 7.4 openspec validate --strict
