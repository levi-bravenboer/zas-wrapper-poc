## Why

The pathway model, builder, and runtime aggregate (enrollment + block executions + engine) all exist, but there is no way for a caregiver to **enroll a patient into a pathway** and **see/advance that patient's pathway** in the orchestrator. Without this, the runtime that was built is unreachable: pathways can be authored but never run for a real patient. This change makes the runtime usable end-to-end for the PoC and gives every block a defined runtime contract so the team can demo a patient moving through a care pathway.

## What Changes

- **Per-block runtime contract** — each block kind gets an explicit, phase-tagged contract: what is set in the **builder** (template config), what is set at **enrollment** (deferred fields), and what is produced at **runtime** (execution result). Fields across phases can connect (a build choice marks a field deferred-to-enroll; an enroll value seeds a runtime default; a build-time `decision.outputs` feeds a runtime branch pick).
- **Temporal runtime** — the runtime runs on **Temporal**: one generic `PathwayEnrollmentWorkflow` per enrollment interprets the pinned pathway data; durable timers handle block timing/escalation; signals drive caregiver actions; activities perform all I/O (materialization, projection, audit emit). Temporal holds authoritative state; the Postgres executions become a read projection. Replaces the in-process engine.
- **Materialized work primitives** — when a block becomes actionable the runtime materializes the matching primitive (distinct entities): `appointment`/`treatment`/`mdo` → real `Appointment` rows (calendar + appointment source); `task` + fake-log blocks → a new `pathway` task source projection. Completing the primitive advances the block.
- **Uniform "fake-log" runtime** — every block is advanceable in the PoC. A caregiver advances a block from the patient tab; the execution transitions state. Blocks with real logic (task, appointment, treatment, mdo, decision) capture a typed result; blocks without a real integration (form, message, informed_consent, external_program, pathway_link) just transition. Every transition emits an audit event via an activity — a hook for the forthcoming audit/event-logging system (`feat/audit-event-logging`); no event log is built here.
- **Timing on blocks, not a block** — relative delays ("N days after dependency", "N days before target") are modelled as each block's `timing_policy`, driving when an execution becomes eligible.
- **Enroll flow** — a caregiver enrolls a patient into a published pathway version, supplying enroll-phase deferred values. Backed by the existing `POST /enrollments`.
- **List-by-patient read** — a new endpoint returns a patient's enrollments with their block executions, so the patient view can render progress. No such endpoint exists today.
- **Patient "Pathway" tab** — a new tab on the patient detail view showing **next steps** (eligible/active executions) and **finished steps** (completed/skipped), with per-block caregiver actions.
- **BREAKING (catalogue prune)** — remove the `milestone` block (redundant with phases) and the `wait` block (delays now live in `timing_policy`). `task.assignee` becomes caregiver-only.

## Capabilities

### New Capabilities
- `pathway-patient-enrollment`: caregiver enrolls a patient into a published pathway version (enroll-phase deferred values); list a patient's enrollments + executions for read.
- `pathway-runtime-execution`: per-block runtime contracts, phase-tagged fields (build/enroll/runtime), uniform advance + completion semantics, timing-driven eligibility, and the audit-emit hook points.
- `patient-pathway-tab`: the Pathway tab on the patient detail view — next vs finished steps and per-block caregiver actions.

### Modified Capabilities
- `pathway-domain`: remove `milestone` and `wait` block kinds; `task.assignee` caregiver-only; add the build/enroll/runtime field-phase classification and per-block runtime-contract metadata.
- `patient-profile-ui`: register the new Pathway tab in the patient detail tab set.

## Impact

- **New infra (Temporal)**: a `temporal` service in `docker-compose`; `temporalio` added to backend deps; a worker process (backend) registering `PathwayEnrollmentWorkflow` + activities. Deploy target (Temporal Cloud vs self-hosted) decided at MVP.
- **Backend**: port `engine.py` eligibility/fanout into the Temporal workflow interpreter; persistence moves into activities that write the `pathway_block_execution` / `pathway_enrollment` **SQL projection**. New `pathway` source in the `/tasks` aggregator; `Appointment` materialization (reusing `appointments.pathway_block_instance_id`). New list-by-patient enrollments endpoint; caregiver-action endpoints become Temporal **signals**. Block catalogue changes (remove milestone/wait, `task` caregiver-only) in `app/domain/pathway/blocks/`.
- **Frontend (orchestrator)**: enroll dialog (from the patient page); new `patient` Pathway tab + runtime module; consumes existing generated enrollment client + the new list endpoint; pathway steps also surface in the `/tasks` inbox.
- **Dependencies**: Temporal (new); audit event emission deferred to `feat/audit-event-logging` (emitted via an activity). Builder authoring of per-block runtime overrides is a **follow-up change**.
- **Migrations**: remove `milestone`/`wait` block kinds; no runtime-event table; no data backfill (no live enrollments).
