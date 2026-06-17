# Design — FHIR-aligned audit trail

Extends the shipped `audit-trail-base`. Read `openspec/changes/backend-audit-event-logging/` first — this document only covers the deltas.

## FHIR R5 AuditEvent mapping

The driving constraint: every column maps to an HL7 FHIR R5 `AuditEvent` element so the trail is ATNA/NEN-mappable and could be exported as FHIR later without re-modelling.

| FHIR R5 element | Cardinality / binding | Our column | Status |
| --- | --- | --- | --- |
| `action` | 1..1, Required (C/R/U/D/E) | `action` (`AuditAction`) | **extend** — add `read`, `execute` |
| `code` | 1..1, "most specific event" | `event_code` (text + vocab) | **new** |
| `category` | 0..* | — (folded into `event_code` prefix) | out of scope v1 |
| `recorded` | 1..1 instant | `created_at` | exists |
| `outcome` | 0..1 | `result` (`AuditResult`) | exists |
| `agent.who` | 1..1 | `actor_id` / `actor_label` / `actor_type` | exists |
| `agent.requestor` | 0..1 bool | `actor_type` (user vs system) | sufficient v1 |
| `agent.authorization` (purposeOfUse) | 0..* | `purpose_of_use` (`PurposeOfUse`) | **new** |
| `agent.network[x]` | 0..1 | `context.ip` / `context.user_agent` | exists |
| `entity.what` | 0..* | `resource_id` | exists |
| `entity.role` | 0..1 | `resource_type` | exists |
| `patient` | 0..1 | `patient_id` | **new** |

## Decisions

### D1 — `action` stays the FHIR CRUDE 5; specificity moves to `event_code`
`AuditAction` becomes `created | updated | deleted | read | execute` (mapping C/R/U/D/E). The domain verb that a human reads — `enrolled`, `sla_escalated` — is **not** an action value; it is `event_code`. Rationale: FHIR binds `action` as Required to exactly 5 codes, and the auto-diff feed already owns `created/updated/deleted`. Exploding `action` would (a) break FHIR mapping and (b) make `updated` ambiguous between a real field edit and a runtime transition. `login` is kept as a legacy `AuditAction` value so existing rows stay valid, but is **deprecated** for new writes in favour of `action=execute, event_code=login`.

### D2 — `event_code` is text validated against an app vocabulary
Not a Postgres enum: the vocabulary grows per feature and an enum migration per new domain event is friction the base change explicitly avoided for nouns. Instead a frozen `KNOWN_EVENT_CODES` set (mirrors `registry.is_known_resource`) validates at emit, giving typo protection without a migration. Codes are namespaced by surface: `pathway.published`, `runtime.enrolled`, `runtime.block_executed`, `runtime.sla_escalated`, `runtime.decision_branched`, `runtime.deferred_value_resolved`, `runtime.fast_forwarded`, `patient.dossier_viewed`, `auth.login`, `auth.logout`.

### D3 — `patient_id` is a denormalised, FK-less, indexed axis
Mirrors `actor_id` / `tenant_id`: UUID, nullable, **no foreign key** (must survive patient deletion / archival), indexed `(patient_id, created_at DESC)`. It is orthogonal to `resource_type/resource_id`. The emit-site contract: *if the event concerns a patient's dossier, set `patient_id`, even when the touched entity is not the Patient row.* This makes the NEN 7513 query — "all access to patient X" — a single indexed scan instead of a per-resource-type join fan-out.

### D4 — `purpose_of_use` is a Postgres enum
Unlike `event_code`, purpose-of-use is a small, slow-growing, compliance-defined closed set, so a native enum (queryable, constrained) is right: `treatment | operations | patient_request | emergency | break_the_glass`. Nullable overall; **required on patient-data read events** (a read with no stated purpose is itself a finding). `emergency` and `break_the_glass` are distinct: emergency = documented urgent care; break_the_glass = override of an access restriction, the highest-scrutiny row.

