## Why

The pathway builder currently exposes a closed roster of native block types (`appointment`, `task`, `message`, `form`, `decision`, `milestone`, `wait`, `pathway_link`). Clinical pilots increasingly ask to drop a **Luscii program** (the certified end-to-end care path Luscii ships as a single product unit) directly into a pathway. Hard-coding "Luscii blocks" would entangle vendor coupling with the core builder; we want a generic seam so any external system (Luscii first, then HiX or registries) can register block kinds the builder treats as first-class.

Crucially, Luscii's authoring boundary is rigid: programs are certified Class IIa medical-device artefacts authored only inside **Luscii Builder** by Certified Medical Developers. We never mutate them, never re-derive their alert logic, and never expose internal program parameters as pathway-builder fields. Our block is a **reference** to a Luscii program + protocol pair.

## What Changes

- Introduce a generic **external block** seam: a catalogue-registered block whose runtime semantics, config schema, and renderer come from a vendor adapter rather than the native block-type table.
- Add a backend registry (`external_block_provider`) that names each integration (e.g. `luscii`) and exposes the block kinds it contributes. For Luscii, the registry exposes exactly **one kind**: `program`. (Earlier drafts proposed multiple kinds — `questionnaire`, `monitoring_program`, `education_module` — which is wrong: Luscii's Public API exposes the **Program** as the primitive, with questionnaires/measurements/education embedded inside it.)
- Extend the existing `pathway-block-redesign` block-type catalogue contract so the API can surface external entries alongside native ones, marked with provider + kind metadata.
- Add an adapter Protocol in `external-adapters` describing block-shaped capabilities (`list_blocks`, `get_block_schema`, `resolve_block`), with a Luscii stub as first implementation.
- Frontend: builder palette gains an "External" group sourced from the catalogue; block inspector renders the provider-supplied JSON schema via the existing pathway-config-forms renderer.
- Persistence: `pathway_block.type` accepts the namespaced provider codes (e.g. `luscii.program`); existing CHECKs widen to accept dotted codes; FK lookup falls back to provider registry when native block-type lookup misses.

### Per-patient customisation boundary

**Critical invariant:** the Luscii block's `config_schema` carries **only pathway-author choices** — the program reference, the protocol reference, the wait/fire-and-forget mode, the version-pin policy, and the identifier system used at enrollment. It does **not** expose any per-patient parameter fields.

Per-patient customisation in Luscii happens at the **enrollment call** (`POST /v1/patients`) — language, timezone, BSN/NHS identifier, contact info — and is filled by the caregiver in the runtime caregiver app when a patient is enrolled into the pathway, not by the pathway author at build time.

This means our pathway builder never asks "what BP target should this patient have?" because that's not a question Luscii lets you answer per-enrollment — alert thresholds belong to the program, not the patient. Patient-specific values are limited to demographics + locale + identifiers, captured at runtime.

## Capabilities

### New Capabilities

- `external-block-integrations`: generic registry, adapter protocol, and frontend wiring for vendor-contributed pathway blocks. Adds the registry table, namespaced block-type semantics, palette grouping, and inspector renderer hand-off. Luscii is the first concrete provider but the capability is vendor-agnostic. Encodes the per-patient-vs-pathway-build boundary so vendor adapters can declare which fields are author-time (block config) vs runtime-only (enrollment payload).

### Modified Capabilities

- `pathway-block-redesign`: relax the closed block-type enum to accept `<provider>.<kind>` dotted codes contributed by the registry; surface provider/kind metadata on catalogue entries.
- `external-adapters`: add a block-capability Protocol slice (`list_blocks`, `get_block_schema`, `resolve_block`) and a `LusciiStubClient` implementation of it.

(The pathway-config-forms inspector renderer already consumes `config_schema` + `ui_schema` generically; no requirement change is needed there. See design.md.)

## Impact

- Backend: new `app/pathways/external_blocks/` module (registry + service), Alembic migration to widen `pathway_block.type` CHECK and add `external_block_provider` table, new Luscii adapter slice under `app/adapters/luscii/`.
- API: `GET /pathway-block-types` returns external entries; new `GET /external-block-providers`; block-type validation accepts dotted codes.
- Orchestrator: palette grouping by provider, generic inspector pass-through, no per-vendor React code.
- No change to edge timing, lane mapping, or version snapshotting beyond accepting the new type codes.
- Out of scope: live Luscii client, OAuth, importing patient data from Luscii, **and any block-level per-patient configuration**. Only block-shaped metadata + stub fixtures land here. Per-patient enrollment fields are captured at runtime in the caregiver app (separate change).
