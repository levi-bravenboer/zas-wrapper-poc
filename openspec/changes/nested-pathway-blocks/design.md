## Prerequisite

`external-block-integrations` MUST be archived before this change is applied. The catalogue `source` enum, dotted-code parser, inspector chip component, and `x-external-options` schema convention all originate there. Do not start implementation of this change until that one is merged + archived. The merge-order risk section below is a fallback for the unwanted parallel case, not the default plan.

## Context

`pathway-block-redesign` already established `pathway_link` as one of the eight native block types, with a config schema requiring `target_pathway_id` and a `mode` of `blocking | fire_and_forget`. What it does NOT cover:

- Visual nesting inside the builder canvas.
- Pinning to a specific child pathway version vs. tracking the latest published.
- Drill-down navigation from a parent pathway to the child.
- Snapshot rules when the parent version is published.

Concurrently, the `external-block-integrations` change introduces a generic seam for non-native block sources — registry, dotted codes, `source`-tagged catalogue entries, inspector header chip, and `x-external-options` schema hint. The two changes have overlapping shape (a block that *points* at something the builder cannot edit inline) and should share infrastructure rather than reinvent it.

This design defines what to reuse from `external-block-integrations`, what to extend, and what is genuinely nesting-specific.

## Goals / Non-Goals

**Goals:**

- Make `pathway_link` render as an inline, collapsible nested pathway inside the parent canvas.
- Pin the resolved child version at snapshot time so a published parent does not silently drift when the child pathway is edited.
- Drill-down navigation: clicking the nested container opens the child pathway's builder; a breadcrumb back to the parent appears.
- Use the same catalogue source-tagging and inspector chip introduced by `external-block-integrations`, so a future tenant integration ("show all 'monitoring' blocks regardless of provider") works uniformly across native, external, and internal entries.
- Cycle guard: a pathway cannot link to itself, and cannot link to a pathway already in its parent chain at edit time (basic depth-1 guard; full graph cycle detection is a follow-up).

**Non-Goals:**

- Runtime execution semantics of nested pathways (when does the child start? how do completion events propagate?). Captured as Open Questions and handled in a separate change.
- Cross-tenant nesting.
- Editing child blocks from inside the parent canvas — drill-down only.
- Multi-level cycle detection across more than the immediate parent chain.

## Decisions

### Reuse vs. invent: explicit cross-reference with `external-block-integrations`

Before implementing this change, re-read `openspec/changes/external-block-integrations/design.md` and walk this checklist. Reuse defaults to "yes" unless we have a concrete reason not to.

| Concern | Reuse from external-block-integrations? | Notes |
| --- | --- | --- |
| Catalogue `source` field | YES (extend enum) | Add `'internal'` as third value alongside `'native'` and `'external'` |
| Dotted code shape `<provider>.<kind>` | NO for storage, YES for display | `pathway_link` keeps its bare native code in `pathway_block.type` to avoid breaking pathway-block-redesign; the catalogue entry advertises a synthetic `provider='pathway'`, `kind='link'` for grouping |
| Inspector header chip component | YES | Same component, props: `{source, provider, kind, label}` |
| Schema renderer pass-through | YES | Nested-pathway inspector renders its `config_schema` (target picker, mode, version-pin) via the same form renderer used for external blocks |
| Options fetch convention (`x-external-options`) | YES (extended) | Add `x-options-source: 'pathway-picker'` for the `target_pathway_id` field so the renderer wires it to the pathway-search endpoint |
| Block lane validation | NO — unchanged | Existing lane rules apply |
| Registry / capability seeding | NO | Pathway nesting is not vendor-pluggable; the `pathway_link` entry stays in the native catalogue with extra metadata |

If `external-block-integrations` slips behind this change, the source-tag and inspector-chip bits MUST land here in a shape compatible with that other change's design — but the *registry table* and adapter Protocol are explicitly out of scope here.

### Catalogue: enrich `pathway_link`, do not add a new type

`pathway_link` stays the single block-type code for nested pathways. The catalogue entry gains:

- `source: 'internal'`
- `provider: 'pathway'`, `kind: 'link'` (synthetic, for grouping symmetry with external entries)
- `nested_render: 'inline_preview' | 'collapsed_card'` UI hint
- `config_schema` adds `version_pin: { enum: ['latest_published', 'specific'], default: 'latest_published' }` and a conditionally-required `pinned_version_id` (when `version_pin='specific'`)

### Snapshot rules

When a parent pathway version is published, every `pathway_link` block SHALL resolve its child reference and persist the result in `pathway_block.snapshot_json`:

- `version_pin='specific'` → record the explicit `pathway_version_id`. Republishing the child does NOT change the parent.
- `version_pin='latest_published'` → record the `pathway_id` plus the *currently* latest published `pathway_version_id` at snapshot time, and a `tracking: 'latest_published'` flag so future runtime can re-resolve. (Runtime re-resolution is out of scope here; we only persist the data.)

### Cycle guard

At edit time, when a `pathway_link` block is saved with `target_pathway_id = X`:

- Reject when `X` equals the parent pathway's id (HTTP 422, `NestedPathwayCycleError`).
- Reject when `X` appears in the parent's ancestor chain at the time of edit (resolved by walking `pathway_link` blocks recursively, capped at depth 8 to bound traversal).

### Drill-down navigation

Frontend adds a route convention: clicking a nested-pathway block in the canvas navigates to `/pathways/<child-id>?from=<parent-id>` and renders a breadcrumb. No new backend route; the parent context lives in the URL.

## Risks / Trade-offs

- **`source` enum drift** if `external-block-integrations` lands after this change. → Coordinate merge order; if this change merges first, ship the `source` enum with only `'native'` and `'internal'` and widen to include `'external'` in the other change.
- **Snapshot drift between parent and child for `latest_published`.** → Accepted limitation: we persist the resolved id at snapshot time and a `tracking` flag; surfacing "child has newer version" warnings to the builder is a follow-up.
- **Depth-bounded cycle guard misses cross-tenant or deep cycles.** → Bound at 8 levels; runtime executor (separate change) gets the final say.
- **Drill-down loses unsaved canvas state.** → Use the existing autosave hook to flush before navigating; show a "saving…" toast if a flush is in flight.
- **Inspector chip component coupling.** → If both changes ship together, the chip component lives in shared UI; if this change lands solo first, the component lives here and gets generalised when `external-block-integrations` arrives.

## Migration Plan

1. Alembic migration: extend `pathway_block.config` JSON Schema validation server-side to accept `version_pin` + `pinned_version_id`; add `snapshot_json` column if not already present from pathway-version snapshotting.
2. Backend: extend `pathway_link` catalogue entry, add resolver service `app/pathways/nesting/resolver.py`, cycle-guard validator, snapshot hook.
3. Frontend: add `NestedPathwayBlock` container component (collapsible, read-only child summary), drill-down route, inspector additions for `version_pin`.
4. Rollback: revert config-schema widening; existing `pathway_link` rows remain valid because new fields are optional with defaults.

## Open Questions

- Runtime execution semantics — out of scope for this change, but the persisted snapshot shape MUST anticipate it (resolved child version id + tracking flag).
- Should "edit in child" require a confirmation when the parent has unsaved changes? Default in this change: autosave-flush, no confirm.
- Per-tenant nesting depth cap policy — currently bounded at 8 in code; future config?
- Coordination with `external-block-integrations` PR order — see merge-order risk above.
