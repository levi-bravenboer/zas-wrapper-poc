**Tier**: [poc] additive schema + demo-critical emit sites · [mvp] exhaustive read-logging, purpose-of-use enforcement, full model coverage
**Promotes**: hospital-grade, standards-aligned audit trail — extends the shipped `audit-trail-base` from a write-only starter into a FHIR R5 / NEN 7513 / ISO 27789 / IHE ATNA-mappable record of who did what to which patient, when, how, and why.

## Why

`backend-audit-event-logging` shipped the foundation: an append-only `audit_events` table with automatic write-diff capture (`before_flush`) and auth events (`emit_committed`). It deliberately deferred two things in its own *Out of scope*: **read/access logging** and **auditing beyond a starter model set**. Both are hard requirements once this is a hospital handling a patient dossier.

Tenants are hospitals; rows are PHI. Dutch hospitals are bound by **NEN 7513** (logging of access to the patient record — explicitly including *reads*), which sits on top of **ISO 27789** (EHR audit trigger events, query/read included) and aligns with **IHE ATNA** and **HL7 FHIR R5 `AuditEvent`**. The two questions a compliance officer must be able to answer — *"wie heeft het dossier van patiënt X ingezien of gewijzigd?"* and *"wat heeft zorgverlener Y gedaan?"* — are not answerable today because:

1. **Reads are invisible.** Capture rides `before_flush`, which only fires on writes. There is no `read` action and no read-emit path. NEN 7513's core duty — logging *access* (viewing), not just mutation — is unmet.
2. **There is no patient axis.** A note edit logs `resource_type=Note, resource_id=<note>`. Answering "all access to patient X" requires joining every resource type back to a patient. FHIR R5 added a first-class `AuditEvent.patient` element for exactly this reason.
3. **Domain events have nowhere legible to live.** Runtime events (enrolled, SLA escalated, decision branched, block executed) don't fit `created/updated/deleted`. FHIR keeps `action` coarse (C/R/U/D/E, a Required 5-value binding) and puts the specific event in a separate `code` field. We have no such field, so a domain event would either abuse `updated` (colliding with the auto-diff feed) or bloat the action enum.
4. **The "why" is unrecorded.** NEN 7513 and HIPAA require purpose-of-use, and **break-the-glass / emergency access** must be logged distinctly. Today only a free-text `context.reason` exists — not queryable, not enforceable.

### Standards basis (researched, not invented)

- **HL7 FHIR R5 `AuditEvent`** — `action` is a Required 5-code binding (C/R/U/D/E); the specific event lives in `code` (1..1) with optional `category`; `patient` (0..1) gives deterministic patient tracking; `entity.what`/`entity.role` is the touched object; `agent.authorization` carries purposeOfUse. Our columns map onto this model directly.
- **NEN 7513** (NL) — patient-centric logging of *access* to the dossier, reads included.
- **ISO 27789** — EHR audit trigger events; query/read is an auditable trigger.
- **IHE ATNA** — the integration profile hospitals certify against; serialises to `AuditEvent`.

The base change explicitly invited this: *"new verbs are added only when a feed needs them"* and *"`emit()` can be called manually in a sensitive read path."* This change adds those feeds.

## What Changes

### Modified capability — `audit-trail-base` (additive, append-only-safe)

Four additive changes to the existing `audit_events` table and enums. No existing column changes, no backfill, no FK churn — the table stays structurally immutable.

