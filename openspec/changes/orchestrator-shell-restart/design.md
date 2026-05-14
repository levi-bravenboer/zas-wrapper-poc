# Design — Orchestrator shell restart

This document captures the locked design decisions for the orchestrator's visual + navigational base. Each decision links back to one or more HTML mockups in `mockups/`.

## Package-first stance

This change is implemented on top of existing shadcn/ui primitives wherever one fits. The restrained baseline grows by 5 primitives (`Sidebar`, `Sheet`, `Breadcrumb`, `Alert`, `Command`), all installed via the shadcn CLI. Only `cmdk` is a new runtime dep (transitive of `Command`). No bespoke replacements for primitives that exist in the baseline.

| Concern | Primitive | Customisation |
|---|---|---|
| Collapsible sidebar | shadcn `Sidebar` block | Glass class on root, override shortcut to `⌘\`, override persistence to `localStorage` key |
| Mobile drawer | shadcn `Sheet` (via `Sidebar`) | None — defaults fit |
| Tooltip on collapsed nav | shadcn `Tooltip` (via `SidebarMenuButton.tooltip`) | None |
| Command palette | shadcn `Command` | Wrap `<CommandDialog>` with route list |
| Breadcrumb | shadcn `Breadcrumb` | Driven by `useMatches()` |
| Tabs | shadcn `Tabs` + TanStack `<Link>` `asChild` | Active state from router, not local state |
| Skeletons | shadcn `Skeleton` | Compose into row/card/detail variants |
| Inline + page errors | shadcn `Alert` | `destructive` variant + retry slot |
| Toast | Sonner | `toastError({ message, retry? })` helper |
| Dropdown (user menu) | shadcn `DropdownMenu` | None |

## Decision log

| # | Decision | Mockup |
|---|---|---|
| D1 | Sidebar only, no top bar | `01-shell-skeleton.html` (A) |
| D2 | Bold glass aesthetic, light theme only | `03-glass-variants.html` (G), `05-bold-glass-treatments.html` |
| D3 | Flush full-height sidebar, square edges | `05-bold-glass-treatments.html` (I) |
| D4 | Collapsible sidebar 240px ↔ 64px | `04-bold-glass-collapse.html` |
| D5 | Lucide icons throughout | `04-bold-glass-collapse.html` |
| D6 | `⌘K` command palette as primary search | (no mockup — pattern lock) |
| D7 | Teal-gradient active item pill | `04-bold-glass-collapse.html` |
| D8 | Branding: mark + name + version | `04-bold-glass-collapse.html` |
| D9 | User block: glass card with dropdown menu | `04-bold-glass-collapse.html` |
| D10 | Login: minimal centered, no card chrome | `06-login-screen.html` (O) |
| D11 | Hybrid `PageHeader` component, auto-crumb | `09-header-matrix-hybrid.html` (col 4) |
| D12 | State surfaces: skeleton / empty / inline error / toast / refetch overlay | `10-states.html` |

## D2 — Bold glass tokens

```css
/* additions to src/styles/tokens.css */
--glass-panel: rgba(255, 255, 255, 0.55);
--glass-panel-strong: rgba(255, 255, 255, 0.7);
--glass-border: rgba(255, 255, 255, 0.7);
--glass-blur: 20px;
--glass-saturate: 180%;

--shadow-glass:
  0 12px 32px rgba(38, 107, 94, 0.08),    /* derived from #266b5e — primary glow */
  0 1px 0 rgba(255, 255, 255, 0.6) inset;

