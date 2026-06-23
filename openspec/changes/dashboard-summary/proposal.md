## Why

**Tier**: [poc] — closes feature `F2` Dashboard.

The orchestrator landing route (`/_auth/`) is the caregiver's workspace home, but today it is a static placeholder: four KPI tiles render permanent skeletons (`<Skeleton>`), and the two list panels ("Mijn taken", "Recente patiënten") render `RowSkeleton` rows that never resolve. No real data is ever fetched. The shipped `index.tsx` also drifted from the `caregiver-shell` spec — it inlines its own markup instead of `<DashboardLanding>`, declares a different tile set (adds `appointments` + `messages`), and adds two drill-down list panels that the spec never described.

`F2` requires the logged-in caregiver to land on a dashboard showing **summary counts + their pending tasks, with one-click drill-down**. The dashboard is task-first: the caregiver opens the app to see what to do today. We make the existing skeleton real — live counts and navigable lists, reading only existing endpoints. Presentation-only — no backend, no migration. The page stays **app-only by intent** (`// surface-opt-out: app-only`); it is not migrated through `gen:feature` and never calls `defineFeature`.

## What Changes

- **Three KPI tiles fetch live counts** — `Actieve patiënten` from `GET /patients`, `Open taken` from `GET /tasks` (pending only), `Afspraken` from `GET /appointments`, each requested with `page_size=1` and read from `Page.total`. A per-tile fetch failure renders an em-dash (`—`), never an error boundary.
- **Drop the `messages` tile** — there is no messaging domain in the PoC (no `messages` module, no `/messages` endpoint). The tile would show a permanent placeholder, so it is removed; the `stats.messages` i18n key is deleted.
- **"Mijn taken" panel (primary) becomes real** — renders the caller's pending tasks sorted by deadline (overdue first, then creation), capped at 5, reusing the existing `tasks` query. Each row is a one-click drill-down opening the referenced patient/task; a "bekijk alles" link points to `/_auth/inbox`. Empty state when there are none; quiet inline failure panel on fetch error.
- **"Afspraken" panel becomes real** — renders today/upcoming appointments (capped at 5) from the existing `appointments` query, each row navigating to the appointment's patient/detail. Empty + quiet-failure states; "bekijk alles" link to the appointments surface.
- **Reconcile spec with reality** — update `caregiver-shell` so the documented landing dashboard matches what ships: the corrected tile set (patients, pending tasks, appointments — no messages, no care-teams tile) plus the two drill-down panels (tasks, appointments) with one-click navigation.

## Capabilities

### Modified Capabilities
- `caregiver-shell`: the `/_auth/` landing dashboard renders live KPI counts (patients, pending tasks, appointments) sourced from existing list endpoints via `Page.total`, plus two drill-down panels (pending tasks by deadline, today/upcoming appointments) whose rows navigate on click; per-section fetch failures degrade quietly to em-dash / quiet-panel states without an error boundary.

## Impact

- **Frontend (orchestrator)**: `apps/orchestrator/src/routes/_auth/index.tsx` — replace skeleton tiles + lists with data-backed counts and lists (reusing `modules/patient`, `modules/tasks`, `modules/appointment` query clients); add count queries with `page_size=1`; remove the `messages` tile; replace the "Recente patiënten" skeleton panel with the "Afspraken" panel; wire row click-through navigation. Update `apps/orchestrator/src/lib/i18n/locales/nl/dashboard.json` (drop `stats.messages`, retarget the second panel keys to appointments, add empty/error strings).
- **Backend**: none. All counts and lists come from existing `GET /patients`, `GET /tasks`, `GET /appointments`.
- **Migrations**: none.
- **Out of scope**: a "recente patiënten" list panel (cut — patient signal is the KPI count only); a "patients needing attention" / pathway-off-track card (cut for PoC — needs runtime state); quick-action buttons (cut — create flows live on their own pages); the `messages` domain (does not exist in PoC); live counts from HiX/Luscii and out-of-bounds alerting (`F2` MVP delta — needs HiX FHIR adapter + Luscii contract); a `care-teams` KPI tile (older draft, never shipped, not part of `F2`); task completion from the dashboard (lives in the inbox `F4`/`F6`).
