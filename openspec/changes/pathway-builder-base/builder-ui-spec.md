# Builder UI Specification

Per-element behavior + visual spec for the pathway builder, derived from `builder-canvas-prototype.html` (May 2026) and design decisions D21–D29.

**How to read this doc.**

- Each section describes **one user-visible piece** of the builder. Sections follow a consistent template: *Purpose · Anatomy · Layout · Visual · Behavior · Data · States · Accessibility · Open*.
- Cross-references: `design.md` carries the **why** (D-decisions); this doc carries the **what + how**; `builder-components.md` carries the **React mapping** (component names, props, file paths, build order).
- Tokens cited (e.g. `--primary`, `--gradient-active`, `--lane-patient`) are listed in §22 Tokens reference.
- All measurements are in CSS pixels at 1× zoom. Aspect: desktop-first, no mobile/tablet variant in PoC.
- Locale: nl-NL only (en/fr deferred per Phase 2 i18n policy).

---

## 0. Global layout — builder shell

**Purpose.** Hosts every other piece. Locks the three-row chrome (topbar, subbar, canvas) so the canvas dimensions stay knowable for xyflow viewport math (D21).

**Anatomy.**
- Topbar (§1)
- Subbar (§2)
- Canvas frame (§3) — contains background layers (phase columns, lane rows), node layer, edge layer, dock (absolute), drawer (absolute), minimap+zoom (absolute).

**Layout.**
- Outer: `display: grid; grid-template-rows: 64px 44px 1fr;` filling the viewport minus the app sidebar.
- App sidebar starts collapsed (icon-only, 56px wide) when the route mounts; restores to user's previous state on unmount.
- Canvas frame uses `position: relative` so all absolute overlays anchor to it.

**Visual.**
- Body background: `var(--gradient-aurora)`, `background-attachment: fixed`.
- No outer border.

**Behavior.**
- Only the canvas frame scrolls. Topbar and subbar pin.
- Esc with nothing focused clears selection.
- Keyboard shortcuts (global): `⌘Z` undo, `⌘⇧Z` redo, `⌘S` save (preventDefault on browser default).

**Data.** Reads `usePathway(id)`, `usePathwayBlocks()`, `usePathwayPhaseTemplates()`. Holds `useBuilderState(initial)` as the controlled source of truth for nodes/edges/selection/history.

**States.** Single discriminated union `BuilderShellState`:

- `loading` — `usePathway(id)` pending. Topbar renders chrome skeleton (identity tile placeholder + faded title bar + disabled buttons). Subbar shows 3 anchor skeletons. Canvas shows shimmer over phase-column placeholders. Status pill hidden.
- `not-found` — pathway id resolved to 404. Topbar renders only the back link (`← Zorgpaden`) and a muted title `Zorgpad niet gevonden`. Subbar hidden. Canvas region shows a centered card: alert icon, title `Dit zorgpad bestaat niet of is verwijderd`, body, primary button `Terug naar overzicht`.
- `error` — fetch failed for non-404 reasons. Topbar renders identity tile + back link + faded buttons. Subbar hidden. Canvas region shows centered card: alert icon, title `Kan zorgpad niet laden`, body with error message, two buttons: `Opnieuw proberen` (primary) + `Terug naar overzicht` (ghost).
- `ready-empty` — pathway loaded with zero blocks. Topbar + subbar fully active. Canvas renders phase columns + lane rows from the preset (if any). First-block CTA visible (§26). Status pill shows `Concept · automatisch opgeslagen` if status is `concept`, otherwise the regular clean/dirty machine (§17).
- `ready-populated` — normal canvas. Topbar + subbar + all canvas layers active.

Transitions:
- `loading → ready-empty | ready-populated` on fetch success.
- `loading → not-found | error` on fetch failure.
- `error → loading` on retry.
- `ready-empty → ready-populated` when the first block is added.

**Accessibility.**
- `<main role="main">` wraps the canvas frame; topbar uses `<header>`; subbar uses `<nav aria-label="Fasen">`.
- `not-found` and `error` cards: `role="alert"` and `aria-labelledby` pointing at the card title.

**Open.** Whether to persist the last-used zoom level / scroll position per pathway in localStorage.

---

## 1. Topbar

**Purpose.** Identity, status, presence, history, save. The chrome that tells the user "what pathway am I editing, is it saved, who else is here, can I undo/save?" (D28).

**Anatomy (left → right).**
1. Pathway identity tile (32px gradient square with workflow icon).
2. Identity stack (eyebrow crumb + title row).
   - Crumb: `ZORGPADEN / Rugrevalidatie` (uppercase first crumb, slash separator).
   - Title row: editable title, pencil-icon trigger, meta line (`9 blokken · 4 fasen · bewerkt 13:24`).
3. Status pill (slim outline pill with pulsing dot when dirty).
4. Spacer (flex 1).
5. Presence stack (overlapping avatars).
6. Vertical divider (1×22 hairline).
7. Undo button (icon).
8. Redo button (icon).
9. `Geschiedenis` ghost button (clock-rewind icon + label).
10. `Opslaan` primary button (save icon + label, gradient background).

**Layout.**
- Height: 64px. Padding: `0 16px 0 14px`. Gap between children: 14px.
- Identity tile + identity stack form one logical cluster, no gap between them.
- Identity stack: `display: flex; flex-direction: column; gap: 1px;`. Title row inside: `display: inline-flex; align-items: center; gap: 8px;`.

**Visual.**
- Background: glass — `linear-gradient(180deg, transparent 0%, rgba(207,237,232,0.18) 100%)` over `rgba(255,255,255,0.55)`, `backdrop-filter: blur(10px) saturate(140%)`.
- Bottom edge: `border-bottom: 1px solid var(--hairline)` plus an `::after` 1px gradient (transparent → primary@22% → transparent, opacity .35) for a subtle aurora bleed.
- Identity tile: 32×32, `border-radius: 9px`, background `linear-gradient(135deg, primary@16% white, mint@22% white)`, border `1px solid primary@22%`, inner highlight `inset 0 1px 0 white@60%`.
- Eyebrow crumb: 11.5px, `letter-spacing: 0.02em`, muted-foreground; the root segment uppercased at 10.5px, weight 600, `letter-spacing: 0.08em`.
- Title: 14.5px / weight 600 / `letter-spacing: -0.005em`, foreground color.
- Meta line: 11px, muted-foreground, numeric segments use `font-variant-numeric: tabular-nums`. Bullet separator is a 2.5px dot at opacity .45.

**Behavior.**
- Click identity tile (or eyebrow root crumb) → `navigate({ to: '/pathways' })`.
- Click title or pencil → `EditableTitle` enters edit mode (auto-width input, Enter or blur commits, Esc reverts). Commit → `PUT /pathways/{id}` with the new name; optimistic UI; on error revert + toast.
- Status pill is a passive indicator — not interactive in PoC.
- Avatars are tooltips-only in PoC (no click target).
- Undo / redo: disabled when `history.past` / `history.future` is empty.
- `Geschiedenis`: opens version-history drawer (stub in PoC — button is rendered, drawer is `// TODO`).
- `Opslaan`: dispatches save action; disabled while `saving`.

**Data.** Reads pathway summary fields (`name`, derived block_count, derived phase_count, derived updated_at), `saveState` from builder state, `history.past/future` lengths, presence list (stub `[]` in PoC).

**States.**
- Save states: `clean` / `dirty` / `saving` / `error`. Pill visual + Save button enabled-ness derived from this.
- Title commit: idle / saving (input becomes read-only) / error (revert + toast).
- Sidebar collapsed: always true on this route (no variant).

**Accessibility.**
- Pencil icon: `<button aria-label="Naam wijzigen">`.
- Status pill: `role="status" aria-live="polite"`; localized text "Niet opgeslagen" / "Opgeslagen" / "Opslaan…" / "Opslaan mislukt".
- Avatars: `aria-label="{name}"`; presence stack `aria-label="Aanwezig: {n} mensen"`.
- Buttons keyboard-reachable in DOM order; Save button has `data-testid="builder-save"` for e2e.

