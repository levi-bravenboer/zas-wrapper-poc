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
| 1 | Patient added to carepath | `start` | system | — | at enroll | invite patient, set primary caregiver | patient logs into portal first time | Onboarding |
| 2 | Send informed consent | (Luscii-internal) | patient/Luscii | `if_done(1)` | — | (inside Luscii program) | patient signs consent | Onboarding |
| 3 | Enroll in Luscii program | `external_program` | external/Luscii | `if_done(1)` | at enroll/reach | ensure Luscii connection + enroll program | enrolled in program | Onboarding |
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
| n3 | Send pre-op info | `message` | patient | enter | **X days before n6 (operation)** | mock: log send | sent |
| n4 | Anesthesia questionnaire | (Luscii-internal) | patient/Luscii | enter | X days before n6 | inside Luscii | patient completed |
| n5 | Luscii measurements | (Luscii-internal) | patient/Luscii | enter | — | inside Luscii (request params, escalate) | patient provided |
| n6 | Treatment: Operation | `treatment` | urologist | `all_of(n2, n3, n4, n5)` | scheduled date (booked) | Appointment(kind=procedure) + book + perform; clinical result | operation done |

Fan-out after `operation`:

| # | Block | Kind | Role | input_logic | Actions | Complete-if |
|---|---|---|---|---|---|---|
| n7 | Send post-op info | `message` | patient | `if_done(n6)` | mock: log send | sent |
| n8 | PROM | (Luscii-internal) | patient/Luscii | `if_done(n6)` | inside Luscii | patient completed |
| n9 | Luscii params (post-op) | (Luscii-internal) | external/Luscii | `if_done(n6)` | inside Luscii | — |
| n10 | Task: view pathology results | `task` | urologist | `if_done(n6)` + pathology reported | project task | urologist reviewed results |
| n11 | MDO | `mdo` | MDO lead + caregivers | `if_done(n10)` (reviewed by all) | Appointment(kind=other, caregiver participants) | everyone contributed, lead decided |
| n12 | Appointment (post-MDO) | `appointment` | urologist | `if_done(n11)` | Appointment(consultation), patient discusses options | patient attended |
| n13 | Decision (treat?) | `decision` | urologist | `if_done(n11)` | record decision (outputs: cancer_treatment / nothing) | decision recorded |
| n14 | XOR → cancer treatment | `end_pathway` + `pathway_link`(fire_and_forget → oncology) | system | `decision_output(n13, cancer_treatment)` | end this pathway + kick off oncology pathway | handed over |
| n15 | XOR → end pathway | `end_pathway` | caregiver | `decision_output(n13, nothing)` | — | pathway ended |

## What must be built / matched (gaps)

To make this pathway actually run across enrollment + builder + runtime:

1. **Nested sub-pathway runtime** (`pathway_link`) — "operate (biopsy)" is a real nested enrollment. The parent must spawn a child enrollment/workflow, gate on its completion, and clean up on cancel. **In scope, not yet specced in runtime detail.**
2. **Named clinical-date anchors set at enrollment (e.g. operation date)** — RESOLVED: the operation date is a **planned clinical date set at enrollment**, with **constraint-assisted suggestion**. Blocks constrain it two ways: (a) **blocking** prerequisites (`operation` `all_of(lab, anesthesia, measurements)` — must finish before), and (b) **min lead time** ("earliest N days from now / from block X"). The system computes the earliest feasible operation date to guide the caregiver. **Forward timing** then becomes simple: pre-op blocks (info, anesthesia) fire at `operation_date − N days`. If the date is rebooked, dependent timers recompute.
3. **Timing keys off named anchors** — `timing_policy` gains an anchor reference: relative to node-completion (existing) **or** relative to a named clinical-date anchor (e.g. `operation_date − N days`). Anchors are enroll-set dates; `anchor_date` (day-0) is the default one.
4. **Luscii enroll activity** — ensure-connection + enroll-in-program (thin), built on `app/adapters/luscii`. Needs Luscii's enroll/connection endpoints.
5. **Role-set authoring + binding** — urologist, casemanager, MDO lead bound at enroll from the care team.
6. **Materialization mapping** — Appointment kinds (imaging/lab/consultation/procedure/other) per block; task projection via the `pathway` source.
7. **Decision outputs feeding XOR** — `decision_output` predicate gates the two XOR branches; publish-validation that the referenced outputs exist.
8. **Seed fixture** — author this whole pathway (blocks + roles + input_logic + timing + Luscii program ref) as a seed, since builder authoring of the new fields is a follow-up.

## Open questions raised by this flow

- **(2)** "X days before operation" — how do we model forward/negative timing onto a downstream block's booked date?
- Does the nested sub-pathway share the parent's bound roles + anchor, or rebind?
- Pathology-reported gate (n10) — Luscii-internal/mock, or a real lab-result signal?
