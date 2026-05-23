# Overview & Create-Flow UI Specification

Per-element behavior + visual spec for `/pathways` (overview) and the create-pathway dialog, derived from D30–D35 in `design.md` and the orchestrator's existing design tokens.

**How to read this doc.**

- Sibling to `builder-ui-spec.md`. Same template per section: *Purpose · Anatomy · Layout · Visual · Behavior · Data · States · Accessibility · Open*.
- Covers everything pre-canvas: list, list-empty, create-button, modal, handoff to builder. The builder canvas itself stays in `builder-ui-spec.md`.
- Builder is **one component** with two entry paths: (a) dialog → POST → navigate (concept mode), (b) row click (concept or published). Lifecycle differences live in `builder-ui-spec.md` §25.
- Tokens cited are the orchestrator's existing tokens (`--primary`, `--card`, `--gradient-active`, etc.) plus phase/lane tokens added in `builder-ui-spec.md` §22.
- Locale: nl-NL only.

---

## 0. Overview shell

**Purpose.** Hosts the overview surface inside the standard orchestrator app shell. Distinct from the builder shell — sidebar stays in user-preferred state (no force-collapse).

**Anatomy.**
- `<AppSidebar>` (existing) on the left.
- `<SidebarInset>` content area on the right.
  - Page header (§1).
  - Pathway list region (§2) OR empty state (§4) OR loading (§5) OR error (§6) — mutually exclusive.

**Layout.**
- Content area max-width: 1200px, centered, horizontal padding 32px, vertical padding 24px top / 48px bottom.
- Page header sticks to top of content area (not viewport): `position: sticky; top: 0; z-index: 2; background: var(--card); padding-bottom: 16px; border-bottom: 1px solid var(--hairline);`. Keeps Create button reachable while scrolling long lists.

**Visual.**
- Content background: `var(--card)` (white).
- Body backdrop: same `--gradient-aurora` as the rest of the app.

**Behavior.**
- Standard sidebar collapse persistence (localStorage).
- Esc with focus inside list: no-op.

**Data.** `usePathwayList()` query → `OverviewState`.

**States.** Drives a single discriminated union `OverviewState`:
- `loading` (§5)
- `error` (§6)
- `ready-empty` (§4) — zero pathways
- `ready` (§2 + §3) — one or more pathways

**Accessibility.** `<main role="main" aria-labelledby="overview-title">`.

**Open.** Whether to add filters (status, owner, archive) — parked.

---

## 1. Page header

**Purpose.** Title + primary action. Anchors the page.

**Anatomy.**
- Title cluster (left):
  - `<h1 id="overview-title">Zorgpaden</h1>`
  - Subtitle: count line `{n} zorgpaden · {m} concept` (only renders in `ready` state).
- Spacer.
- Primary action (right): `+ Nieuw zorgpad` button.

**Layout.** `display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;`. Title cluster: `display: flex; flex-direction: column; gap: 4px;`.

**Visual.**
- Title: 22px / weight 600 / `letter-spacing: -0.01em` / foreground.
- Subtitle: 12.5px / muted-foreground / `font-variant-numeric: tabular-nums`.
- Create button: `btn-primary` (gradient-active background, white text, plus-icon 14px, label 13px / weight 600, height 36, padding 0 14px, border-radius `var(--r-sm)`, `box-shadow: 0 1px 2px rgba(11,26,23,0.08), 0 4px 12px color-mix(in srgb, var(--primary) 18%, transparent)`).

**Behavior.**
- Click Create → opens `CreatePathwayDialog` (§7).
- Subtitle hidden when `OverviewState !== ready`.

**Data.** Counts derived from list response.

**States.** Static; Create button is always enabled.

**Accessibility.**
- `<button aria-haspopup="dialog" aria-label="Nieuw zorgpad aanmaken">`.

**Open.** Whether Create-button copy reads `+ Nieuw zorgpad` or `+ Zorgpad aanmaken`.

---

## 2. Pathways list

**Purpose.** Show existing pathways at-a-glance with the most-needed metadata for orientation: name, status, owner, block count, last edited.