**Open.** Whether the meta line shows `Laatst opgeslagen 13:24` or `Bewerkt 13:24` when there are unsaved edits.

---

## 2. Subbar — phase anchor strip

**Purpose.** Spatial navigation between phases (D29). Not tabs. Click jumps the canvas viewport to that phase's x-range.

**Anatomy.**
- Leading label: `SPRING NAAR` (uppercase 10.5px, weight 600, letter-spacing 0.06em, muted-foreground).
- Phase anchor × N: `[index-badge] {label}`.
- Chevron separator `›` between anchors.
- Trailing `+ Fase` ghost button → opens `PhasePickerPopover`.

**Layout.**
- Height: 44px. Padding: `0 14px`. Gap between children: 2px.
- Anchor: `display: inline-flex; height: 28px; padding: 0 10px; gap: 8px; border-radius: var(--r-sm);`.
- Index badge: 18×18 round, phase-tinted (`background: var(--ph-soft); color: var(--ph-ink)`), 10.5px / weight 600, tabular-nums.

**Visual.**
- Subbar background: **transparent** (the strip floats on the canvas/aurora).
- Bottom edge: faint gradient hairline `::after` (transparent → 6% black → transparent). No solid border.
- Anchor label: 12.5px / weight 500 / foreground.
- Anchor hover: `background: rgba(11, 26, 23, 0.04)` (mild teal-tinted hover, no border).
- Chevron: 12×12, `color: var(--border-strong)`.
- `+ Fase`: ghost button, same hover treatment, `+` icon 12×12.

**Behavior.**
- Click an anchor → smooth-scroll the canvas viewport horizontally so the matching phase column's left edge aligns at ~80px from the canvas-frame left (gives visual breathing room before the first block).
- Anchors are stateful only in the sense of order — no "active" highlight (D29). Hover gives feedback, click commits scroll.
- `+ Fase` opens `PhasePickerPopover` (§14).

**Data.** Reads `pathway.phases` ordered by `ord`; emits `onJumpToPhase(phaseId)` and `onAddPhase()`.

**States.** Single state. No active variant.

**Accessibility.**
- `<nav aria-label="Fasen">` wraps.
- Anchors: `<button>` with `aria-label="Spring naar fase {idx} {label}"`.
- Keyboard: Tab moves through anchors; Enter/Space activates.

**Open.** Whether to add a tiny live-region announcement on jump ("Verplaatst naar fase 2 Operatie").

---

## 3. Canvas frame

**Purpose.** The xyflow surface (D5). Hosts background layers, nodes, edges, and floating overlays.

**Anatomy.**
- Background layers (rendered below nodes, non-interactive):
  - Phase columns (§4)
  - Lane rows (§5)
- xyflow node layer (interactive)
- xyflow edge layer (interactive)
- Floating overlays (positioned absolute inside the frame):
  - Dock (§14)
  - Drawer (§15) — slide-in from right
  - Minimap + zoom panel (§19) — bottom-right

**Layout.**
- Fills row 3 of the shell grid: `position: relative; overflow: hidden;`.
- Inner xyflow `<ReactFlow>` element fills the frame.
- Background layers sit in a single absolutely-positioned child of the xyflow viewport so they pan and zoom together with nodes.

**Visual.**
- Frame background inherits `--gradient-aurora` from the body.
- A 24px square dotted grid (`background-image: radial-gradient(circle, rgba(11,26,23,0.06) 1px, transparent 1px); background-size: 24px 24px;`) sits on top of the aurora for spatial anchoring while panning.

**Behavior.**
- Pan: middle-mouse drag, space+drag, or two-finger scroll on trackpad.
- Zoom: `⌘` + scroll, or pinch on trackpad.
- Selection: click on empty area clears selection. Click on a node selects it. `⇧` + click multi-selects (multi-select UI is parked for PoC — clicks still work, drawer reflects last-selected).
- Drag-from-dock: drop releases a new node at the drop coordinates, snapped to the closest lane row by y, defaulting lane to the type's `default_lane_kind_code`.

**Data.** Reads nodes/edges from `useBuilderState`. Emits `onNodesChange`, `onEdgesChange`, `onConnect`, `onSelectionChange` per xyflow controlled-mode contract.

**States.**
- Empty pathway: shows a centered empty state inside the frame (`"Begin met een blok uit het palet hieronder"` + arrow pointing down to the dock).
- Loading: skeleton shimmer over the frame; dock + drawer inert.

**Accessibility.**
- Frame: `role="application"` with `aria-label="Zorgpad-canvas"`.
- xyflow handles keyboard pan/zoom internally; document the relevant shortcuts in a `?` overlay (parked).

**Open.** Whether to use the xyflow MiniMap component or a custom minimap (§19 currently custom).

---

## 4. Phase columns (background layer)

**Purpose.** Show phase boundaries spatially (D22). Each block sits visibly inside one phase column.

**Anatomy.**
- Per phase: a full-height tinted column.
- Per phase: a floating phase-head chip (badge + label + count) at top-left of the column.

**Layout.**
- Column: `position: absolute; top: 0; bottom: 0; left: {x_start}; width: {x_end - x_start};`. Right edge: `1px dashed rgba(11,26,23,0.08)`.
- Phase-head chip: `position: absolute; top: 14px; left: 14px;`, `display: inline-flex; height: 26px; padding: 0 10px 0 7px; gap: 7px; border-radius: 999px;`. Inline-flex so width fits content.

**Visual.**
- Column background: `var(--phase-N)` (faint pastel, ~3–5% saturation against canvas). Each phase has a hue: 1 = mint, 2 = lilac, 3 = peach, 4 = sand (tokens defined in §22).
- Phase-head chip: glass — `background: rgba(255,255,255,0.55)`, `backdrop-filter: blur(10px) saturate(160%)`, `border: 1px solid color-mix(in srgb, var(--ph-ink) 14%, var(--hairline))`, `border-radius: 999px`, `box-shadow: 0 1px 0 white@50% inset, 0 1px 2px black@5%`.
- Badge inside chip: 16×16 round, `background: var(--ph-soft); color: var(--ph-ink);` 10px / weight 700 / tabular-nums.
- Label: 11.5px / weight 600 / foreground / letter-spacing -0.005em.
- Count pill: 10.5px, muted-foreground, `background: rgba(11,26,23,0.06)`, `padding: 1px 6px; border-radius: 999px;`.

**Behavior.**
- Non-interactive on its own — clicks pass through to canvas/nodes.
- Future (parked): hover on phase-head highlights the column edge slightly; click opens phase-edit popover.

**Data.** Phases read from `pathway.phases`; x ranges computed by `layoutEngine.computePhaseRanges(pathway)` (described in §20).

**States.** None (static rendering once phases resolved).

**Accessibility.**
- Decorative; phase-head chip has `aria-hidden="true"` (the subbar is the navigation surface).

**Open.** Whether the phase-head chip should be a click target to open a phase-rename popover (currently no).

---

## 5. Lane rows + sticky labels

**Purpose.** Show lane membership (D23). Every block sits visibly inside one lane row, color-coded per lane kind.

**Anatomy.**
- Per lane: a horizontal row band spanning full canvas width.
- Per lane: a sticky label chip pinned at the left edge of the viewport (lane icon + name + count).

**Layout.**
- Row: `position: absolute; left: 0; right: 0; top: {y_start}; height: {y_end - y_start};`. Sets `--lane-accent` CSS variable on the row root so children inherit it.
- Label chip: `position: sticky; left: 12px;` inside the row, `display: inline-flex; height: 28px; padding: 0 12px 0 8px; gap: 8px;`. Top offset from row top: 8px. `width: max-content`.

