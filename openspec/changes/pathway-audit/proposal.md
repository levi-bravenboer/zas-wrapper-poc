**Tier**: [poc]
**Builds on**: `backend-audit-event-logging` (the append-only `audit_events` store, also `[poc]`). That change's own proposal names "pathway published" as a target domain action — this change delivers it.

## Why

Care pathways are the product's core authored artefact, yet **nothing about their authoring is recorded today**. The pathway models are not `__audited__`, so the merged audit store captures who created/edited a `User` or `Patient` but is silent on who created, edited, published, duplicated, or deleted a care pathway. For a compliance- and operability-sensitive product, "who changed this care path, and when" must be answerable from the same unified trail as everything else.

The audit foundation was built for exactly this — it explicitly anticipated "pathway published" as a domain event — but the emit calls were never wired into the pathway service. This change wires them.

## What Changes

- **Emit semantic authoring events** from the pathway service methods into the existing `audit_events` table: pathway **created**, draft **edited**, version **published**, pathway **duplicated**, draft **restored**/**forked** from a source version, and pathway **deleted**. These are explicit domain events, not row-level auto-diffs — the pathway models stay non-`__audited__`.
- **Anchor every event to the Pathway** (`resource_type = "Pathway"`, `resource_id = pathway_id`), with version/operation details in the `context` payload, so one indexed query returns a care path's full history.
- **Add one audit action verb: `published`** — a generic, reusable state-transition verb. All other authoring events reuse `created` / `updated` / `deleted`, with a `context.operation` discriminator (`create` / `edit` / `duplicate` / `restore` / `fork` / `delete`). This keeps the verb enum small per the documented convention.
- **Coalesce autosave churn**: the builder's save endpoint fires repeatedly via ~800ms-debounced autosave. Emit only **one `edited` event per editing session** (per pathway, per actor, within a quiet window) so the trail reads as sessions, not keystrokes, and surfaces actor handoffs.
- **Emit in-band** — within the same request transaction as the mutation — so a rolled-back publish leaves no `published` event. (This is the opposite requirement from login, which must survive rollback.)
- **Audit pathway access changes** — emit events when a pathway's specialism scoping or explicit practitioner assignment changes (the two admin-only bulk replace-set endpoints in `ScopingService`). These reuse `action = updated` with `context.operation` of `scope_specialisms` / `assign_practitioners`, anchor to the Pathway, and — as a deliberate exception to headline-only — carry a small `context.added` / `context.removed` id diff (the substance of a permission change, already computed by the replace-set logic). No-op saves emit nothing; these are not coalesced.
- **No read-API change beyond the new verb.** Per-pathway timeline, "all publishes", "all pathway edits", and actor-scoped queries are all already served by the existing `GET /audit-events` filters. `context.operation` is display-only and intentionally **not** server-side filterable in v1.

### Out of scope (explicit)

- Runtime events — patient enrollment/unenrollment, block execution, deferred-value writes.
- Pathway access *enforcement* events — shielded-access attempts, access denials, break-glass usage (`BL-069`, `[mvp]`). This change audits access *configuration changes*, not runtime access *attempts*.
- The MVP audit **surface**: admin dashboard, CSV/JSON export, retention config, tamper-evidence, near-real-time alerting (`BL-069`, `[mvp]`).
- Server-side filtering on `context.operation` (JSONB) — a future extension if a hot filter emerges.
- Field-level diffs for these semantic events (`changes` stays empty; headline + context only).

## Capabilities

### New Capabilities
- `pathway-audit`: which pathway authoring and access actions emit audit events, what each event's action/operation/anchor/context payload is, the per-session coalescing rule for draft edits, the added/removed diff for access changes, and the in-band (atomic-with-the-change) emit guarantee.

### Modified Capabilities
- `audit-trail-base`: add `published` to the `AuditAction` enum as a generic state-transition verb (the only enum value not expressible as create/update/delete). The verb-only / noun-in-`resource_type` convention is otherwise preserved.

## Impact

- **Enum + migration**: add `published` to `AuditAction` (`app/core/enums/audit.py`); `ALTER TYPE audit_action ADD VALUE 'published'` migration. Native PG enum — the down-migration must rebuild the type (Postgres cannot drop an enum value).
- **New in-band emit helper**: analogous to `emit_committed()` but `session.add()`-ing the `AuditEvent` onto the current request session instead of a separate committed session (`app/services/audit/`).
- **Pathway service**: emit calls in `PathwayService.create_empty` / `replace_definition` / `duplicate` / `soft_delete` and `PathwayVersionService.publish` / `restore` / `fork_from_publish`. `replace_definition` additionally runs the coalescing lookup.
- **Scoping service**: emit calls in `ScopingService.set_pathway_specialisms` / `set_pathway_practitioners`, each computing the added/removed id diff from the existing-vs-desired set and suppressing no-op saves (`app/services/access/scoping/scoping_service.py`).
- **Read API**: unchanged surface; `GET /audit-events` gains `published` as a valid `action` filter value automatically. `openapi.json` + orchestrator typegen regenerate for the new enum value.
- **No frontend/UI in this change** — this is the backend emit layer the upcoming audit view will read.
