# luscii-patient-data Specification (delta)

## ADDED Requirements

### Requirement: Luscii configuration is token-presence-driven

The backend SHALL read two settings: `luscii_api_url` (env `BACKEND_LUSCII_API_URL`, default `https://vitalsapi.luscii.com`) and `luscii_api_token` (env `BACKEND_LUSCII_API_TOKEN`, secret, default unset). `build_luscii_client(settings)` SHALL return a `LusciiHttpClient` when the token is set and `None` when it is not. There SHALL be no Luscii mode setting. The token value MUST never appear in logs or error payloads.

#### Scenario: Token present yields live client

- **WHEN** the app starts with `BACKEND_LUSCII_API_TOKEN` set
- **THEN** `build_luscii_client(settings)` returns a `LusciiHttpClient` configured with the URL and bearer token, and the readiness registry registers a `luscii` ping

#### Scenario: Token absent yields no client and no readiness entry

- **WHEN** the app starts without `BACKEND_LUSCII_API_TOKEN`
- **THEN** `build_luscii_client(settings)` returns `None`, boot succeeds, and the readiness registry has no `luscii` entry

#### Scenario: Unconfigured endpoints respond 503 unavailable.luscii.not_configured

- **WHEN** any Luscii-data or Luscii-link endpoint is called while the client is `None`
- **THEN** the API responds `503` with error code `unavailable.luscii.not_configured`

### Requirement: Live Luscii HTTP client wraps the public API

`LusciiHttpClient` (`app/adapters/luscii/http_client.py`) SHALL implement the `LusciiClient` Protocol with: `ping()` (`GET /v1/diagnostics/ping`), `get_patient(luscii_patient_id)`, `get_planned_actions(luscii_patient_id, start_date, end_date)`, `get_measurements(start_date, end_date)`, and the three localisation catalogues (`instrument localisations`, `instrument item localisations`, `instrument item response localisations`) consumed ONLY by the offline catalogue sync. All requests SHALL send `Authorization: Bearer <token>`, use a 10-second timeout, and map unexpected upstream statuses to a typed `LusciiApiError`. Paginated endpoints SHALL follow `nextCursor` with `perPage=100` until exhausted, raising (not truncating) when the page budget is exceeded: 50 pages for request-path endpoints, 2000 for the catalogue fetches (measured 2026-06-10: the catalogues are 15.6k–40k+ rows and the API ignores all filter params).

#### Scenario: Pagination followed to exhaustion

- **WHEN** `get_planned_actions` receives a first page whose `meta.nextCursor` is non-null
- **THEN** the client requests subsequent pages until `nextCursor` is null and returns the concatenated rows

#### Scenario: Upstream error becomes typed error

- **WHEN** Luscii responds `500` to any client call
- **THEN** the client raises `LusciiApiError` and the calling route maps it to a `502` `ErrorResponse` without leaking the token or raw upstream body

#### Scenario: Page-cap overrun raises

- **WHEN** a single client call would exceed 50 pages
- **THEN** the client raises `LusciiApiError` rather than returning a silently truncated result

### Requirement: Patients link to Luscii via dedicated endpoints

The backend SHALL expose `PUT /patients/{id}/luscii-link` (body `{"luscii_patient_id": "<uuid>"}`) and `DELETE /patients/{id}/luscii-link`. Both SHALL be guarded by the same `require_patient_access` predicate as `PATCH /patients/{id}` and carry `# AUTH-HARDEN` markers. `PUT` SHALL validate the ID against Luscii `GET /v1/patients/{luscii_patient_id}` before persisting; on success it SHALL upsert the patient's single `urn:zas:luscii:patient` identifier row (soft-deleting any previous row — replacement semantics) and SHALL return the Luscii programme and protocol names for visual confirmation. `DELETE` SHALL soft-delete the identifier row and SHALL succeed (204) even when no link exists.

#### Scenario: Valid link persists identifier and echoes programme

