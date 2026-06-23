## Context

The landing route `apps/orchestrator/src/routes/_auth/index.tsx` is the caregiver workspace home (`F2`). It currently ships as a static placeholder: `StatTile` renders a `<Skeleton>` for every value and the two panels render `RowSkeleton` rows. It carries `// surface-opt-out: app-only` (catalogue: `dashboard` is app-only by intent — never `defineFeature`, never `gen:feature`).

Existing data clients we reuse (no new endpoints):

- `modules/patient/api.ts` — `GET /patients` (paginated, `Page.total`).
- `modules/tasks/api.ts` — `fetchTasks()` → `GET /tasks?page_size=100`, returns `Task[]`; `Task` carries `status` + a deadline field.
- `modules/appointment/api.ts` — `fetchAppointments()` → `GET /appointments?page_size=100`.

The `caregiver-shell` spec already describes a `<DashboardLanding>` (KPI tiles via `page_size=1` reading `Page.total`, em-dash on per-tile failure). The shipped code never matched it. This change makes code and spec converge on the F2 shape.

## Goals / Non-Goals

**Goals**
- Live counts on three KPI tiles (patients, pending tasks, appointments).
- Two drill-down panels — pending tasks by deadline (primary) + today/upcoming appointments — with one-click navigation.
- Graceful per-section degradation (em-dash / quiet empty panel), no error boundary, no thrown render.
- Zero backend / migration work; presentation-only.

**Non-Goals**
- Any new backend endpoint or aggregate/count API (counts come from `Page.total`).
- A "recente patiënten" list panel (cut — patient signal is the KPI count), a "patients needing attention" card (cut — needs runtime state), or quick-action buttons (cut).
- A `messages` tile (no messaging domain in PoC) or a `care-teams` tile (not part of F2).
- Task completion / mutation from the dashboard (that is the inbox, F4/F6).
- Live HiX/Luscii counts or alerting (F2 MVP delta).

## Decisions

### D1 — Counts via `page_size=1` + `Page.total`, not a count endpoint
Each KPI tile issues its own list request with `page_size=1` and reads `Page.total`. This matches the documented `caregiver-shell` pattern and adds no backend surface. Tiles fetch independently so one failing count cannot blank the others.

**Why:** PoC has no count/summary endpoint and we are not adding one (avoids backend + migration). `Page.total` is already returned by the list endpoints.

### D2 — "Pending" tasks only for the Open-taken count and the task panel
The `Open taken` tile and the "Mijn taken" panel count/show tasks whose `status` is the pending/open state, not completed ones. The count uses the same filter as the panel so the number and the list agree.

**Why:** F2 says "pending tasks". Showing total-including-completed would mislead. If the `/tasks` query supports a status filter param, use it for the count (`page_size=1`); otherwise derive the count from the already-fetched filtered list rather than issuing a second call.

### D3 — Panels cap at 5 and sort deterministically
"Mijn taken": pending tasks sorted by deadline ascending (overdue first), then creation, take 5. "Afspraken": appointments from now forward (today/upcoming) sorted by start ascending, take 5. Each row is an anchor/link, not a button, so it is keyboard-navigable and uses the router.

**Why:** Dashboard is a glance + drill-down surface (F2: "counts + one-click drill-down"), not a full list — those live at `/_auth/inbox` and the appointments surface. A "bekijk alles" link points to the full surface. Tasks panel is primary (the caregiver's reason to open the app); appointments panel is secondary context.

### D4 — Per-section quiet failure, never an error boundary
A tile whose fetch fails renders `—`. A panel whose fetch fails renders a quiet inline state (short muted message), keeping the rest of the page interactive. No `throw`, no shared error boundary.

**Why:** The dashboard aggregates several independent sources; one flaky source must not take down the whole home screen. Matches the existing `caregiver-shell` em-dash rule.

### D5 — Keep it inline in `index.tsx` (do not introduce `DashboardLanding`)
The shipped route already renders inline. We keep the data-backed version inline in `routes/_auth/index.tsx` rather than extracting a `features/dashboard/DashboardLanding.tsx`, and update the `caregiver-shell` spec wording to match. Reassess extraction only if the route grows unwieldy.

**Why:** Avoids a rename/move churn that the spec/reality drift would otherwise force; the page is small. The spec is the thing that was wrong, so we correct the spec to the simpler shipped shape.

### D6 — Reuse existing query clients + keys
Use the existing TanStack Query hooks/keys from `modules/patient`, `modules/tasks`, `modules/appointment` so the dashboard shares cache with the inbox/patients/appointments screens (navigating away and back is instant, and mutations elsewhere invalidate the dashboard too).

**Why:** No duplicate fetching layer; consistent cache + invalidation. Aligns with the "prefer packages / wrap don't rebuild" convention.

## Risks / Trade-offs

- **`page_size=1` count + `page_size=100` list = two calls per domain** for tasks (one for the tile count, one for the panel). Mitigation (D2): when a status filter is available the count is cheap; otherwise reuse the panel's fetched list to derive the count and skip the extra call.
- **"Afspraken vandaag/upcoming" filtering** is client-side over the fetched page if `/appointments` has no date-range param. With `page_size=100` and PoC data volume this is fine; if real volume grows it needs a server-side range filter (MVP).
- **Spec rewrite** touches `caregiver-shell`, a shared capability. We only MODIFY the landing-route requirement, leaving nav/i18n requirements intact.

## Migration Plan

None — no schema or data changes. Ship the route + i18n edit + spec delta together.

## Open Questions

- Does `GET /tasks` accept a `status` query param for a server-side pending count (D2)? Confirm during implementation; fall back to client-side derivation if not.
- Does `Task` expose the caller-scoped "mine" filter the panel title implies, or is `/tasks` already caller-scoped? Confirm the inbox's existing behaviour and reuse it.
- What is the appointment row's drill-down target — patient detail (Afspraken tab) or a dedicated appointment route? And is there a full "Afspraken" surface for "bekijk alles", or does it deep-link into the patient? Confirm against the appointment module's existing routes.
