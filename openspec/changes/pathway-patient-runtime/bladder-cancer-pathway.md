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

## Participants (FHIR action.participant — role + specialty, resolved to Practitioners at enroll)

| Block participant | role code | specialty | Notes |
|---|---|---|---|
| Urologist (hoofdbehandelaar) | physician | urology | most appointments/tasks/decisions |
| Casemanager (verpleegkundige) | nurse | — | coordinates, ends pathway |
| MDO participants | physician | (per discipline) | the MDO panel — multiple, one lead |
| GP (huisarts) | — | — | transmural, informed only — not a bound participant |
| Patient | — | — | subject; not a user — data |

## Phases (from the blueprint)

First complaints · First consultation · Initial onboarding · Scans · Decision to biopsy · Pre surgery · Day of surgery · Recovery & waiting for results · Analysis of tissue · Diagnosis & treatment decision · (→ oncology care path)

## Block-by-block (initial Miro decode — SUPERSEDED)

> This was the first read of the Miro. The **authoritative** seed is the "Seed definition — walked together" section below (it adds a diagnostic MDO, places Luscii early, makes lab-review a decision, etc.). Kept for reference only.

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

## Seed definition — walked together (authoritative)

Early spine (confirmed):

| # | Block | Kind | Participant (role/specialty) | prereq | Completes |
|---|---|---|---|---|---|
| 1 | Patient added | `start` | system | — | auto at enroll |
| 2 | Enroll in Luscii | `external_program` | — | `if_done(1)` | program enrolled (does consent + measurements + PROM internally) |
| 3 | Appointment: scan | `appointment` (imaging) | urologist (physician/urology) | `if_done(2)` | patient attended + scan made |
| 4 | Task: review scan | `task` | urologist | `if_done(3)` | urologist reviewed |
| 4b | Task: prep diagnostic MDO | `task` (**links to 5**) | urologist | `if_done(4)` | add draft outcome + notes/files to MDO 5 |
| 5 | MDO (diagnostic) | `mdo` | panel: urologist (lead) + radiology + pathology + oncology | `if_done(4b)` | lead **commits** outcome (operate / do-nothing) |
| 6 | Appointment: discuss results | `appointment` (consultation) | urologist | `if_done(5)` | patient attended |
| 7 | Decision: operate? | `decision` | urologist | `if_done(6)` | outcome recorded (operate / do-nothing); XOR |

XOR on (7): **do-nothing → `end_pathway`**; **operate → subpath "operate (biopsy)"** (inlined):

| # | Block | Kind | Participant | prereq | Notes |
|---|---|---|---|---|---|
| 8 | Appointment: lab test | `appointment` (lab) | urologist | enter (`decision_output(7,operate)`) | |
| 9 | Decision: review lab test | `decision` | urologist | `if_done(8)` | outcomes proceed/abort; abort → `end_pathway` |
| 10 | Send pre-op info | `message` | — (mock) | enter | timing `operation_date − N` |
| 11 | Task: review Luscii pre-op data | `task` | urologist | enter | gates op on Luscii measurements/anesthesia |
| 12 | Operation | `treatment` (procedure) | urologist | `all_of(decision_output(9,proceed), 10, 11)` | scheduled `operation_date`; result {performed_at,notes,complications} |
| 13 | Send post-op info | `message` | — (mock) | `if_done(12)` | |
| 14 | Task: view pathology results | `task` (**links to 15**) | urologist | `if_done(12)` + pathology marked-in (mock) | review results; add draft + notes/files to MDO 15 |
| 15 | MDO (post-op) | `mdo` | panel (lead urologist + radiology + pathology + oncology) | `if_done(14)` | lead **commits** outcome (treatment/nothing) |
| 16 | Appointment: discuss | `appointment` (consultation) | urologist | `if_done(15)` | |
| 17 | Decision: treat? | `decision` | urologist | `if_done(16)` | outcomes treatment/nothing; XOR |
| 18a | treatment → bridge | `end_pathway` + `pathway_link`(fire_and_forget → oncology) | system | `decision_output(17,treatment)` | hand to oncology pathway |
| 18b | nothing → end | `end_pathway` | system | `decision_output(17,nothing)` | |

## Seed data (so the pathway need not be hand-built)

The seed script SHALL create:
- **Pathway**: the full bladder-cancer pathway template (blocks + participants + clinical dates + timing + Luscii `programId` placeholder), published.
- **Patient**: Jansen, Pieter (68, M) + a `CareTeam`.
- **Practitioners** (with `PractitionerRole` code + specialty):
  - Dr. A. de Vries — `physician` / `urology` (urologist, lead)
  - S. Smit — `nurse` (casemanager)
  - Dr. R. Jansen — `physician` / `radiology` (MDO)
  - Dr. P. Klein — `physician` / `pathology` (MDO)
  - Dr. O. Bos — `physician` / `oncology` (MDO)
- GP — informed only, not a bound participant.

## What must be built / matched (gaps)