- **WHEN** a caregiver with access PUTs a Luscii UUID that Luscii resolves
- **THEN** a `patient_identifiers` row `(system='urn:zas:luscii:patient', value=<uuid>, use='secondary')` exists for the patient and the response includes the Luscii programme and protocol names

#### Scenario: Unknown Luscii ID rejected

- **WHEN** Luscii responds `404` (or `403`) for the supplied UUID
- **THEN** the API responds `422` with error code `invalid.luscii.patient_not_found` and persists nothing

#### Scenario: Luscii unreachable during link

- **WHEN** the validation call fails on transport or upstream `5xx`
- **THEN** the API responds `502` and persists nothing

#### Scenario: Relink replaces existing link

- **WHEN** a patient already linked to Luscii ID A is PUT-linked to Luscii ID B
- **THEN** the A row is soft-deleted and B is the patient's only active Luscii identifier

#### Scenario: Luscii ID unique across patients

- **WHEN** a PUT supplies a Luscii UUID already actively linked to a different patient
- **THEN** the API responds `409` with error code `conflict.luscii.already_linked`

### Requirement: Aggregation endpoint serves a merged Luscii payload

The backend SHALL expose `GET /patients/{id}/luscii-data?days=N` (default 30, max 365), guarded by `require_patient_access` with `# AUTH-HARDEN`. For a linked patient it SHALL return one payload containing: `programme` and `protocol` (id + name, from Luscii patient details), `planned_actions` (each with its Luscii status fields and an embedded `measurement` when one matches by `plannedActionId`), and `unmatched_measurements` (measurements for the patient in the window with no matching planned action). Measurements SHALL be obtained from the org-wide endpoint filtered by the patient's Luscii ID. Independent upstream fetches SHALL run concurrently. For an unlinked patient the endpoint SHALL return `200` with `{"state": "not_linked"}` and no Luscii calls made.

#### Scenario: Merged payload for linked patient

- **WHEN** a linked patient has planned actions and measurements in the window, some sharing `plannedActionId`
- **THEN** matched measurements appear embedded in their planned action, unmatched measurements appear in `unmatched_measurements`, and programme/protocol are present

#### Scenario: Unlinked patient short-circuits

- **WHEN** the patient has no active `urn:zas:luscii:patient` identifier
- **THEN** the response is `200` `{"state": "not_linked"}` and no upstream request is made

#### Scenario: Upstream failure is a contained error

- **WHEN** any required Luscii fetch fails
- **THEN** the endpoint responds `502` with error code `unavailable.luscii.upstream` (the patient page itself is unaffected; only the panel consumes this endpoint)

#### Scenario: Days parameter bounded

- **WHEN** a request supplies `days=400`
- **THEN** the API responds `422`

### Requirement: Measurement values decode to labelled display values

The aggregation payload SHALL decode each measurement's `details` JSON into display items `{label, value, unit, response_texts}` using the LOCALLY SYNCED catalogue tables (key-filtered selects for exactly the instruments/items/response-ids in the window — the request path MUST NOT fetch the upstream catalogues): item title and unit from instrument-item localisations, multiple-choice answers resolved from `response_ids` via item-response localisations, instrument name from instrument localisations. Locale selection SHALL prefer `nl` and fall back to the first available locale for the record. Decoding failures — including an unsynced catalogue — SHALL degrade per-item to the raw value with a null label, never fail the request.

#### Scenario: Numeric item decodes with unit

- **WHEN** a measurement detail item references an item whose `nl` localisation has title "Gewicht" and unit "kg" and the value is "82"
- **THEN** the payload contains `{label: "Gewicht", value: "82", unit: "kg"}`

#### Scenario: Multiple-choice item resolves answer text

- **WHEN** a detail item carries `response_ids` matching item-response localisations
- **THEN** the payload contains the localised `response_texts` for those IDs

#### Scenario: Unknown item degrades to raw value

- **WHEN** a detail item references an item ID absent from the catalogue
- **THEN** the payload contains the raw value with `label: null` and the request still succeeds

