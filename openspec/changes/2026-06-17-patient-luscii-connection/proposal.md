# Proposal: patient-luscii-connection

**Tier**: [poc] — extends `luscii-patient-enrichment` ([poc]). Carries
explicit `[mvp]` notes for the multi-program-per-carepath extension we are
*not* building now (see "Scope split").

## Why

`luscii-patient-enrichment` shipped the patient↔Luscii link as a single
`PatientIdentifier` row (`system = urn:zas:luscii:patient`), one active id
per patient, set from an inline `<LusciiLinkForm>` inside the `<LusciiPanel>`.
That model is too thin for how care actually runs:

- **A patient can run multiple Luscii programs.** The Luscii public API
  (`GET /v1/patients/{id}`, schema `PatientTransformer`) gives each Luscii
  patient **exactly one** `program` + one `protocol` — never a list. So a
  patient on multiple programs is **multiple Luscii patients** in Luscii's
  system. A single-link model can represent only one.
- **The link has no lifecycle.** A `PatientIdentifier` row exists or doesn't;
  no *inactive* connection is retained for history. Re-linking silently
  soft-deletes the prior row, losing the prior relationship.
- **Luscii data is not tied to our carepaths.** Caregivers need to see which
  Luscii program belongs to the patient's *current* carepath vs a past one.
- **The link is set from the wrong surface** — a data widget, not the patient
  edit dialog where patient administration lives.

This change makes the patient↔Luscii link a first-class
**`patient_luscii_connection`** entity (many per patient, `active | inactive`
status), aggregates Luscii data across a patient's active connections, and
**attributes each connection to a carepath** so the UI can split current vs
history. Connection management moves into `<EditPatientDialog>`.

## Scope split (PoC vs MVP)

- **PoC (this change builds):** a carepath maps to **at most one** Luscii
  program ⇒ **1:1 connection ↔ carepath**. *Not enforced in the pathway
  builder.* A patient with multiple programs shows as a **split**: multiple
  connections, each attributed to its own carepath (or *unassigned* when no
  carepath matches).
- **MVP (documented, NOT built here):** a single carepath may own **multiple**
  Luscii programs ⇒ nested `carepath > program > data` grouping. The data
  model below already permits many connections per patient and per carepath;
  only the PoC *rendering* assumes 1:1. Flagged `[mvp]` inline.

## Luscii model — facts that shape the design

(Verified against the contract snapshot
`openspec/changes/luscii-patient-enrichment/luscii-public-api.json`.)

- **1 Luscii patient = 1 current program/protocol.** Multi-program ⇒ multiple
  Luscii patients ⇒ multiple connections.
- **Instruments are GLOBAL**, not per-program (`InstrumentTransformer.
  instrumentType`: numerical | questionnaire | bloodpressure | …). The same
  instrument (e.g. weight) means the same thing across programs — **values
  are comparable; merging by instrument is safe**. The program adds *schedule
  + alerting context*, not a different unit/meaning.
- **Measurements carry no `programId`.** `MeasurementTransformer` =
  `patientId`, `plannedActionId`, `groupId`, `instrumentId`+version,
  `details`. Program link is only indirect (`plannedActionId → programAction →
  programId`); self-measurements have none. ⇒ the reliable attribution unit is
  the **connection (Luscii patient_id)**, with `program` as **provenance**.
- **Measurements come from one org-wide call.** `GET /v1/measurements?
  startDate&endDate` returns the whole org's window (paginated); we filter by
  the *set* of our connections' Luscii ids. No per-connection API cost.
- **Per-program settings live on the Protocol** (`patientActionReminderTime`,
  overdue handling, `triggerCommentAlerts`, timezone) and **program
  actions/moments** (what is asked, when). **Alerts carry `programId` + a
  `flag`** — clinical thresholds, **out of our display-only MDR scope** (we do
  not render alerts/flags).

## What Changes

### New backend capability — `patient-luscii-connection`

- New `patient_luscii_connections` table: `patient_id` FK (CASCADE),
  `luscii_patient_id` (UUID), `status` enum (`active | inactive`),
  `program_id` + `program_name` snapshot (nullable), audit + soft-delete.
- **Multiplicity**: many connections per patient; **many active at once**.
  Partial-unique (live rows): one active per `luscii_patient_id` across all
  patients; one live row per `(patient_id, luscii_patient_id)`. **No**
  one-active-per-patient constraint.
- Source of truth for the link — replaces the `urn:zas:luscii:patient`
  identifier. **Staged**: the table is created + backfilled (copied) from the
  identifier first; the identifier rows are retired only once the link service
  reads the connection table (§2), so the single-link path keeps working in
  between.

### Modified backend capability — `luscii-patient-enrichment` (pathway-agnostic)

- `get_patient_data(patient, days)` aggregates across **all active
  connections**: parallel `get_patient` per connection (refresh program
  snapshot), one windowed `get_measurements`, filter by the Luscii-id set,
  partition measurements + planned actions + series **by connection**.
