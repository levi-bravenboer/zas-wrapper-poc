# PoC Scope

## How to read this

This file is the **living scope ledger** for the ZAS PoC. It answers:

- *Is feature X in the PoC?* → see **PoC In-Scope**.
- *Should I assume Y works?* → see **PoC Out-of-Scope** + **PoC Mocks**.
- *What changes for MVP?* → see **PoC → MVP Delta**.

**Who updates it.** Whoever proposes a change that adds, removes, or re-tiers a feature edits this file as part of the change. Update lands in the same PR as the change proposal.

**When to read it.** Before proposing any OpenSpec change. Before implementing any task. After pulling main, if you weren't paying attention while it was being edited.

**Tier tags.** Every line carries a tier: `[poc]` (in PoC demo), `[mvp]` (first paying release), `[product]` (later). No tag = bug.

**Relation to other files.**
- `openspec/project.md` — the world (long-lived). Stakeholders, integrated systems, hard constraints.
- `openspec/scope.md` — **this file**. What we are and aren't building right now.
- `openspec/roadmap.md` — tier progression (PoC → MVP → Product). Current-tier flag, per-tier exit criteria, sequencing.
- `openspec/backlog.md` — parking lot for findings, deferred ideas, MVP+ details. Out-of-tier work goes here, not into a change folder.
- `openspec/changes/` — active change proposals. Every proposal cites its tier; out-of-tier proposals belong in `backlog.md` until promoted.

---

## Project Idea

Care-pathway **orchestration builder** for ZAS Antwerpen. We are a builder, not a clinician: hospitals author their own pathways with our tool, composing operational workflow steps (send email, create HiX task, schedule appointment, branch on a decision, milestone, embed a Luscii clinical care path as a sub-flow). We do not encode clinical reasoning — that lives in Luscii's clinical care paths, which we treat as opaque sub-flow blocks. PoC validates the composer + caregiver web app spine end-to-end with mocked HiX / Luscii / auth.

**June 2026 demo target.** Composer + caregiver web app driven over hospital-authored demo content (Rugrevalidatie + one more), fully mocked backends. The demo content is examples a hospital could build with the tool — we don't own the clinical domain.

**Vocabulary.**
- **Care pathway** — our composition: operational workflow steps a hospital wires together (manual + technical).
- **Clinical care path** — Luscii's clinical sub-flow. Opaque block to us; mocked as static JSON in PoC.

**Product shape note.** PoC ships Designer + Orchestrator as a single web app. Splitting into separate apps is `[mvp]`.

**Hard invariant — never an MDR medical device.** See `openspec/project.md` Important Constraints + `openspec/mdr-watchlist.md`. Holter (and any medical-device territory) is **out of PoC and MVP scope**.

---

## PoC In-Scope

Everything in this list is `[poc]` by definition. Each item has a stable feature ID (`F1`..`Fn`) and a one-line acceptance criterion. IDs are referenced by `openspec/changes/` and `openspec/backlog.md`.

- **`F1` Login** — Caregiver signs in with a hard-coded username + password; session cookie is set; protected routes redirect when unauthenticated.
- **`F2` Dashboard** — Logged-in caregiver lands on a dashboard showing summary cards for their patients + pending tasks. Demo: counts + one-click drill-down.
- **`F3` Carepath builder** — Designer composes a care pathway from blocks (appointments, decisions, **Luscii clinical care path** as a single block, milestones) and saves it; saved pathways are listed and re-openable. Saved-in-builder = enrollable (no separate publish step in PoC).
- **`F4` Patients overview** — Caregiver sees a list of all patients enrolled in any pathway, filterable by pathway + status; clicking a row opens the patient view.
- **`F5` Patient view** — Single patient page shows the patient's current care pathway, current step, completed + upcoming steps, and the Luscii clinical care path block (rendered from static JSON in PoC, no live Luscii) as part of the pathway visualization. Every patient in the PoC is in exactly one pathway we composed.
- **`F6` Task view** — Caregiver sees an inbox of tasks across all their patients (not just one). Tasks can be marked complete; completing updates the patient's pathway state.
- **`F7` Pathway model + backend** — Backend exposes the API surface for `F1`–`F8`: auth, pathway definitions, patient enrollment, task list, task completion. Persisted in our own DB. Care pathway = our composition; Clinical care path = Luscii sub-flow (mocked in PoC).
- **`F8` Admin (minimal)** — A bootstrapped admin can list users and assign caregiver role. No multi-tool admin work in PoC.

---

## PoC Out-of-Scope

Explicit "no for PoC" — the obvious things a reader will ask about. Long-tail deferrals live in `openspec/backlog.md`.

- **HiX embed** `[mvp]` — Orchestrator screens are not embedded in HiX during PoC. Standalone web app only.
- **HiX FHIR live integration** `[mvp]` — No real HiX reads, writes, or SMART-on-FHIR launch. HiX is fully mocked.
- **Two-way task sync with HiX** `[mvp]` — Tasks live only in our DB during PoC. No mirroring to HiX, no callback from HiX.
- **Luscii live integration** `[mvp]` — No Luscii Builder API, no Luscii task webhook, no Luscii Vitals embed. Luscii clinical care paths are static JSON in our DB.
- **Patient surface** `[mvp]` — Patient view of Pathway Orchestrator + HiX Patient Portal touchpoint + Luscii deep-link are MVP work. Patients are data, not users, in PoC.
- **Real authentication** `[mvp]` — No IdP, no eID, no itsme®, no CSAM, no eHealth. PoC uses a hard-coded user table. External caregiver login (eID) is `[mvp]`.
- **Notifications** `[mvp]` — No email, SMS, push, or in-HiX notifications.
- **Real patient data** — Synthetic fixtures only. This is a project-wide invariant, not a PoC concession; included here so demo planning never forgets it.

