**Tier**: poc

## Prerequisite

This change **requires `external-block-integrations` to be archived (apply-complete) before implementation starts.** It builds on the `source`/`provider`/`kind` catalogue fields, the inspector header chip component, and the shared schema-renderer conventions introduced there. Do not run `/opsx:apply nested-pathway-blocks` until `external-block-integrations` is marked archived in `openspec/changes/archive/`. The merge-order risk noted in design.md only applies if both changes land in parallel against the user's wishes — default plan is strictly sequential.

## Why

The pathway builder already has a `pathway_link` block (see `pathway-block-redesign`) but it only stores a target id + `blocking | fire_and_forget` mode — there is no in-canvas representation of the linked pathway's content, no drill-down from parent to child, and no shared semantics with the upcoming external-block integrations. Care pathways increasingly compose sub-pathways (e.g. an oncology pathway embedding a standard "pre-op checklist" pathway) and clinicians want to *see* and edit the nested structure without switching documents. We need a first-class "pathway-as-block" that behaves consistently with the generic external-block seam introduced in `external-block-integrations`.

## What Changes

- Treat the existing `pathway_link` block as the foundation for a fuller **nested pathway block**: same persistence, expanded UX + runtime semantics.
- Backend: add a resolver that, given a parent pathway version, fetches the linked child pathway version snapshot for inline rendering; surface child-blocks read-only by default with an "edit in child" affordance.
- Block-type catalogue: enrich the `pathway_link` entry with `nested_render: 'inline_preview' | 'collapsed_card'` UI hint and a `version_pin: 'latest_published' | 'specific'` config field.
- Builder: render a nested pathway as a collapsible container in the canvas (drill-down navigates to the child pathway's builder). Inspector exposes target picker, mode, version-pin, and a read-only summary of the child's lanes / block count.
- **Reuse from `external-block-integrations` wherever the seams overlap**: the registry/catalogue metadata model, the `source`-tagged catalogue entries, the inspector header chip pattern, and the generic JSON-schema renderer. The internal "pathway" provider is registered as `source='internal'` (a third source value alongside `'native'` and `'external'`) so the catalogue stays one merged list. See design.md for the explicit cross-reference checklist.
- Versioning: snapshotting a parent version SHALL pin the resolved child version id (when `version_pin='specific'`) or record the symbolic pointer (when `'latest_published'`).

## Capabilities

### New Capabilities

- `nested-pathway-blocks`: in-canvas nesting of pathways via the existing `pathway_link` block, with version-pinning, drill-down navigation, read-only child preview, and snapshot rules. Aligns its catalogue metadata, inspector pattern, and source-tagging with `external-block-integrations` so the two changes share infrastructure rather than diverge.

### Modified Capabilities

- `pathway-block-redesign`: extend the `pathway_link` block-type entry with `nested_render`, `version_pin`, and the `source='internal'` catalogue tag.

## Impact

- **Hard dependency on `external-block-integrations`** (see Prerequisite). Requires that change archived first for: the `source` field on catalogue entries, the dotted-code parser (we add `internal.pathway` as an alias of the native `pathway_link` entry for catalogue symmetry — final decision in design.md), and the inspector-header chip component.
- Backend: new `app/pathways/nesting/` module (resolver, snapshot rules), Alembic migration to add `version_pin` + `pinned_pathway_version_id` columns to `pathway_block.config` JSON validation and snapshot tables.
- Orchestrator: nested-canvas container component, drill-down router (`/pathways/:id` opening child id), read-only child summary in inspector.
- No change to edge timing or lane mapping. Out of scope: cycle detection across deep nesting (basic same-version cycle guard ships; multi-pathway cycle detection is a follow-up), per-tenant nesting depth caps, runtime execution of nested pathways (versioning lays groundwork only).
