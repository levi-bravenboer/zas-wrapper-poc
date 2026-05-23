## Why

The pathway builder currently exposes a closed roster of native block types (`appointment`, `task`, `message`, `form`, `decision`, `milestone`, `wait`, `pathway_link`). Clinical pilots increasingly ask to drop a **Luscii program** (the certified end-to-end care path Luscii ships as a single product unit) directly into a pathway. We need a way to add it without bleeding vendor names into core builder code — but also without inventing a heavyweight provider-registry abstraction we won't use for years.

Luscii's authoring boundary is rigid: programs are certified Class IIa medical-device artefacts authored only inside Luscii Builder by Certified Medical Developers. We never mutate them, never re-derive their alert logic, and never expose internal program parameters as pathway-builder fields. Our block is a **reference** to a Luscii program + protocol pair.

## What Changes

- Extend the pathway block-type **catalogue** (the existing `BLOCK_TYPES` code constant in `app/services/pathway/catalogue.py`) with a single new entry: `luscii.program`. Catalogue entries gain three provenance fields — `source` (`'native' | 'external'`), `provider` (string | null), `kind` (string | null) — so the frontend can dispatch to the per-provider renderer.
- Accept the dotted block-type code form (`<provider>.<kind>`) at the persistence layer: the `pathway_block.type` column gains a regex CHECK (`^[a-z_]+(\.[a-z_]+)?$`). Application-level validation already exists via the catalogue lookup.
- Serve Luscii programs from a **per-vendor backend route pair** — `GET /luscii/programs` (picker list) and `GET /luscii/programs/{id}` (full payload). Backed today by a static in-memory constant (`app/adapters/luscii/programs.py`, `# POC ONLY`); future live-Luscii adapter replaces the in-memory constant with a real fetch + cache layer without changing the route shape.
- Frontend renders the Luscii block as a content-sized mini-pathway thumbnail (360×200 → 540×300, auto-scaled by program density) via a dispatcher xyflow node type. Inspector dispatch gains an `external_program` semantics branch.

### Per-patient customisation boundary

**Critical invariant:** the Luscii block's `config_schema` carries **only pathway-author choices** — the program reference, the protocol reference, the wait/fire-and-forget mode. It does **not** expose any per-patient parameter fields.

Per-patient customisation in Luscii happens at the enrollment call (`POST /v1/patients`) — language, timezone, BSN/NHS identifier, contact info — and is filled by the caregiver in the runtime caregiver app when a patient is enrolled into the pathway, not by the pathway author at build time. Patient identifier system (BSN for ZAS) is an org-level setting, not a block-config field.

### What we explicitly do NOT build

- No `external_block_provider` registry table. The catalogue is a code constant; vendors are added the same way native block types are added (a code change + deploy). Per-tenant gating, when needed later, lands via a tiny `tenant_external_block_provider` join table — not via a generic registry today.
- No `ExternalBlockClient` Protocol or cross-vendor factory. With one vendor, the abstraction is overhead. Future vendors (HiX, registries) get their own per-vendor routes (`GET /hix/...`) — we'll refactor to a shared abstraction only when a second vendor exists and the abstraction is justified.
- No `luscii_program` DB table. Stub data is a static Python constant. The live-Luscii adapter change adds caching later if/when needed.

## Capabilities

### New Capabilities

- `external-block-integrations`: dotted block-type code support + `source`/`provider`/`kind` provenance fields on catalogue entries + the first concrete external block (`luscii.program`) shipped with stub data and per-vendor routes. Encodes the per-patient-vs-pathway-author boundary so future vendor adapters know which fields belong at author-time.

### Modified Capabilities

- `pathway-block-redesign`: relax the closed block-type enum to accept `<provider>.<kind>` dotted codes; surface provider/kind metadata on catalogue entries.

(The pathway-config-forms inspector renderer already consumes `config_schema` + `ui_schema` generically; no requirement change needed there.)

## Impact

- Backend: extend `BLOCK_TYPES` catalogue with the `luscii.program` entry, extend `PathwayBlockType` Pydantic schema with `source`/`provider`/`kind`, add `external_program` to `BlockSemanticsLiteral`, single DDL migration widening `pathway_block.type` CHECK, new `app/api/routers/luscii/luscii_router.py` with the two routes, `app/services/luscii/luscii_service.py` reading the in-memory constant.
- API: `GET /luscii/programs`, `GET /luscii/programs/{id}`, `GET /pathway-block-types` includes `luscii.program` with provenance metadata.
- Orchestrator: variable-size block renderer (360×200 → 540×300 clamp rule), per-provider thumbnail component decomposition (`LusciiProgramBlockNode` + Header + Thumbnail + Fake + Live + Router), inspector branch on `external_program` semantics, palette grouping by `source` then `provider`, `LANE_ROW_HEIGHT` bump to 320.
- No change to edge timing, lane mapping, or version snapshotting beyond accepting the new type code.
- Out of scope: live Luscii client, OAuth, patient-data ingestion, per-patient enrollment dialog, "Open Viewer" SAML SSO, multi-vendor lane-kind split. Each is a separate future change.