### D5 — Read capture is an explicit emit, not an automatic hook
`before_flush` fires only on writes; there is no portable "after-select" hook that knows *which* patient was viewed. So patient-data GET routes opt in explicitly via a FastAPI dependency (`audit_read(patient_id, event_code, purpose_of_use)`) that calls the transaction-independent emit. One row per **logical dossier view**, not per sub-resource fetch — a profile load that pulls notes + appointments emits one `patient.dossier_viewed`, not three. Rationale: matches NEN 7513's unit of access (a clinician opened the dossier) and controls volume (R1).

### D6 — Reuse `emit_committed` semantics for reads; keep writes on the hook
Read and domain events use the same separately-committed session path as auth (`emit_committed`) so they survive a 4xx and never turn an audit failure into a 500. Write-diffs stay on `before_flush` (in-transaction with the change). Net: three feeds unchanged in mechanism, extended in payload.

### D7 — Migration is additive and online-safe
`ALTER TYPE audit_action ADD VALUE 'read'` / `'execute'` (outside a transaction block per `alembic-postgresql-enum`); `CREATE TYPE purpose_of_use`; `ALTER TABLE audit_events ADD COLUMN event_code text`, `ADD COLUMN patient_id uuid`, `ADD COLUMN purpose_of_use purpose_of_use`; two new indexes. No backfill — historical rows keep nulls, which is semantically honest (we did not capture those axes then).

### D8 — Actor levels: add `patient`; the actor axis is `ActorType`
"User did / patient did / system did" is one axis — the actor — carried by `ActorType`, not by separate tables or an event level. Extend `ActorType` to `user | patient | system | anonymous`. `patient` is a **mobile-originated** actor (patient completes a task, submits a measurement, gives consent); `actor_id` is the patient id. The orchestrator surface stays admins+caregivers only (patients are data there) — `patient` actor rows originate from the mobile app against the shared backend. `service` (external HiX/Luscii callback acting) is deliberately **not** added yet: add it only when those callbacks are audited, to avoid an unused enum value.

### D9 — Audit trail ≠ system error log; keep them in separate stores
The `audit_events` table answers "who did what to which subject" — security/compliance/domain events. Application errors (500s, exceptions, DB timeouts, job crashes) are **observability**, not audit, and SHALL NOT be written to `audit_events`. Reasons: an error has no subject/patient/purpose; error volume is orders higher; error retention is short; the readers differ (dev vs compliance officer). The boundary rule:

- *"Did an actor do something to a subject?"* → `audit_events` (this change). A **failed audited action** (bad login, denied dossier read) belongs here with `result = failure`.
- *"Did the system break?"* → structured logs + Sentry. Never `audit_events`.

FHIR R5 `AuditEvent.severity` exists if per-row info/warn/critical levels are ever wanted, but patient-access events are uniformly significant and `break_the_glass` already isolates the hot ones — `severity` is out of scope.

### D10 — Denied/failed access is an audited event
The read seam (D5) fires on a **successful** GET only, so an authorization denial (403 on a patient the actor has no relationship with) would leave no trace — the opposite of what NEN 7513 wants. The authorization layer SHALL emit `action = read`, `result = failure`, with `patient_id` + the attempted `event_code` on denial. This is what makes anomalous-access and break-the-glass detection possible. Applies to the patient-data surfaces only (matching the read-logging scope), not to every 403 in the app. **Hook point**: the backend already gates routes with `require_role(...)` FastAPI dependencies (e.g. `require_role(Role.ADMIN)` on the enrollment fast-forward) — the denial emit wraps/extends that dependency for patient-data routes rather than inventing a new authz layer.

### D12 — Admin fast-forward is a distinct audited action
The merged `EnrollmentService.fast_forward` (admin-only) bulk-completes non-choice steps of a patient's runtime — a privileged operation on patient data, exactly the kind a hospital auditor must see. It SHALL emit one `runtime.fast_forwarded` event (actor = the admin, `purpose_of_use = operations`, `patient_id` from the enrollment) **in addition to** the per-step `runtime.block_executed` events its loop already triggers via `complete_step`/`advance`. The summary event captures intent ("admin X fast-forwarded enrollment Y"); the per-step events capture the granular transitions. Both are correct; they are different grains.