#### Scenario: Locale fallback

- **WHEN** an item has no `nl` localisation but has an `en` one
- **THEN** the `en` title/unit are used

### Requirement: Localisation catalogues sync into local tables

The backend SHALL persist the three Luscii localisation catalogues in local tables (`luscii_instrument_localisations`, `luscii_instrument_item_localisations`, `luscii_item_response_localisations`) — vendor reference data: no tenant scope, no patient data, unique on their natural keys. `scripts/sync_luscii_catalogue.py` (moon task `backend:luscii-sync`) SHALL fetch all three catalogues to exhaustion and full-replace the tables in one transaction. The sync SHALL exit with a clear error when `BACKEND_LUSCII_API_TOKEN` is unset.

#### Scenario: Upstream duplicate natural keys are deduped

- **WHEN** the upstream catalogue repeats rows with identical natural keys (observed live: duplicated `(itemResponseId, locale)` rows)
- **THEN** the sync stores one row per natural key (first occurrence wins) and logs the dropped count

#### Scenario: Sync replaces instead of appending

- **WHEN** the sync runs twice, the second time with a changed upstream catalogue
- **THEN** the tables contain exactly the second run's rows (no duplicates, no orphans)

#### Scenario: Unsynced catalogue degrades, never errors

- **WHEN** `GET /patients/{id}/luscii-data` runs while the catalogue tables are empty
- **THEN** the response succeeds with raw values and null labels

#### Scenario: Request path never sweeps upstream catalogues

- **WHEN** `GET /patients/{id}/luscii-data` is served
- **THEN** no upstream catalogue endpoint is called (labels come from the local tables only)

### Requirement: Catalogue snapshots export/import as versioned JSON

The backend SHALL support dumping the synced catalogue tables into per-locale JSON snapshot files under `apps/backend/data/luscii_catalogue/<locale>.json` (committed to version control; `moon run backend:luscii-export`) and full-replacing the tables from those files (`moon run backend:luscii-import`) so a fresh checkout loads the catalogue in seconds without a token or the ~30-45 minute live sync. Snapshot rows SHALL be sorted by natural key and serialized one per line (row-granular git diffs); the locale lives at file level only. Export SHALL remove stale `<locale>.json` files for locales no longer present and SHALL error when the tables are empty. Import SHALL validate each file (schema, filename/locale agreement) and SHALL error when the snapshot directory has no files.

#### Scenario: Export/import round trip restores the tables

- **WHEN** the tables are exported, mutated, and then imported from the snapshot files
- **THEN** the tables contain exactly the exported rows (full replace, locale reattached from the file)

#### Scenario: Import without snapshots errors clearly

- **WHEN** `backend:luscii-import` runs with no `<locale>.json` files present
- **THEN** it exits with an error pointing at `backend:luscii-export` / version control, and the tables are untouched

#### Scenario: Snapshot file disagrees with its filename

- **WHEN** `en.json` declares `"locale": "nl"`
- **THEN** the import refuses the file with a clear error

#### Scenario: Case-colliding locales survive case-insensitive filesystems

- **WHEN** the catalogue contains locales differing only by case (observed live 2026-06-11: `en-US` and `en-us`)
- **THEN** the export writes the collider to a deterministic `<locale>~N.json` filename (instead of silently overwriting on macOS/Windows) and the import restores both locales' rows exactly

### Requirement: Luscii data is display-only (non-MDR invariant)

The aggregation payload SHALL contain only values, labels, units, timestamps, identifiers, and Luscii's own status fields, passed through unmodified. The backend MUST NOT compute thresholds, scores, rankings, flags, trends, or any derived clinical signal from measurement values. Any future change adding such a field MUST first add an entry to `openspec/mdr-watchlist.md`.

#### Scenario: Payload is passthrough-only

- **WHEN** the aggregation response schema is reviewed
- **THEN** every field is traceable to a Luscii response field or a join/decode of Luscii response fields, with no value-derived computed fields
