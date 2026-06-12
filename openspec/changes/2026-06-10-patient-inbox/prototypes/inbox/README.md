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
| **v9** | **LOCKED** | Reframe-final: TASK rows (not patient rows), no sort tabs, no filter row, no pager (D-FLAT + D-NOSORT). Patient detail = TWO tabs only (Metingen + Labresultaten), no Afspraken (D10). Sidebar `Taken` replaces `Mijn patiënten`. Deterministic-tint avatars (D7). |

## v9 = accepted wireframe

Open `v9.html`. Three master states (D15 unchanged from v8):

1. **State 1** — `/_auth/tasks` — full-width task list, no detail pane.
2. **State 2** — `/_auth/tasks/p/$patientId` — compact 320px rail (avatar + name only), detail right.
3. **State 3** — local UI toggle on top of state 2 — master width 0, detail full-width, floating reopen button.

URL drives selection (state 1 ↔ 2). Master-hidden (state 2 ↔ 3) is session-local — NOT in URL.

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
