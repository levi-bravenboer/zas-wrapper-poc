## Context

The merged `backend-audit-event-logging` change (`[poc]`) shipped an append-only `audit_events` table with two feeds:

1. **Automatic ORM diff** — a `before_flush` listener (`app/db/audit.py`) captures create/update/delete events for models flagged `__audited__ = True`. Today only `User` and `Patient` opt in.
2. **Explicit committed emit** — `emit_committed()` (`app/services/audit/emit.py`) writes an event in a **separate** session that survives request rollback. Used today only for login events (`auth_router.py`).

Pathway models are not `__audited__`, so care pathway authoring is unrecorded. The audit foundation explicitly anticipated "pathway published" as a domain action; this change wires the emit calls.

Relevant facts that shape the design:

- The save endpoint `PUT /pathways/{id}` → `PathwayService.replace_definition` is the **same** endpoint for autosave and explicit save; the frontend debounces it ~800ms (`useAutosavePathway.ts`). The backend cannot distinguish autosave from a deliberate save.
- `AuditAction` is a **native** Postgres enum (`native_enum=True`, `name='audit_action'`); adding a value requires `ALTER TYPE`.
- The actor is available in every authoring service path via `CurrentUserDep` (`SessionUser`: `id`, `display_name`, `tenant_id`), and is already stamped into `session.info` for the existing hook.
- The read API `GET /audit-events` already filters on `resource_type`, `resource_id`, `actor_id`, `action` (`eq`/`in`), `result`, `created_at` range; `context` (JSONB) is not filterable.

## Goals / Non-Goals

**Goals:**

- A sensible, queryable trail of what happens to a care pathway and by whom: created, edited, published, duplicated, restored/forked, deleted, plus access-configuration changes (specialism scoping, practitioner assignment).
- One indexed query returns a pathway's full history — authoring and access changes interleaved.
- Reuse the existing store, read API, and indexes; minimal new surface.
- Keep the audit action enum small per the documented verb-only convention.

**Non-Goals:**

- Runtime auditing (enrollments, block executions, deferred-value writes).
- Pathway access *enforcement* auditing — shielded-access attempts, denials, break-glass usage (`BL-069`, `[mvp]`). This change audits access *configuration changes*, not runtime access *attempts*.
- The MVP audit surface — admin dashboard, export, retention, tamper-evidence, alerting (`BL-069`).
- Field-level diffs of pathway content (`changes` stays empty; headline + context only).
- Server-side filtering on `context.operation`.

## Decisions

### D1 — Semantic emit, not auto-diff (do not `__audited__` pathway models)

Pathway authoring is captured by explicit calls in the service layer, not by flipping `__audited__` on the pathway model tree.

**Why:** A single builder save rewrites the whole concept definition (delete + re-persist of phases, lanes, blocks, branches, timing rows). Auto-diff would emit dozens of low-value row events per save and could not express domain verbs like `published` or `duplicated`. Semantic events read as a human story and anchor cleanly to the pathway.

**Alternative considered:** `__audited__ = True` on `Pathway` + `PathwayVersion` only (not children). Rejected — still produces `updated` row-diffs on every autosave and can't model publish/duplicate/restore/fork as distinct operations.

### D2 — One new verb (`published`); everything else reuses `created`/`updated`/`deleted` + `context.operation`

`published` is the only authoring action that is not a create, update, or delete (it is a concept→published state transition). It is also generic and reusable (any resource can be published), so it fits the verb-only convention. Duplicate/restore/fork are all "a new thing was created", and edit is an update; these reuse the generic verbs with a `context.operation` discriminator for display.

**Why:** Keeps the native PG enum small and slow-growing (one `ALTER TYPE … ADD VALUE`), honours the documented convention, and still yields a self-describing trail (the view renders `context.operation`).

**Alternatives considered:** (a) Add four verbs `published/duplicated/restored/forked` — most self-describing action column, but deviates from the convention and adds three permanent enum values for distinctions that fold cleanly into `created`. (b) Add zero verbs, put `publish` in `context` too — leaves the action column unable to answer "show me all publishes" without JSONB filtering. `published` is the sweet spot.

### D3 — Anchor every event to the Pathway

`resource_type = "Pathway"`, `resource_id = pathway_id` on every event; version/source identifiers live in `context`. Duplicate anchors to the new pathway.

**Why:** The driving question is "what happened to this care path." Anchoring to the pathway makes the per-pathway timeline a single query against the existing `ix_audit_events_resource` index (`resource_type, resource_id, created_at DESC`). Anchoring publish/restore to `PathwayVersion` instead would split a pathway's story across two resource types and two queries.

### D4 — In-band emit (atomic with the mutation)

Authoring events are added to the **current request session** so they commit in the same transaction as the change. A rolled-back operation leaves no event. This needs a small helper analogous to `emit_committed()` but using the request session (e.g. `record_in_session(...)` / a method that `session.add()`s the `AuditEvent`).

