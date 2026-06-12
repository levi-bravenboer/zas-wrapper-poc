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
| **v10** | **LOCKED** | "Taken klein + alles open". Narrow 280px task rail left + scroll-stack of OPEN task cards right. Each appointment card = patient identity + appointment block + Metingen/Lab tabs. Scroll-spy syncs rail with viewport. Default view = see everything. |

## v10 = accepted wireframe

Open `v10.html`. Two-pane layout that ALWAYS shows both panes (no master/detail collapse):

- **LEFT** — narrow `280px` rail (`<TaskRail>`). One row per task: kind tile + `family, given` + relative due copy. Rail is grouped by due bucket (`Vandaag` / `Morgen` / `Over N dagen`).
- **RIGHT** — wide scrollable column (`<TaskStack>`). EVERY task renders as a card upfront. No click required to "open" anything.
  - For `source = "appointment"`, the card body = patient identity (avatar + name + INSZ pill + DOB + org + Zorgteam) + the appointment block (kind tile + title + time + modality + location + participants strip) + two patient tabs (`Metingen` + `Labresultaten`, both `<EmptyState>` v1).
  - Per-card actions: `Open patiënt` (deep link to `/_auth/patients/$id`) + kebab (`Bewerken` / `Verwijderen` / `Geschiedenis`).
- **Scroll-spy** — rail row highlights the card currently dominant in the right viewport. Clicking a rail row smooth-scrolls to its card and flashes a focus ring.

### What v10 reframes vs v9

- **No click-to-expand.** All tasks render open by default. The user direction was: *"takenlijst kleiner en dan rechts doen we al de taken open (voor appointment gewoon de patient)"*.
- **No master/detail state machine.** Drops D15 three-state collapse. Drops the floating reopen button. Drops `<MasterDetailLayout>` for this surface (the layout primitive is still available for other surfaces).
- **Rail = narrow chip list** (280px), not a 320px-or-full master.
- **Right = card stack**, not a single detail mount. Each appointment becomes a self-contained card.
- **The task IS the patient context for appointments** — patient identity is the card header. There is no separate "open patient" mode you need to reach.
- **Mobile fallback (`<md`)**: rail hidden, stack full-width (same scroll-stack on a phone, just without the side rail). Out of scope for this prototype.

### What stays from v9

- Sidebar nav = `Taken` (lucide `inbox`).
- TaskItem envelope shape (no top-level `patient`; payload carries it).
- Window hardcoded ≤3 days (D-WINDOW).
- Fixed sort `due_at asc` (D-NOSORT).
- Two patient tabs only (`Metingen` + `Labresultaten`) per D10.
- Deterministic-tint avatars (D7) by `patient.id`.
- Single source-agnostic empty-state copy (D-EMPTY).

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