### D11 — `patient_id` completeness is enforced, not best-effort
The patient-centric query is only as trustworthy as `patient_id` population: a single patient-scoped audited model that fails to resolve it silently drops rows from "all access to patient X", which *looks* complete. So every patient-scoped `__audited__` model SHALL have a defined patient-resolution path, asserted by a conformance test (mirrors the base change's `test_audited_models` pattern). If a model genuinely has no patient (template-level), that is an explicit, tested decision — not an accidental null. This promotes design Q1 from a hope to a guard.

## Emit-site map (the `audit-emit-coverage` capability)

| Surface | Site | action | event_code | patient_id | purpose_of_use | feed |
| --- | --- | --- | --- | --- | --- | --- |
| Builder | pathway/block CRUD | created/updated/deleted | — | null | — | `__audited__` |
| Builder | pathway publish | execute | `pathway.published` | null | operations | explicit |
| Patient | dossier view | read | `patient.dossier_viewed` | set | required | explicit (D5) |
| Patient | note/appointment/collab CRUD | created/updated/deleted | — | set | treatment | `__audited__` + patient_id seam |
| Runtime | enrollment | execute | `runtime.enrolled` | set | treatment | explicit |
| Runtime | block executed | execute | `runtime.block_executed` | set | treatment | explicit (actor=system) |
| Runtime | SLA escalation | execute | `runtime.sla_escalated` | set | treatment | explicit (actor=system) |
| Runtime | decision branch | execute | `runtime.decision_branched` | set | treatment | explicit (actor=system) |
| Runtime | deferred value resolved | execute | `runtime.deferred_value_resolved` | set | treatment | explicit |
| Runtime | admin fast-forward | execute | `runtime.fast_forwarded` | set | operations | explicit (actor=admin) |

## Resolved (2026-06-17)

- **Q2 → RESOLVED**: new auth events write `action = execute` + `event_code = auth.login/auth.logout`. Historical `login` rows are not rewritten; `AuditAction.login` stays a legacy value.
- **Q3 → RESOLVED**: `purpose_of_use` on a caregiver read is **role-derived default** (`treatment`) with an explicit break-glass override path. Not required per request from the UI.
- **break_the_glass → RESERVED**: the enum value and its queryability ship now, but no access-override *flow* is built — PoC has no access restriction to override. The real override flow is [mvp] (tracked with tamper/retention under the compliance push). `purpose_of_use` is still required on patient reads (defaulting to `treatment`); break-glass is set only once a flow exists.
- **Patient-actor emits → ENUM + CAPABILITY NOW, EMIT DEFERRED**: `auth_router.py` has no patient/mobile login endpoint today — there is no PoC backend call site for a patient action. So `ActorType.patient` + the capability ship now; the actual emit (`auth.login`/`auth.logout` with `actor_type = patient`, plus task completion / measurement / consent) is wired when the mobile backend auth endpoint exists (tracked with `feat/mobile-app-auth-setup`). No schema change needed then.
- **Luscii vitals/measurement reads → EXCLUDED from read-logging (PoC)**: viewing Luscii clinical data is *not* read-logged in this change (decision 2026-06-17). This is a known NEN 7513 gap — clinical-data viewing should eventually be audited — tracked as **BL-087** for MVP. The `luscii_router` GET routes get no read seam now.

## Open questions

- **Q1 (sub) → RESOLVED**: `Note`, `Attachment`, `Task`, `Appointment`, `PathwayEnrollment` all carry a direct `patient_id` column, so `_patient_of` resolves them at flush with no extra query. Only `PathwayBlockExecution` lacks the column (patient via its enrollment): its auto-diffs carry null `patient_id` and the patient axis is set by the explicit `runtime.block_executed` emit. Captured as `_PATIENT_VIA_PARENT` in the conformance test.
- **Q4** — patient-actor emit surface: confirm which patient-facing backend endpoints exist today (mobile auth only?) so task 7 wires the real set and does not assume endpoints that aren't built.
