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
| v11 | superseded | Narrow rail + single-task right pane with custom card chrome. Didn't mirror real `PatientProfilePage` styling closely enough. |
| **v12** | **LOCKED** | Right pane = real `<PatientProfilePage>` chrome (EntityDetailPage + PageHeader + EntityDetailTabs, all mirroring orchestrator primitives 1:1). Small appointment-context block in the body slot, ABOVE the tabs. Empty state mirrors `<EmptyState>`. |

## v12 = accepted wireframe

Open `v12.html`. Two-pane layout, both panes always visible. Right pane mirrors the **real `<PatientProfilePage>` chrome** + adds a small appointment-context block above the tabs.

### Layout

- **LEFT** — narrow `280px` task rail (`<TaskRail>`). Always visible. Rows grouped by due bucket (`Vandaag` / `Morgen` / `Over N dagen`).
- **RIGHT** — `<EntityDetailPage>` chrome with appointment context:
  - **`<PageHeader>`** (px-6 pt-6 pb-4): eyebrow back-link, `h1` text-3xl semibold tracking-tight = `family, given`, subtitle row = `<Badge variant="default">INSZ:&nbsp;<mono /></Badge>` + `Geboren …` muted + `<Badge variant="soft">{org}</Badge>`. Actions = `<Button>Bewerken</Button>` + ghost-icon kebab.
  - **Body** (px-6 pb-8 flex flex-col gap-3):
    1. **Appointment context block** — flat slim strip with kind tile + title + relative time + modality icon/location + lead participant + `Open afspraak` ghost button. Subtle primary-soft background to nudge the eye but no card-in-card depth.
    2. **`<EntityDetailTabs>`** underline variant — `Metingen` + `Labresultaten` (D10). Both render `<EmptyState>` v1.
- **Empty state** when nothing selected mirrors `<EmptyState>` (dashed border, icon-in-circle on muted bg, `h3` text-base semibold + `p` max-w-sm text-sm muted).

### Why mirror existing primitives 1:1

User direction: *"more inline with our actually styling should use later on our components we already have in the orchestrator app"*. The prototype CSS replicates the relevant components so the React build is a 1:1 port — no surprise styling drift:

| Prototype class | Real component |
|---|---|
| `.badge[data-variant]` | `src/components/ui/badge.tsx` variants (`default` / `soft` / `outline` / `muted` / `destructive`) |
| `.btn[data-variant]` | `src/components/ui/button.tsx` variants (`default` / `ghost`) |
| `.tabs-list` / `.tab-trigger` | `src/components/ui/tabs.tsx` underline variant |
| `.av[data-tint]` | `src/components/ui/avatar.tsx` `getAvatarTintClass` palette |
| Right-pane chrome | `src/components/entity/EntityDetailPage.tsx` + `src/components/layout/PageHeader.tsx` |
| Tabs strip | `src/components/entity/EntityDetailTabs.tsx` (underline variant) |
| `emptyState()` | `src/components/states/EmptyState.tsx` |

### Implications for the React build (when promoting)

- `/_auth/tasks` parent route: plain two-column flex (`<TaskRail>` 280px + `<Outlet>`).
- `/_auth/tasks/index.tsx` child: `<EmptyState icon={Inbox} title="Selecteer een taak" body="..." />`.
- `/_auth/tasks/$taskId/index.tsx` child: fetches task + patient, renders `<EntityDetailPage>` with:
  - `back` → `{ to: '/_auth/tasks' }`.
  - `title` → `family, given`.
  - `subtitle` → INSZ Badge default + Geboren + Org Badge soft (reuse `pickInsz` + organisation lookup from existing `PatientProfilePage.tsx`).
  - `actions` → `Bewerken` + kebab (`useEntityDelete` + `Geschiedenis` dialog).
  - `body` → `<AppointmentContextBlock task={...} />` + `<EntityDetailTabs>` with Metingen + Lab.
- New components scoped to `modules/tasks/`:
  - `<AppointmentContextBlock>` — slim flat strip described above. Owns kind tile + relative-time copy + modality + lead participant + `Open afspraak` button.
- Reuse from `modules/patient/`: `usePatient`, `pickInsz`, organisation cache pattern, `EditPatientDialog`, `<PatientHistoryPanel>`, `useEntityDelete`.

### What stays from v11 / v9

- Sidebar nav = `Taken` (lucide `inbox`).
- Narrow `280px` task rail, grouped by due bucket.
- TaskItem envelope shape (no top-level `patient`; payload carries it).
- Window hardcoded ≤3 days (D-WINDOW).
- Fixed sort `due_at asc` (D-NOSORT).
- Two patient tabs only (`Metingen` + `Labresultaten`) per D10.
- Deterministic-tint avatars (D7) by `patient.id`.
- URL drives selection — selection is shareable.

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
