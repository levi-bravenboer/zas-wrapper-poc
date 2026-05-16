## Context

`dashboard-shell` ships a persistent sidebar with two top-level entries and a flat structure. The orchestrator-admin-ux chain layers four admin surfaces (`Gebruikers`, `Organisaties`, `Affiliaties`, plus the care-teams editor that lives inside patient profile), a caregiver landing page, and an inbox placeholder. The sidebar needs role-aware sections, the landing route needs a real page, and every list surface needs the same page-level frame around `<DataTable<T>>`.

Building all of that as a single capability now — before any consumer spec implements its surface — means consumers compose pre-validated primitives instead of re-rolling page shells.

## Goals / Non-Goals

**Goals:**
- One nav inventory in one file, role-filtered at render time.
- Caregiver lands on a useful page (counts + quick links), not a redirect.
- `<FilterableListPage<T>>` slot component every chain list surface composes (no per-surface page shell drift).
- `_auth/patients/index.tsx` refactor is byte-identical user-facing (no behaviour change).
- All admin route placeholders gated at the layout, not per-route, so unauthorised users never see the nav entry **and** can't deep-link in.

**Non-Goals:**
- No real Inbox functionality (placeholder route only).
- No realtime dashboard counts (initial render is enough).
- No permission framework refactor — same `session.user.role === 'admin'` checks used elsewhere.
- No theming or design-system additions.
- No accessibility work beyond what shadcn primitives already provide.

## Decisions

### D1. Hybrid nav vs flat nav

Pure flat (`Patiënten | Gebruikers | Organisaties | Affiliaties | Care teams | Instellingen`) wins on simplicity but fails on hierarchy — admin surfaces and clinical surfaces are different audiences. Hybrid with a `Beheer` group keeps the caregiver's daily-driver list short and tucks admin work behind one click. Cost: one collapsible component (already in shadcn).

### D2. Role gating at inventory level, not per-route

Filtering the inventory before render avoids "ghost" nav entries that the user can't click. The admin route layout (`_auth/admin/route.tsx`) is the second gate — defence in depth. Cheap.

### D3. `<FilterableListPage>` as slot scaffolding, not a controller

Tempting alternative: pass a `useListController` hook into the scaffolding and have it own data. Rejected — every list page already owns its `usePaginatedQuery` call via `<DataTable<T>>`, and forcing a second hook would duplicate state. Slots only.

### D4. Dashboard tiles backed by `Page.total`

KPI counts come from `page_size=1` calls to existing list endpoints. Cheap, no new endpoints, and the count stays correct against the same tenant scope the user already has access to. If a count fetch fails, render `—` instead of throwing; the dashboard's job is to suggest "what to do next", not be authoritative.

### D5. Drop the `_auth → _auth/patients` redirect

Keeping it means caregivers never see the new landing. Drop the redirect entirely; the landing is the new home. Direct `/_auth/patients` deep-links still work.

## Risks

- **R1 — placeholder admin pages look broken.** They live for a few PRs. Mitigation: render "Komt binnenkort — wordt geleverd door <spec>" with a link back; each downstream spec deletes its placeholder when shipping the real page.
- **R2 — patients-page refactor regression.** Subtle behaviour drift (URL keys, default sort, kebab actions) is easy. Mitigation: the existing patients-page test suite is the regression net; the refactor MUST keep them green without test edits.
- **R3 — `FilterableListPage` over-generalised.** Slot props grow on demand from chain consumers; ship the smallest viable surface (6 named slots) and add only if two consumers need a new one.

## Open questions

- Should the Inbox nav entry be visible to caregivers without a real inbox? Yes — placeholder is fine, and removing it later would require a nav-inventory edit. Keep it visible.
- Should `Beheer` be a collapsed-by-default group? Default open for admins, closed for caregivers (but they don't see it anyway). Open is friendlier; ship that.
