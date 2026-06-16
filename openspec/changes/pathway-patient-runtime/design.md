## Context

The pathway domain (typed block hierarchy), the runtime aggregate (`PathwayEnrollment`, `PathwayBlockExecution`, `PathwayDeferredFieldValue`), the runtime engine (`auto_fire_starts`, `evaluate_eligibility`, `start`, `complete`, `skip`, decision fanout), and five enrollment endpoints (`POST /enrollments`, `GET /enrollments/{id}`, execution `:start` / `:complete`, deferred-value `PATCH`) already exist and are tested. The frontend has a generated API client and an extensible patient-detail tab set (currently measurements, lab_results).

What is missing is the **caregiver-facing path**: enrolling a patient, advancing their blocks, and viewing progress — plus a **defined runtime contract per block kind** so each block behaves predictably. This design fills that gap for the PoC.

The audit/event-logging system is being built separately (`feat/audit-event-logging`); this change emits audit events through a stub `emitAuditEvent` activity (a hook), not a built event store. The existing in-process engine logic is **re-homed into a Temporal workflow** (D9).

## Goals / Non-Goals

**Goals:**
- A caregiver can enroll a patient into a published pathway version — binding roles to people, setting an anchor date, supplying enroll-phase values.
- Every block kind has a phase-tagged contract: build (template) / enroll (deferred) / runtime (produced).
- The runtime runs on **Temporal**: one interpreter workflow per enrollment; **durable timers auto-advance** timed steps (incl. `if_not_done_within` escalation).
- Blocks **materialize work primitives** — Appointments (`appointment`/`treatment`/`mdo`) and a `pathway` task source (`task` + fake-log) — that surface in the calendar + `/tasks` inbox.
- A **Zorgpad** tab on the patient detail view shows the full pathway (upcoming / actionable / finished); a list-by-patient endpoint backs it.
- Every runtime transition invokes a stub `emitAuditEvent` activity (hook for `feat/audit-event-logging`).

**Non-Goals:**
- Building the audit/event-logging store (the merged `audit` system is wired via an activity).

