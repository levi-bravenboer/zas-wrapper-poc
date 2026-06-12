# Inbox prototypes

| Version | Status | Notes |
|---------|--------|-------|
| v1 | superseded | First scaffold with sort + mini-card. |
| v2 | superseded | Glass sidebar + Card chrome split-pane. |
| v3 | superseded | Inbox narrower (420px), tighter rows. |
| v4 | superseded | Linear-style minimalism — too far. |
| v5 | superseded | Entity-page chrome mirror — wrong vibe. |
| v6 | superseded | Builder topbar + subbar + drawer mirror — too heavy. |
| v7 | superseded | Admin-table style (real orchestrator vibe). |
| v8 | superseded | v7 + 3-state master/detail collapse. Surface-agnostic `<PatientDetailView>` architecture. Pre-reframe (patient list with sort tabs + Afspraken tab). |
| v9 | superseded | Reframe-final master/detail. Click row → expand patient detail right. |
| v10 | superseded | Narrow rail + scroll-stack of ALL tasks open. Scroll-spy. Too noisy — user wants single-task focus. |
| **v11** | **LOCKED** | Narrow 280px rail (always visible) + right pane shows ONE task at a time. URL drives selection. Empty state when nothing selected. Single-card focus replaces stack. |

## v11 = accepted wireframe

Open `v11.html`. Two-pane layout, both panes always visible:

- **LEFT** — narrow `280px` rail (`<TaskRail>`). Always visible. Rows grouped by due bucket (`Vandaag` / `Morgen` / `Over N dagen`). Each row = kind tile + `family, given` + relative due copy. Active row has a 3px left accent and tinted background.
- **RIGHT** — single-task viewport (`<TaskDetail>`). Renders exactly ONE state:
  - **Nothing selected** (URL `/_auth/tasks`): `<EmptyState>` with `Selecteer een taak` headline + `Kies links een taak om de patiënt en de afspraak te bekijken.` hint.
  - **One selected** (URL `/_auth/tasks/$taskId`): that task's full card — patient identity (avatar + name + INSZ pill + DOB + org + Zorgteam) + appointment block (kind tile + title + time + modality + location + participants strip) + Metingen/Labresultaten tabs (both empty v1).
- Per-card actions: `Open patiënt` (deep link to `/_auth/patients/$id`) + kebab (`Bewerken` / `Verwijderen` / `Geschiedenis`).

### What v11 reframes vs v10

- **One task at a time** on the right. No scroll-stack. No scroll-spy.
- **URL drives selection** (state 1 ↔ state 2). Selection is shareable.
- **Empty state on first load.** Caregiver lands on `/_auth/tasks` → sees the rail + a centered "Selecteer een taak" empty state on the right.
- **Rail still narrow 280px** and always visible (no collapse, no hide).

### What stays from v10

- Sidebar nav = `Taken` (lucide `inbox`).
- Narrow `280px` task rail, grouped by due bucket.
- TaskItem envelope shape (no top-level `patient`; payload carries it).
- Window hardcoded ≤3 days (D-WINDOW).
- Fixed sort `due_at asc` (D-NOSORT).
- Two patient tabs only (`Metingen` + `Labresultaten`) per D10.
- Deterministic-tint avatars (D7) by `patient.id`.
- Single source-agnostic empty-state copy (D-EMPTY) on rail; separate "selection" empty state on right pane.

### Implications for the React build (when promoting)

- Drop `<MasterDetailLayout>` from `/_auth/tasks` route — replace with a plain two-column flex layout (the layout primitive stays available for other surfaces).
- Route shape: parent `/_auth/tasks` renders rail + `<Outlet>`; child `/_auth/tasks/$taskId/index.tsx` renders the selected task card; child `/_auth/tasks/index.tsx` renders the selection-empty state.
- URL param is `$taskId` (not `$patientId`) — selection is per-task, not per-patient. Same patient can have two tasks → two distinct selectable rows + URLs.
- Patient-detail components from `<PatientDetailView>` (D16) are reused as the upper section of the right card; the appointment block is a new piece (lives in `modules/tasks/`).

### What v9 reframes vs v8

- **Inbox = TASK list (not patient list).** Multiple tasks per patient → multiple rows. Same patient can appear twice (e.g. Anke has a controle + a check at 16:30 today).
- **No filter row.** No `Team` / `Status` dropdowns. No search input. Window is hardcoded ≤3 days (D-WINDOW).
- **No sort tabs.** Single fixed sort = `due_at asc` (D-NOSORT).
- **No pager strip.** No `Per pagina` / `Vorige / Volgende` / `Meer laden`. Flat list (D-FLAT).
- **Row anatomy (D7)**: subject avatar (deterministic tint per `patient.id`) + identity (family, given) + secondary line (INSZ · kind label · relative due copy) + `<KindTile>` + chevron. No per-row kebab. No checkbox.
- **Patient detail tabs = TWO ONLY** (`Metingen`, `Labresultaten`). Both render `<EmptyState>` v1 (D10). **No `Afspraken` tab** — appointment surfacing lives entirely in `/tasks` (the row IS the upcoming appointment).
- **Sidebar nav** = single `Taken` entry replacing `Mijn patiënten`. Lucide `inbox` icon (icon-name only; surface concept is "tasks").
- **Empty state copy** = `Geen taken` / `Nieuwe taken verschijnen automatisch` (D-EMPTY).
- **Kebab actions** = `Bewerken` / `Verwijderen` / `Geschiedenis` (history → shadcn `Dialog` with `<PatientHistoryPanel>`).

`<PatientDetailView>` stays **surface-agnostic** (D16) — mounted by:
- task-list split-pane (via TanStack Router `<Outlet>` at `/_auth/tasks/p/$patientId`)
- standalone full-page detail at `/_auth/patients/$patientId` (mobile fallback + non-tasks-context entry)
- future `smart` / `embed` host

### What stays from v8

- Admin-page chrome (solid sidebar, underline tabs primitive).
- 3-state master/detail layout (D15) + 320px compact rail.
- Surface-agnostic `<PatientDetailView>` (D16).
- Tinted INSZ pill in detail header.
- `<KindTile>` visual language for appointment kinds.

### Resolved questions

- **Q1 (counter)** — resolved by D-FLAT: no counter, no pager.
- **Q3 (`next_appointment` on `GET /patients/{id}`)** — resolved by D-AGG: no embedded next_appointment anywhere; aggregator at `/tasks` is the canonical projection.

See `../../design.md` for the full decision set.
