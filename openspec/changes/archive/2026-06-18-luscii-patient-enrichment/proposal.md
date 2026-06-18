# Proposal: luscii-patient-enrichment

**Tier**: [poc] — promoted from BL-008 (`[mvp]`) on 2026-06-10; `openspec/scope.md` updated in this change.

## Why

Caregivers need to see a patient's Luscii monitoring data (programme, protocol, planned actions, measurements) inside the Orchestrator patient view instead of switching to Luscii. The Luscii public API (bearer-token, `https://vitalsapi.luscii.com`) is available to us now, and patients in our system currently have no link to their Luscii identity, so no enrichment is possible. This promotes backlog item **BL-008** (Luscii Vitals viewing in Orchestrator) into the PoC.

**MDR guard**: display-only passthrough. We render Luscii's own values, labels, units, and answer texts. No thresholds, no alerts, no derived scores, no interpretation — alerting stays in Luscii. Recorded in `openspec/mdr-watchlist.md` (2026-06-10 entry).

## What Changes

- **Patient linking**: a patient can hold exactly one Luscii patient ID, stored as a `patient_identifiers` row with new system URI `urn:zas:luscii:patient`, unique across patients. Set/removed via dedicated `PUT`/`DELETE /patients/{id}/luscii-link` endpoints (caregiver write access). `PUT` validates the ID live against Luscii (`GET /v1/patients/{id}`) and rejects unknown IDs. The patients-base "identifiers are immutable post-create" rule gains this single carve-out via the dedicated endpoint (general `PATCH` identifier mutation stays rejected).
- **Live Luscii HTTP client**: new httpx-based client (pattern: Kratos/Keto clients) implementing patient details, planned actions (paged, date-ranged), org-wide measurements (paged, date-ranged, client-side patient filter), and the three localisation catalogues needed to decode `measurement.details` into labelled values with units (catalogue fetches are consumed only by the offline sync — see below). Locale `nl` preferred, fallback to first available.
- **Aggregation endpoint**: `GET /patients/{id}/luscii-data?days=N` (default 30) fans out to Luscii and returns one merged payload: programme + protocol from patient details; planned actions joined to measurements via `plannedActionId`; unmatched measurements listed separately. Patient data is a live proxy — nothing persisted, no cache (patient-data caching is a named follow-up).
- **Catalogue sync (added 2026-06-10)**: measurement labels resolve against locally synced copies of the Luscii localisation catalogues (three tables + `moon run backend:luscii-sync`), because the live catalogues measured 15.6k–40k+ rows with no server-side filtering — per-request fetching is impossible. Unsynced catalogue degrades to raw values.
- **BREAKING (internal): Luscii stub mode removed.** `BACKEND_LUSCII_MODE` setting deleted; `LusciiStubClient` deleted. The factory returns the live client iff `BACKEND_LUSCII_API_TOKEN` is set, else `None`: readiness ping registers only when configured; enrichment endpoints return a "not configured" response otherwise. The static `LUSCII_STUB_PROGRAMS` constant, `LusciiService`, and `/luscii/programs*` builder-picker routes are untouched (live migration is a follow-up change). `hix_mode` is unaffected.
- **New settings**: `BACKEND_LUSCII_API_URL` (default `https://vitalsapi.luscii.com`), `BACKEND_LUSCII_API_TOKEN` (secret, no default).
- **Orchestrator patient view**: new Luscii section in `PatientProfilePage` — programme/protocol header, merged planned-actions timeline with decoded measurement values. Unlinked patient → empty state with manual UUID entry. Luscii/network errors stay contained to the panel; the rest of the page renders normally. Not-configured backend → quiet info state.

## Capabilities

### New Capabilities

- `luscii-patient-data`: live Luscii integration for patient enrichment — patient↔Luscii linking (identifier system, link/unlink endpoints, live validation), the Luscii HTTP client surface, the aggregation endpoint with merge semantics, token-presence configuration model, and the display-only (non-MDR) invariant.

### Modified Capabilities

- `external-adapters`: Luscii leaves the mode-driven stub factory model — stub client and `BACKEND_LUSCII_MODE` removed; factory becomes token-presence-driven and may return "unconfigured". Stub-programs constant requirement narrowed to the builder picker only (no longer tied to a stub client).
- `patients-base`: identifier immutability gains the Luscii-link carve-out (dedicated endpoint only); new reserved identifier system `urn:zas:luscii:patient` with cross-patient uniqueness.
- `patient-profile-ui`: patient detail page gains the Luscii data section (panel states: data, empty/unlinked, error, not-configured).

## Impact

- **Backend**: `app/adapters/luscii/` (client rewrite, stub deletion), `app/adapters/deps.py`, `app/core/settings.py` (+ `.env`, `.env.example`, settings tests), `app/main.py` (conditional readiness registration), new router/service for link + aggregation endpoints, `app/core/identifiers.py` (new system URI), catalogue tables + sync script + moon task, Alembic migrations for the cross-patient unique index and the catalogue tables.
- **API contract**: new endpoints → `openapi.json` regeneration + orchestrator typegen (`/openapi-sync`).
- **Orchestrator**: `PatientProfilePage` + new Luscii panel components, generated client usage.
- **Governance docs (this PR)**: `openspec/scope.md` (F5 "no live Luscii" note superseded; feature line updated), `openspec/backlog.md` (BL-008 promoted note), `openspec/mdr-watchlist.md` (display-only entry).
- **External dependency**: Luscii public API v3.30.x; bearer token provisioned out-of-band. When the token is absent (CI, fresh dev setups), everything degrades to "not configured" — no test or boot-time dependency on Luscii reachability.