**Anatomy.**
- Single column list of `PathwayRow` (§3). No table chrome — each row is its own card.
- Optional toolbar above the list (sort/filter) — parked for PoC.

**Layout.**
- `display: flex; flex-direction: column; gap: 8px;` Below the page header.
- Rows: full content width.

**Visual.** Inherits row styling (§3). No separator lines (rows have own borders).

**Behavior.** Renders only when `OverviewState === ready`.

**Data.** `pathways: PathwaySummary[]` (sorted by `updated_at` desc by default).

**States.** Single state; per-row state lives in §3.

**Accessibility.** `<ul role="list">` containing rows as `<li>`.

**Open.** Whether to ship sort/filter toolbar in PoC.

---

## 3. PathwayRow

**Purpose.** One pathway as a clickable card. Conveys identity, status, and a quick action.

**Anatomy (left → right).**
1. Pathway identity tile (32px gradient square with workflow icon — same component the builder topbar uses, §1 of builder-ui-spec.md).
2. Identity stack:
   - Title row: `{name}` + status badge (`Concept` / `Gepubliceerd` / `Gearchiveerd`).
   - Meta line: `{block_count} blokken · {phase_count} fasen · door {owner.name} · bewerkt {relative_time}`.
3. Spacer.
4. Trailing actions cluster:
   - Owner avatar (26px round, initials).
   - Overflow menu `⋯` (ghost icon button).

**Layout.**
- Row: `display: flex; align-items: center; gap: 12px; padding: 12px 14px;`.
- Border: `1px solid var(--hairline)`; border-radius: `var(--r-md)`.
- Background: `var(--card)`.
- Identity stack: `display: flex; flex-direction: column; gap: 2px; min-width: 0;` (flex-shrink rules let title truncate).
- Trailing cluster: `display: flex; align-items: center; gap: 8px;`.

**Visual.**
- Identity tile: same gradient + border as builder topbar's tile (`linear-gradient(135deg, primary@16%, mint@22%)`, border `primary@22%`, inner highlight `inset 0 1px 0 white@60%`). Size `md` (32×32).
- Title: 14.5px / weight 600 / foreground / single-line truncate.
- Status badge:
  - `Concept` → bg `color-mix(in srgb, var(--warn) 8%, var(--card))`, border `var(--warn) 26%`, text `var(--warn)`.
  - `Gepubliceerd` → bg `color-mix(in srgb, var(--success) 8%, var(--card))`, border `var(--success) 26%`, text `var(--success)`.
  - `Gearchiveerd` → muted-foreground, hairline border, transparent bg.
  - Dimensions: `display: inline-flex; height: 20px; padding: 0 8px; border-radius: 999px; font: 10.5px/1 weight 600; letter-spacing: 0.04em; text-transform: uppercase;`.
- Meta line: 11.5px / muted-foreground / `font-variant-numeric: tabular-nums` / single-line truncate. Bullet separator 2.5px dot opacity .45.
- Owner avatar: 26px round, hash-of-name gradient (same palette as builder presence stack §18). Tooltip: `{owner.full_name} · {owner.role}`.
- Overflow button: 28×28 ghost.
- Hover: `border-color: var(--border-strong); box-shadow: var(--shadow-sm);`. Cursor pointer.
- Active/pressed: 1px translateY downward, shadow tightens.

**Behavior.**
- Click anywhere on the row (except overflow button or avatar tooltip area) → `navigate({ to: '/pathways/$pathwayId', params: { pathwayId: id } })`.
- Overflow menu opens shadcn `<DropdownMenu>` with: `Naam wijzigen`, `Dupliceren`, `Archiveren` (danger). All except `Archiveren` parked for PoC.

**Data.** `PathwaySummary { id, name, status, block_count, phase_count, owner: { id, full_name, role }, updated_at }`. `relative_time` formatted via `formatDistanceToNow` from date-fns with nl-NL locale.

**States.**
- `default` / `hover` / `pressed`.
- Status variant drives the badge.