**Visual.**
- Row background: `color-mix(in srgb, var(--lane-accent) 4%, transparent)` — a near-invisible lane tint that becomes legible only when a block sits in it.
- Row top border (between lanes): `1px solid color-mix(in srgb, var(--lane-accent) 12%, var(--hairline))`.
- Sticky label chip: glass — `background: rgba(255,255,255,0.7)`, `backdrop-filter: blur(8px)`, border `1px solid color-mix(in srgb, var(--lane-accent) 24%, var(--hairline))`, `border-radius: 999px`, `box-shadow: var(--shadow-xs)`.
- Label icon: 13×13 in a 18×18 lane-tinted square inside the chip.
- Label text: 12px / weight 600 / foreground.
- Count: 11px / muted-foreground / tabular-nums.

**Behavior.**
- Sticky label survives horizontal scroll (always visible at `left: 12px` of viewport).
- Hover on chip: subtle background bump.
- Click chip → opens lane-edit popover (rename, change icon, toggle visibility) — parked for PoC.

**Data.** Lanes read from `pathway.lanes` ordered by `ord`; y ranges from `layoutEngine.computeLaneRanges(pathway)`.

**States.**
- Empty lane (`blockCount === 0`): label chip dims to 60% opacity; row gets a `2px dashed lane-accent@30%` outline at low opacity.

**Accessibility.**
- Label chip: `<div role="group" aria-label="Lane {name}, {count} blokken">`.

**Open.** Whether to allow drag-reordering lanes via the chip (parked for PoC).

---

## 6. Block card (default)

**Purpose.** Render one `pathway_block`. Single-card aesthetic locked to 220×68 (D27) regardless of duration.

**Anatomy.**
- Rail-bar (4px vertical strip, lane-accent color).
- Ico-tile (28×28 lane-tinted square with block-type icon).
- Name (single line, truncate).
- Meta row: `{type-label} · {DayChip}`.
- In-port (mid-left, §8).
- Out-port (mid-right, §8).
- Entry corner-tab (top-left, only when block is the runtime entry) (§13).

**Layout.**
- Dimensions: 220×68 fixed.
- Inner grid: `grid-template-columns: 4px 36px 1fr; grid-template-rows: auto auto;` with the rail-bar spanning both rows. Ico-tile centered in col 2.
- Card padding: 0 (rail-bar is flush left).

