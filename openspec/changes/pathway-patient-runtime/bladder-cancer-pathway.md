# Bladder-cancer (urology) pathway — mapped into our system

The demo seed. This document maps the Miro service-blueprint flow onto our block model, roles, timing, and runtime, and lists what must be built for it to run end-to-end across **enrollment + builder + runtime**.

## How the Miro stickies map

Each Miro block carries three parts → our model:

| Miro sticky | Our model |
|---|---|
| **Pre-requisites** | `input_logic` (predicates over upstream blocks: `if_done`, `value_equals`, `decision_output`, timing) |
| **Actions** | runtime **materialization** (create Appointment / project task / Luscii enroll / send message) |
| **Complete-if** | the block's **completion predicate** (what advances the execution) |

XOR/AND in the flow = a `decision` block (`mode=xor`) and an `all_of` convergence (the `operation` block depends on all parallel pre-op blocks).

## Roles (bound to people at enrollment)

| Role | role_in_care | Notes |
|---|---|---|
| Urologist (hoofdbehandelaar) | lead clinician | most appointments/tasks/decisions |
| Casemanager (verpleegkundige) | care coordinator | coordinates, ends pathway |
| MDO lead | lead at the multidisciplinary meeting | may = urologist |
| GP (huisarts) | transmural, informed | receives shared results; not necessarily a bound actor |
| Patient | subject | not a user — data |

## Phases (from the blueprint)

First complaints · First consultation · Initial onboarding · Scans · Decision to biopsy · Pre surgery · Day of surgery · Recovery & waiting for results · Analysis of tissue · Diagnosis & treatment decision · (→ oncology care path)

## Block-by-block

Linear spine, then an XOR, then the nested "operate" sub-pathway with an AND fan-out.

| # | Block | Kind | Actor/Role | input_logic (prereq) | Timing | Actions (materialize) | Complete-if | Phase |
|---|---|---|---|---|---|---|---|---|
| 1 | Patient added to carepath | `start` | system | — | at enroll | (portal invite mocked) | auto-fires at enroll (portal-login gating skipped, PoC) | Onboarding |
| 2 | Enroll in Luscii program | `external_program` | external/Luscii | `if_done(1)` | at enroll/reach | `POST /v1/patients` (programId) — one program does consent + questionnaires + measurements internally | enrolled in program | Onboarding |
| 4 | Appointment: scan | `appointment` | urologist | `if_done(2)` consent | — | create Appointment(kind=imaging), invite to schedule, share prep info | patient attended, scan made | Scans |
| 5 | Task: review scan | `task` | urologist | `if_done(4)` | — | project task for urologist | urologist reviewed scan | Scans |
| 6 | Appointment: discuss results | `appointment` | urologist | `if_done(5)` | — | create Appointment(consultation), invite to schedule | patient attended | Decision to biopsy |
| 7 | Decision (operate?) | `decision` | urologist | `if_done(6)` | — | record decision (outputs: operate / do_nothing), share with GP | decision recorded | Decision to biopsy |
| 8 | **XOR** | — | — | `decision_output(7)` | — | — | — | — |
| 8a | End pathway (do nothing) | `end_pathway` | caregiver | `decision_output(7, do_nothing)` | — | read-only mode | pathway ended | — |
| 8b | Subpath: operate (biopsy) | `pathway_link` (**nested**) | system | `decision_output(7, operate)` | — | spawn nested sub-enrollment | child sub-pathway done | Pre surgery |

### Nested sub-pathway: operate (biopsy)

AND fan (all start after the operate decision; `operation` requires `all_of`):

| # | Block | Kind | Role | input_logic | Timing | Actions | Complete-if |
|---|---|---|---|---|---|---|---|
| n1 | Appointment: lab test | `appointment` | urologist | enter sub-pathway | — | Appointment(kind=lab) | patient attended |
| n2 | Task: review lab test | `task` | urologist | `if_done(n1)` | — | project task | urologist reviewed |
| n3 | Send pre-op info | `message` | patient | enter | **`operation_date − N days`** | mock: log send | sent |
| n4 | Task: review Luscii pre-op data | `task` | caregiver | enter | — | caregiver verifies anesthesia + measurements are good in Luscii (MeasurementCharts) | caregiver marked good |
| n5 | Treatment: Operation | `treatment` | urologist | `all_of(n2, n3, n4)` | scheduled `operation_date` | Appointment(kind=procedure) + book + perform; clinical result | operation done |

Fan-out after `operation`:

| # | Block | Kind | Role | input_logic | Actions | Complete-if |
|---|---|---|---|---|---|---|
| n6 | Send post-op info | `message` | patient | `if_done(n5)` | mock: log send | sent |
| n7 | Task: view pathology results | `task` | urologist | `if_done(n5)` + pathology marked in (mock) | project task | urologist reviewed results |
| n8 | MDO | `mdo` | MDO lead + caregivers | `if_done(n7)` (reviewed by all) | Appointment(kind=other, caregiver participants) | everyone contributed, lead decided |
| n9 | Appointment (post-MDO) | `appointment` | urologist | `if_done(n8)` | Appointment(consultation), patient discusses options | patient attended |
| n10 | Decision (treat?) | `decision` | urologist | `if_done(n8)` | record decision (outputs: cancer_treatment / nothing) | decision recorded |
| n11 | XOR → cancer treatment | `end_pathway` + `pathway_link`(fire_and_forget → oncology) | system | `decision_output(n10, cancer_treatment)` | end this pathway + kick off oncology pathway | handed over |
| n12 | XOR → end pathway | `end_pathway` | caregiver | `decision_output(n10, nothing)` | — | pathway ended |

> PROM + post-op measurements are part of the **one Luscii program** (post-op phase) — internal, not separate pathway blocks.

## What must be built / matched (gaps)

To make this pathway actually run across enrollment + builder + runtime:

1. **Subpath inlining** — "operate (biopsy)" is a **subpath**: builder-time inlining that flattens into regular blocks in the **same** pathway/enrollment (no nested child workflow). The builder must expand it; **enrollment must scan the flattened block set** so any enroll value/role a subpath block introduces is prompted for. (The oncology **bridge** at the end is the separate-pathway `pathway_link` — a real handoff, distinct from subpath.)
2. **Named clinical-date anchors set at enrollment (e.g. operation date)** — RESOLVED: the operation date is a **planned clinical date set at enrollment**, with **constraint-assisted suggestion**. Blocks constrain it two ways: (a) **blocking** prerequisites (`operation` `all_of(lab, anesthesia, measurements)` — must finish before), and (b) **min lead time** ("earliest N days from now / from block X"). The system computes the earliest feasible operation date to guide the caregiver. **Forward timing** then becomes simple: pre-op blocks (info, anesthesia) fire at `operation_date − N days`. If the date is rebooked, dependent timers recompute.
3. **Timing keys off named anchors** — `timing_policy` gains an anchor reference: relative to node-completion (existing) **or** relative to a named clinical-date anchor (e.g. `operation_date − N days`). Anchors are enroll-set dates; `anchor_date` (day-0) is the default one.
4. **Luscii activities** — (a) **enroll**: `POST /v1/patients` with `programId`/`protocolId` (create connection + program); (b) **read-gating**: poll `GET /v1/instrument-item-responses` + `GET /v1/measurements` + `GET /v1/alerts` to complete the anesthesia/measurements blocks + escalate out-of-bounds. Built on the existing read adapter + a new enroll call.
5. **Role-set authoring + binding** — urologist, casemanager, MDO lead bound at enroll from the care team.
6. **Materialization mapping** — Appointment kinds (imaging/lab/consultation/procedure/other) per block; task projection via the `pathway` source.
7. **Decision outputs feeding XOR** — `decision_output` predicate gates the two XOR branches; publish-validation that the referenced outputs exist.
8. **Seed fixture** — author this whole pathway (blocks + roles + input_logic + timing + Luscii program ref) as a seed, since builder authoring of the new fields is a follow-up.

## Resolved

- **Forward timing** ("X days before operation") → named clinical-date anchor `operation_date`, set at enroll with constraint-assisted "earliest feasible" suggestion; pre-op blocks = `operation_date − N` (D3a).
- **Subpath "operate"** → builder-time **inlining** into the same pathway/enrollment (D15); enrollment scans the flattened block set for enroll values. Not a nested child workflow.
- **Pathology-reported gate (n10)** → **mock**: caregiver marks "results in" to make the review task actionable (no lab/HiX integration in PoC).
- **Anesthesia + measurements gates** → **real, read-gated from Luscii** (`/v1/instrument-item-responses`, `/v1/measurements`, `/v1/alerts`).

## PoC assumptions / shortcuts

- **Consent is not gated.** Consent lives inside the Luscii program; for the PoC the pathway does **not** verify it — downstream blocks proceed (assume the patient consents). Real consent gating is a later upgrade (read Luscii consent action).
- **Operation pre-op gate is a caregiver task** ("review Luscii pre-op data is good"), not an automatic Luscii read.
- **Pathology results** are caregiver-marked (no lab/HiX integration).
- **Messages + GP-share** are mock (logged, no delivery).
- **`end_pathway` leaves the Luscii program running** — no unenroll/stop call; Luscii monitoring/PROMs continue independently.

## Still needed

- Luscii enroll endpoint wiring (`POST /v1/patients`) + read-poll cadence (timer vs on-eval).
- Constraint-assisted `operation_date` computation (min lead times + blocking prereqs).
- "Share result with GP" actions (decision blocks) — mock for PoC.