**Why:** A `published` event must never exist for a publish that rolled back. This is the **opposite** requirement from login (which must persist despite a 401, hence its separate committed session). Different guarantee → different helper.

### D5 — Per-session coalescing for draft edits

`replace_definition` queries the most recent audit event for the pathway and suppresses a new `edited` event when the latest event is an `edited` event by the same actor within a quiet window (named constant, default 15 min). A fresh `edited` event is emitted when the window elapses, a different actor edits, or a lifecycle event intervened.

**Why:** Autosave fires constantly; one event per persisted save would bury the trail. Coalescing yields one line per editing session and naturally surfaces actor handoffs. The lookup reuses the `ix_audit_events_resource` index (latest event for `resource_type=Pathway, resource_id`), so it is a cheap indexed read per save.

**Alternatives considered:** (a) Emit every save — rejected by design intent (noisy). (b) Time-bucket without actor/lifecycle awareness — misses handoffs and would wrongly suppress the first edit after a publish.

### D6 — Access changes reuse `updated` + carry a small added/removed diff

The two `ScopingService` replace-set endpoints (`set_pathway_specialisms`, `set_pathway_practitioners`) emit `action = updated` with `context.operation` of `scope_specialisms` / `assign_practitioners`, anchored to the Pathway, carrying `context.added` / `context.removed` id lists. No-op saves (empty diff) emit nothing; these events are not coalesced.

**Why a diff here when authoring is headline-only:** for a permission change, *who gained or lost access* is the entire point, and the replace-set service already computes existing-vs-desired — so the diff is small, bounded, and free. This is a deliberate, scoped exception, not a reversal of the headline-only rule (D-authoring events still carry no `changes`).

**Why `updated` and not a new verb:** changing a pathway's access set is a modification of the pathway's configuration; it is not a publishable state transition. It folds cleanly into `updated`, so no enum growth. Same anchor (Pathway) means access changes interleave with authoring events in the per-pathway timeline.

**Why no coalescing:** these are deliberate admin saves through an admin panel, not debounced autosave. Each save is its own intentional event.

**Alternative considered:** `__audited__ = True` on `PathwaySpecialism` / `PathwayPractitioner`. Rejected — the replace-set deletes and re-inserts junction rows, so auto-diff would emit a scatter of per-row create/delete events instead of one coherent "access changed: +X −Y" event anchored to the pathway.

### D7 — No read-API change beyond the new enum value

The new `published` value flows through the existing `action` filter automatically. Per-pathway timeline, all-publishes, all-pathway-edits, and actor-scoped queries are all already served. `context.operation` stays display-only.

## Risks / Trade-offs

- **Coalescing read on the hot save path** → one extra indexed `SELECT … ORDER BY created_at DESC LIMIT 1` per `replace_definition`. Cheap (covered by `ix_audit_events_resource`); acceptable on an already write-heavy endpoint. If it ever matters, the last-edit timestamp could be cached, but that is premature now.
- **Create-flavours not server-side filterable** → distinguishing create/duplicate/restore/fork requires reading `context.operation` on the returned page. Acceptable for v1; per-pathway timelines and `published` filtering (the common needs) are fully served. JSONB filtering is a documented future extension.
- **Native enum migration is one-way** → `ALTER TYPE audit_action ADD VALUE 'published'` cannot be cleanly reversed (Postgres can't drop an enum value). The down-migration must rebuild the type or be a no-op stub; document the choice in the migration.
- **`ALTER TYPE … ADD VALUE` transaction constraint** → on some Postgres/Alembic setups, adding an enum value cannot run inside a transaction block alongside other DDL. Keep the enum addition in its own migration step (or use `op.execute` with the documented pattern) to avoid a failed batch.
- **Coalescing could hide a malicious rapid-edit pattern** → out of scope; the trail is operational, not intrusion-detection. Noted for the MVP audit surface (`BL-069`).

## Migration Plan

1. Add `published` to `AuditAction` (`app/core/enums/audit.py`).
2. Alembic migration: `ALTER TYPE audit_action ADD VALUE 'published'` (own migration step). Down-migration documented as type-rebuild or no-op.
3. Add the in-band emit helper.
4. Wire emit calls into the seven pathway service methods; add the coalescing lookup to `replace_definition`.
4b. Wire emit calls into the two `ScopingService` access methods; compute the added/removed diff and suppress no-op saves.
5. Regenerate `openapi.json` + orchestrator typegen for the new enum value.
6. Deploy: additive and backward-compatible — existing audit events and the read API are unaffected; pathway events simply begin appearing.

**Rollback:** Stop emitting (revert the service wiring). The enum value can remain harmlessly; no data migration is needed either way.

## Open Questions

- None blocking. The quiet-window default (15 min) is a tunable constant; revisit if real editing sessions show a different natural gap.
