# AI Opportunity Mapping

**Status:** research / vision mapping (not a committed change).
**Date:** 2026-06-22.
**Scope decision:** This mapping deliberately includes AI use cases that touch patient
clinical data — including caregivers *questioning* patient data in natural language.
Some of these cross the project's standing "never an MDR medical device" invariant.
They are kept in the map (per explicit product direction) and tagged so the line stays
visible. A corresponding decision is logged in `openspec/mdr-watchlist.md`
(2026-06-22 entry). MDR-tagged items must not ship without a recorded MDR decision.

## How to read the tables

- **Tier** — `poc` (June 2026 demo, synthetic data) · `mvp` (first paying release) ·
  `product` (post-MVP).
- **MDR** — `safe` (operational/workflow only) · `RISK` (interprets or reasons over
  clinical data — needs an MDR decision before build) · `gate` (safe only if a named
  guardrail holds, e.g. verbatim passthrough, human-in-loop).
- **Layer** — where it plugs into the platform (composer, runtime, task inbox, patient
  profile, admin, MCP, mobile app).

---

## 1. Platform building blocks (shared)

| Capability | Tier | MDR | Notes |
|---|---|---|---|
| LLM gateway service (prompts, tenant scope, audit stamp, PII guard, Belgian hosting) | poc | safe | `app/services/ai/`; one wrapper all features call |
| RAG over pathway + audit + task data | poc | safe | retrieval over `pathway_version.definition_json`, `audit_events`, `tasks` |
| RAG over patient clinical data (Luscii, HiX, observations) | mvp | RISK | retrieval is fine; *answering clinical questions from it* is the MDR line |
| Human-in-the-loop draft → review → accept component | poc | safe | reusable; every AI write produces an `AuditEvent` on accept |
| MCP host (BL-007) — pathway/task/audit/patient tools over MCP | product | gate | tool surface safe; clinical-query tools inherit RISK of their data |

---

## 2. Caregivers

### 2a. Authoring + workflow (safe — ship first)

| Use case | Tier | MDR | Layer |
|---|---|---|---|
| NL prompt → draft pathway graph (uses 14-block catalogue) | poc | safe | composer |
| Block field autofill (message body, task title, appointment copy, MDO agenda) | poc | safe | `BlockDialog` |
| Pathway critic (unreachable branch, missing consent reminder) — structural only | poc | safe | composer |
| Suggest best-fit authored pathway at enrollment | mvp | safe | `EnrollDialog` |
| Inbox summary + grouping (12 tasks, 4 patients, 3 overdue) | poc | safe | task inbox |
| Priority *hinting* by workflow signals (due date, SLA, blocking) — not clinical severity | poc | safe | task inbox |
| Draft task replies / reminder messages — human sends | poc | safe | task inbox |
| Workflow-status catch-up ("where is she in her pathway?") | poc | safe | patient profile |

### 2b. Questioning patient data (RISK — the new opportunity)

This is the high-value, MDR-sensitive cluster the product direction explicitly wants in.
Each lets a caregiver ask natural-language questions and get answers synthesized from
patient clinical data rather than digging through charts.

| Use case | Tier | MDR | Why it's RISK |
|---|---|---|---|
| NL Q&A over a patient's record ("what meds is she on?", "last 3 appointments?") | mvp | gate | factual retrieval = safe if **verbatim**; becomes RISK the moment it summarizes/judges |
| "Is this patient trending worse?" / deterioration questions over Luscii vitals | mvp | RISK | interpreting Luscii measurements = MDR Class IIa territory; alerting must stay in Luscii |
| "Summarize this patient's last month" (cross-source clinical narrative) | mvp | RISK | clinical summarization is interpretive output |
| "Compare this patient to the cohort / pathway norm" | product | RISK | derived clinical signal / scoring |
| "What should I do next for this patient?" (recommendation) | product | RISK | clinical decision output — hardest MDR line |
| "Flag patients in my panel who need attention" (triage queue) | product | RISK | signal-driven clinical prioritization |
| Ask-the-record retrieval that returns *verbatim* values + source citation, no synthesis | mvp | gate | stays safe ONLY as passthrough with provenance; no thresholds/trends/scores |

**Guardrail design for the gate items:** answer with the *source value + citation*, never a
derived judgment; render Luscii data verbatim (existing `luscii-patient-data` display-only
rule); route any interpretive/clinical question to "ask your care team / open Luscii" unless
an MDR decision says otherwise. The difference between `gate` and `RISK` is exactly
**retrieval vs. interpretation**.

---

## 3. Patients (mostly `digital-front-door`, MVP+)

| Use case | Tier | MDR | Layer |
|---|---|---|---|
| Plain-language "what do I do this week?" (workflow steps) | mvp | safe | mobile app |
| Multilingual nudges (consent, surveys, appointment prep) in nl/fr/en | mvp | safe | mobile app |
| Pathway-step explainer (operational step → plain language) | mvp | gate | safe if template-based + clinician-approved copy |
| Conversational assistant answering workflow/schedule questions | product | gate | must refuse-and-route on any clinical/symptom question |
| "Should I be worried about X?" symptom questions | — | RISK | out of bounds — hard refusal + escalate to care team |
| AI-suggested delivery channel (email/Portal/Luscii/app) — BL-014 | mvp | safe | human policy decides |

---

## 4. Admins / compliance (safest layer)

| Use case | Tier | MDR | Layer |
|---|---|---|---|
| NL audit query ("who accessed record X last week?") | mvp | safe | `/admin/audit-log` |
| Anomaly flagging on access patterns (informational) | mvp | safe | audit |
| Draft a role from plain description → review + apply | mvp | safe | `/admin/roles` |
| Bulk user/role ops drafting + onboarding | mvp | safe | `/admin/users` |
| On-demand compliance / audit narrative reports | mvp | safe | audit export |
| MCP-exposed admin tooling (audit query, report gen) | product | safe | MCP (BL-007) |

---

## 5. Cross-cutting

| Theme | Tier | MDR | Notes |
|---|---|---|---|
| Bring-your-own-AI plugs into one governed MCP door | product | gate | tool surface safe; clinical-data tools carry their data's MDR tag |
| Every AI action human-approved + audit-logged | all | safe | provenance into `audit_events`; core trust mechanism |
| Permission-scoped AI (can only do what the user can) | all | safe | reuses dynamic RBAC |
| Synthetic data only | all | safe | project-wide invariant |

---

## 6. Build order (recommendation)

1. **PoC:** pathway authoring copilot + inbox/status summaries (all `safe`, highest demo
   impact, zero clinical interpretation).
2. **MVP:** admin audit/RBAC assistants (`safe`) → caregiver ask-the-record **verbatim
   retrieval** (`gate`) once provenance + passthrough guardrails are built.
3. **MVP+ / Product, gated on MDR decision:** clinical summarization, deterioration
   questions, recommendations, triage — each needs its own `mdr-watchlist.md` entry and a
   recorded decision before build, since these are the items that could classify ZAS as a
   medical device.

---

## 7. MDR decision required before building any RISK item

The standing invariant (`openspec/project.md`, `openspec/mdr-watchlist.md`) is that ZAS is
never a medical device. The `RISK`-tagged caregiver-data-questioning items above interpret
clinical data and therefore could cross that line. Product direction has chosen to keep
them in scope for *mapping*; actually building them requires a per-item MDR decision logged
in the watchlist (alternative shape, or accepted-with-rationale, or escalated to regulatory).
See the 2026-06-22 watchlist entry recording this scope decision.