**Visual.**
- Card background: `var(--card)` (#ffffff).
- Border: `1px solid var(--border)`. On hover: `var(--border-strong)`. On selected: `1.5px solid var(--lane-accent)`.
- Border-radius: `var(--r-md)` (6px).
- Box-shadow: `var(--shadow-sm)`. On selected: additionally `0 0 0 4px color-mix(in srgb, var(--lane-accent) 22%, transparent)` glow.
- Rail-bar: solid `var(--lane-accent)`. Top-left + bottom-left corners match card radius.
- Ico-tile: `background: color-mix(in srgb, var(--lane-accent) 12%, var(--card))`, `color: var(--lane-accent)`, `border-radius: var(--r-sm)`. Icon 16×16, stroke-width 1.7, currentColor.
- Name: 13px / weight 600 / foreground / `letter-spacing: -0.005em` / single-line truncate.
- Meta type label: 11.5px / weight 500 / muted-foreground.
- Meta separator dot: 2.5px round, opacity .45.

**Behavior.**
- Click → selects block, opens drawer to its config form.
- Double-click on name → inline-edit name (commits to `block.config.title` or top-level name depending on schema — parked decision; default to top-level `name` field).
- Drag → repositions on canvas, snaps to lane row (`y` constrained to lane center; `x` free).
- Hover → ports scale 1.25× (§8 hover-port affordance).
- Delete shortcut: select + `⌫` → confirmation modal, then `onDeleteBlock(blockId)`.

**Data.** Reads `block`, `blockType` (resolved from `catalogue[block.type]`), `lane` (resolved from `lanes[block.lane_id]`).

**States.**
- `default` — as above.
- `selected` — lane-accent border + glow.
- `is-entry` — corner-tab visible.
- `is-dirty` (PoC: not visualized per block, dirty is pathway-wide).
- `is-error` (config invalid): red outline 1px, alert dot in top-right corner. Parked: PoC validates only on save.

**Accessibility.**
- `<div role="button" tabindex="0" aria-label="{name}, type {type}, lane {lane}, duration {duration}">`.
- Enter / Space activates (selects).
- Focus ring: same as selected state.

**Open.**
- Whether to surface deferred-fields count as a small badge on the card.
- Whether to show an inline-edit pencil-icon on hover next to the name (currently double-click-only).

---

## 7. Branch block variant

**Purpose.** Same as §6 but for `decision`-type blocks with two outgoing paths.

**Differences from §6.**
- Border style: `dashed` 1px (signals "branches from here"). Selected border becomes solid.
- Out-port replaced with two ports (§8): `out-yes` at `top: 28%`, `out-no` at `top: 72%`.
- Meta type label always reads "Beslissing".
- Ico-tile icon: branching glyph (lucide `git-branch` or equivalent).

Everything else inherits from §6.

---

## 8. Connection ports

**Purpose.** Explicit, visible affordances for starting/ending edges (D25). Replace the "drag from anywhere on the card" mystery.

**Anatomy.**
- Single circular dot, 11px diameter.
- Anchored to card edge:
  - `in` — `left: -6px; top: 50%; margin-top: -5.5px;`
  - `out` — `right: -6px; top: 50%; margin-top: -5.5px;`
  - `out-yes` — `right: -6px; top: 28%;`
  - `out-no` — `right: -6px; top: 72%;`

**Visual.**
- Default: `background: var(--card); border: 1.5px solid var(--lane-accent); box-shadow: 0 1px 2px rgba(11,26,23,0.15);`.
- Hover (card or port): scale to 1.25×, `background: var(--lane-accent)` (filled).
- Active drag: scale 1.4×, additional glow ring `box-shadow: 0 0 0 4px color-mix(in srgb, var(--lane-accent) 30%, transparent)`.

**Behavior.**
- Hover-port affordance: ports are always visible at low scale; scale up on card hover so they don't disappear when the user isn't pointing at one. (Other tools hide ports until hover — this prototype keeps them visible to teach the affordance.)
- Drag from a port → starts a connection. xyflow's `<Handle>` provides the geometry; this component is the visual skin.
- Drop on another port → creates an edge. Drop on empty → cancels (no node-creation-on-drop in PoC).

**Data.** Per-port handle id maps to xyflow Handle: `in` → `target/left`, `out` → `source/right`, `out-yes` → `source/right/yes`, `out-no` → `source/right/no`.

**States.** `default` / `hover` / `dragging` / `connected` (when at least one edge anchors to this port — adds an inner dot to indicate occupancy, parked).

**Accessibility.**
- `aria-label="Verbinding {in|uit|ja-tak|nee-tak}"`.
- Keyboard-initiated connection (Tab to port, Enter to start, arrow keys to traverse target candidates): parked for PoC.

**Open.** Whether to show port labels (`ja`/`nee`) inline on hover for branch ports.

---

## 9. Edges

**Purpose.** Show flow between blocks (D24). Direction implied, not arrow-marked.

**Anatomy.**
- One SVG `<path>` per edge.
- Optional `<EdgeLabel>` (§10) at the midpoint of the longest straight segment.

**Layout.**
- Path geometry: orthogonal H/V segments connecting source-port → target-port, with `Q` corner curves of radius 8–10px.
- Generation algorithm (described in §20 layout engine): start at source port, draw to ~10px out horizontally, turn vertically toward target y, turn back horizontally to target port. For cross-phase or cross-lane edges, choose the routing channel that minimizes overlap with other edges (PoC: simple "step at the midpoint" heuristic — overlap avoidance parked).

**Visual.**
- Default: `stroke: #cbd1d8; stroke-width: 1.75; fill: none;`.
- Primary (cross-phase OR branch-positive): `stroke: var(--primary); stroke-width: 2;`.
- Dashed (branch-negative): default colors plus `stroke-dasharray: 6 4`.
- Stroke linecap: `round`. Stroke linejoin: `round`.
- **No `marker-start` or `marker-end`.** Direction is implied by port placement.

**Behavior.**
- Click → selects edge; selected edge stroke widens by 1px and shows endpoints (small handles on source/target dots).
- Selected + `⌫` → delete with confirmation modal.
- Hover → stroke color brightens by ~12% (no width change to avoid layout jitter).

**Data.** Reads `pathway.edges`; xyflow handles selection state.

**States.** `default` / `primary` / `dashed` / `hover` / `selected` / `invalid` (e.g. dangling — parked: PoC ensures all edges valid on save).

**Accessibility.**
- `<path role="img" aria-label="Verbinding van {source.name} naar {target.name}">`.

**Open.**
- Whether to color cross-phase AND branch-positive identically (current) or split them into two distinct variants.
- Whether to bundle parallel edges (multiple edges between the same two blocks) — D20 forbids duplicates so likely not needed.

---

## 10. Edge labels

**Purpose.** Show delay between source completion and target activation (e.g. `+1d`, `+7d`).

**Anatomy.**
- A single SVG `<text>` element.

**Layout.**
- Position: midpoint of the longest straight segment of the edge path.
- `text-anchor: middle; dominant-baseline: middle;`.

**Visual.**
- Font: 11px Geist Mono (or `font-variant-numeric: tabular-nums` if monoface not available).
- Color: `var(--muted-foreground)`.
- Optional pill background (parked): `rgba(255,255,255,0.85)` rounded rect to keep label legible over busy backgrounds.

**Behavior.** Non-interactive in PoC.

**Data.** Reads `edge.delay_value` resolved via `pathway_timing_value`. Formats: `D+{n}d`, `D-{n}d`, `+{n}u`, `+{n}m`, etc.

**States.** Hidden if `delay_value === null`.

**Accessibility.** Decorative — the labeled edge already carries an `aria-label` (§9).

**Open.** Whether to add a pill background for legibility.

---

## 11. Day chip (block meta)

**Purpose.** Compact representation of duration / scheduled day on a block card.

**Anatomy.** Single inline pill.

**Layout.** `display: inline-flex; align-items: center; height: 18px; padding: 0 7px; border-radius: 999px;`.

**Visual.**
- Background: `color-mix(in srgb, var(--lane-accent) 8%, var(--card))`.
- Border: `1px solid color-mix(in srgb, var(--lane-accent) 18%, transparent)`.
- Text: 10.5px / weight 600 / `color: var(--lane-accent)` (darker shade) / `font-variant-numeric: tabular-nums`.

**Behavior.** Tooltip on hover: `Vaste dag: D+10 vanaf inschrijving`.

**Data.** Reads `block.duration_value` from `pathway_timing_value`. Formats:
- `fixed` kind, days: `D{+/-}{n}d` (e.g. `D0`, `D+10`).
- `fixed` kind, hours: `{n}u` (e.g. `2u`).
- `fixed` kind, minutes: `{n} min` (e.g. `30 min`).
- `enrollment` kind: `D0` always.
- `null`: hide the chip entirely.

**States.** Present / hidden.

**Accessibility.** Tooltip via `<title>` or shadcn `<Tooltip>`.

**Open.** Whether to ever render a duration range (`0–7d`) — depends on whether ranges are added back to the timing-value table.

---

## 12. Entry corner-tab

**Purpose.** Visually identify which block is the runtime entry point (the block enrollment will start at).

**Anatomy.** Single span attached to card's top-left corner.

**Layout.** `position: absolute; top: -1px; left: -1px;`, `padding: 3px 7px 3px 8px;`.

**Visual.**
- Background: `var(--primary)`.
- Color: `#fff`.
- Border-radius: only `border-top-left-radius` + `border-bottom-right-radius` set to `var(--r-md)` (folder-tab shape).
- Text: 9px / weight 700 / `letter-spacing: 0.09em` / uppercase.
- z-index: 5 (above rail-bar, below ports).

**Behavior.** Non-interactive (block click still works). Indicates state only.

**Data.** Read from `block.is_entry` (derived field). Per D16, the entry block is picked at enrollment, not at design time — so this tab is purely for previewing "if this pathway were enrolled now, here's the start." Source for `is_entry` in PoC: the first block with no incoming edges (computed in the layout engine).

**States.** Shown when block is the derived entry; hidden otherwise.

**Accessibility.** `aria-label="Startblok"`; rendered as a `<span>` with `role="status"`.

**Open.** Whether to render the tab on multiple blocks if there are multiple "no incoming edges" candidates, or pick one deterministically.

---

## 13. Block group (time-locked cluster)

**Purpose.** Represent one moment in time (e.g. `D+10`) that triggers multiple ordered child blocks (D26). Replaces scattered micro-blocks.

**Anatomy.**
- Outer container: dashed lane-tinted card.
- Group header: uppercase label + step count + DayChip.
- Group items (children): numbered rows `[idx] [icon] [name] [type]`.
- One outer `in` port (mid-left), one outer `out` port (mid-right). **No** per-child ports.

**Layout.**
- Container width: 252px (slightly wider than a block to fit the 4-col item grid). Height: auto, capped at ~360px (children scroll inside if more).
- Padding: `8px 10px 10px 10px`.
- Header row: `display: flex; align-items: center; gap: 8px; padding-bottom: 6px;`.
- Item row: `display: grid; grid-template-columns: 14px 24px 1fr auto; gap: 8px; align-items: center; padding: 6px 8px; border-radius: var(--r-sm);`.

**Visual.**
- Container border: `1.5px dashed color-mix(in srgb, var(--lane-accent) 55%, var(--border-strong))`.
- Container background: `color-mix(in srgb, var(--lane-accent) 5%, rgba(255,255,255,0.82))`.
- Container border-radius: `var(--r-md)`.
- Header label: 10.5px / weight 700 / uppercase / letter-spacing 0.08em / muted-foreground.
- Header count: 10.5px / weight 500 / muted-foreground.
- Header DayChip: identical styling to §11.
- Item idx: 10px / weight 700 / tabular-nums / muted-foreground.
- Item icon: 14×14 lane-accent.
- Item name: 12px / weight 500 / foreground.
- Item type: 10.5px / muted-foreground / right-aligned.
- Item hover: `background: rgba(11,26,23,0.04)`.

**Behavior.**
- Click container header → selects the group (drawer opens to a group config form: shared moment + step order + optional shared metadata).
- Click child row → selects that child as a block (drawer opens to its block config form). Selecting a child does **not** select the group.
- Drag-reorder children via grip on hover (parked for PoC).
- Add a child via `+ Stap` footer button (parked).
- Group ports behave identically to block ports (§8).

**Data.** Reads `pathway.block_groups[id]` + `pathway.blocks` filtered by `group_id` ordered by `group_ord`. **Data model dependency:** requires `pathway_block_group` table and `pathway_block.group_id` + `pathway_block.group_ord` columns — not in Phase 1 schema. Phase 3 either ships the migration or falls back to UI-only grouping (an in-memory cluster the user can save but that doesn't round-trip).

**States.** `default` / `selected` (container border becomes solid). `empty` (0 children) prevented at creation time.

**Accessibility.**
- Container: `role="group" aria-label="Cluster {label}, {count} stappen op {day}"`.
- Items: each `role="button"` with own aria-label.

**Open.** Group + nested-child drag-drop semantics; whether children can be moved to/from a group via drag.

---

## 14. Dock (block palette)

**Purpose.** Source of new blocks. Catalogue-driven (D2).

**Anatomy.**
- Container card (glass) positioned absolute bottom-center of canvas frame.
- Search input (left, optional in PoC).
- Block-type item × N (one per `PathwayBlockType` returned by `GET /pathways/blocks`).
- Drag handle / drag hint on the right (parked for PoC).

**Layout.**
- Container height: 60px. Padding: `0 14px`. Centered horizontally with `left: 50%; transform: translateX(-50%); bottom: 20px;`.
- Items: `display: inline-flex; gap: 8px;`.
- Item: 44×44 with type icon on top + label below (label 10px), or 36×36 icon-only with tooltip (PoC default: icon-only with tooltip).

**Visual.**
- Container: glass — `background: rgba(255,255,255,0.7); backdrop-filter: blur(12px) saturate(160%); border: 1px solid var(--hairline); border-radius: var(--r-lg); box-shadow: 0 8px 24px rgba(11,26,23,0.12), 0 1px 2px rgba(11,26,23,0.06);`.
- Item: `border-radius: var(--r-sm); color: var(--muted-foreground);`.
- Item hover: `background: rgba(11,26,23,0.05); color: var(--foreground);`.
- Item drag-active: scales to 1.05× with `cursor: grabbing`.

**Behavior.**
- Drag an item → starts a drag operation carrying `{ type: PathwayBlockType.type }`. The canvas listens for drop and creates a new node at drop coordinates with lane resolved from `default_lane_kind_code`.
- Click an item (no drag) → adds a new node at the current viewport center.
- Tooltip: shows the type's label + a short description from the catalogue.

**Data.** `usePathwayBlocks()` → `PathwayBlockType[]`.

**States.** `default` / `dragging-item` / `empty-catalogue` (renders a "geen blok-types beschikbaar" message — should never happen in practice).

**Accessibility.**
- Container: `<div role="toolbar" aria-label="Blok-palet">`.
- Items: `<button aria-label="Voeg {label} toe">`.
- Drag-and-drop is mouse/trackpad-driven; click-to-add provides the keyboard path.

**Open.** Whether to ship search input in PoC.

---

## 15. Drawer (per-block config editor)

**Purpose.** Edit a selected block's `config` against its `config_schema`. Schema-driven via rjsf.

**Anatomy.**
- Slide-in panel from the right edge of the canvas frame.
- Header: `IcoTile + name + type-chip + lane-chip + close button`.
- Body: `<ConfigForm>` rendered via `@rjsf/core` (form fields per `config_schema`).
- Footer: `Verwijderen` (danger ghost) + `Klaar` (primary).

**Layout.**
- Width: 360px. Height: full canvas-frame height.
- Position: `position: absolute; top: 0; right: 0; bottom: 0;`. Slides in via `transform: translateX(0)`; default `translateX(100%)`.
- Padding: header 14px 16px; body 16px (with overflow-y: auto); footer 12px 16px.

**Visual.**
- Background: glass-strong — `background: rgba(255,255,255,0.92); backdrop-filter: blur(16px) saturate(160%); border-left: 1px solid var(--hairline); box-shadow: -8px 0 24px rgba(11,26,23,0.08);`.
- Header: same identity cluster pattern as a block (IcoTile + name).
- Form fields: shadcn-tinted inputs (text, select, number, checkbox, radio, date) — rjsf widgets adapted.
- Footer Verwijderen: `btn-danger` variant (transparent + danger color + thin danger border).
- Footer Klaar: `btn-primary` (gradient-active).

**Behavior.**
- Opens when selection changes to a block or group; closes on Esc, close button, or click on canvas blank area.
- Field edits flow through onChange → reducer patches `block.config` → marks dirty.
- Verwijderen → confirmation modal → `onDeleteBlock` → drawer closes.
- Klaar → just closes drawer (does not save; save lives in topbar).
- Validation errors surface inline from rjsf; submit-to-save happens via Save button, not Klaar.

**Data.** Reads `selection.blockId`, `block`, `blockType.config_schema`. Writes through `onPatchBlock(blockId, partial)`.

**States.** `closed` (default) / `open-block` / `open-group` / `open-edge` (edge selection opens a slim variant — parked).

**Accessibility.**
- `<aside role="complementary" aria-label="Blok bewerken">`.
- Focus trap while open; first focusable field auto-focused on open.
- Close button keyboard-reachable; Esc closes.

**Open.** Whether the drawer should auto-save on blur (likely yes once auto-save lands in Phase 3) or stay manual-save-only.

---

## 16. Status pill

**Purpose.** Tell the user "is your work saved right now?" (D28 + save state machine, §17).

**Anatomy.** Single horizontal pill with `[dot] {label}`.

**Layout.** `display: inline-flex; align-items: center; gap: 7px; height: 24px; padding: 0 11px 0 9px; border-radius: 999px;`.

**Visual (per state).**
- `clean` (Opgeslagen): `color: var(--success)`, `border: 1px solid color-mix(in srgb, success 26%, transparent)`, `background: color-mix(in srgb, success 8%, var(--card))`. Dot: static.
- `dirty` (Niet opgeslagen): `color: var(--warn)`, border 28%, bg 8%. Dot: animated 1.8s ease-out pulse (`box-shadow` ring expands and fades).
- `saving` (Opslaan…): `color: var(--muted-foreground)`, border 22%, bg 6%. Dot replaced with a 10×10 spinner (1px stroke, currentColor).
- `error` (Opslaan mislukt): `color: var(--danger)`, border 28%, bg 8%. Dot: static.
- Text: 11.5px / weight 500 / letter-spacing 0.005em.

**Behavior.** Passive indicator. Tooltip on hover: timestamp ("Laatst opgeslagen 13:24" / "Laatste poging mislukt om 13:26").

**Data.** Reads `saveState` from builder state.

**States.** Four (above). Transitions per §17.

**Accessibility.** `role="status" aria-live="polite"`. Label localized.

**Open.** Whether to include the timestamp inline in the pill when saving completes (compromise: tooltip-only to keep pill slim).

---

## 17. Save action / state machine

**Purpose.** Specify the lifecycle of a save operation and how every signal-bearing element (Save button, status pill, presence stack) reacts.

**States.**
1. `clean` — pathway baseline === current; nothing to save.
2. `dirty` — local edits diverge from baseline.
3. `saving` — `PUT /pathways/{id}` in flight.
4. `error` — last save attempt failed.

**Transitions.**
- `clean → dirty` on any edit (node add/move/delete, edge add/delete, drawer field change, title commit).
- `dirty → saving` on Save click or `⌘S`.
- `saving → clean` on 2xx response; baseline becomes the saved snapshot; history.past unchanged; history.future cleared (the save is a commit point, not an undo barrier — PoC).
- `saving → error` on 4xx/5xx response.
- `error → dirty` on any further edit.
- `error → saving` on retry.

**Side effects per transition.**
- `clean → dirty`: status pill switches to dirty visual; Save button enabled.
- `dirty → saving`: pill shows spinner + "Opslaan…"; Save button disabled.
- `saving → clean`: toast `pathway.save.success` (success variant); pill clean; Save disabled.
- `saving → error`: toast `pathway.save.error` (error variant, with response detail if available); pill error; Save enabled (so user can retry).

**Data.** `useSavePathway(id)` mutation. Optimistic: no (PoC sends the full definition and reads back the response).

**Behavior.**
- `⌘S` triggers save when state is `dirty` or `error`; no-op when `clean` or `saving`.
- Unsaved-changes guard: route-level `onBeforeNavigate` warns when state is `dirty` or `error` ("Je hebt niet-opgeslagen wijzigingen. Doorgaan?").
- Auto-save: explicitly out of scope in PoC (D8); revisit in Phase 3 prototyping.

**Accessibility.** Status pill `aria-live="polite"` announces transitions; toasts use the existing orchestrator toast a11y wiring.

**Open.** Whether to clear `history` on save or keep it (current: keep `past`, clear `future`).

---

## 18. Presence stack

**Purpose.** Show who else is on the same pathway right now (D28).

**Anatomy.** Inline row of overlapping circular avatars + optional `+N` overflow chip.

**Layout.** `display: inline-flex; align-items: center;`. Each avatar 26×26 round; subsequent avatars `margin-left: -8px` (8px overlap). Max 3 avatars + overflow chip.

**Visual.**
- Avatar: 26px, border `2px solid var(--card)`, ring `0 0 0 0.5px rgba(11,26,23,0.08)`, initials (2 chars, uppercase, 10.5px / weight 600 / white).
- Per-user color: `linear-gradient(135deg, {primary-of-user}, {dark-of-user})`. PoC uses a fixed hash-of-name palette.
- Overflow chip: same dimensions, `background: var(--card)`, `color: var(--muted-foreground)`, text `+{N}`.

**Behavior.**
- Tooltip on each avatar: full name + role + "actief sinds {ts}".
- Click: no-op in PoC.

**Data.** `presence` array from a presence backend (not in PoC scope). PoC renders 0–2 mock users so the visual exists.

**States.** Hidden when presence is empty.

**Accessibility.** `aria-label="Aanwezig: {n} mensen"` on the stack root; per-avatar `aria-label="{name}"`.

**Open.** Whole presence backend is out of scope; this component is forward-compatible.

---

## 19. Minimap + zoom panel

**Purpose.** One combined floating control for both spatial overview and zoom (D29). Replaces a separate zoom strip.

**Anatomy.**
- Container card.
- Minimap region (top): scaled-down representation of the canvas with one colored dot per block and a viewport rectangle.
- Zoom bar (bottom): `−` icon button · percent readout · `+` icon button · fit-to-screen icon button.

**Layout.**
- Container: 220px wide. Position: `absolute; right: 16px; bottom: 16px;`. `display: flex; flex-direction: column;`.
- Minimap: height 132px. Padding 8px.
- Zoom bar: height 36px. `display: flex; align-items: center; gap: 6px; padding: 0 8px;` separator border-top.

**Visual.**
- Container: glass — `background: rgba(255,255,255,0.78); backdrop-filter: blur(12px) saturate(160%); border: 1px solid var(--hairline); border-radius: var(--r-md); box-shadow: 0 8px 24px rgba(11,26,23,0.12), 0 1px 2px rgba(11,26,23,0.06);`.
- Minimap dots: 4×4 round, `background: var(--lane-accent)` per block.
- Viewport rectangle: `1.5px solid var(--primary); background: color-mix(in srgb, primary 8%, transparent); border-radius: 4px;`.
- Zoom buttons: 24×24 icon-buttons (ghost variant of §1 icon-btn).
- Percent readout: 11.5px / weight 600 / tabular-nums / foreground / center-aligned, min-width 44px.

**Behavior.**
- Click on minimap → recenter viewport so the clicked position is at the viewport rectangle center.
- Drag the viewport rectangle on the minimap → pans the canvas.
- `−` / `+` step zoom by 0.1× (clamped to 0.4 min, 2.0 max).
- Fit-to-screen → set zoom to fit all nodes plus 32px padding.

**Data.** Reads node positions + viewport from xyflow.

**States.** Single state. Pulse animation on the viewport rectangle when zoom changes (200ms ease-out).

**Accessibility.**
- Minimap: `<svg role="img" aria-label="Overzichtskaart">`.
- Buttons: standard `aria-label`s.

**Open.** Whether the minimap should also show edges (PoC: dots only).

---

## 20. Layout engine

**Purpose.** A small set of pure functions that derive geometry from the pathway model. Lives outside the component tree so it can be unit-tested independently.

**Surfaces.**
- `computePhaseRanges(pathway): Record<phaseId, { xStart: number; xEnd: number }>` — assigns x ranges to phase columns based on contained-block density (PoC: equal-width columns, 320px minimum).
- `computeLaneRanges(pathway): Record<laneId, { yStart: number; yEnd: number }>` — assigns y ranges based on lane order, 170px per lane.
- `computeBlockPosition(block, pathway): { x: number; y: number }` — places a block inside its phase column + lane row using stored `x` / `y` if set, otherwise an auto-layout fallback (Sugiyama or similar — parked; PoC respects stored positions).
- `computeEdgePath(edge, sourceBlock, targetBlock, sourcePort, targetPort): string` — produces the SVG `d` attribute. Orthogonal smoothstep with Q-corners radius 8–10px.
- `computeEdgeLabelPosition(path): { x: number; y: number }` — midpoint of longest straight segment.
- `deriveEntryBlock(pathway): blockId | null` — first block with no incoming edges; ties resolved by lowest `ord`.
- `deriveLaneAccent(laneKindCode): string` — maps `patient/caregiver/system/external` → CSS token name.

**Data.** Pure functions; no side effects; no React.

**States.** N/A.

**Open.** Whether to ship auto-layout in PoC or rely on user-positioned blocks throughout.

---

## 21. Interaction model

Cross-cutting behavior rules. If two sections seem to contradict, this takes precedence.

**Selection.**
- One thing selected at a time. Selection is a discriminated union: `{ kind: 'none' | 'block' | 'edge' | 'group', id?: string }`.
- Click on a node/edge/group selects it. Click on canvas empty space clears selection. `⇧` modifier on click reserved for future multi-select.
- Selection drives the drawer (§15).

**Dirty tracking.**
- Pathway is dirty iff `!deepEqual(builderState.pathway, builderState.baseline)`.
- Any field edit, node add/move/delete, edge add/delete, group edit, title commit marks dirty.
- Save action clears dirty (sets baseline := pathway).

**History (undo/redo).**
- Reducer pushes a snapshot of `pathway` to `history.past` before every mutating action; clears `history.future` on every new action.
- Undo: pop `past`, push current to `future`, restore popped state.
- Redo: pop `future`, push current to `past`, restore popped state.
- Cap at 50 entries each side; drop oldest beyond.
- Title commit, lane/phase rename, block move all participate in history.
- Save does NOT push a history entry.

**Drag.**
- Drag from dock (§14) → creates a new node at drop coords.
- Drag a node → repositions (snap to lane row by y).
- Drag from a port (§8) → starts an edge connection.
- Drag the minimap viewport rectangle (§19) → pans canvas.

**Keyboard.**
- `⌘Z` undo, `⌘⇧Z` redo, `⌘S` save (always preventDefault on the browser save dialog).
- `⌫` deletes the current selection (with confirmation modal).
- `Esc` clears selection or closes the drawer.
- `?` opens a shortcuts overlay (parked).

**Error surface.**
- All API errors → toast via the orchestrator's existing toast pipeline.
- Inline validation errors (rjsf in drawer) → inline under the field.
- Save error → status pill + toast; pill remains `error` until the user makes another edit (→ `dirty`) or retries.

---

## 22. Tokens reference

New tokens this surface requires. Existing tokens (`--primary`, `--card`, `--hairline`, `--shadow-*`, etc.) come from the orchestrator's existing tokens.css and are referenced only.

**Phase tints (4 phases, 3 tokens each).**
```
--phase-1:      <very pale mint background, ~3% saturation>
--phase-1-soft: <pale mint, ~10% saturation>
--phase-1-ink:  <dark mint, readable on white>

--phase-2:      <pale lilac>
--phase-2-soft: ...
--phase-2-ink:  ...

--phase-3:      <pale peach>
--phase-3-soft: ...
--phase-3-ink:  ...

--phase-4:      <pale sand>
--phase-4-soft: ...
--phase-4-ink:  ...
```

Exact hex values picked during the prototype pass — copy from `builder-canvas-prototype.html` `:root` declarations.

**Lane accents.**
```
--lane-patient:    #266b5e  (same as ZAS primary — caregiver-as-default-accent)
--lane-caregiver:  #4d6e87  (steel blue)
--lane-system:     #7b67c4  (lilac)
--lane-external:   #c5803c  (warm tan)
```
Each lane row sets `--lane-accent: var(--lane-{kind});` on its root so descendants inherit.

**Gradients.**
```
--gradient-aurora:  <body background; defined in tokens.css>
--gradient-active:  linear-gradient(135deg, #266b5e 0%, #08453c 100%)  (primary→pressed)
```

**Radii.** `--r-sm: 4px`, `--r-md: 6px`, `--r-lg: 12px` — already in tokens.css.

**Shadows.** `--shadow-xs`, `--shadow-sm`, `--shadow-md` — already in tokens.css. Custom drop-shadow on the dock/drawer/minimap uses ad-hoc values (see §14/§15/§19).

**Layout vars (builder-scope).**
```
--topbar-h: 64px;
--subbar-h: 44px;
--lane-height: 170px;
--canvas-grid-step: 24px;
--drawer-w: 360px;
--dock-h: 60px;
--minimap-w: 220px;
```

---

## 23. Out of scope (explicit non-requirements)

Listed here so reviewers don't ask "where's X?":

- **Multi-select** of nodes/edges.
- **Auto-layout** (Sugiyama, dagre, ELK). PoC respects stored x/y or falls back to "drop at viewport center."
- **Real-time presence** backend. The visual stack ships; data does not.
- **Versie-geschiedenis** drawer. Button exists; drawer is `// TODO`.
- **Auto-save**. D8 revisits in Phase 3.
- **Block-group persistence**. UX locked (§13); data-model migration parked.
- **Smart time tape** visualization. D13 defers post-PoC.
- **Inline-edit on block name without double-click**. PoC ships double-click only.
- **Edge-bundling** for parallel edges. D20 forbids duplicates so likely never needed.
- **Mobile / tablet** breakpoints. Desktop-first; min canvas width assumed 1024px.

---

## 24. Open questions (deferred to implementation)

Tracked here so the next planning session can pick them up:

1. Persist last-used zoom/scroll position per pathway in localStorage? (§0)
2. Meta line label when dirty: "Bewerkt" or "Laatst opgeslagen"? (§1)
3. Live-region announcement on phase jump? (§2)
4. xyflow MiniMap vs custom minimap? (§3 vs §19)
5. Phase-head chip as a click target for rename? (§4)
6. Allow drag-reordering lanes via chip? (§5)
7. Surface deferred-fields count as a block badge? (§6)
8. Inline-edit pencil-icon on block name hover? (§6)
9. Port labels (`ja`/`nee`) visible on hover for branch ports? (§8)
10. Color cross-phase and branch-positive edges identically or split them? (§9)
11. Pill background on edge labels for legibility? (§10)
12. Range support on DayChip? (§11)
13. Multiple entry-tab candidates — show all or deterministic pick? (§12)
14. Block-group / nested-child drag-drop semantics? (§13)
15. Search input in dock for PoC? (§14)
16. Auto-save in drawer on blur? (§15)
17. Inline timestamp on status pill or tooltip-only? (§16)
18. Clear history on save or preserve `past`? (§17)
19. Minimap shows edges or dots only? (§19)
20. Auto-layout in PoC? (§20)

---

## 25. Pathway lifecycle (concept ↔ published) and autosave

**Purpose.** Distinguish the two modes the same builder canvas operates in. A pathway is `concept` from creation until explicitly published; once published it becomes available for patient enrollment. The builder is **one component** — only signals and a few actions change between modes.

**Status values (mirrors backend `pathway.status`).**
- `concept` — draft mode. Default after dialog submit (§8 in overview-ui-spec.md). Not enrollable.
- `published` — live mode. Enrollable by intake. Edits still allowed but each save is auditable.
- `archived` — read-only. Builder opens but every action is disabled. Out of scope for PoC except as a status badge.

**Mode-driven differences.**

| Concern | Concept | Published |
|---|---|---|
| Save policy | Autosave (debounced 800ms after last edit) | Manual save (existing §17 state machine) |
| Status pill copy when clean | `Concept · automatisch opgeslagen` | `Opgeslagen` |
| Status pill copy when dirty | `Concept · wijzigingen opslaan…` (autosave in flight) or `Concept · niet opgeslagen` (during the 800ms debounce window) | `Niet opgeslagen` |
| Topbar primary action | `Publiceren` (gradient-active) — disabled when state is `dirty` or `saving` (must save before publishing) | `Opslaan` (existing §17 button) |
| Topbar secondary | `Opslaan` ghost button (force save without waiting for autosave debounce) | none |
| Unsaved-changes guard | None (autosave covers it) | Existing §17 guard |
| `⌘S` | Force-flush autosave debounce immediately | Triggers manual save |

**Autosave behavior (concept only).**
- Debounce: 800ms after the last edit settles. Cancel-and-restart on each new edit.
- While the debounce window is active: pill copy `Concept · niet opgeslagen`.
- On flush: pill copy `Concept · wijzigingen opslaan…`, button disabled, `PUT /pathways/{id}` in flight.
- On 2xx: pill returns to `Concept · automatisch opgeslagen` (clean).
- On 4xx/5xx: pill switches to `Concept · opslaan mislukt` (danger), toast `pathway.autosave.error` with a `Opnieuw proberen` action. Debounce restarts on next edit; manual retry via the Opslaan ghost button.
- No autosave during initial fetch or while `BuilderShellState !== ready-*`.

**Publish action.**
- Visible only when `status === concept`.
- Disabled when autosave is dirty or in-flight.
- Click → confirmation modal:
  - Title: `Zorgpad publiceren?`
  - Body: `Zodra je publiceert, kunnen patiënten ingeschreven worden op dit zorgpad. Je kunt nog steeds bewerken — wijzigingen blijven autosaven.`
  - Footer: `Annuleren` (ghost) + `Publiceren` (primary).
- On confirm: `POST /pathways/{id}/publish` → status flips to `published` → topbar primary changes to `Opslaan` → status pill changes to `Opgeslagen` → toast success.

**Data.** Reads `pathway.status`. Writes status only via `POST /pathways/{id}/publish` (not via the generic `PUT`).

**Behavior — guard against accidental autosave-loss-on-publish.**
- If user clicks `Publiceren` while a debounce window is open: force-flush autosave, await success, then open the confirmation modal. If autosave fails, abort the publish flow and surface the autosave error.

**Accessibility.**
- Status pill keeps its `role="status" aria-live="polite"` per §16.
- Publish confirmation modal: `<Dialog role="alertdialog">` (more aggressive than a regular dialog so screen readers treat the action as consequential).
- `aria-disabled` on the Publish button reflects the dirty/saving guard; pair with a tooltip explaining why it's blocked.

**Open.**
- Should published pathways also offer autosave? (Currently no — manual save preserves §17 audit pattern. Revisit after PoC.)
- Should publish be reversible (back to concept)? (Likely yes, via overflow → parked.)
- Debounce duration: 800ms feels right; user-test before locking.

---

## 26. Empty canvas — first-block CTA

**Purpose.** When `BuilderShellState === ready-empty`, the canvas is structurally complete (phase columns + lane rows render from the preset) but contains zero blocks. The CTA replaces the absent block graph and teaches the dock → drop interaction.

**Anatomy.**
- A single dashed placeholder card positioned inside the earliest lane of the earliest phase.
- Above the card: an arrow + label `Sleep een blok hier vanuit het palet hieronder` (12.5px, muted-foreground).
- Optional: a centered helper toast `Tip: begin met een Afspraak-blok om de patiëntreis te starten.` — parked.

**Layout.**
- Placeholder card: same dimensions as a real block (220×68).
- Placeholder position: phase 1 column center horizontally, lane 1 row center vertically.
- Arrow + label cluster: positioned directly above the placeholder, centered horizontally. Arrow points down; label sits above arrow.
- `display: flex; flex-direction: column; align-items: center; gap: 6px;` for the cluster.

**Visual.**
- Placeholder card: `border: 2px dashed color-mix(in srgb, var(--lane-accent) 40%, var(--border-strong)); background: color-mix(in srgb, var(--lane-accent) 4%, transparent); border-radius: var(--r-md);`. No shadow.
- Inside the card, centered: lucide `plus` icon 20px in `var(--lane-accent)` over a tiny label `Eerste blok` (10.5px / weight 600 / `letter-spacing: 0.06em` / uppercase / muted-foreground).
- Arrow: lucide `arrow-down` 18px in `var(--muted-foreground)` with a gentle 1.6s ease-in-out vertical bounce (`@keyframes ctaBounce { 0%,100% { transform: translateY(0) } 50% { transform: translateY(4px) } }`).
- Label above arrow: as anatomy.

**Behavior.**
- Click the placeholder → opens the dock palette tooltip with focus on the first item.
- Hover the placeholder while dragging from the dock → entire placeholder turns `border-color: var(--lane-accent); background: color-mix(in srgb, var(--lane-accent) 10%, transparent);` to confirm the drop target.
- Drop a dock item onto the placeholder → places that block at the placeholder's position with `lane_id` = placeholder's lane and `phase_id` = placeholder's phase, ignoring the type's `default_lane_kind_code`.
- Drop a dock item anywhere else → falls back to default lane resolution (§3 of §14 dock).
- Once any block exists, transition to `ready-populated` and remove the CTA.

**Data.**
- Earliest phase: lowest `ord`. Earliest lane within that phase: lowest `ord` across lanes scoped to that phase (PoC: lanes are pathway-scoped, not phase-scoped, so it's just the lowest-ord lane).
- If pathway has zero phases or zero lanes (created with `Leeg canvas` preset), CTA renders centered in the canvas frame instead, with copy `Voeg eerst een fase toe via "+ Fase" in de balk hierboven om te beginnen.`. Replace the arrow target with a pointer toward the subbar.

**States.**
- `inside-scaffold` (has phases + lanes) — placeholder + arrow as above.
- `no-scaffold` (zero phases or lanes) — centered prompt pointing at the subbar `+ Fase` button.

**Accessibility.**
- Placeholder: `<button aria-label="Voeg het eerste blok toe. Sleep vanuit het palet of klik om te beginnen.">`.
- The bounce animation respects `prefers-reduced-motion` (replace with a static arrow + 0.4 opacity pulse).

**Open.**
- Whether to render the placeholder for every empty lane or just the first one (PoC: just the first).
- Whether the helper toast appears on first visit only (localStorage flag) or every time the canvas is empty.

## 27. Version-switch chip (topbar)

Compact dropdown sitting inside the topbar action cluster, immediately left of `Opslaan`. Replaces the prior standalone `Geschiedenis` ghost button in the topbar — the full drawer is now reached via this menu's footer link. See `history-spec.md` §5a for full anatomy / behavior; this section captures the topbar integration contract.

**Anatomy.**
- Trigger: `<button class="vs-trigger">` with three children — colored status dot · `v.{n}` (weight 600, tabular-nums) · chevron-down. Height 24px, 7px radius, 1px hairline border, transparent background.
- Menu (popover): 240px min-width, glass-strong surface, two grouped sections (`Werkversie` / `Gepubliceerd`), per-row trailing checkmark when current, footer link `Alle versies in geschiedenis`.

**Layout.** Inserted into the topbar's right action group between the existing icon cluster (undo/redo) and the primary `Opslaan` button. Popover anchored `top: 30px; right: 0;` relative to trigger, z-index 40.

**Visual.**
- Dot colors: concept → warn `#d97706`, latest published → success `#16a34a`, historical → info `#3a7d8d`.
- Trigger text stays neutral foreground regardless of state (the dot carries the signal — keeps the topbar visually calm).
- Active menu row: foreground tinted `#08453c` + bold + visible check.
- Group eyebrows: 10px / weight 700 / 0.08em letter-spacing / muted.

**Behavior.**
- Click trigger toggles popover; click outside closes it.
- Selecting a Werkversie row → navigates to bare `/pathways/{id}`.
- Selecting a Gepubliceerd row → bare URL when that version is what bare currently resolves to, else `/pathways/{id}/v/{versionId}`.
- Selecting a historical row → `/pathways/{id}/v/{versionId}`.
- Footer link opens Geschiedenis drawer (§15 mutex with block-config drawer).
- Trigger stays interactive while shell is read-only (escape route — explicitly excluded from the `.is-readonly` dim list).

**Data.** Trigger reads resolved version from the shell loader; menu reads `useVersionList(pathwayId)` (deferred to first open, then session-cached).

**Accessibility.** `aria-haspopup="menu"`, `aria-expanded`, `aria-label="Wissel versie, huidig v.{n} {status}"`. Menu uses `role="menu"` + `role="menuitem"`; current row carries `aria-current="true"`. Keyboard: ↑↓ cycle, Enter activates, Esc closes, Tab from trigger lands on first item.

## 28. Read-only banner

Thin tinted strip below the topbar, above the phase subbar. Visible only when the shell is read-only. See `history-spec.md` §5b for full content + variant rules; this section captures the layout slot + integration with the rest of the chrome.

**Anatomy.** 36px-tall strip, full-width. Three regions left-to-right: info-circle icon (14px) · body copy (`flex: 1`) · action cluster (optional `Terug naar huidige` ghost + primary CTA).

**Layout.** Stacks between `<header class="topbar">` and `<div class="subbar">`. Subbar remains visible so the user can navigate the canvas read-only (the banner does not replace it).

**Visual.**
- Published-fallback variant: gradient `color-mix(success 8%, white) → success 3%`, bottom-border `success 22%`, text `#166534`.
- Historical variant: gradient `color-mix(info 10%, white) → info 4%`, bottom-border `info 22%`, text `#2c6473`.
- Variant chosen from the resolved `version.status`, NOT from the URL shape — same rule as ver-switch dot and crumb-version marker.

**Behavior.**
- Mount when shell enters read-only; unmount when concept editable.
- `Terug naar huidige` → navigate to bare `/pathways/{id}`.
- `Herstel als nieuw concept` (historical) → restore flow with confirmation modal (`history-spec.md` §2).
- `Maak nieuwe versie` (published-fallback) → fork-on-edit flow with confirmation modal (`history-spec.md` §4) without an intercepted mutation.

**Interaction with editing chrome.** Shell carries `.main.is-readonly` class while banner is visible. That class dims/disables: palette dock, save button, undo/redo, status pill, and presence stack. Ver-switch chip and crumbs row stay live. Block cards become pointer-events: none; clicking one falls through to the canvas (no per-block modal). The blocked-mutation modal from `history-spec.md` §4 still fires for keyboard-initiated mutations.

**Accessibility.** `role="status"` so navigation announcements include the mode change. CTA is a labeled `<button>`, not an icon. Reduced motion: instant show, no slide-in.

## 29. Crumb version marker

Passive inline marker in the topbar crumbs row that always shows current version identity. See `history-spec.md` §5c for full anatomy; this section captures placement + AT contract relative to the rest of the topbar.

**Anatomy.** `<span class="crumb-version">` placed in the crumbs row after the breadcrumb leaf (`Rugrevalidatie`). Three inline children: 6px colored dot · `v.{n}` (weight 600, tabular-nums) · state word (lowercase, opacity 0.75).

**Layout.** Inline-flex with margin-left 6px. Inherits crumbs row typography (~11.5px). No background, no border, no padding — purely a typographic addition.

**Visual.** Foreground color is the variant tint (concept warn ink, published success ink, historical info ink); the dot is `currentColor`.

**Behavior.** Display-only. Not interactive. The ver-switch chip (§27) is the interactive surface.

**Accessibility.** `aria-hidden="true"` — the ver-switch trigger's `aria-label` already announces the same info. Avoids duplicate AT announcements.
