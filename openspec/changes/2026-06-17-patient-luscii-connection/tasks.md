# Tasks: patient-luscii-connection

Order: verify FE data dependency → entity + migration → aggregation rewrite →
API schemas → frontend attribution + UI. Verify once per checkpoint via
`/verify`.

**Staged build**: §1 (data layer) is built ahead — the connection table
supports many Luscii patients per patient now, but the link service / API /
FE still run on the single `PatientIdentifier` path until §2+. The migration
therefore COPIES from the identifier rows and leaves them authoritative; they
are retired in §2 when the service is re-pointed.

## §0 — De-risk (do first)

- [ ] 0.1 Confirm an EXISTING read API/hook exposes each enrollment's
  `external_program` (provider=luscii) `program_id` + enrollment `state` +
  pathway name to the patient profile FE. Record where. If absent → carepath
  split degrades to a flat connection list (do NOT add to the pathway API;
  carepath datalayer is off-limits).

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

## §2 — Backend: aggregation rewrite (pathway-agnostic)

- [ ] 2.1 Connection reads: `active_connections(patient_id)` +
  `active_connection_luscii_ids(patient_id)`; replace `active_link_value`.
  Once the service reads the connection table, retire the now-unused luscii
  `PatientIdentifier` rows (migration soft-delete) — single source of truth.
- [ ] 2.2 `link`: validate via Luscii; cross-patient active conflict ⇒
  `LusciiIdAlreadyLinkedError`; upsert connection to `active` (reactivate
  pair-row or insert); snapshot `program_id/name` from details.
- [ ] 2.3 `unlink(connection_id)`: set that connection `inactive`
  (idempotent). Replace `_soft_delete_active_links`.
- [ ] 2.4 `get_patient_data`: gather `get_patient` per active connection
  (refresh snapshot), one `get_measurements`, filter by id set, partition by
  `patientId`; per connection build planned actions + decoder + series (reuse
  existing builders); emit flat `ConnectionGroup[]`. **No pathway imports.**
- [ ] 2.5 Tests: two active connections aggregate; one measurements call
  regardless of count; inactive excluded from active aggregation; snapshot
  refresh on program change.

## §3 — Backend: API schemas + routes

- [ ] 3.1 `schemas/luscii/patient_data.py`: `ConnectionGroup`, flat
  `LusciiPatientData` (drop single-program/`state` fields). Connection list +
  link/unlink request/response schemas. Series points keep `program_id`.
- [ ] 3.2 Routes: `PUT /patients/{id}/luscii-link` → connection upsert; add
  per-connection deactivate (path or body param — D9); optional `GET
  /patients/{id}/luscii-connections` for the dialog list.
- [ ] 3.3 `/openapi-sync` — regenerate (breaking reshape).

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