- Response = **flat list of connection groups**, each carrying its
  `program`/`protocol` and `series[]` (series points keep `program_id`
  provenance). **The backend does NOT read pathway/enrollment data and does
  NOT compute carepath buckets** — that stays out per the carepath-datalayer
  rule. Breaking reshape vs today's single-program payload ⇒ regenerate client.
- `link` / `unlink` / `active_link_value` re-pointed at the connection table;
  unlink deactivates (keeps row).

### Modified frontend capability — `patient-profile-ui`

- **Carepath attribution happens here (presentation only).** The FE matches a
  connection's `program_id` against the `external_program` (Luscii)
  `program_id` of the patient's enrollments — using **existing** enrollment
  read data/hooks — and buckets: active enrollment ⇒ *current*,
  completed/cancelled ⇒ *history*, no match ⇒ *unassigned*; inactive
  connection ⇒ *history*. No pathway datalayer/API changes.
- `<LusciiPanel>` renders the buckets: **current** carepath groups prominent,
  **history** + **unassigned** collapsible, each headed by program (+ carepath
  name when matched).
- `<EditPatientDialog>` gains connection management: list active connections,
  add (paste Luscii id), deactivate. Inline `<LusciiLinkForm>` removed.

## Capabilities

### Added Capabilities

- `patient-luscii-connection` — backend entity modelling the patient↔Luscii
  link as a many, status-bearing relationship with a program snapshot; source
  of truth for the link.

### Modified Capabilities

- `luscii-patient-enrichment` — multi-connection aggregation; flat
  connection-group response with program provenance; link/unlink re-pointed at
  the connection table. Stays pathway-agnostic.
- `patient-profile-ui` — FE-side carepath attribution + bucketed rendering;
  connection management in `<EditPatientDialog>`; inline form removed.

## Impact

- **Prerequisites**: `luscii-patient-enrichment`, `patients-base`,
  `patient-profile-ui`; pathway enrollment read surface (base branch
  `feat/pathway-enrollment-runtime`) — **consumed read-only by the FE**.
- **DB**: new `patient_luscii_connections` table + `luscii_connection_status`
  enum; alembic migration (create + backfill now; identifier rows retired in
  §2 once the service is re-pointed).
- **Backend** (`apps/backend/app/`):
  - `core/enums/patient.py` — `LusciiConnectionStatus`.
  - `db/models/patient/patient_luscii_connection.py` — ORM + indexes;
    `Patient.luscii_connections` relationship.
  - `services/luscii/patient_data_service.py` — multi-connection aggregation,
    flat connection-group response; link/unlink/active-ids rewrite. **No
    pathway imports.**
  - `schemas/luscii/patient_data.py` — `ConnectionGroup`, flat
    `LusciiPatientData`; connection list + link/unlink schemas.
  - alembic revision.
- **Frontend** (`apps/orchestrator/src/modules/patient/`):
  - `EditPatientDialog.tsx` — connection list + add/deactivate.
  - `LusciiPanel.tsx` — bucketed rendering; remove `<LusciiLinkForm>`.
  - new presentation util: `program_id → carepath` match + bucketing using
    existing enrollment data.
  - hooks/api/types for connection list + connection-group data; i18n
    `nl/patient-profile.json`.
- **OpenAPI / typed client**: regenerated (breaking reshape).

## Risks and mitigations

- **R1 — FE attribution needs `external_program.program_id` per enrollment
  from an EXISTING read API.** **Mitigation / open task**: verify it is
  exposed. If not, PoC fallback = flat connection list with no carepath split
  (adding to the pathway API is disallowed by the carepath-datalayer rule).
- **R2 — N `get_patient` calls per active connection.** Parallel
  (`asyncio.gather`); counts are small. Measurements stay one call.
- **R3 — Migration must not violate the active cross-patient index.** Existing
  identifier data already satisfied the equivalent index ⇒ 1:1 backfill safe;
  assert counts in a test.
- **R4 — Breaking response reshape.** Regenerate client; update `<LusciiPanel>`
  + tests in the same change.
- **R5 — Program snapshot drift.** Refresh `program_id/name` on read when the
  live program differs; snapshot only guards display when Luscii drops it.

## Out of scope

- **Measurement semantics + charting** — mapping a Luscii measurement to what
  it is about, chart kind per measurement type, placement. Explicit
  **follow-up change**; builds on the per-connection `series[]` here.
- **Multiple Luscii programs per single carepath** rendering — `[mvp]`,
  documented not built (data model already supports it).
- Manual caregiver override of the derived carepath.
- Alerts / thresholds / flags (Luscii-side clinical interpretation — MDR).
- Per-measurement program history beyond connection-level provenance.
- Browsing/reactivating arbitrary past connections from the UI.
- Removing `LUSCII_PATIENT_SYSTEM` / its identifier index; FHIR export.
- Any change to the pathway/enrollment datalayer, runtime, or API.