--gradient-aurora:
  radial-gradient(ellipse 60% 50% at 0% 0%,    rgba(38, 107, 94, 0.20) 0%, transparent 55%),
  radial-gradient(ellipse 50% 40% at 100% 100%, rgba(207, 237, 232, 0.55) 0%, transparent 55%),
  linear-gradient(180deg, #fafaf9 0%, #f1efed 100%);

--gradient-active:
  linear-gradient(135deg,
    oklch(0.48 0.06 175) 0%,    /* #266b5e — primary */
    oklch(0.32 0.05 175) 100%   /* #08453c — pressed */
  );
```

Aurora paints on `body::before` (`position: fixed`, `inset: 0`, `z-index: -1`, `pointer-events: none`) so every route shares the same background without component coupling. The shell + panel components opt in to `backdrop-filter` via a `.glass` class.

### Why bold glass

- Caregiver feedback: "feels softer, less like SAP". The glass treatment reads as modern without looking gamified.
- Differentiates from HiX (flat blue corporate) and Luscii (white card stack) — adjacent products the user sees daily.
- Teal aurora establishes ZAS brand presence without colouring every surface teal.

### Performance budget

`backdrop-filter` is applied on at most two surfaces per route (the sidebar + active panel). The body aurora is a static radial gradient — zero filter cost. We do not stack blur layers; cards within a blurred panel render flat.

## D3 — Flush full-height sidebar

Sidebar is `position: fixed; inset: 0 auto 0 0; width: 240px;`. Square edges, no margin, no border-radius. Square edges read more "tool" than "toy" and avoid the floating-panel cliché. Tradeoff considered + rejected: a floating rounded sidebar (variant K) felt less anchored on tall content.

## D4 — Collapse behavior

| Trigger | Effect |
|---|---|
| `⌘\` (Mac) / `Ctrl+\` (other) | Toggle collapsed state |
| Click rail icon at sidebar footer | Toggle collapsed state |
| Viewport < 1024px | Force collapsed |
| Viewport < 640px | Force drawer mode (overlay, not push) |

Collapsed state persists in `localStorage["orchestrator.sidebar.collapsed"]` as `"true" | "false"`. Drawer mode does not persist.

Width animates with `transition: width 200ms cubic-bezier(0.4, 0, 0.2, 1)`. Inner content fades via `opacity` so text doesn't reflow mid-animation.

## D6 — Command palette

`⌘K` opens a centered modal palette. Inputs:
- Routes (currently: Dashboard only).
- Patients (resolved from `usePatients()` query in expanded scope; placeholder copy in PoC).
- Recent actions (deferred to `[mvp]`).

Component lives at `src/components/layout/CommandPalette.tsx`. Built on the shadcn `Command` primitive (`cmdk` under the hood). Already in the restrained primitive baseline once the `Command` block is added — flag this as a baseline extension in `tasks.md`.

## D11 — Hybrid `PageHeader`

One component, conditional slots:

```tsx
<PageHeader
  title="De Smet, J."
  sub="Rugrevalidatie · stap 3 / 7 · sinds 12 apr"
  eyebrow={<Badge>Rugrevalidatie · stap 3</Badge>}
  actions={
    <>
      <Button variant="ghost">Bewerken</Button>
      <Button variant="primary">Nieuwe afspraak</Button>
    </>
  }
  tabs={[
    { to: '.', label: 'Zorgpad' },
    { to: 'taken', label: 'Taken' },
    { to: 'documenten', label: 'Documenten' },
  ]}
/>
```

`title` is the only required prop. `eyebrow`, `actions`, `tabs`, `sub` are optional.

Breadcrumb is auto-rendered from `useMatches()` when `matches.length > 2` (root + auth wrap + content). It is not a prop. Each match contributes its label via the route's `staticData.breadcrumb` (string) or a `loader`-returned `crumb`. If neither is present, the segment is skipped — the breadcrumb never falls back to URL segments verbatim (those are Dutch but technical: `_auth/dashboard` reads poorly).

Tabs use TanStack Router's `<Link>` with `activeProps={{ 'data-active': true }}`. Indicator is a `::after` underline on the active link.

## D12 — State surfaces

| State | Component | When |
|---|---|---|
| Skeleton | `<RowSkeleton>`, `<CardSkeleton>`, `<DetailSkeleton>` | `query.isPending && !query.data` |
| Empty | `<EmptyState glyph title body action>` | `data.length === 0` |
| Inline error | `<InlineAlert>` | partial fetch fail where the rest of the page still renders |
| Full-page error | `<ErrorState>` | route-level fetch fail with no cached fallback |
| Toast | Sonner `toast.error()` | mutation failure; auto-dismiss 5s; includes retry action |
| Refetch overlay | `<RefetchOverlay>` veil + spinner | `query.isFetching && query.data` (stale data still visible) |

Skeletons match the shape of real content (rows for lists, cards for dashboards, sections for detail). Shimmer = 1.4s ease-in-out. Never replace stale data with a skeleton on refetch — only on initial load.

Empty states are calm: no exclamation marks, no celebratory copy. "Alles afgerond" beats "🎉 You're all caught up!".

Errors surface FHIR `OperationOutcome.issue[0].diagnostics` in dev only. Production shows Dutch user-facing copy + HTTP status code as a small mono-font hint.

## Rejected alternatives

- **Top bar + sidebar (`01-shell-skeleton.html` B)** — adds vertical chrome without adding affordances we need. Search lives in `⌘K` palette, user menu lives in sidebar bottom.
- **Dark glass aesthetic (`02-sidebar-modern.html` D)** — dark theme is gated by its own future change per the `design-system` light-only rule. Mixing dark sidebar + light content would also pin us to two themes simultaneously.
- **Floating rounded sidebar (`05-bold-glass-treatments.html` K)** — felt less anchored, breaks the aurora alignment at large viewports.
- **Per-page header components** — three variants (simple / eyebrow+tabs / breadcrumb+tabs) proliferate; the hybrid component covers all three with optional slots and a single API to learn.
- **Card-framed login (`06-login-screen.html` M)** — visually busy against the aurora; obscures brand presence. The minimal pattern (O) lets the aurora carry the page.

## Open questions deferred

- **Whether the user dropdown lives in the sidebar bottom or in a separate top-right slot when section count grows past 10.** Defer until we have >5 nav items, since the dropdown sits comfortably in the sidebar today.
- **Whether tabs in `PageHeader` should support overflow into a "…" menu on narrow viewports.** Defer until we have a route with >4 tabs; today we have none.
- **Drawer animation direction on mobile.** Defer until a mobile design pass — PoC demo is desktop-only.