To make this pathway actually run across enrollment + builder + runtime:

1. **Subpath inlining** — "operate (biopsy)" is a **subpath**: builder-time inlining that flattens into regular blocks in the **same** pathway/enrollment (no nested child workflow). The builder must expand it; **enrollment must scan the flattened block set** so any enroll value/role a subpath block introduces is prompted for. (The oncology **bridge** at the end is the separate-pathway `pathway_link` — a real handoff, distinct from subpath.)
2. **Named clinical-date anchors set at enrollment (e.g. operation date)** — RESOLVED: the operation date is a **planned clinical date set at enrollment**, with **constraint-assisted suggestion**. Blocks constrain it two ways: (a) **blocking** prerequisites (`operation` `all_of(lab, anesthesia, measurements)` — must finish before), and (b) **min lead time** ("earliest N days from now / from block X"). The system computes the earliest feasible operation date to guide the caregiver. **Forward timing** then becomes simple: pre-op blocks (info, anesthesia) fire at `operation_date − N days`. If the date is rebooked, dependent timers recompute.
3. **Timing keys off named anchors** — `timing_policy` gains an anchor reference: relative to node-completion (existing) **or** relative to a named clinical-date anchor (e.g. `operation_date − N days`). Anchors are enroll-set dates; `anchor_date` (day-0) is the default one.
4. **Luscii enroll activity** — `POST /v1/patients` with `programId`/`protocolId` (one program; resolve our patient via the existing Luscii patient-identifier link). No per-step Luscii orchestration; a caregiver `task` gates the operation. Measurement display on patient detail reuses the existing `MeasurementCharts` (read). Built on the existing read adapter + a new enroll call.
5. **Role-set authoring + binding** — urologist, casemanager, MDO lead bound at enroll from the care team.
6. **Materialization mapping** — Appointment kinds (imaging/lab/consultation/procedure/other) per block; task projection via the `pathway` source.
7. **Decision outputs feeding XOR** — `decision_output` predicate gates the two XOR branches; publish-validation that the referenced outputs exist.
8. **Seed fixture** — author this whole pathway (blocks + roles + input_logic + timing + Luscii program ref) as a seed, since builder authoring of the new fields is a follow-up.

## Resolved

- **Forward timing** ("X days before operation") → named clinical-date anchor `operation_date`, set at enroll with constraint-assisted "earliest feasible" suggestion; pre-op blocks = `operation_date − N` (D3a).
- **Subpath "operate"** → builder-time **inlining** into the same pathway/enrollment (D15); enrollment scans the flattened block set for enroll values. Not a nested child workflow.
- **Pathology-reported gate (n10)** → **mock**: caregiver marks "results in" to make the review task actionable (no lab/HiX integration in PoC).
- **Anesthesia + measurements** → **Luscii-internal** (inside the one program), not separate blocks; the operation is gated by a **caregiver task** ("review Luscii pre-op data is good").

## operation_date allowed range (TODO — walk the pathway)

`operation_date` is bounded by an allowed range `[earliest, latest]` derived from per-block constraints. Day-numbers to be filled by going over the flow:

| Block | Constraint on operation_date | Days (TBD) |
|---|---|---|
| pre-op info (`message`) | `≥ N days before` | ? |
| review Luscii pre-op data (`task`) | must be `done` before (hard gate) | — |
| lab test + review | must be `done` before (hard gate) | — |
| scan + review | must be `done` before (hard gate) | — |
| clinical urgency (if any) | `≤ M days` (latest bound) | ? |

> Anesthesia/measurements run inside the Luscii program (not blocks); the caregiver `task` "review Luscii pre-op data" is the gate.

→ earliest = today + max(lead times); latest = tightest max bound (if any). Fill from the Miro "X days before operation" notes.

## PoC assumptions / shortcuts

- **Consent is not gated.** Consent lives inside the Luscii program; for the PoC the pathway does **not** verify it — downstream blocks proceed (assume the patient consents). Real consent gating is a later upgrade (read Luscii consent action).
- **Operation pre-op gate is a caregiver task** ("review Luscii pre-op data is good"), not an automatic Luscii read.
- **Pathology results** are caregiver-marked (no lab/HiX integration).
- **Messages + GP-share** are mock (logged, no delivery).
- **`end_pathway` leaves the Luscii program running** — no unenroll/stop call; Luscii monitoring/PROMs continue independently.
- **Decision/MDO outcomes are binary `treatment` / `nothing`** for the seed (decision 1: operate/nothing; final/MDO: treatment→bridge oncology / nothing→end). Richer staging-based outcomes (TURBT, BCG, cystectomy, chemoradiation, systemic) are a later, clinically-validated enrichment.

## Still needed

- Luscii enroll endpoint wiring (`POST /v1/patients`) + read-poll cadence (timer vs on-eval).
- Constraint-assisted `operation_date` computation (min lead times + blocking prereqs).
- "Share result with GP" actions (decision blocks) — mock for PoC.
