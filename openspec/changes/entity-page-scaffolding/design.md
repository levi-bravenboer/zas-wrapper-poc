## Context

`caregiver-shell` shipped `<FilterableListPage>` as the canonical chrome for every list surface in the chain. The remaining five consumers (`users-admin-ui`, `organisations-admin-ui`, `practitioner-roles-admin-ui`, `patient-profile-ui`, `care-teams-ui`) all add **detail + create + edit** flows on top of those lists. Without a comparable base for entity pages, each consumer will pick its own save-flow shape, dirty-guard pattern, delete UX, validation strategy, and error/loading copy.

Existing primitives that the base composes:
- `@tanstack/react-form` (already installed) + `zod` — form state + validation
- `@tanstack/react-router` `useBlocker` — navigation guard
- `sonner` — toast (`<Toaster>` already mounted in app shell)
- shadcn `form.tsx`, `alert-dialog.tsx`, `card.tsx`, `tabs.tsx`, `button.tsx`, `skeleton.tsx`, `sheet.tsx`
- `<PageHeader>` from `caregiver-shell`

Building the base now — before any consumer ships its detail/form pages — means consumers compose validated primitives instead of re-rolling chrome.

## Goals / Non-Goals

**Goals:**
- One chrome contract for entity detail and form pages used by all five chain consumers.
- One form component reused for create + edit (mode prop) — never two near-identical components per entity.
- Consumer-owned data (`useQuery` / `useMutation` stay outside the scaffolding) — keeps the base composable and testable in isolation.
- Cross-cutting concerns (dirty guard, delete confirm, toasts) live in hooks the consumer calls once; the chrome stays presentational.
- Validation = Zod schema → TanStack Form → inline `<FormMessage>` per field; on blur + submit (no eager-on-change noise).

**Non-Goals:**
- No permission framework — `_auth/admin/*` already gates on `session.user.role === 'admin'`. Per-action permissions arrive with a later change.
- No realtime / optimistic update plumbing — consumers can layer that in.
- No two-pane layout (e.g. Linear-style summary + tabs). Single-column and tabs ship; richer layouts on demand.
- No status-badge slot in chrome — consumers render badges inside their header `actions` slot. Cosmetic decisions defer to first impl.
- No "create another" / `save & new` workflow — create always navigates to detail.
- No browser-back hijack beyond `useBlocker`'s dialog when dirty.

## Decisions

### D1. Full-page routes for create + edit, never sheet / dialog

Sheet-from-list is faster for short forms but cramps long ones (patient profile, care-team editor will both need multi-section forms). One pattern across all five consumers beats two patterns with a soft rule about which to use. Route convention `_auth/admin/<entity>/new` + `_auth/admin/<entity>/$id/edit` deep-links cleanly and gives the browser back button useful semantics.

### D2. One `<EntityFormPage>` for create + edit, `mode` prop

The fields, validation, and submit handler differ by mode only in (a) initial values and (b) which mutation runs. Two components would duplicate the field tree. Single component + `mode: 'create' | 'edit'` prop keeps the consumer's form definition in one place.

### D3. Adaptive detail layout via composable bodies, not a god component

`<EntityDetailPage>` owns chrome (header + body slot) and nothing else. Body layouts (`<EntityDetailSingleColumn>`, `<EntityDetailTabs>`) ship as separate components consumers drop into the body slot. Rejected alternative: a single `<EntityDetailPage layout="tabs" tabs={...}>` API — pushes layout-specific props into the chrome surface and grows with every layout variant. Slot composition keeps the chrome small.

### D4. Consumer owns data; base owns chrome + cross-cutting hooks

Mirrors `<FilterableListPage>`'s contract. Wrapping `useQuery` / `useMutation` into the base would force a single fetch shape across five surfaces with different cache keys, dependency hooks, and invalidation rules. Hooks (`useEntityForm`, `useDirtyGuard`, `useEntityDelete`) cover the shared behaviour without owning data.

### D5. Dirty guard via TanStack Router `useBlocker` + AlertDialog

The router already exposes `useBlocker` for in-app navigation; a `beforeunload` handler covers tab close / hard reload. The hook wires both, plus an AlertDialog rendered inline so the consumer doesn't have to mount it. Rejected alternative: hand-roll a `useBeforeUnload` + custom history listener — duplicates router internals.

### D6. Validation = Zod on blur + submit, never on change

On-change validation flashes errors while the user is still typing and inflates the perceived complexity of every field. On-blur catches the same errors a moment later and matches industry norms (Linear, Vercel, GitHub). Submit re-runs the full schema, so nothing slips through.

### D7. Errors: inline card with retry, toast only for mutation failures

Read failures (detail load) render `<EntityErrorCard>` inside the page; the user sees what went wrong and stays in context. Mutation failures (submit, delete) raise a toast because the user already has the form / page state in front of them — a banner would be redundant. Rejected alternative: toasts for everything — loses context on cold-load errors.

### D8. Delete = header action → AlertDialog → toast + redirect to list

Putting delete in a "Danger zone" card at the bottom of the edit form hides it from the detail view where users land more often. Header action with AlertDialog confirm is the same shape every other admin tool uses (Linear, GitHub, Vercel). The hook owns dialog state, mutation call, toast, and redirect — consumer wires `mutationFn` + `listPath` once.

### D9. i18n: shared `entity-page` namespace + per-entity namespaces

Action labels, dirty-guard copy, delete-confirm copy, not-found copy, error copy are identical across the five surfaces — one namespace prevents copy drift. Per-entity namespaces still own field labels, titles, descriptions. Rejected alternative: keep everything per-entity — guarantees five subtly different `Wijzigingen niet opgeslagen` strings.

## Risks

- **R1 — base API over-fits the first consumer.** Mitigation: do not ship `<EntityDetailTabs>` slots beyond `tabs: [{ value, label, content }]` until two consumers need more; same rule that worked for `<FilterableListPage>`.
- **R2 — `useDirtyGuard` interaction with TanStack Router on form submit.** Submitting a dirty form should bypass the guard once the mutation succeeds (the consumer navigates after success). The hook MUST expose a `dismiss()` call so the consumer disables the blocker before navigating, and the success path calls it before `navigate()`.
- **R3 — Sticky footer obscures last field on short viewports.** Mitigation: body slot wraps in a scroll container with bottom padding equal to footer height; tested at the first consumer.
- **R4 — Edit-mode form mutates the cached entity before the mutation resolves.** Mitigation: `useEntityForm` works on a local copy from `defaultValues`; consumer's mutation invalidates the query on success; no optimistic update by default.
- **R5 — i18n namespace `entity-page` clashes with future per-page namespace named the same.** Low risk; pin the namespace as reserved in `caregiver-shell` doc updates.

## Open questions

- Should `<EntityFormPage>` expose a "discard" footer button (alongside Cancel / Save) for edit mode to revert to server state? Defer to first consumer feedback; not blocking.
- Where exactly does the status badge render in the header — left of title or right with actions? Defer to first impl with a real entity that has status. The chrome already accepts an `actions` slot; status badge is just another node in that slot until two consumers want it canonicalised.
