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
| **v8** | **LOCKED** | v7 + 3-state master/detail collapse. Surface-agnostic `<PatientDetailView>` architecture. |

## v8 = accepted wireframe

Open `v8.html`. Three master states:

1. **State 1** — `/_auth/patients` — full-width inbox, no detail.
2. **State 2** — `/_auth/patients/$id` — compact 320px rail (avatar + name + org + mini meta), detail right.
3. **State 3** — local UI toggle on top of state 2 — master fully hidden (width 0), detail full-width, floating "panel-left-open" button to bring master back to compact rail.

URL = source of truth for selection. Master-hidden (state 3) is session-local, not in URL.

`<PatientDetailView>` is **surface-agnostic** — same component mounted by:
- orchestrator inbox split-pane (via TanStack Router `<Outlet>`)
- a future standalone full-page detail route (same URL, different shell wrapper)
- future `smart` / `embed` surface

See `../../design.md` §"Component reuse audit" for the build plan.