- **`AuditAction` aligned to FHIR CRUDE.** Add `read` and `execute`. Keep `created`/`updated`/`deleted`. `login` and all runtime/domain events are classified `execute`. The set is now the stable FHIR 5: create / read / update / delete / execute. `login` is retained as a value for backward compatibility of existing rows but new auth events MAY also carry `action=execute` + `event_code=login` (see migration note in design).
- **`ActorType` gains `patient`** (D8). The actor axis now covers `user | patient | system | anonymous` — "user did / patient did / system did" is one axis carried by `ActorType`, not separate event levels. `patient` is a mobile-originated actor (completes a task, submits a measurement, gives consent); orchestrator stays admins+caregivers only, these rows come from the mobile app against the shared backend. System *errors* are explicitly NOT audit events — they stay in structured logging / Sentry (D9).
- **New `event_code` column** (FHIR `code`, the most-specific event) — text, nullable, indexed. Domain specificity lives here: `enrolled`, `sla_escalated`, `decision_branched`, `block_executed`, `deferred_value_resolved`, `pathway_published`, `login`, `logout`. Validated against a small app-level vocabulary (mirrors the resource registry pattern).
- **New `patient_id` column** (FHIR R5 `AuditEvent.patient`) — UUID, nullable, **no FK** (must outlive patient deletion, like `actor_id`/`tenant_id`), indexed `(patient_id, created_at DESC)`. A *separate axis* from `resource_type`/`resource_id` (which remain FHIR `entity`). Set whenever the audited event concerns a patient's dossier, even when the touched entity is not the Patient row (e.g. a Note on patient X → `resource_type=Note`, `patient_id=X`).
- **New `purpose_of_use` column** (FHIR `agent.authorization`) — a small Postgres enum: `treatment | operations | patient_request | emergency | break_the_glass`. Nullable; required on read events of patient data. Powers "show all break-the-glass access".

### Modified capability — read/access capture

- **`emit_committed()` (or a transaction-bound `emit()`) gains a `read` path.** Because `before_flush` cannot see reads, patient-data read endpoints emit explicitly. A thin dependency/decorator captures `action=read`, `event_code` (e.g. `patient_dossier_viewed`), `patient_id`, `purpose_of_use`, and request context.
- **Scope = patient-scoped reads only** [mvp for exhaustive]: patient profile/dossier, pathway runtime (enrollment timeline, block executions), notes, appointments, collaboration. Admin/template/list reads (pathway catalogue, user admin) are **not** read-logged — ISO 27789 lists query as a trigger but the legal duty is dossier access; logging every GET buries the signal and bloats the table.
- **Denied access is audited** (D10). The authorization layer emits `action=read`, `result=failure`, with `patient_id` + the attempted `event_code`, when an actor is denied a patient-data resource (403). The success-only read seam would otherwise leave anomalous/unauthorized access attempts invisible — the events NEN 7513 and break-the-glass detection most need.
- **`patient_id` completeness is enforced** (D11). Every patient-scoped `__audited__` model has a defined patient-resolution path asserted by a conformance test, so "all access to patient X" cannot silently drop rows.

### Added capability — `audit-emit-coverage`

The *map of where to emit*, across three surfaces, with `patient_id` / `event_code` / `purpose_of_use` populated:

- **Pathway builder** — pathway + block create/update/delete (auto-diff via `__audited__`), plus explicit `pathway_published` domain event. No `patient_id` (template-level).
- **Patient data** — dossier read; note/appointment/collaboration create/update/delete + read. `patient_id` set on all.
- **Pathway runtime** — `enrolled`, `block_executed`, `sla_escalated`, `decision_branched`, `deferred_value_resolved`. `patient_id` set from the enrollment's patient; actor may be `system` for engine-driven transitions.

## Capabilities

### Added Capabilities

- `audit-emit-coverage` — the enumerated set of audit-emit call sites across pathway builder, patient data, and pathway runtime, each populating the FHIR axes (`action`, `event_code`, `patient_id`, `purpose_of_use`). Includes the `__audited__` opt-ins for the patient/collaboration/pathway models and the explicit domain-event + read-event emit calls.

### Modified Capabilities

- `audit-trail-base` — `AuditAction` extended to the FHIR CRUDE set (`read`, `execute` added); `ActorType` extended with `patient`; three new columns (`event_code`, `patient_id`, `purpose_of_use`) + indexes; new `PurposeOfUse` enum; `event_code` vocabulary registry; a read-capture emit path + a denied-access (`result=failure`) emit path alongside the existing write feeds; a `patient_id` completeness conformance test; an explicit audit-vs-error-log boundary (errors stay out of `audit_events`).

## Impact

