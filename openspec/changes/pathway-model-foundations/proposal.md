## Why

**Tier**: `[poc]`
**Parent**: `pathway-model-redesign` (resolved design lives there)
**Chain slot**: #1 of 3 (foundations → input_logic+timing → runtime aggregate)

The current `PathwayBlock` ORM is one generic class with `type: str` + `config: JSONB`. Per-kind behaviour lives in a parallel `BlockTypeEntry` data registry. The parent change `pathway-model-redesign` decided to replace this with a typed `BaseBlock` class hierarchy (D1 single-table inheritance, D4 sibling `DeferredFieldSpec`, D7 class-level `allowed_lane_kinds`).

This change lands the foundations only: class hierarchy, single-table ORM mapping, read API on the new shape, compat shim on the write API so the builder keeps working. No behaviour change visible to the user.

## What Changes

### Domain — `BaseBlock` hierarchy

`app/domain/pathway/blocks/` reshaped from data-registry (`BlockTypeEntry` instances) to class hierarchy. `BaseBlock` carries `name`, `input_logic` (stub field — populated in chain slot #2), `timing_policy` (stub — slot #2), `lane_kind`. Per-kind subclasses cover today's 9 kinds:

| Existing kind | New subclass |
|---|---|
| `appointment` | `AppointmentBlock` |
| `task` | `TaskBlock` |
| `decision` | `DecisionBlock` |
| `message` | `MessageBlock` |
| `form` | `FormBlock` |
| `milestone` | `MilestoneBlock` |
| `wait` | `WaitBlock` |
| `pathway_link` | `PathwayLinkBlock` |
| `luscii_program` | `ExternalProgramBlock` (with `provider: Literal["luscii", ...]` discriminator) |

Each subclass adds typed fields, `DEFERRED_FIELDS`, and class-level metadata: `LABEL`, `DESCRIPTION`, `ICON`, `LANE_KINDS`, `EVENTS`, `RESULT_TYPE`, `FIELD_MODES`. `BlockTypeEntry` data registry retired; per-kind class is the source of truth.

**Out of scope for this change**: new kinds named in the parent spec catalogue (`start`, `subpath`, `treatment`, `mdo`, `bridge`, `end-pathway`, `notification`) and any merge/retire of `form`/`milestone`/`wait`. Those land as separate proposals after foundations.

### Storage — single-table inheritance

New `pathway_block` table with discriminator `kind: str` and nullable per-kind columns covering the union of all subclasses' typed fields. SQLAlchemy `polymorphic_on` / `polymorphic_identity` per subclass. Old `pathway_block` renamed to `pathway_block_legacy` (read-only via compat shim).

### Read API on new shape

`GET /pathways/{id}` returns blocks shaped by their typed subclass; OpenAPI schema reflects the discriminated union. Frontend types regenerated via `/openapi-sync`.

### Write API compat shim

`POST/PATCH /pathways/{id}/blocks` keeps accepting the legacy `(type, config)` payload; shim transforms to the typed class, writes to new `pathway_block` table. Old `pathway_block_legacy` writes also continue (dual-write) until chain slot #2 retires the legacy path.

### Deferred fields — first-class

`DeferredFieldSpec` class added. Each subclass declares `DEFERRED_FIELDS: tuple[DeferredFieldSpec, ...]`. Existing `pathway_block_deferred_field` rows migrated into class-level specs (data → declaration). Runtime values (chain slot #3) consume the spec.

### Out of scope (chain slot #2 / #3)

- `input_logic` semantics + edge-table drop → slot #2
- `TimingPolicy` tagged union + timing column backfill → slot #2
- `PathwayEnrollment` + `BlockExecution` + `DeferredFieldValue` tables → slot #3
- Runtime engine → slot #3

## Impact

- Backend: ORM rewrite, domain reshape, alembic migration, write-compat shim.
- Frontend: regenerated types; no functional change. Builder keeps using legacy write API.
- Tests: per-subclass contract tests; migration round-trip tests.
- Out-of-scope surfaces: runtime engine, builder UI redesign.