**Accessibility.**
- `<li><a href="/pathways/{id}" aria-label="{name}, {status}, bewerkt {time}">…</a></li>`.
- Status badge contributes to the aria-label.
- Overflow menu: `<button aria-label="Acties voor {name}" aria-haspopup="menu">`.

**Open.** Whether to expose archive directly (vs hide behind overflow).

---

## 4. Empty state (ready-empty)

**Purpose.** When the tenant has zero pathways, guide the caregiver to create their first.

**Anatomy.**
- Centered illustration placeholder (workflow icon at 64px in a 96×96 gradient tile, same gradient as identity tile).
- Title: `Nog geen zorgpaden`.
- Body: `Maak je eerste zorgpad aan om patiëntreizen te ontwerpen.`
- Primary CTA: `+ Nieuw zorgpad` (duplicate of page-header button).

**Layout.** Vertically centered in the content area below the page header. Max-width 360px, centered text.

**Visual.** Title 16px / weight 600. Body 13px / muted-foreground / line-height 1.5. CTA same as §1.

**Behavior.** Click CTA → same dialog as §1's Create button.

**Data.** Rendered when `pathways.length === 0`.

**States.** Single.

**Accessibility.** `<section aria-labelledby="empty-title">`; title gets that id.

**Open.** Whether to seed a sample pathway button (`Voorbeeld zorgpad inladen`).

---

## 5. Loading state

**Purpose.** Skeleton while `GET /pathways` is in flight.

**Anatomy.** Three skeleton rows matching the layout of §3.

**Visual.** Each skeleton row: same border + padding as a real row, with:
- 32×32 rounded skeleton (identity tile placeholder).
- Two stacked text-lines: 180×12 (title), 240×10 (meta) with `var(--shadow-sm)` softness.
- Right-side: 24×20 status badge placeholder.
- Skeletons use shadcn `Skeleton` component (animated pulse).

**Behavior.** Replaces list region; page header still renders (Create button enabled and functional).

**Data.** Driven by `query.isPending`.

**States.** Single.

**Accessibility.** `<div role="status" aria-label="Zorgpaden worden geladen">`.

---

## 6. Error state

**Purpose.** When `GET /pathways` fails.

**Anatomy.**
- Centered card with: alert icon (lucide `triangle-alert`), title `Kan zorgpaden niet laden`, body with the error message, two buttons: `Opnieuw proberen` (primary) + `Ga terug` (ghost).

**Layout.** Centered in content area, card max-width 420px.

**Visual.** Card with `border: 1px solid color-mix(in srgb, var(--danger) 18%, var(--hairline));` and `background: color-mix(in srgb, var(--danger) 3%, var(--card));`. Icon 18px in danger color. Title 14px / weight 600. Body 12.5px / muted-foreground.

**Behavior.**
- `Opnieuw proberen` → `query.refetch()`.
- `Ga terug` → `navigate({ to: '/' })`.

**Data.** `query.error`.

**States.** Single.

**Accessibility.** `role="alert"` on the card.

---

## 7. CreatePathwayDialog

**Purpose.** Capture the minimum info needed to seed a concept pathway, then hand off to the builder where the actual structuring happens.

**Anatomy (top → bottom).**
1. Header cluster:
   - 40×40 gradient identity tile (size `lg`, workflow icon).
   - Stack:
     - Eyebrow: `NIEUW ZORGPAD` (uppercase, 10.5px, weight 700, letter-spacing 0.08em, muted-foreground).
     - Title: `Begin met een leeg canvas`.
2. Body form (`<form onSubmit>`):
   - Field group 1 — **Identiteit**.
     - `Naam *` (text input, autoFocus, max 120 chars, placeholder `bv. Rugrevalidatie`).
   - Field group 2 — **Doelen**.
     - `Klinisch doel *` (textarea 3 rows, placeholder `Wat wil de behandelaar bereiken?`).
     - `Patiëntdoel *` (textarea 3 rows, placeholder `Wat ervaart de patiënt aan het einde?`).
   - Field group 3 — **Setup**.
     - `Fase-preset` (radio group): `Standaard (4 fasen)` (default) | `Leeg canvas`.
     - `Eigenaar` (combobox of caregivers in the tenant; defaults to current user; required; non-empty).
