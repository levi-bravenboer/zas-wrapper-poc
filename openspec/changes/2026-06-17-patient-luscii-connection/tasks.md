# Tasks: patient-luscii-connection

Order: verify FE data dependency → entity + migration → aggregation rewrite →
API schemas → frontend attribution + UI. Verify once per checkpoint via
`/verify`.

**Staged build**: §1 (data layer) is built ahead — the connection table
supports many Luscii patients per patient now, but the link service / API /
FE still run on the single `PatientIdentifier` path until §2+. The migration
therefore COPIES from the identifier rows and leaves them authoritative; they
are retired in §2 when the service is re-pointed.

## §0 — De-risk (do first) ✓ RESOLVED — data available, no pathway API changes

- [x] 0.1 Confirmed (after merging `feat/pathway-enrollment-runtime`): the FE
  can derive carepath attribution from EXISTING read APIs — no pathway
  datalayer changes, off-limits rule respected.
  - Enrollment `state` + `pathway_id` + `pathway_version_id` →
    `GET /enrollments?patient_id=` (`usePatientEnrollments`,
    `modules/patient-pathway/hooks.ts`). `EnrollmentResponse.state` ∈
    active|paused|completed|cancelled.
  - `external_program` (luscii) `program_id` + pathway name →
    `GET /pathways/{pathway_id}/versions/{version_id}`
    (`modules/pathway/api.ts`); returns blocks with config, `PathwayBlock`
    carries `program_id`.
  - **Cost note**: N version fetches (one per enrollment) — cache per
    `pathway_version_id`. No flat-list fallback needed.

## §1 — Backend: connection entity + migration ✓ DONE (not yet applied)

- [x] 1.1 `LusciiConnectionStatus` StrEnum (`active`, `inactive`) in
  `app/core/enums/patient.py`; Postgres enum `luscii_connection_status`.
- [x] 1.2 ORM `app/db/models/patient/patient_luscii_connection.py`
  (`PatientLusciiConnection(AuditableEntity)`): `patient_id` FK (CASCADE,
  indexed), `luscii_patient_id` (`PG_UUID`), `status` (enum, default
  `active`), `program_id` (`String`, nullable), `program_name` (`String`,
  nullable), `patient` relationship.
- [x] 1.3 Indexes (partial, `deleted_at IS NULL`): unique `(luscii_patient_id)
  WHERE status='active'`; unique `(patient_id, luscii_patient_id)`. (No
  one-active-per-patient index.)
- [x] 1.4 Register in `db/models/__init__.py` + `patient/__init__.py`; add
  `Patient.luscii_connections` relationship.
- [x] 1.5 Alembic revision `20260617_1100_patient_luscii_connections.py`
  (`lscconn00001`): create enum + table + indexes; backfill one `active`
  connection per live `urn:zas:luscii:patient` identifier. **Identifier rows
  left in place** (service still reads them — retired in §2, not here).
  Downgrade drops table + enum. **Migration written, NOT yet applied** (shared
  docker DB).
- [ ] 1.6 Apply migration against the shared stack (`alembic upgrade`) — gated;
  confirm with user / parallel worktrees first.
- [ ] 1.7 Test: backfill count == pre-migration live luscii-identifier count.

## §2 — Backend: service rewrite (pathway-agnostic)

**Phase A (DONE)** — repoint linking onto the connection table, keep the
single-active behaviour + response shape so nothing breaks:
- [x] 2.1 `active_link_value` reads the active connection's `luscii_patient_id`.
  (`active_connections` / `active_connection_luscii_ids` come with Phase B.)
- [x] 2.2 `link`: validate via Luscii; cross-patient active conflict ⇒
  `LusciiIdAlreadyLinkedError` (now checked against connections); deactivate
  current active, upsert target to `active` (reactivate pair-row or insert);
  snapshot `program_id/name`.
- [x] 2.3 `unlink`: deactivate active connection(s) (idempotent). Replaced
  `_soft_delete_active_links` with `_deactivate_active_connections`.
- [x] 2.A Tests: router suite rewritten to assert on `PatientLusciiConnection`
  (happy-path snapshot, relink keeps inactive history, link not in patient-read
  identifiers). 15/15 + 256 service/schema green.
- [ ] 2.B **Identifier retire DEFERRED** — soft-deleting the luscii
  `PatientIdentifier` rows is a SHARED-DB hazard while other worktrees still
  run the identifier-based service. Do it at ship/merge time, not in the dev
  shared DB. (Stale rows are harmless: the service no longer reads/writes them.)

**Phase B1 (DONE)** — multi-connection aggregation, ADDITIVE (keep legacy
fields, add `connections[]`) so the FE stays green until it migrates:
- [x] 2.4 `get_patient_data`: `_active_connections`, one org-wide
  `get_measurements`, per-connection `get_patient` + planned actions in
  parallel, decode once, `_connection_group` per connection → `connections[]`.
  Legacy top-level fields mirror the first connection. No pathway imports.
- [x] 2.5 Test `test_luscii_data_aggregates_multiple_active_connections`: two
  active connections → 2 groups, one measurements call, per-connection
  measurement isolation. 16/16 router + 40/40 FE patient green.
- [ ] 2.6 Snapshot refresh on program change — DEFERRED (avoid write-in-GET;
  revisit with per-connection caching).

**Phase B2 (TODO)** — FE migrates to `connections[]`, then remove legacy
top-level fields (the actual breaking step) once no consumer reads them.

## §3 — Backend: API schemas + routes

- [x] 3.1 `schemas/luscii/patient_data.py`: `ConnectionGroup` added;
  `connections[]` added to `LusciiPatientData` (legacy fields kept for now —
  dropped in Phase B2). Series points keep `program_id`.
- [ ] 3.2 Routes: `PUT /patients/{id}/luscii-link` → connection upsert (done
  via service); add per-connection deactivate (D9) + `GET
  /patients/{id}/luscii-connections` for the dialog list — Phase B2.
- [x] 3.3 openapi.json + schema.d.ts regenerated (additive; FE compiles).

## §4 — Frontend: attribution + UI

- [ ] 4.1 Presentation util `lusciiCarepathMatch.ts`: map connection
  `program_id` → carepath using the §0 enrollment data; bucket
  current/history/unassigned (D5). Pure, unit-tested. Fallback: all into one
  flat bucket if program ids unavailable.
- [ ] 4.2 `<LusciiPanel>`: render buckets — `current` prominent, `history` +
  `unassigned` collapsible; each group headed by program (+ carepath name when
  matched). Remove `<LusciiLinkForm>`.
- [ ] 4.3 `<EditPatientDialog>`: active-connection list (Luscii id + program
  name), add (paste id → link), deactivate per connection; inline link errors
  (`linkErrorKey`); fire link calls only on change.
- [ ] 4.4 hooks/api/types for connection list + connection-group data; i18n
  `nl/patient-profile.json` (`luscii.connection.*`, `luscii.groups.*`,
  `edit.fields.luscii*`); remove orphaned form keys.
- [ ] 4.5 Tests: `lusciiCarepathMatch` (match/tie-break/no-match/fallback);
  `LusciiPanel.test.tsx` (bucketed render, no inline input);
  `EditPatientDialog.test.tsx` (add/deactivate); update
  `PatientProfilePage.test.tsx` if shape assumptions changed.

## §5 — Verify

- [ ] 5.1 `/verify` backend + orchestrator (lint + typecheck + tests).
