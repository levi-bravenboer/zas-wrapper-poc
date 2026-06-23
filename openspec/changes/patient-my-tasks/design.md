## Context

The task domain already exists end-to-end:

- **Backend** — `GET /tasks` (`task_router.py`) lists via `TaskService.list_for_caller`, which restricts a caregiver to `with_assignee(caller.id)` and lets `PATIENT_ACCESS_ALL` holders see tenant-wide. `TaskRepository` whitelists `patient_id` as an `eq` filter (`filterable_fields`). The shared list-query dependency (`app/api/_list/deps.py`) already parses bracket filters: `filter[patient_id]=<uuid>`. So a patient-scoped, caller-scoped task list is reachable today with **zero backend work**.
- **Frontend** — `modules/tasks` has `fetchTasks` (no patient filter), `useTasksQuery` (15s poll), `Task`/`TaskStatus` types from the generated OpenAPI schema, `TaskRow` (rail row, links to `/tasks/$taskId`), and `dueLabel`/`dayGroupLabel` helpers. `PatientProfilePage` renders `<PathwayTimeline>` then `<EntityDetailTabs>` in its body; `useSession()` exposes the current user.

What is missing is purely **presentation**: surfacing the current caregiver's open tasks for the patient in view, on the patient page, between the timeline and the tabs.

## Goals / Non-Goals

**Goals:**
- Show the logged-in caregiver's **open** tasks for the patient currently in view.
- Place it **between** the pathway timeline and the detail tabs.
- Render **nothing** when there are no such tasks (no card chrome, no empty-state).
- Reuse existing task primitives (`TaskRow`, `dueLabel`) so the panel matches the inbox.

**Non-Goals:**
- No backend change (filter + caller-scoping already exist).
- No completing/creating/assigning tasks from the panel — rows link into the existing `/tasks/$taskId` detail.
- No care-team / "team tasks" toggle (mine-only; admins inherit tenant-wide from the existing service rule).
- No pathway-runtime task materialisation (separate in-flight change).

## Decisions

- **D1 — Filter via the existing bracket-filter param, not a new endpoint.** `fetchPatientTasks(patientId)` calls the generated `/tasks` client with `filter[patient_id]=<patientId>` and `status` = open, `page_size` bounded. Reason: the param, the repo whitelist, and the caller-scoping all exist; adding a route would duplicate them.
- **D2 — Mine-only is implicit, not a new filter.** The panel does not pass an assignee filter. `TaskService.list_for_caller` already narrows a caregiver to their own tasks; an admin viewing the page sees all assignees for that patient (consistent with the inbox). Reason: avoid encoding auth in the client.
- **D3 — Open tasks only.** The panel is a "what do I still owe this patient" view, so it requests `status = open`. Completed history stays in the global inbox. Reason: matches the "to do" intent the user described.
- **D4 — Empty = `null`.** When the query resolves to an empty list (or while loading), the component returns `null`. No skeleton, no empty card. Reason: explicit user instruction — "when no tasks just nothing there".
- **D5 — Cards open the existing full task detail.** Clicking a task card navigates to the existing route `/_auth/tasks/$taskId/` (the full `EntityDetailPage`: complete/reopen action, patient summary, collaboration column). The panel builds no new detail surface — it is a lens onto the task that hands off to the inbox detail we already have. Reason: reuse the one detail view; no duplicate.
- **D7 — Horizontal block layout (prototype v3), inbox vocabulary.** Tasks render as a horizontal, snap-scrolling row of cards (~4 visible) with prev/next arrows + native scroll for the rest. Each card reuses the inbox `TaskRow` vocabulary: leading teal `Circle` status icon, title, muted `dueLabel` copy (overdue in `destructive`), and the `primary-soft` uppercase status chip. No bespoke per-task-type icons/colors (rejected v2 treatment). Reason: user-selected look; stays consistent with the `/tasks` list.
- **D6 — Own query key + poll, mirroring the inbox.** `usePatientTasksQuery(patientId)` keys on `['tasks','patient',patientId]` with the same 15s `refetchInterval` as the inbox so a newly-assigned task appears without reload. Reason: parity with `useTasksQuery`.

## Risks / Trade-offs

- **Generated-client bracket-filter ergonomics** — the typed client may not surface `filter[patient_id]` as a first-class param key. Mitigation: pass it through the client's `params.query` map (string key) exactly as `list_query_params` parses it; verify against `openapi.json`. No schema regen expected (no new route/param shape).
- **Two pollers on one page** — the inbox is not mounted on the patient page, so only this panel polls there; acceptable. If the patient page later mounts more task views, consolidate keys.

## Migration Plan

None — additive frontend only. No data, no schema, no API surface change.

## Open Questions

- Resolved: visual treatment is **prototype v3** (`prototypes/my-tasks/v3.html`) — horizontal blocks, inbox vocabulary, arrows + scroll. Remaining nit: keep overdue due-copy `destructive` (scan aid) vs. fully muted (pure inbox parity).