3. Footer:
   - `Annuleren` (ghost button, left).
   - Spacer.
   - `Aanmaken & openen` (primary button with gradient-active, right). Loading spinner replaces icon while pending.

**Layout.**
- Dialog width: 520px. Padding: header 20px 24px 16px; body 0 24px 16px; footer 16px 24px.
- Header cluster: `display: flex; gap: 12px; align-items: center;`.
- Field groups: stacked with 18px gap. Within a group: 10px gap between fields. Group label (not rendered as visible heading — semantic group only) wraps each `<fieldset>`.
- Inputs: full width.
- Footer: `display: flex; align-items: center; gap: 12px;`.

**Visual.**
- Dialog overlay: existing shadcn `<DialogOverlay>` with backdrop blur.
- Dialog panel: glass-strong — `background: rgba(255,255,255,0.96); backdrop-filter: blur(20px) saturate(160%); border: 1px solid var(--hairline); border-radius: var(--r-lg); box-shadow: 0 24px 64px rgba(11,26,23,0.18), 0 2px 8px rgba(11,26,23,0.06);`.
- Identity tile: same gradient as builder topbar's tile, size `lg` (40×40, radius 12).
- Eyebrow + title align with the tile: top of tile = top of eyebrow.
- Inputs: shadcn `<Input>` + `<Textarea>` defaults. Focus ring: `outline: 2px solid color-mix(in srgb, var(--primary) 45%, transparent); outline-offset: 1px;`.
- Radio group: horizontal `<RadioGroup>` with 2 cards each 1fr, padding 12px, border `1px solid var(--hairline)`, border-radius `var(--r-sm)`. Selected card: border `1.5px solid var(--primary)`, background `color-mix(in srgb, var(--primary) 6%, var(--card))`, primary-colored radio dot.
- Owner combobox: shadcn `<Command>` inside `<Popover>` triggered by an input-styled button showing selected avatar + name.
- Primary button: same gradient-active styling as overview Create button; height 38px in footer for a bit more presence.
- Field labels: 12px / weight 500 / foreground / margin-bottom 4px.
- Helper text: 11.5px / muted-foreground / margin-top 4px.
- Inline validation error: 11.5px / `color: var(--danger)` / margin-top 4px.

**Behavior.**
- Opens via Create-button click; closes via X, Esc, click outside, Annuleren, or successful submit.
- Naam, Klinisch doel, Patiëntdoel, Eigenaar are required. Trimmed values feed validation.
- `Aanmaken & openen` enabled when all required fields non-empty and `!createMutation.isPending`.
- Submit:
  1. Disable Annuleren + submit; show spinner on submit button.
  2. `POST /pathways` with `{ name, clinical_goal, patient_goal, phase_preset, owner_id }`.
  3. On 2xx: close dialog, push success toast `pathway.create.success`, `navigate({ to: '/pathways/$pathwayId', params: { pathwayId: data.id } })`.
  4. On 4xx (validation): map field errors onto fields inline; pop generic error toast for non-field errors.
  5. On 5xx / network: push error toast `pathway.create.error`; dialog stays open with values preserved.
