# Design: patient-luscii-connection

## Context

Patient↔Luscii link today = a single `PatientIdentifier`
(`system = urn:zas:luscii:patient`). `LusciiPatientDataService` serves a
single-program payload fetched live per call.

External constraints (verified against the Luscii contract snapshot
`openspec/changes/luscii-patient-enrichment/luscii-public-api.json`):

1. `PatientTransformer.program` / `.protocol` are **single objects** — one
   Luscii patient = one current program. Multi-program ⇒ multiple Luscii
   patients.
2. `GET /v1/measurements` is **org-wide** (paginated); rows carry `patientId`
   (Luscii) but **no `programId`**. Attribution unit = the connection.
3. **Instruments are global**; same instrument = same meaning across programs.
   Merging by instrument is safe; program is provenance/context.
4. Per-program config lives on the **Protocol** (reminders, overdue, comment
   alerts) and **program actions/moments**; **Alerts** carry `programId` +
   `flag` but are clinical interpretation → **out of our display-only scope**.

Internal constraint (saved rule): the **carepath/pathway datalayer is
off-limits**; patient pathway work is presentation-only. Therefore carepath
attribution is done on the **frontend** using existing enrollment data; the
Luscii backend stays pathway-agnostic.

Our side: `PathwayEnrollment` = `(patient, pathway_version)`,
`state ∈ {active, paused, completed, cancelled}`; many per patient.
`external_program` blocks (`provider='luscii'`) store `program_id` in config —
the FE's join key to a carepath.

## Goals

- Many Luscii connections per patient, many active, `active | inactive`
  lifecycle, retained history.
- Aggregate across active connections in O(1) measurement calls.
- FE-side current/history/unassigned split by carepath, no datalayer coupling.
- Move link management into `<EditPatientDialog>`; retire the inline form.

## Scope split

- **PoC**: 1:1 connection ↔ carepath (carepath has ≤1 Luscii program; not
  enforced in builder). Patient with multiple programs ⇒ split across
  carepaths/unassigned.
- **MVP `[mvp]`**: carepath with multiple programs ⇒ nested
  `carepath > program > data`. Data model already supports it; only PoC
  rendering assumes 1:1.

## Decisions

### D1 — Connection is the attribution unit; program is provenance

Measurements have no program id and instruments are global, so we never fork a
measurement stream by program. We bucket `measurement.patientId → connection`
and tag series points with `program_id` for provenance. Same instrument across
connections stays one comparable stream.

### D2 — Connection table is source of truth (replace + migrate)

`patient_luscii_connections` replaces the `urn:zas:luscii:patient` identifier,
**staged** to avoid a flag-day:

1. **This step (data layer):** the migration creates the table and backfills
   (copies) one active connection per live identifier (program snapshot null,
   derived on first read). Identifier rows are **left in place** — the link
   service still reads them, so nothing breaks.
2. **§2 (service rewrite):** once `link`/`unlink`/reads point at the connection
   table, the identifier rows are retired (soft-deleted) so there is a single
   source of truth. `LUSCII_PATIENT_SYSTEM` + its index stay (unused).

### D3 — Status enum + partial unique indexes

`status` = `luscii_connection_status` Postgres enum (`active | inactive`).
Deactivation sets `inactive`, keeps the row; `deleted_at` reserved for true
deletion. Partial-unique (live rows): `(luscii_patient_id) WHERE
status='active'`; `(patient_id, luscii_patient_id)`. **No** one-active-per-
patient index — many active is the point.

### D4 — Program snapshot on the connection

Store `program_id` + `program_name` from the live Luscii patient at link;
refresh on read when the live value differs. Lets the FE attribute + label
without a live call when only listing connections, and shows a sensible name
in history if Luscii later drops the program.

### D5 — Backend stays pathway-agnostic; FE does attribution

The Luscii service returns connection groups with `program`/`protocol`/
`series[]` and never imports pathway models. The FE owns the
`program_id → carepath` match + bucketing:

1. From existing enrollment data the profile already loads, read each
   enrollment's `external_program` (Luscii) `program_id` + the enrollment
   `state` + pathway name.
2. Match connection `program_id` → enrollment. Tie-break: prefer
   `state='active'`, else most recent. `paused` counts as *current*.
3. Bucket: active connection + active/paused enrollment ⇒ **current**; active
   connection + completed/cancelled ⇒ **history**; no match ⇒ **unassigned**;
   inactive connection ⇒ **history**.

**Data source (R1, RESOLVED)**: `program_id` per enrollment comes from
existing reads — `GET /enrollments?patient_id=` (state + `pathway_version_id`)
+ `GET /pathways/{id}/versions/{version_id}` (blocks with `program_id` +
pathway name). No pathway API change; off-limits rule holds. Cost: N version
fetches — cache per `pathway_version_id`.

### D6 — Aggregation flow (backend)

`get_patient_data(patient, days)`:
1. Load active connections.
2. `asyncio.gather` `get_patient(luscii_id)` per connection → refresh
   snapshot; capture program/protocol.
3. One `get_measurements(start, end)`; filter to the connection Luscii-id set;
   partition by `patientId`.
4. Per connection: planned actions (existing per-patient endpoint), decoder +
   series (reuse existing builders).
5. Emit a flat `ConnectionGroup[]`.

### D7 — Response shape (breaking, flat)

```
LusciiPatientData {
  connections: ConnectionGroup[]
  window_days: int
}
ConnectionGroup {
  connection_id: UUID
  luscii_patient_id: UUID
  status: 'active' | 'inactive'
  program:  { id, name } | null
  protocol: { id, name } | null
  planned_actions: LusciiPlannedActionView[]
  measurements:    LusciiMeasurementView[]   // unmatched-to-action
  series:          LusciiMeasurementSeries[] // points keep program_id
}
```
No `current/history/unassigned` on the wire — that is an FE projection (D5).
Display-only invariant unchanged: every field is passthrough/join/decode; no
thresholds, scores, alerts, or value-derived signal.

### D8 — Edit dialog manages active connections

`<EditPatientDialog>` lists active connections (Luscii id + program name);
caregiver **adds** (paste id → `link`) and **deactivates** (→ `unlink` per
connection). Link calls validate against Luscii, surface errors inline
(`linkErrorKey`), and don't block the core patient PATCH. Browsing/reactivating
history is deferred.

### D9 — Endpoints

`PUT /patients/{id}/luscii-link` upserts a connection to `active`
(reactivate the pair-row or insert); cross-patient active conflict ⇒
`conflict.luscii.already_linked`. Per-connection deactivate (new path or body
param — settle in impl). `active_link_value` → `active_connection_luscii_ids`.

## Open questions

- Per-connection deactivate endpoint shape (path vs body param).
- Confirm `paused` enrollment counts as *current* (proposed: yes).

## Follow-up (separate change)

Measurement semantics + charting: map a measurement to what it measures, pick
a chart kind per archetype, decide placement. Built on the per-connection
`series[]` (with program provenance) this change emits.