**In scope (revised — D16):** the **pathway builder must fully author** the bladder-cancer pathway — every new field (care-team role-types, named clinical dates + min-lead-time, subpath, per-block runtime contracts, timing incl. forward offsets, input_logic predicates). A **seed script** also authors the same pathway for convenience.
- A patient-facing portal — patient-lane blocks (form, message, informed_consent) are fake-log only; no patient channel.
- (Revised — see D14/D15) A **subpath** (the flow's "operate (biopsy)") is **builder-time inlining**: it expands into regular blocks in the **same** pathway/enrollment — no nested child workflow. A cross-pathway **bridge** (handoff to the separate oncology pathway) is a different mechanism: `end_pathway` + a fire-and-forget `pathway_link` to another pathway. `external_program` (Luscii) is thin-real (enroll only).
- Data-driven `decision.auto_resolve` (authored, not wired — caregiver picks).
- Notifications/escalation beyond what an `if_not_done_within` timer triggers.

## Decisions

### D1 — Three field phases per block (build / enroll / runtime)

Each block field is supplied at exactly one phase, and phases can connect:
- **Build**: authored on the template in the builder (static config).
- **Enroll**: a `DeferredFieldSpec` the builder marks deferred; the value is supplied per patient at enrollment (`PathwayDeferredFieldValue`).
- **Runtime**: produced while the execution runs, stored on `PathwayBlockExecution.result_json`.

Connections: a build choice can flip a field to enroll-deferred; an enroll value can seed a runtime default (e.g. pre-filled appointment date editable at runtime); a build-authored `decision.outputs` enumerates the runtime branch choices.

**Alternative considered:** one flat config blob resolved at runtime — rejected; loses the typed enroll-form descriptor and the build/runtime separation already in the model.

### D2 — Uniform fake-log runtime + audit hook

Every block advances through `pending → eligible → active → completed` (with `skipped` / `failed`). The **Temporal workflow** (D9) owns transitions: a caregiver advances a block via a Temporal Update, or a durable timer auto-advances a timed step. Blocks with real logic write a typed `result_json`; blocks without an integration just transition. Each transition invokes an `emitAuditEvent` activity carrying `{enrollment, execution, block_kind, action, actor, payload, at}` — a **stub hook** for `feat/audit-event-logging` (no event store built here).

**Why:** makes the whole pathway demoable now without per-block integrations, and gives a single, consistent advance mechanism.

### D3 — Timing lives on blocks, not a `wait` block

Relative delays are authored as each block's `timing_policy` (`fixed_duration`, `wait_after {node, offset}`, `due_within`) and drive when the execution becomes eligible/`due_at`. The `wait` block is removed.

**Named clinical-date anchors (D3a).** Beyond `anchor_date` (day-0), a pathway may declare **named clinical dates** (e.g. `operation_date`) that are **set at enrollment with constraint-assisted guidance**. Blocks constrain such a date into an **allowed range** `[earliest, latest]`, and the caregiver picks within it:
- **earliest** = today + the largest **min-lead-time** (`≥ N days before <date>`) across blocks (plus: blocking prerequisites must be `done` before the date — a hard gate the caregiver judges, not a date estimate).
- **latest** = the tightest **max constraint** if any (e.g. clinical urgency "operate within N days").
The enroll field offers the range (pre-filled at `earliest`) and rejects out-of-range picks. **The concrete per-block day-numbers come from walking the actual pathway** (the bladder-cancer flow's "X days before operation" stickies) — captured in the seed/fixture and not invented here. `timing_policy` may then key off a named anchor — including **forward/negative offsets** (`operation_date − N days`) so pre-op work fires ahead of a planned date. If the date is rebooked, dependent Temporal timers recompute. (Driven by the bladder-cancer flow's "send pre-op info X days before the operation.")

**Alternative considered:** keep `wait` as an explicit block — rejected; duplicates timing already expressible on the dependent block. Forward timing onto a *downstream block's* runtime-booked date (vs an enroll-set named date) — rejected as harder to reason about; the enroll-set planned date is clearer and matches how clinicians plan around a surgery date.

### D4 — Per-block runtime contracts

Actor: **S**ystem / **C**aregiver / **P**atient (fake-log) / **E**xternal (fake-log).

| Block | Actor | Build (template) | Enroll (deferred) | Runtime (produced) | Completion |
|---|---|---|---|---|---|
| `start` | S | — | — | — | auto-fires at enrollment |
| `end_pathway` | S | — | — | — | auto on reach → enrollment `completed` |
| `task` | C | title, due_offset_days, requires_completion, notes | — | `{done, completed_at}` | caregiver marks Done |
| `appointment` | C | title, mode, duration_minutes, attendees_patient, notes | location (optional) | scheduled_at (book), `{performed_at}` | caregiver books date, then marks Performed |
| `treatment` | C | title, location, duration_minutes, notes | date (optional) | scheduled_at, `{performed_at, notes, complications}` | caregiver books, then records result |
| `mdo` | C | topic, expected_attendees_note | — | `{notes, closed_at}` | lead caregiver Closes + notes |
| `decision` | C | question, outputs[], mode (xor/and), auto_resolve.field_path | — | picked `output_key` | caregiver picks branch (auto if field present); engine fans out |
| `form` | P | title, intro, questions[], submit/confirmation labels | — | — (fake-log) | caregiver marks done (no patient portal) |
| `message` | P | subject, body, cta_label, cta_target, channel | — | — (fake-log) | caregiver marks sent |
| `informed_consent` | P | questions[], channels[], reminder/expiry config | — | — (fake-log; real `{consented, expired, signed_at}` later) | caregiver records |
| `external_program` | E | Luscii program ref | — | — (enroll only; no per-step data) | on reach: ensure Luscii connection + enroll in program (real, thin); no further orchestration |
| `pathway_link` | S | target pathway, version pin, mode (blocking/fire_and_forget) | — | — (fake-log; child completion later) | caregiver advances; nested enrollment hooked |

### D4a — Runtime materializes work primitives (task vs appointment are distinct)

A block execution is not just a state row; when it becomes actionable the runtime materializes the matching **work primitive**, which surfaces in existing caregiver surfaces. **Task and appointment are different entities**, not the same thing:

- **Appointment-backed blocks** (`appointment`, `treatment`, `mdo`) → create a real `Appointment` row (already pathway-aware via `appointments.pathway_block_instance_id`). The Appointment carries scheduling (`starts_at`/`ends_at`, `modality`, `location_text`), `participants` (roles lead/support/observer), and FHIR `status`. It surfaces in the existing `appointment` task source + calendar + `/tasks` inbox.
  - Kind mapping: `appointment` block — builder picks `AppointmentKind` (consultation/lab/imaging); `treatment` → `procedure`; `mdo` → `other`.
  - `mdo` has no patient attendance: `patient_id` = the enrolled (subject) patient, `participants` = caregivers only.
  - The **clinical result** (`treatment.complications`, `mdo.notes`) lives on `BlockExecution.result_json`, not on the Appointment. The Appointment owns scheduling + status; the execution owns the typed clinical outcome.
  - Completing/fulfilling the Appointment advances the block execution (status ↔ execution-state sync).
- **Task (to-do) blocks** (`task` + fake-log: `form`, `message`, `informed_consent`, `decision`, `external_program`, `pathway_link`) → no `Appointment`; the block execution itself is projected into a `TaskItem` via a new **`pathway` source** in the tasks aggregator. (There is no `tasks` table; a task is a projection — same pattern as the appointment source.) Completing the to-do advances the execution.
- **System blocks** (`start`, `end_pathway`) → no work primitive.

The `/tasks` inbox is therefore an aggregated view over distinct entities (appointments + pathway to-dos); it never conflates them.

### D5 — Enroll flow

Caregiver enrolls from the **patient page** (an "Enroll in pathway" action on the Pathway tab): picks a published pathway version, sets the **anchor date** (the day-0 relative timing counts from; defaults to today, editable), and supplies enroll-phase deferred values (from the typed enroll-form descriptor). Submits to existing `POST /enrollments`. Validation surfaces missing required deferred fields. A patient may have **multiple concurrent enrollments**; each renders separately. Enrollments are **pinned to the pathway version** they start on (later edits/new versions don't change a running patient). Lifecycle controls: **cancel + pause/resume** (model states active/paused/completed/cancelled); completion is automatic via `end_pathway`. No per-step skip in the PoC.

### D6 — List-by-patient read endpoint

New `GET /patients/{patient_id}/enrollments` (or `GET /enrollments?patient_id=`) returns the patient's enrollments each with their block executions (state, scheduled_at, due_at, completed_at, result_json). No list-by-patient surface exists today; the tab needs it to render next + finished steps.

### D7 — Patient Pathway tab

A new tab on the patient detail view, one section per active enrollment. Three step buckets:
- **Upcoming** — eligible but timing not yet elapsed: shown greyed with its due/scheduled date, not yet actionable (needs an `available_at`/ready gate on the execution beyond input-logic eligibility).
- **Next / actionable** — eligible with timing elapsed, or active: rendered per its D4 contract with the matching caregiver action (Done / Book / Perform / Close / Pick branch / Advance).
- **Finished** — `completed`/`skipped`: shows the typed **result summary** (appointment performed_at, treatment notes/complications, decision branch picked, mdo notes) plus the caregiver + timestamp.

**Editable values on the tab.** Beyond advancing steps, an authorized caregiver (with rights) or admin may **edit still-updatable values** on a running enrollment from the Zorgpad tab — clinical dates (e.g. `operation_date`), deferred values, role bindings — as long as they haven't been consumed (a completed block's result is locked; pending ones are editable). Editing a named clinical date (e.g. rebooking `operation_date`) **recomputes** the dependent Temporal timers (`operation_date − N`). The patient is data, never an editor.

The tab is labelled **"Zorgpad"** (Dutch UI string) and shows the **full** pathway across all horizons — near-term and far-future steps alike. This contrasts with the `/tasks` inbox, which is a flat near-term work list **visually windowed to the next 30 days** (same window as the appointment source): the runtime materializes pathway tasks/appointments for future steps too, but the inbox only surfaces the next 30 days while the Zorgpad tab shows them all. Exact layout to be prototyped as HTML (`prototypes/` per repo convention).

### D8 — Decision resolution (PoC)

`decision` is a caregiver action: it surfaces as an actionable step, the caregiver picks one of the build-authored `outputs`, and the engine fans out. `auto_resolve.field_path` may be authored in the builder but is **not wired** in the PoC (no data-driven resolution yet).

### D9 — Runtime substrate: Temporal (interpreter + SQL projection)

The runtime executes on **Temporal**, not the in-process engine. Pathways are data (builder-authored), so we do **not** compile a workflow per pathway. Instead:

- **One generic `PathwayEnrollmentWorkflow`** per enrollment. At start, an Activity loads the **pinned pathway version** (blocks + input_logic + timing) and hands it to the workflow as data; the workflow interprets it deterministically (version-pinning satisfies Temporal determinism — a running enrollment never sees a re-authored pathway).
- **Activities** (retryable side-effects, the only place I/O happens): `loadPathwayVersion`, `createAppointment`, `projectPathwayTask`, `writeExecutionProjection`, `emitAuditEvent` (→ `feat/audit-event-logging`), `callLuscii` (later). The current `engine.py` eligibility logic moves into the workflow interpreter; persistence moves into activities.
- **Signals** drive caregiver actions: `blockCompleted(execId, result)`, `decisionPicked(output)`, `cancel`, `pause`, `resume`.
- **Timers** handle block timing (`wait_after`, `due_within`) and escalation durably — no cron. This is the main reason for choosing Temporal.
- **Source of truth**: the Temporal workflow holds authoritative execution state. The Postgres `pathway_block_execution` / `pathway_enrollment` rows become a **read projection** written exclusively by activities, so the patient tab and the `pathway` task source can keep querying SQL. The workflow is the sole writer-trigger; projection writes are idempotent.

**Caregiver actions use Temporal Update (synchronous), not Signal.** An action endpoint sends an Update; the workflow validates, advances, and returns the new authoritative state in the response — immediate feedback, server-side validation, no UI guessing. Fire-and-forget lifecycle ops (`cancel`) may use Signal. The endpoint returns the Update result directly; the SQL projection (for the tab list + `/tasks` source) catches up via activities and is read-eventually-consistent by other surfaces.

**Worker topology:** one backend image, two entrypoints — the API server and a **separate worker process** (distinct container) registering `PathwayEnrollmentWorkflow` + activities, so API and workflow execution scale independently while sharing code/models.

**Dead-path cleanup:** when a `decision` prunes an `xor` branch or an enrollment is cancelled/paused, the workflow runs `cancelAppointment` / `withdrawTask` activities for the pruned blocks — their Appointments move to `cancelled` status and their task projections drop from the inbox, keeping all surfaces consistent. Materialization happens when a block becomes actionable (eligible, incl. greyed upcoming); pruned-before-materialized blocks need no cleanup.

**Infra**: a Temporal server + the worker process via the Python `temporalio` SDK. Temporal runs **isolated** from the shared dev stack — a separate compose file or a compose `profile` — so it does not perturb the default `docker-compose` used across worktrees. Deploy: Temporal Cloud or self-hosted (decide at MVP).

**Open (next session):** test pathways carrying the new fields (role-set, per-block role, runtime contracts) must be authored as **seed/fixtures** by hand, since builder authoring of these is a deferred follow-up.

**Alternative considered:** in-process sync engine with event-emitting transitions (lighter, no infra) — set aside in favor of Temporal's durable timers and autonomous advancement.

### D11 — People assignment: roles authored at build, bound to people at enrollment

A block that materializes work needs people, modelled as a **care-team / role-type reference**, not hard-coded users:
- **Build**: each materializing block (`appointment`, `treatment`, `mdo`, `task`) references a **care-role code** drawn from **one shared, FHIR-aligned value set** — the existing `role_in_care` / `PractitionerRole` codes that `CareTeam.participant` already uses. No new role-type entity: builder ↔ care-team ↔ `Appointment.participant` all align on this single vocabulary. The same role code may be referenced by many blocks.
- **Enroll**: for each block (or each distinct role-type), the caregiver **chooses the actual caregiver(s)** from that care-team — **one or several** (MDO has multiple participants). People come from the patient's **care team** (added to it if not yet on it). Blocks sharing a role-type may default to the same pick with a per-block override where needed.
- **Runtime**: materialization uses the chosen people — appointment/treatment/mdo → the picked caregiver(s) become the Appointment participants (one `lead` + optional support/observer); `task` → the picked caregiver is the assignee.

A pathway cannot be enrolled until every block's required caregiver(s) are chosen (same validation path as required deferred fields). Phase tags: the role-type *reference* is build; the role-type→caregiver(s) *choice* is enroll; the resulting participant(s)/assignee is runtime.

### D10 — Timed steps auto-advance; care-team visibility

- **Auto-advance:** a block with relative timing (`wait_after` N days) sets a **Temporal timer**; when it fires, the step flips `upcoming → actionable` automatically (caregiver still does the work). The `if_not_done_within` (escalation) predicate is also realized as a Temporal timer — see D13. This is the autonomous behavior Temporal is here for.
- **Visibility/authz:** the pathway tab and the `pathway` to-do source are visible/actionable to the **patient's care team** (any caregiver on the team), reusing the existing care-team access model — not per-step assignment, not tenant-wide.

### D12 — Per-block authoring matrix

**Authorable on every non-`start` block (stated once):** `input_logic` (dependencies + predicate + aggregator `all_of`/`any_of`/`n_of_m`), `timing_policy` (`fixed_duration` / `wait_after {node, offset}` / `due_within`), `name`/`description`/`lane`/`icon`, and per-field **deferral marking** (flip a build field to enroll). Columns below add the per-kind specifics.

| Block | Build values | Build business-logic (per-kind) | Role | Enroll | Runtime result |
|---|---|---|---|---|---|
| `start` | name | — (auto-fires, no input_logic/timing) | — | — | — |
| `end_pathway` | name | terminal; input_logic only | — | — | — (flips enrollment complete) |
| `task` | title, due_offset_days, notes | `requires_completion` | assignee role | role binding; any deferred field | `{done, completed_at}` |
| `appointment` | title, duration_minutes, attendees_patient, notes | `mode` (in_person/video/phone), `AppointmentKind` (consultation/lab/imaging) | lead role (+ support/observer) | location (optional), role binding(s), optional scheduled_at pre-fill | scheduled_at (book), `{performed_at}` |
| `treatment` | title, duration_minutes, notes | kind fixed `procedure` | lead role | optional date, role binding | scheduled_at, `{performed_at, notes, complications}` |
| `mdo` | topic, expected_attendees_note | kind fixed `other`; caregiver-only participants | lead role (+ caregiver participants) | role binding(s) | `{notes, closed_at}` |
| `decision` | question | `outputs[]`, `mode` (xor/and), `auto_resolve.field_path` (authored, not wired) | role that picks | role binding | picked `output_key` |
| `form` | title, intro, questions[], submit/confirmation labels | fake-log | — | — | — (answers later) |
| `message` | subject, body, cta_label, cta_target | `channel`; fake-log | — | — | — (sent later) |
| `informed_consent` | questions[] | `channels[]`, `reminder_offset_iso`, `reminder_max`, `expires_at_iso`; fake-log | — | — | — (`{consented, expired, signed_at}` later) |
| `external_program` | program/type config | Luscii program ref; fake-log/external | — | — | — (program data later) |
| `pathway_link` | target pathway, version pin | `mode` (blocking/fire_and_forget), nested render; fake-log | — | — | — (child completion later) |

Notes: "fake-log" blocks expose no role and no typed runtime result in the PoC — they advance via a caregiver-logged action with the audit hook. The role columns are build-declared, enroll-bound (D11). `decision.auto_resolve` is authored but PoC always asks the caregiver (D8).

### D13 — Trigger predicates wired + connection validation

The PoC `input_logic` vocabulary is: `IF_DONE`, `WAIT_AFTER`, `IF_NOT_DONE_WITHIN`, `DECISION_OUTPUT`, `HAS_DATA`, `VALUE_EQUALS`, `VALUE_GT`; aggregators `all_of` / `any_of` (+ optional `n_of_m`). `EVENT` is **dropped for the PoC** (nothing emits events after `wait` removal) — re-added when external integrations emit events. This vocabulary is what connects/triggers blocks, and it is bound to what runtime produces:

- **Timing predicates** (`WAIT_AFTER`, `IF_NOT_DONE_WITHIN`) are realized as **Temporal timers**. `IF_NOT_DONE_WITHIN` is the escalation trigger — now **in PoC** (Temporal makes it cheap).
- **Data predicates** (`HAS_DATA`, `VALUE_EQUALS`, `VALUE_GT`) and `DECISION_OUTPUT` may only reference an upstream block's **exposed runtime result/output**. Real-result blocks (`task`, `appointment`, `treatment`, `mdo`, `decision`) can be gated on their fields; **fake-log blocks expose nothing**, so they can only be referenced by `IF_DONE` / `WAIT_AFTER` / `IF_NOT_DONE_WITHIN` (no data-branching on a `form`/`consent` in the PoC).
- **`EVENT`** is dropped for the PoC (no emitter); re-introduced with real external integrations.

**Connection validation (publish-time):** a predicate that references a block + output/result-field SHALL be rejected (422) unless that block's runtime contract exposes it. This is the rule that keeps "what you can author to connect/trigger blocks" tied to "what the upstream block actually produces at runtime" — the builder cannot wire a trigger onto an output that doesn't exist.

### D14 — Reference seed pathway: bladder-cancer (urology) + integration classification

The demo seed is the real bladder-cancer urology flow (authored in Miro). Decoded block sequence:

```
start → informed_consent → external_program(Luscii invite) → appointment(scan)
→ task(review scan) → appointment(discuss results) → decision
  ──XOR──┬─ end_pathway ("do nothing")
         └─ pathway_link: nested sub-pathway "operate (biopsy)"  [REAL nested enrollment]
              ──AND(all_of)── appointment(lab test)→task(review lab test)
                              message(pre-op info)
                              form(anesthesia questionnaire)
                              external_program(Luscii measurements + escalate-if-out-of-bounds)
              → treatment(Operation)
              → fan-out: message(post-op info), form(PROM),
                         external_program(Luscii params),
                         task(view pathology results)
                           → mdo(MDO) → appointment → decision
                              ──┬─ end_pathway + pathway_link(fire_and_forget → oncology)  [bridge]
                                └─ end_pathway
```

The sticky-note structure (Pre-requisites / Actions / Complete-if) maps to: `input_logic` / materialization actions / completion predicate.

**Integration classification (mock / Luscii / build) — decided per block, filled as we walk:**

| Block (flow) | mock vs Luscii vs build | Notes |
|---|---|---|
| informed_consent | Luscii (inside program) | consent handled within a Luscii program, not a standalone block |
| external_program: Luscii enroll | Luscii (real) | ONE block, enrolled once: `POST /v1/patients` (`programId`/`protocolId`); program does consent + questionnaires + measurements internally |
| consent / anesthesia / measurements / PROM | Luscii-internal | all inside the one Luscii program — not separate pathway blocks |
| `task`: review Luscii pre-op data | build (caregiver) | caregiver verifies anesthesia + measurements are good in Luscii, marks done — **this gates the operation** |
| Luscii measurements on patient detail | existing (MeasurementCharts) | the read surface the caregiver reviews |
| message: pre-op / post-op info | mock (logged) | no real delivery in PoC |
| appointment / task / treatment / mdo / decision | build | caregiver-facing, built here |

**Luscii scope.** Confirmed against `luscii-public-api.json`:
- **One program, one block, enrolled once.** A single Luscii program (`programId`) is enrolled at the early `external_program` block via `POST /v1/patients` (demographics + identifiers + `programId`/`protocolId`; reuse an existing patient if found). The program runs consent + questionnaire + measurements **internally** — none are separate pathway blocks.
- **The operation gates on a caregiver task, not an auto-read.** Auto-gating on Luscii completion proved awkward, so a `task` ("review Luscii pre-op data is good") lets a caregiver verify anesthesia + measurements in Luscii and mark it done, gating the operation.
- **Reads feed the display, not auto-gates.** `GET /v1/measurements` / `/v1/alerts` power the existing `MeasurementCharts` patient-detail view the caregiver reviews. Webhooks (`/v1/webhooks-events`) are a later upgrade.
- Built on the existing read adapter plus the new `POST /v1/patients` enroll call.

### D15 — Subpath is inlining, not nested enrollment

A **subpath** is **another pathway, inlined**: a subpath block references a separate (reusable) pathway and the builder/loader **expands it into the parent's block set**. The builder already renders this visually (the `nested-pathway-blocks` capability). At runtime there is **one** enrollment and **one** Temporal workflow over the **flattened** block set — no child workflow, no nested enrollment. Consequences:
- The subpath's blocks are ordinary blocks: same `input_logic`, timing, roles, materialization as any other.
- **Enrollment scans the fully-flattened block set** (including inlined subpath blocks) when building the enroll descriptor — so any enroll-phase value (deferred field or role) introduced by a subpath block is prompted for at enroll. "If a subpath has enroll values, the enroll flow makes you set them."
- This is distinct from `pathway_link` to a **separate** pathway (the oncology **bridge**), which is a real cross-pathway handoff (fire-and-forget child enrollment) — not inlining.

**Supersedes** the earlier "real nested enrollment" reading of the operate subpath and the moot "inherit-from-parent" question (there is no separate parent/child — it's one flattened pathway).

## Risks / Trade-offs

- **Temporal infra + ops burden** → new server + worker, learning curve. Mitigation: docker-compose service locally; defer Cloud-vs-self-host to MVP; keep the worker thin (logic in workflow, I/O in activities).
- **Dual state (Temporal authoritative + SQL projection)** → reconciliation risk. Mitigation: SQL written only by idempotent activities triggered by the workflow; workflow is the single source of truth; never write the projection out-of-band.
- **Engine rewrite** → existing `engine.py` eligibility logic must move into the workflow interpreter, persistence into activities. Mitigation: no live enrollments to migrate; port logic with its existing tests as interpreter unit tests.
- **Workflow determinism** → no nondeterministic reads inside the workflow; all I/O via activities; pathway data loaded once at start. Version-pinning removes the workflow-versioning hazard from pathway edits.
- **Fake-log blocks look "done" without real effect** → label fake-log advances clearly in the tab; audit activity records the gap for later.
- **Removing `milestone`/`wait` is breaking** → migration drops the kinds; PoC pathways re-authored.
- **Stacked on freshly-merged runtime backend** → builds directly on `main` (PR 42 merged); low risk.

## Migration Plan

- Stand up Temporal: add a `temporal` service to `docker-compose`; add `temporalio` to backend deps; run a worker (backend process) registering `PathwayEnrollmentWorkflow` + activities.
- Port `engine.py` eligibility/fanout into the workflow interpreter; move persistence into activities writing the `pathway_block_execution` / `pathway_enrollment` projection.
- Remove `MilestoneBlock` and `WaitBlock` classes + catalogue entries; migration drops the `milestone`/`wait` kinds. `task.allowed_lane_kinds` → caregiver-only.
- No runtime-event table (audit emission deferred to `feat/audit-event-logging` via an activity).
- No data backfill — no live enrollments exist.

## Open Questions

- Patient tab layout (single list vs grouped-by-phase vs timeline) — resolve via HTML prototype.
- Decision `auto_resolve` data source wiring (which runtime field feeds `field_path`) — fake/manual for PoC, real later.
- Whether `appointment`/`treatment` book-date uses the existing deferred-value `PATCH` path or a dedicated runtime action endpoint.
