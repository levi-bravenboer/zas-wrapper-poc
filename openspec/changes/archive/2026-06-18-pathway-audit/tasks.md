## 1. Audit action enum + migration

- [x] 1.1 Add `PUBLISHED = "published"` to `AuditAction` in `app/core/enums/audit.py`; update the module docstring to note that new verbs are added only for non-create/update/delete state transitions (cite `published`).
- [x] 1.2 Generate the migration via `moon run backend:make-migration` (message: "add published audit action") and edit it to `ALTER TYPE audit_action ADD VALUE 'published'` in its own step; document the down-migration as a type-rebuild or explicit no-op stub (Postgres cannot drop an enum value).
- [ ] 1.3 (remaining — needs dev stack) Apply the migration locally and confirm the enum value exists (`SELECT enum_range(NULL::audit_action)`); confirm existing audit read/write paths still work.

## 2. In-band emit helper

- [x] 2.1 Add an in-band recorder in `app/services/audit/` (analogous to `emit_committed()` but `session.add()`-ing the `AuditEvent` onto the **current** request session) that builds the event from action, optional `context.operation`, `resource_type`/`resource_id`, `context`, and the `SessionUser` actor (actor_type=user, actor_id, actor_label, tenant_id).
- [x] 2.2 Unit-test the helper: it adds the event to the passed session (commits with the transaction) and does NOT open a separate session.

## 3. Pathway authoring emit wiring

- [x] 3.1 `PathwayService.create_empty` → emit `created` / `operation=create` / `version_no=1`, anchored to the new pathway, actor from the request user.
- [x] 3.2 `PathwayVersionService.publish` → emit `published` (no operation) with `version_no`, `version_id`, `label`, `note` in context.
- [x] 3.3 `PathwayService.duplicate` → emit `created` / `operation=duplicate` anchored to the **new** pathway, with `source_pathway_id` + `source_version_id` in context.
- [x] 3.4 `PathwayVersionService.restore` → emit `created` / `operation=restore` with new `version_no` + `source_version_id` (+ `source_version_no`).
- [x] 3.5 `PathwayVersionService.fork_from_publish` → emit `created` / `operation=fork` with new `version_no` + `source_version_id`.
- [x] 3.6 `PathwayService.soft_delete` → emit `deleted` / `operation=delete` with `name` in context.
- [x] 3.7 Ensure the actor (`SessionUser`) reaches each service method (thread through from `CurrentUserDep` or reuse the `session.info` actor slot); confirm `tenant_id` is set on every event.
- [x] 3.8 Confirm all events set `resource_type = "Pathway"` and leave `changes` empty (headline-only).

## 4. Draft-edit coalescing

- [x] 4.1 Add a named quiet-window constant (default 15 minutes) in the audit/pathway service config.
- [x] 4.2 In `PathwayService.replace_definition`, before emitting, look up the most recent audit event for `(resource_type="Pathway", resource_id)` (single indexed read).
- [x] 4.3 Suppress a new `edited` event when the latest event is an `edited` event by the **same** actor within the quiet window; otherwise emit `updated` / `operation=edit` with `version_no` + `version_id`.
- [x] 4.4 Verify the emit path for the three reset conditions: window elapsed, different actor, intervening lifecycle event.

## 5. Pathway access emit wiring

- [x] 5.1 `ScopingService.set_pathway_specialisms` → compute `added`/`removed` specialism ids from existing-vs-desired; emit `updated` / `operation=scope_specialisms` anchored to the pathway with the diff in context.
- [x] 5.2 `ScopingService.set_pathway_practitioners` → compute `added`/`removed` user ids; emit `updated` / `operation=assign_practitioners` anchored to the pathway with the diff in context.
- [x] 5.3 Suppress emission when the diff is empty (no-op save), in both methods.

## 6. Tests

- [x] 6.1 Per-method emission tests: create / publish / duplicate / restore / fork / delete each produce exactly one event with the correct `action`, `context.operation`, anchor, and actor.
- [x] 6.2 Anchoring test: a pathway's full history is returned by one `resource_type=Pathway` + `resource_id` query in `created_at` order; duplicate anchors to the new pathway with `source_pathway_id` in context.
- [x] 6.3 Coalescing tests: rapid autosaves within the window collapse to one `edited` event; edit after window → new event; different actor → new event; edit after an intervening publish → new event.
- [x] 6.4 Atomicity test: a rolled-back publish leaves no `published` event; a committed authoring action persists its event in the same transaction.
- [x] 6.5 Access tests: setting specialisms/practitioners emits one `updated` event with the correct `operation` and `added`/`removed` diff; a no-op re-save emits nothing; access events appear in the pathway's timeline interleaved with authoring events.
- [x] 6.6 Read-API test: `action=published` filter returns publishes; confirm there is no server-side `context.operation` filter.

## 7. Contract sync + verification

- [x] 7.1 Run `/openapi-sync` to regenerate `apps/backend/openapi.json` and orchestrator typegen for the new `published` enum value.
- [x] 7.2 Run `/verify` (lint + typecheck + tests for the backend) and confirm green before opening a PR.
