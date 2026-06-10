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
- standalone full-page detail route at `/_auth/patients/$patientId` (same component, different shell wrapper)
- future `smart` / `embed` surface

See `../../design.md` §"Component reuse audit" for the build plan.

## Note on framing shift (post-v8)

After v8 was locked, the surface was reframed from "patient inbox" to **"caregiver attention inbox of items"** (design.md D19-D24). Visually v8 is unchanged — each row still shows a patient identity + appointment meta. Conceptually the row is now an `InboxItem` (a thing demanding attention) whose `subject` is a patient. v1 ships only `resourceType: "Appointment"` items, so each row maps 1:1 to an upcoming appointment. Click → opens the subject patient at `/_auth/inbox/p/$patientId`.

The route also moved: `/_auth/patients` → `/_auth/inbox` (promotes BL-065). Sidebar nav swaps `"Mijn patiënten"` → `"Inbox"`. The prototype's URL mock should be read as `/_auth/inbox?sort=...` instead of `/_auth/patients?sort=...` when implementing.
