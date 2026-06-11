# Tasks: luscii-patient-enrichment

## 1. Governance docs

- [x] 1.1 Update `openspec/scope.md`: amend F5's "no live Luscii" note and add the live Luscii patient-data feature line `[poc]`, citing this change
- [x] 1.2 Update `openspec/backlog.md` BL-008 note: "Promoted to `changes/luscii-patient-enrichment/` on 2026-06-10"; note that cache/sync and builder-picker live migration remain follow-ups
- [x] 1.3 Add `openspec/mdr-watchlist.md` entry (2026-06-10, display-only passthrough decision, source: luscii-patient-enrichment)

## 2. Settings + stub-mode removal

- [x] 2.1 Settings: remove `luscii_mode`, add `luscii_api_url` (default `https://vitalsapi.luscii.com`) and `luscii_api_token` (secret, default `None`); update `.env` and `.env.example`; update `tests/core/test_settings.py`
- [x] 2.2 Delete `app/adapters/luscii/stub.py`; extend `LusciiClient` Protocol with the live method signatures (`ping`, `get_patient`, `get_planned_actions`, `get_measurements`, catalogue fetches)
- [x] 2.3 Rewrite `build_luscii_client` to return `LusciiHttpClient` iff token set, else `None`; keep `build_hix_client` mode-driven; update `app/adapters/__init__.py` exports
- [x] 2.4 `app/main.py`: register the `luscii` readiness ping only when the client is not `None`; verify boot succeeds with and without the token

## 3. Live HTTP client

- [x] 3.1 Implement `LusciiHttpClient` (`app/adapters/luscii/http_client.py`): httpx AsyncClient, bearer header, 10s timeout, typed `LusciiApiError`, cursor pagination loop (`perPage=100`, 50-page cap that raises)
- [x] 3.2 Pydantic response models for the public-API shapes used (patient details incl. programme/protocol, planned action, measurement, instrument + item + response localisations) — see vendored `luscii-public-api.json`
- [x] 3.3 Client unit tests against recorded/static fixtures (httpx MockTransport): pagination exhaustion, page-cap raise, error mapping, no token leakage in errors

## 4. Linking (schema + endpoints)

- [ ] 4.1 Register `LUSCII_PATIENT_SYSTEM = "urn:zas:luscii:patient"` in `app/core/identifiers.py`
- [ ] 4.2 Alembic migration via `/new-migration`: partial unique index on `patient_identifiers (system, value) WHERE system='urn:zas:luscii:patient' AND deleted_at IS NULL`
- [x] 4.3 Implement `PUT /patients/{id}/luscii-link` (live validation → 422/502, replacement upsert, 409 on cross-patient duplicate, programme/protocol echo) and `DELETE /patients/{id}/luscii-link` (idempotent 204), both `require_patient_access` + `# AUTH-HARDEN`
- [x] 4.4 `POST /patients`: reject initial identifiers with the Luscii system (422); confirm `PATCH` identifier rejection still covered by tests
- [x] 4.5 Endpoint tests: link happy path, unknown ID, Luscii down, relink replacement, cross-patient 409, unlink idempotency, access guard, not-configured 503

## 5. Aggregation endpoint

- [x] 5.1 Luscii data service: resolve link, concurrent fetches (patient details, planned actions, measurements sweep filtered by patientId, catalogues), join measurements↔planned actions by `plannedActionId`, build `unmatched_measurements`
- [x] 5.2 Measurement decoding: parse `details` JSON, resolve labels/units via item localisations (`nl` preferred, fallback first available), resolve `response_ids` to response texts, per-item degradation to raw value
- [x] 5.3 Route `GET /patients/{id}/luscii-data?days=N` (default 30, max 365, 422 beyond): `not_linked` short-circuit, `503 unavailable.luscii.not_configured`, `502 unavailable.luscii.upstream`, guard + `# AUTH-HARDEN`
- [x] 5.4 Response schema kept passthrough-only (display-only invariant) — review fields against the spec scenario
- [x] 5.5 Service + route tests with fixture-backed client: merge semantics, decoding (numeric, multiple-choice, unknown item, locale fallback), window bounds, all four response states

## 6. Contract sync

- [x] 6.1 Run `/openapi-sync` (regenerate `apps/backend/openapi.json` + orchestrator typegen)

## 7. Orchestrator Luscii tab

- [x] 7.1 Add `Luscii` tab to `PatientProfilePage` with its own query for `GET /patients/{id}/luscii-data`; failure isolated from the rest of the page
- [x] 7.2 Not-configured (quiet info) and error (retry) states
- [x] 7.3 Not-linked empty state: UUID input → `PUT /patients/{id}/luscii-link`, inline 422/409/502 errors, programme/protocol confirmation on success, query invalidation
- [x] 7.4 Data state: programme/protocol header, planned-actions timeline with embedded decoded measurement values (label + value + unit, raw fallback), unmatched-measurements list; no value-derived styling
- [x] 7.5 Unlink + relink affordances with refetch
- [x] 7.6 Component tests for the four states and link-form error handling; NL copy in `lib/i18n` where the module convention requires it

## 9. Catalogue sync (added 2026-06-10 — live API reality: 95k-row unfilterable catalogues)

- [x] 9.1 Catalogue tables (`luscii_instrument_localisations`, `_item_localisations`, `_item_response_localisations`) + Alembic migration
- [x] 9.2 `sync_luscii_catalogue` service (full replace) + `scripts/sync_luscii_catalogue.py` + moon task `backend:luscii-sync`; client catalogue fetches get a 2000-page budget
- [x] 9.3 Decoder reads key-filtered rows from the local tables; request path makes only 3 upstream calls; unsynced catalogue degrades to raw values
- [x] 9.4 Tests: sync populate + full-replace semantics; aggregation tests seed DB catalogue rows; assert no upstream catalogue calls on the request path
- [x] 9.5 Versioned JSON snapshots (added 2026-06-11): `backend:luscii-export` dumps per-locale files under `apps/backend/data/luscii_catalogue/`, `backend:luscii-import` full-replaces from them (no token, seconds); round-trip + validation tests
- [ ] 9.6 Run the export after the live sync lands and commit the snapshot files

## 8. Verify

- [ ] 8.1 Run `/verify` (backend + orchestrator) and quote results
- [ ] 8.2 Manual smoke with a real token in `.env`: link a known Luscii patient, view merged data, unlink; confirm unconfigured behaviour after removing the token