- **DB**: one alembic migration — extend the `audit_action` enum with `read`/`execute`; add `purpose_of_use` enum type; add three nullable columns + two indexes to `audit_events`. Additive only; no data backfill required (existing rows keep null `patient_id`/`event_code`/`purpose_of_use`).
- **Backend code** (`apps/backend/app/`):
  - `core/enums/audit.py` — extend `AuditAction` (`read`/`execute`) and `ActorType` (`patient`); add `PurposeOfUse`.
  - `db/models/audit/audit_event.py` — three new columns + indexes.
  - `services/audit/context.py` / `emit.py` — `emit_committed()` / `emit()` signatures gain `event_code`, `patient_id`, `purpose_of_use`; add `event_code` vocabulary validation.
  - `services/audit/registry.py` — add an `event_code` allow-list alongside `resource_type` validation.
  - A read-capture seam (FastAPI dependency / decorator) for patient-data GET routes.
  - `__audited__` opt-ins: `Patient`, `Note`, `Attachment`, `Appointment`, `Pathway`, `PathwayBlock`, `Enrollment`, `BlockExecution` (per the coverage map).
  - Runtime engine (`services/pathway/runtime/…`, temporal activities) — explicit `emit()` at enrollment / execution / escalation / branch / deferred-value sites.
- **OpenAPI / typed client**: `GET /audit-events` filters extended (`patient_id`, `event_code`, `purpose_of_use`); regenerate.

## Risks and mitigations

- **R1 — Read-logging volume.** Patient-dossier reads are far higher volume than writes. **Mitigation**: scope to patient-data reads only; one row per logical dossier view (not per sub-resource fetch); partitioning/retention remains the base change's flagged follow-up.
- **R2 — `patient_id` resolution coupling.** Setting `patient_id` on a Note event needs the note→patient link at emit time. **Mitigation**: resolve from the already-loaded aggregate at the call site; never add a query solely to populate the audit field — if unresolved, leave null and rely on `resource_type/resource_id`.
- **R3 — Enum migration on a live `audit_action`.** Adding enum values is online-safe in Postgres (`ALTER TYPE ... ADD VALUE`), but cannot run inside a transaction with concurrent use of the value. **Mitigation**: standard alembic enum-add pattern (already used by `alembic-postgresql-enum`); add values, don't rename.
- **R4 — `event_code` free-for-all.** An unconstrained text code rots like any string bag. **Mitigation**: app-level vocabulary registry validated at emit (mirrors `is_known_resource`).
- **R5 — System-actor runtime events.** Engine-driven transitions have no human actor. **Mitigation**: `actor_type=system`, `actor_id=null`; the `event_code` + `patient_id` still make the row queryable and legible.
- **R6 — Tier creep.** Full NEN 7513 compliance is [mvp]; the PoC only needs the demo's "who touched patient X" story. **Mitigation**: ship the additive schema + a thin demo-critical emit set as [poc]; tag exhaustive read coverage, purpose-of-use enforcement, and full model opt-in as [mvp]. `openspec/scope.md` updated in this change's PR.

## Out of scope

- Audit-trail **UI** (built separately, as in the base change).
- **Tamper-evidence + retention** (DB-level write protection / hash chaining, partitioning, purge, archival) → **BL-085**. App-level append-only only; a real NEN 7513 requirement, tracked for MVP, not silently dropped.
- **Export/disclosure events** (`patient.exported` and similar) → **BL-086**. Schema supports them; no emit sites until an export surface exists.
- **System error / exception logging** — explicitly NOT in `audit_events` (D9). Errors stay in structured logs / Sentry. Only *failed audited actions* (denied access, failed login) land in the trail with `result=failure`.
- Forwarding to an external SIEM / FHIR `AuditEvent` REST endpoint (the local table stays source of truth; a FHIR export feed is a later additive option).
- Auditing **every** model — coverage is the three named surfaces, not an exhaustive sweep.
- Consent / authorization *enforcement* — this logs purpose-of-use and denied attempts, it does not gate on them.
- `ActorType.service` (external integration callbacks as actor) — added only when those callbacks are audited.
- **Patient-actor emit sites** — no patient/mobile backend endpoint exists in PoC; this change ships `ActorType.patient` + capability only, emit wired when mobile auth lands.
- **Luscii vitals/measurement read-logging** → **BL-087**. Excluded for PoC (decision 2026-06-17); a known NEN 7513 gap for clinical-data viewing, deferred to MVP.
