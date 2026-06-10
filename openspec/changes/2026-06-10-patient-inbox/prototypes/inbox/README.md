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

After v8 was locked, the surface was reframed twice (the locked WIREFRAME is still v8 — visually unchanged):

**Iteration 1**: from "patient inbox" to "caregiver attention inbox of items" with polymorphic FHIR envelope. *Rejected* after user pushback.

**Iteration 2 (current)**: from polymorphic items to a focused **task list** (design.md D19-D24). Each row is a Task tied to a patient. Visually v8 is unchanged — rows still show patient identity + meta. Conceptually the row is now a `TaskRead`. Inbox row meta shows kind + due-time relative copy + priority chip + (optional) status chip — the v8 prototype's appointment-mini-card now represents task metadata.

Architecture summary:
- Inbox = task list. Click → opens the subject patient at `/_auth/inbox/p/$patientId` (split-pane) or `/_auth/patients/$patientId` (mobile fallback).
- Appointments are a separate domain consumed by the patient-detail Afspraken tab.
- Route shift: `/_auth/patients` (list) + `/_auth/tasks` (placeholder) → both deleted; replaced by `/_auth/inbox`. Promotes BL-065.
- Sidebar: drop `"Mijn patiënten"` + `"Taken"`, add single `"Inbox"`.

The prototype's URL mock should be read as `/_auth/inbox?sort=...` instead of `/_auth/patients?sort=...`. The "mini-card" right-meta in v8 (kind icon + time + modality) now represents task `(kind icon + dueLabel relative-time + priority chip)`.
