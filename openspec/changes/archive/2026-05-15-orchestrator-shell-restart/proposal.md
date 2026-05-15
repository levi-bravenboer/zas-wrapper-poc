**Tier**: [poc]

## Why

The existing `app-shell` + `routing` + `design-system` specs assume five sibling section routes (`/dashboard`, `/taken`, `/zorgpaden`, `/patienten`, `/instellingen`) and ship a generic shadcn-flat aesthetic. PoC reality is narrower and the visual bar is higher:

- **Scope shrink** — June demo only requires Dashboard as the authed entry. The other four routes are placeholders that distract from the work that actually matters (composer + caregiver views, both `[poc]` features `F2`/`F3`/`F4`/`F5`).
- **Code / spec drift** — `routing` spec mandates Dutch route paths; current `apps/orchestrator/src/components/layout/navItems.ts` ships English routes (`/pathways`, `/patients`, `/settings`). One of them is wrong.
- **Visual identity** — A care-pathway orchestrator competing for caregiver attention against HiX needs a recognisable, calm-but-modern surface. The current shell renders correctly but reads like an admin panel. The locked aesthetic ("bold glass" with aurora gradients on ZAS teal) gives the demo the visual signature it currently lacks.
- **Component reuse** — Locking the shell's primitives (PageHeader, state surfaces, sidebar, login) up front means every later feature (`F2`..`F5`) drops into a known frame instead of reinventing chrome.

This change restarts the frontend's visual + navigational base while keeping the FHIR-readiness layer from `orchestrator-fhir-ready` intact.

## What Changes

- **Reduce authed section routes from 5 → 1.** Keep only the home overview at `/` (rendered by `_auth/index.tsx`, labelled "Overzicht"). Drop `/taken`, `/zorgpaden`, `/patienten`, `/instellingen` from scope. They reappear as separate `[poc]` changes when their feature work begins.
- **Reconcile route language.** The home overview lives at `/` and reads "Overzicht" in the UI. The dropped routes resolve the drift by simply not existing yet — when reintroduced, they ship under their Dutch path per the `routing` rule.
- **Lock visual language as "bold glass".** Translucent sidebar panel with `backdrop-filter: blur(20px) saturate(180%)`, aurora radial gradients on the page background, ZAS teal gradient (`#266b5e` → `#08453c`) for active states. Bold but glass-leaning — never dark mode (POC stays light-theme-only per `design-system`).
- **Lock shell skeleton as sidebar-only, flush full-height.** No top bar. Sidebar spans full viewport height, square edges, no margin. 240px expanded ↔ 64px collapsed.
- **Lock sidebar interaction.** Collapse toggle keyboard shortcut `⌘\` (Mac) / `Ctrl+\` (other). State persists in `localStorage` key `orchestrator.sidebar.collapsed`. Auto-collapses below tablet breakpoint. Mobile renders as a drawer.
- **Lock primary search affordance.** Global `⌘K` opens a command palette. Search input lives in the sidebar header in expanded mode; collapsed mode shows the icon only.
- **Lock active-item treatment.** Teal gradient pill, white text, soft inner glow. Inactive items: muted foreground, hover lifts background.
- **Lock branding block.** Sidebar header shows a gradient mark + product name "ZAS Orchestrator" + version pill. Collapsed mode hides name + version, keeps mark.
- **Lock user block.** Bottom of sidebar — glass card with avatar + name + role. Click opens a dropdown with profile, settings, sign-out.
- **Lock login screen as pattern "O" (minimal centered).** No card chrome. Aurora background, ZAS mark, centered email + password fields, primary teal CTA. No "remember me", no "forgot password" link in POC (out of scope per `F1`).
- **Lock page header as hybrid `PageHeader` component.** One component, optional slots: `eyebrow`, `title` (required), `sub`, `actions`, `tabs`. Breadcrumb auto-renders from `useMatches()` when route depth > 1. No separate header components per page.
- **Lock state surfaces.** Skeletons (shape-of-content shimmer), empty (glyph + headline + guidance + optional CTA, calm tone), inline errors (alert strip), full-page error (`502` style with retry), mutation toast (Sonner, 5s, retry action), refetch overlay (veil + spinner on stale data — never replace with skeleton).
- **Mockup artifacts** — every locked decision is backed by an HTML mockup under `changes/orchestrator-shell-restart/mockups/`. The mockups are part of the change record and not implementation artifacts.

## Capabilities

### Modified Capabilities

- **`app-shell`** — adds the locked shell decisions (sidebar-only, collapsible, command palette trigger) as concrete requirements on top of the existing folder-layout + provider-tree rules. The shell goes from "abstract structure" to "named visual surface with concrete behavior".
- **`design-system`** — adds the bold-glass treatment tokens (translucent panel, aurora gradient, teal active-state gradient) on top of the existing ZAS palette + Geist typography rules. Adds the locked `PageHeader` and state-surface patterns to the restrained primitive set.
- **`routing`** — narrows the "five sibling section routes" requirement to "one section route: `/` (home overview at `_auth/index.tsx`)". The rule that section routes stay lowercase Dutch is preserved for when more routes are added.

### New Capabilities

None. Everything fits inside the three existing capabilities above.

## Impact

- **Code (additive)**:
  - `src/components/layout/Shell.tsx` — bold-glass sidebar shell, replacing current `MenuLayout` + `Sidebar`.
  - `src/components/layout/PageHeader.tsx` — hybrid header with auto-crumb via `useMatches()`.
  - `src/components/states/` — `Skeleton*`, `EmptyState`, `ErrorState`, `RefetchOverlay`.
  - `src/components/layout/CommandPalette.tsx` — `⌘K` palette wired to `cmdk` (or shadcn `Command`).
  - `src/styles/tokens.css` — new tokens: `--glass-panel`, `--glass-border`, `--gradient-aurora`, `--gradient-active`, `--shadow-glass`.
  - `src/styles/globals.css` — aurora `body::before` layer + `backdrop-filter` opt-in for shell.
  - `src/routes/login.tsx` — minimal centered layout, no card.
- **Code (removed)**:
  - `src/routes/_auth/taken.tsx`, `zorgpaden.tsx`, `patienten.tsx`, `instellingen.tsx` — only if these placeholder files were committed; verify before deleting.
  - Old `MenuLayout` + `Sidebar` if their interface no longer matches.
  - `navItems.ts` shrinks to a single entry; English paths removed.
- **Dependencies added** (`apps/orchestrator/package.json`):
  - `cmdk` — command palette primitive (or use shadcn `Command` if already in baseline).
  - No other runtime additions.
- **FHIR readiness** — untouched. `lib/fhir/`, query-key conventions, error-code → toast pipeline all remain. The shell consumes those layers; it doesn't replace them.
- **Localization** — all new strings land in `locales/nl/shell.json`. No raw JSX strings.
- **Out of scope for this change** (separate later proposals):
  - The reintroduction of `/taken`, `/zorgpaden`, `/patienten`, `/instellingen`. Each lands with its feature.
  - Dark mode — still gated by its own change per `design-system` rule.
  - Designer (composer) — separate `[poc]` work under `F3`.
  - Patient detail view — separate `[poc]` work under `F5`.
  - **Login auth wiring** — this change builds only the login screen and a placeholder submit handler that navigates to `/` unconditionally. Frontend validation, credential exchange against the hard-coded user table, cookie-session round-trip, and `?redirect=` honouring all land in `BL-035` (F1 user + auth domain) as its own `[poc]` change. Roadmap tier: `[poc]`.
