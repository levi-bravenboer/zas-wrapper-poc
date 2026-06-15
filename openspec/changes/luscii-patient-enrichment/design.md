# Design: luscii-patient-enrichment

## Context

Patients in our system have no link to their Luscii identity. The Luscii public API (v3.30.x, OpenAPI 3.1, bearer JWT) exposes per-patient details (`GET /v1/patients/{id}` — includes the patient's single programme + protocol), per-patient planned actions (paged, date-ranged), and **org-wide** measurements (paged, date-ranged, no patient filter — we filter client-side by `patientId`). Measurements carry a `details` JSON string of `{item_id, item_version, value, response_ids, file_name}` entries; rendering human-readable values requires the instrument catalogue endpoints (instrument/item/response localisations give titles, units, and answer texts).

Existing plumbing: `app/adapters/luscii/` has a `LusciiClient` Protocol (only `ping()`), a `LusciiStubClient`, and a mode-driven factory (`BACKEND_LUSCII_MODE=stub`, live raises `NotImplementedError`). Separately, the pathway-builder programme picker reads the static `LUSCII_STUB_PROGRAMS` constant via `LusciiService` — it never touches the client or the mode setting. httpx client precedents: `KratosClient`, `KetoClient`.

Constraints: PoC tier; single tenant; one Luscii organization per token; **never an MDR device** — display-only passthrough, no interpretation (watchlist entry 2026-06-10).

## Goals / Non-Goals

**Goals:**

- Link a patient to exactly one Luscii patient ID, validated live at link time.
- Live-proxy a merged 30-day (configurable) Luscii view: programme/protocol, planned actions joined to measurements, decoded measurement values with labels/units.
- Remove Luscii stub mode; configuration collapses to "token present → live, token absent → not configured".
- Contained failure: Luscii being down or unconfigured never breaks the patient page or app boot.

**Non-Goals:**

- No persistence or caching of Luscii data (follow-up; the client surface is shaped so a cache layer can wrap it).
- No migration of the builder programme picker to live data (`LUSCII_STUB_PROGRAMS`, `LusciiService`, `/luscii/programs*` stay as-is; follow-up change).
- No seed-data import of Luscii patients.
- No webhooks, alerts, thresholds, trends, or any interpretation of measurement values.
- No write operations against Luscii.

## Decisions

### D1 — Luscii ID lives in `patient_identifiers`, not the sync seam

System URI `urn:zas:luscii:patient` (registered in `app/core/identifiers.py` beside the HiX namespaces). The `source`/`external_system`/`external_ref` seam means "this row is *owned by* that system" — seed patients already use it, and a local- or HiX-sourced patient must still be linkable to Luscii. An identifier row is a cross-reference; it composes with any source. Cross-patient uniqueness is enforced with a partial unique index on `(system, value) WHERE system = 'urn:zas:luscii:patient' AND deleted_at IS NULL` — narrower than per-patient uniqueness, scoped to this system only so the existing "same identifier reusable across patients" behaviour (e.g. shared MRN edge cases) is preserved for every other system.

### D2 — Dedicated link endpoints instead of relaxing PATCH

`PUT /patients/{id}/luscii-link` (body: `{"luscii_patient_id": "<uuid>"}`) and `DELETE /patients/{id}/luscii-link`. PATCH keeps rejecting identifier mutation (patients-base invariant intact). PUT is idempotent-by-replacement: linking when a link exists replaces it (soft-deletes the old row). PUT validates the UUID live via `GET /v1/patients/{id}` — 404 from Luscii → 422 to the caller; Luscii unreachable → 502 (no blind link). Authorization: same `require_patient_access` predicate as PATCH.

### D3 — Live proxy for patient data; synced local catalogue for labels (amended 2026-06-10)

Every `GET /patients/{id}/luscii-data` request fans out to Luscii for patient data (details, planned actions, org-wide measurements sweep) — fresh, nothing persisted. **Amendment:** the original "no persistence at all" stance died on contact with the real API. The localisation catalogues measured 15,650 (instrument), 40,000+ (item), 40,000+ (response) rows; `perPage` caps at 100, and every filter param (`locale`, `itemId`, `instrumentId`) is silently ignored — per-request decoding would mean 1000+ sequential upstream calls. Labels therefore resolve against locally synced catalogue tables (see D8). The `/v1/export/measurements` BI report (pre-localised names) was evaluated and rejected: ~1-day batch lag (today's measurements missing), no join keys to planned actions, instrument-level labels only, alert + PII columns to strip. Caching *patient* data remains a follow-up.

### D4 — Token presence replaces stub mode (Luscii only)

`BACKEND_LUSCII_MODE` and `LusciiStubClient` are deleted. New settings: `luscii_api_url` (default `https://vitalsapi.luscii.com`), `luscii_api_token` (secret, default `None`). `build_luscii_client` returns `LusciiHttpClient` iff the token is set, else `None`. `main.py` registers the readiness ping only when a client exists. Routes depending on the client respond `503` with error code `unavailable.luscii.not_configured` when it is `None`; the UI renders that as a quiet info state. `hix_mode` and the generic mode-driven-factory pattern stay for HiX.

### D5 — One aggregation endpoint, merge done server-side

`GET /patients/{id}/luscii-data?days=N` (default 30, max 365). The backend: (1) resolves the linked Luscii ID (404 semantics if patient invisible; `not_linked` state in the payload if no identifier); (2) fetches patient details, planned actions, measurements (paging until exhausted, filtering measurements by `patientId`), and the instrument catalogues; (3) joins measurements to planned actions via `plannedActionId`; unmatched measurements go in a separate list; (4) decodes each measurement's `details` items into `{label, value, unit, response_texts}` using `nl` localisations with fallback to the first available locale; unknown item IDs degrade to the raw value, never an error. One endpoint rather than three thin proxies because the orchestrator needs the joined shape, and the join key (`plannedActionId`) is server-knowledge, not UI-knowledge.

### D6 — Client shape

`LusciiHttpClient` in `app/adapters/luscii/http_client.py`, httpx `AsyncClient` with bearer header, 10s timeout, following the Kratos/Keto error pattern: unexpected status → typed `LusciiApiError` mapped to a 502 `ErrorResponse`. The `LusciiClient` Protocol grows the new methods (`ping` now calls `GET /v1/diagnostics/ping`). Cursor pagination handled inside the client (`nextCursor` loop, `perPage=100`, hard page cap of 50 per call as a runaway guard — hitting the cap raises rather than silently truncating).

### D8 — Catalogue sync: full-replace local tables + manual moon task

Three tables (`luscii_instrument_localisations`, `luscii_instrument_item_localisations`, `luscii_item_response_localisations`) hold the localisation catalogues — vendor reference data: no tenant scope, no PII, plain `Entity` rows, hard-deleted on re-sync (full replace in one transaction). `scripts/sync_luscii_catalogue.py` (moon task `backend:luscii-sync`, host-run, token from `.env`) fetches all three to exhaustion (~1000 requests, minutes) — run rarely, the catalogue is near-static. The request-path decoder does key-filtered `IN` selects for exactly the instruments/items/response-ids present in the patient's window. Unsynced catalogue degrades to raw values (never an error). The client's page-cap stays 50 for request-path endpoints; catalogue fetches get a 2000-page budget (sync-only callers).

Amendment (2026-06-11) — versioned JSON snapshots: because the live sync costs ~30-45 minutes of cursor pagination, the synced tables export to per-locale JSON files under `apps/backend/data/luscii_catalogue/<locale>.json` (committed; rows natural-key-sorted, one per line for row-granular diffs) via `backend:luscii-export`, and any checkout reloads them in seconds via `backend:luscii-import` — no token needed. The live sync remains the only path that talks to Luscii; snapshots are how the result travels. `seed_all` (container entrypoint, every boot) imports the snapshots when the catalogue tables are empty — fresh checkouts get labels with zero manual steps; populated tables are never clobbered; absent snapshots degrade to a warning.

### D7 — Display-only invariant is spec-level

The aggregation payload contains only values, labels, units, timestamps, and Luscii's own status fields. No computed fields that rank, score, threshold, or flag values. This is a named requirement in `luscii-patient-data` so any future change touching it trips the MDR watchlist review.

## Risks / Trade-offs

- [Org-wide measurements sweep grows with org size] → PoC-acceptable; page cap raises loudly instead of truncating; patient-data caching is the named follow-up (extend BL-008 note).
- [Catalogue staleness — new instruments appear unlabelled] → decoder degrades to raw values; re-run `moon run backend:luscii-sync`. Scheduling the sync is a follow-up.
- [3 upstream calls per patient view → slow panel] → panel loads independently of the rest of the page (own query, own loading state); backend uses `asyncio.gather` for independent fetches.
- [Luscii API drift] → spec snapshot vendored under the change dir (`luscii-public-api.json`) records the contract we coded against; client tests run off recorded fixtures, never live calls.
- [Token in env] → secret env var, never logged, absent from `.env.example` default; CI and fresh dev setups run unconfigured by design.
- [PII passthrough (Luscii names/emails in patient details)] → aggregation payload includes only programme/protocol/clinical-display fields, not Luscii's demographic block; we already hold richer demographics locally.
- [Link to wrong Luscii patient (human error, UUIDs unlabelled)] → PUT response echoes Luscii programme + protocol names so the UI can show "linked to <programme>" for eyeball verification; relink replaces.

## Migration Plan

1. Alembic migration: partial unique index on `patient_identifiers (system, value)` for the Luscii system. No data backfill (no existing Luscii identifiers).
2. Settings change is removal + addition; `.env`/`.env.example` updated in the same commit. Stale `BACKEND_LUSCII_MODE` in developer `.env` files is ignored (`extra="ignore"`).
3. `/openapi-sync` after backend routes land, before orchestrator work.
4. Rollback: revert PR; the index migration has a clean `downgrade()`; no persisted Luscii data to clean up.

## Open Questions

- Luscii rate limits are undocumented in the public spec — if the demo org trips them, the cache follow-up gets pulled forward.
- Whether `GET /v1/patients/{id}` 403 (token lacks access) should surface differently from 404 at link time — current design: both → 422 "not found or not accessible".