- Phase preset behavior:
  - `Standaard (4 fasen)` → backend seeds 4 phases named `Voorbereiding`, `Behandeling`, `Herstel`, `Nazorg` with default lane scaffold (`patient`, `caregiver`, `system`).
  - `Leeg canvas` → backend seeds zero phases, zero lanes; builder opens in `ready-empty` state with the first-block CTA disabled until at least one phase + lane exist (handled via the builder's first-block CTA — `builder-ui-spec.md` §26).
- Owner default: current logged-in user.

**Data.**
- `useCreatePathway()` mutation → `POST /pathways`.
- `useCaregivers()` for owner combobox options.
- On success: `queryClient.invalidateQueries(pathwayKeys.list())`.

**States.**
- `idle` (default).
- `submitting` (mutation pending).
- `field-error` (per-field inline errors; dialog stays open).
- `error` (toast surface).

**Accessibility.**
- `<Dialog role="dialog" aria-modal="true" aria-labelledby="create-dialog-title" aria-describedby="create-dialog-desc">`.
- Eyebrow + title: title carries the id; eyebrow has `aria-hidden="true"`.
- All inputs have associated `<label>` via `htmlFor`.
- Inline errors via `aria-describedby` on the invalid input.
- Focus trap (shadcn handles); first field (Naam) auto-focuses.
- Submit triggers on Enter from any single-line input; multiline textareas use Cmd/Ctrl+Enter.

**Open.**
- Whether to add a `Beschrijving` field separately from goals (currently only goals).
- Whether `Eigenaar` is a single user or a list.

---

## 8. Dialog → builder handoff

**Purpose.** Specify exactly what state lands on the builder after dialog submit so the canvas reads right immediately.

**Sequence.**
1. Dialog `submitting`.
2. `POST /pathways` → returns `{ id, status: 'concept', phases: [...], lanes: [...], blocks: [], edges: [] }`.
3. Dialog closes (animation: 120ms scale 1 → 0.96 + fade).
4. Success toast appears.
5. Router navigates to `/pathways/$pathwayId`.
6. Builder route mounts:
   - Reads pathway via `usePathway(id)` (cache pre-seeded by mutation `onSuccess`).
   - `BuilderShellState` resolves to `ready-empty` (no blocks).
   - Phase columns + lane rows render (from the preset, if any).
   - Empty-canvas CTA shows in earliest lane (see `builder-ui-spec.md` §26).
   - Status pill shows `Concept · automatisch opgeslagen`.
   - Topbar identity reads from the new record.

**Behavior — no flash.**
- Pre-seed: mutation `onSuccess` calls `queryClient.setQueryData(pathwayKeys.detail(id), data)`. Builder mounts with cached data; no loading skeleton between dialog close and ready render.

**Behavior — failure midway.**
- If router navigation fails (rare), pop toast `pathway.create.openFailed` with link `Open zorgpad` → manual navigate retry.

**Data.** Pre-seeded cache key: `pathwayKeys.detail(id)`. List cache invalidated to surface the new row when user comes back.

**States.** N/A — sequence.

**Accessibility.** Route change announced by existing router-level a11y (`<title>` updates, focus moves to `<h1>` if any).

**Open.** Whether dialog should animate slide-up-into-canvas instead of fade (parked — fade is the orchestrator default).

---

## 9. Tokens reference (overview-scope)

No new tokens introduced. Reuses:
- `--primary`, `--primary-pressed`, `--card`, `--foreground`, `--muted-foreground`, `--hairline`, `--border`, `--border-strong`, `--shadow-sm`, `--shadow-glass`.
- `--warn`, `--success`, `--danger` for status badges and error states.
- `--gradient-active` for Create + Submit buttons.
- `--r-sm`, `--r-md`, `--r-lg` for radii.

Identity tile reuses the gradient declared in `builder-ui-spec.md` §1 — overview must import the same `PathwayIdentityTile` component (not duplicated).

---

## 10. Out of scope (explicit non-requirements)

- Filters (status, owner, archive).
- Sort UI (default: `updated_at desc`).
- Bulk actions (delete/archive multiple).
- Search across pathway names.
- Pagination (PoC assumes < 50 pathways per tenant).
- Owner reassignment from the row (only via overflow → parked).
- Wizard variants of the create dialog (multi-step).
- Phase-preset library beyond the two PoC options.
- Tags / categories.
- Patient-facing surface (orchestrator scope: admins + caregivers only).

---

## 11. Open questions (deferred to implementation)

1. Create-button copy: `+ Nieuw zorgpad` vs `+ Zorgpad aanmaken`?
2. Sort/filter toolbar in PoC?
3. Seed sample-pathway button in empty state?
4. Archive action exposed inline or only via overflow?
5. Separate `Beschrijving` field on dialog vs goals only?
6. Owner combobox: single vs multiple owners?
7. Dialog motion: fade vs slide-up-into-canvas?
8. Phase-preset names — `Voorbereiding/Behandeling/Herstel/Nazorg` vs other defaults?
9. Should `Leeg canvas` also skip seeding default lanes?