---

## PoC Mocks

Each row: the mock used in PoC → the real thing it stands in for at MVP.

| Mock (PoC) | Real thing (MVP) |
|---|---|
| **Auth** — seeded users in DB (argon2id `password_hash`), `LoginProvider` seam shipped with `password` provider only, cookie session (`HttpOnly` + `SameSite=Lax` + `Secure` in prod + `__Host-` prefix in prod), structured login audit log to stdout, `external_idp`/`external_subject` columns ready (null in PoC), RRN never stored | IdP integration: eHealth / itsme® / CSAM for ZAS; eID for external caregivers; role-based access control. Plus MVP compliance gates: `BL-042` server-side session revocation, `BL-043` rate-limit + lockout, `BL-044` MFA via OIDC (LoA High), `BL-045` RP-initiated logout, `BL-046` DPIA, `BL-047` SMART-on-FHIR bearer-token path, `BL-048` OIDC hardening (PKCE/state/nonce/JWKS), `BL-049` password reset (if password provider survives) |
| **HiX** — no client; pathways are not initiated from HiX context | SMART-on-FHIR launch from HiX, FHIR R4 read / write, task two-way sync, embeddable orchestrator surface |
| **Luscii** — clinical care paths represented as static JSON blocks in our DB, no measurements ingested | Luscii Builder API for block authoring, Luscii task webhook for monitoring-triggered tasks, Luscii Vitals embed for clinician viewer |
| **Patients** — seeded fake patients in our DB | Patients enrolled from HiX context (FHIR Patient resource on launch) |
| **Tasks** — orchestrator-only tasks in our DB | Tasks mirrored to HiX task list with two-way completion sync; Luscii-originated tasks ingested via webhook |
| **Notifications** — none; user finds work by opening the app | Email + HiX inbox + Luscii push notifications, depending on user + event type |

---

## PoC → MVP Delta

Per feature: what is the PoC state, what is the MVP state, what external thing must land to bridge the gap.

| Feature | PoC state | MVP delta | MVP blocker |
|---|---|---|---|
| `F1` Login | Seeded users + cookie session (argon2id, `HttpOnly`/`SameSite=Lax`/`Secure`, `__Host-` prefix in prod, prod seed guard); `LoginProvider` Protocol + `GET /auth/providers` discovery seam shipped (one `password` provider); login audit log to stdout; `users.external_idp`/`external_subject` columns + tenant-scoped lookup ready (null in PoC); spec forbids storing Belgian RRN | IdP-backed login (eHealth / itsme® / eID / CSAM) as `oidc` providers via the same seam; role-based ACL; full session hardening (server-side revocation `BL-042`, rate-limit `BL-043`, MFA via LoA High IdPs `BL-044`, RP-initiated logout `BL-045`, DPIA `BL-046`, SMART-on-FHIR bearer path `BL-047`, OIDC hardening `BL-048`, password lifecycle `BL-049`) | IdP integration design + contracts (eHealth, itsme®, eID, CSAM); NewWave Care input; BL-042..BL-049 closure |
| `F2` Dashboard | Summary cards over mocked data | Live counts from HiX + Luscii + Orchestrator; alerting on out-of-bounds | HiX FHIR adapter; Luscii API contract |
| `F3` Carepath builder | Standalone web app, save to our DB; saved = enrollable. Block roster (`pathway-block-redesign`): appointment, task, message, form, decision, milestone, wait, pathway_link. Edge timing kinds: `completion`, `marker`, `immediate`, `branch`. Inspector forms for `form` / `wait` / `pathway_link` are placeholders pending `pathway-config-forms`. Timing-value kinds: `fixed` + `enrollment` only | Publish flow to Orchestrator runtime + audit trail + versioning; Luscii block configured against real Luscii Builder; **runtime-kind timing** (block A duration = block B output, requires `output_schema` on block-type catalogue); phase anchor model (`anchor_block_id` or `anchor_event_type`) once runtime computes phase dates; bespoke inspector widgets (`pathway-config-forms`: form-questions, event-type-picker, pathway-picker) | Luscii Builder API; designer/runtime split decision (separate app? same?); F5/F6 runtime engine landing for runtime-kind + phase anchors |
| `F4` Patients overview | List of seeded patients | List of patients enrolled from HiX, filtered by caregiver / pathway / risk; pagination + search | HiX patient enrollment flow (SMART launch + FHIR Patient read) |
| `F5` Patient view | Static pathway viz + Luscii block rendered from static JSON | Live pathway state synced to HiX (appointments, signed docs, lab results); embedded Luscii Vitals; patient touchpoint shape decided | HiX FHIR adapter; Luscii Vitals embed contract; patient view decision (`BL-014`) |
| `F6` Task view | Inbox over our DB | HiX two-way sync; Luscii-originated tasks; cross-patient filter + assignment | HiX task API contract; Luscii task webhook |
| `F7` Pathway backend | Our DB schema; mocked adapters | Real adapters; FHIR-shaped internal model; OperationOutcome error envelope; ETag versioning | HiX FHIR R4 adapter; Luscii API; compliance review |
| `F8` Admin | Local user table | Cross-tool admin (HiX admin coordination, Luscii admin); audit log; GDPR DSR flows | HiX + Luscii admin integration scope decisions |
