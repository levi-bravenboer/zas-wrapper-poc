# Tasks — orchestrator-shell-restart

> **Package-first rule**: reach for shadcn primitives and existing deps before custom builds. Wrap, don't rebuild. Every component below maps to its underlying primitive when one exists.

## 0. Extend restrained-primitive baseline

The `design-system` spec gates `src/components/ui/` to a closed list. Extend the baseline once here so later steps consume primitives without re-gating:

- [x] 0.1 Add `Sidebar` block via `pnpm dlx shadcn@latest add sidebar` — pulls `Sheet`, `Skeleton` reuse, keyboard shortcut helper.
- [x] 0.2 Add `Breadcrumb` via shadcn CLI.
- [x] 0.3 Add `Alert` via shadcn CLI.
- [x] 0.4 Add `Command` via shadcn CLI — pulls `cmdk` dep.
- [x] 0.5 Update `design-system` primitive baseline list in this change's spec delta to include the five new primitives.
- [x] 0.6 Confirm no other new runtime deps land (`pnpm install --frozen-lockfile` after, audit `package.json` diff). Final adds: `cmdk` + `radix-ui` umbrella.
- [x] 0.7 Rename existing `ui/*` to lowercase + add `components.json` so shadcn CLI resolves aliases.
- [x] 0.8 Extend `button` with `icon` size + extend `dialog` with `showCloseButton` prop (required by `command` + `sidebar`).
- [x] 0.9 Add eslint override for `src/components/ui/**` + `src/hooks/use-mobile.ts` (vendor code — relax project-stricter rules).

## 1. Tokens + global aesthetic

- [ ] 1.1 Add glass + aurora + active-gradient tokens to `src/styles/tokens.css` (see `design.md` D2).
- [ ] 1.2 Add aurora `body::before` layer in `src/styles/globals.css`.
- [ ] 1.3 Add `.glass` utility class (opt-in `backdrop-filter`) in `src/styles/globals.css`.
- [ ] 1.4 Verify no `dark:` Tailwind variants land alongside these tokens (light-only rule still holds).

## 2. Routing narrowing

- [ ] 2.1 Delete `src/routes/_auth/taken.tsx`, `zorgpaden.tsx`, `patienten.tsx`, `instellingen.tsx` if present.
- [ ] 2.2 Keep `src/routes/_auth/dashboard.tsx` as the single section route.
- [ ] 2.3 Confirm `_auth/index.tsx` still redirects `/` → `/dashboard`.
- [ ] 2.4 Run `moon run orchestrator:typecheck` — fix any stale imports referring to removed routes.

## 3. Sidebar shell (built on shadcn `Sidebar` block)

The shadcn `Sidebar` block already ships: collapsible rail (`icon` variant ≈ our 64px), mobile drawer via `Sheet`, keyboard shortcut (`SidebarTrigger`), state provider, tooltip-on-collapsed, persistence cookie. Override only what conflicts with our locks.

- [ ] 3.1 Create `src/components/layout/Shell.tsx` wrapping `<SidebarProvider>` + `<AppSidebar>` + `<SidebarInset>` (with `PageHeader` slot + content).
- [ ] 3.2 Configure shadcn `Sidebar` props: `collapsible="icon"`, `variant="sidebar"` (flush), `side="left"`. Square edges via `className` override (drop default `rounded-*`).
- [ ] 3.3 Apply `.glass` class to the sidebar root; override default bg to `transparent` so glass token wins.
- [ ] 3.4 Override default cookie persistence to `localStorage["orchestrator.sidebar.collapsed"]` — pass `defaultOpen` + custom `onOpenChange` to `SidebarProvider`.
- [ ] 3.5 Override default `⌘B` shortcut to `⌘\` / `Ctrl+\` — replace `SIDEBAR_KEYBOARD_SHORTCUT` constant (fork the block locally if shadcn pins it). If overriding cleanly is not possible, add a custom `useHotkeys` and disable the built-in.
- [ ] 3.6 Brand block in `<SidebarHeader>`: gradient mark + "ZAS Orchestrator" + version pill (read `package.json` `version` via Vite `define`).
- [ ] 3.7 Nav items in `<SidebarMenu>` using shadcn `SidebarMenuItem` + `SidebarMenuButton`. Apply active-gradient via `className` on `isActive` state. Lucide icon as child.
- [ ] 3.8 User block in `<SidebarFooter>`: shadcn `DropdownMenu` triggered by a `SidebarMenuButton` rendering avatar + name + role. Items: profile, settings stub, sign-out (wires to existing `useLogout`).
- [ ] 3.9 Confirm tooltip-on-collapsed works out of the box (shadcn `SidebarMenuButton` accepts a `tooltip` prop) — no extra wiring.
- [ ] 3.10 Shrink `src/components/layout/navItems.ts` to one item (Dashboard, `/dashboard`).

## 4. Command palette (built on shadcn `Command`)

- [ ] 4.1 Create `src/components/layout/CommandPalette.tsx` using `<CommandDialog>` from shadcn `Command` primitive (already added in task 0.4).
- [ ] 4.2 Global `⌘K` / `Ctrl+K` hotkey toggles open state.
- [ ] 4.3 Wire route entries (Dashboard only for PoC) via `<CommandItem>` + TanStack Router `useNavigate`.
- [ ] 4.4 Mount `<CommandPalette />` once inside `Shell.tsx`.

## 5. Page header (built on shadcn `Breadcrumb` + `Tabs`)

- [ ] 5.1 Create `src/components/layout/PageHeader.tsx` with slots: `eyebrow`, `title` (required), `sub`, `actions`, `tabs`.
- [ ] 5.2 Auto-crumb via `useMatches()` when depth > 2; render with shadcn `Breadcrumb` + `BreadcrumbItem` + `BreadcrumbLink`. Crumb labels from `staticData.breadcrumb` or loader `crumb`.
- [ ] 5.3 Tabs render with shadcn `Tabs` shell + custom `<TabsTrigger asChild>` wrapping TanStack Router `<Link>`. Active state driven by router (not local state).
- [ ] 5.4 Mount `<PageHeader>` inside `Dashboard` route as a smoke test (title + sub only).

## 6. State surfaces (built on shadcn `Skeleton` + `Alert`, Sonner)

- [ ] 6.1 `src/components/states/Skeleton.tsx` — compose shadcn `Skeleton` primitives into `<RowSkeleton>`, `<CardSkeleton>`, `<DetailSkeleton>`. No new shimmer impl — shadcn's `animate-pulse` is the baseline; if a shimmer effect is required, layer it via a Tailwind utility on top of `Skeleton`.
- [ ] 6.2 `src/components/states/EmptyState.tsx` — props `{ icon, title, body, action? }`. Custom layout, no package fits.
- [ ] 6.3 `src/components/states/InlineAlert.tsx` — wrap shadcn `Alert` with `variant="destructive"` + retry slot.
- [ ] 6.4 `src/components/states/ErrorState.tsx` — full-page composition using shadcn `Alert` body + lucide icon + primary `Button`.
- [ ] 6.5 `src/components/states/RefetchOverlay.tsx` — custom small wrapper (veil div + lucide `Loader2` spinner). No package needed.
- [ ] 6.6 Sonner `toast.error()` helper in `src/lib/notifications/toast.ts` — wraps existing Sonner with retry-action shorthand. Connect to FHIR error-code → i18n pipeline.

## 7. Login screen

- [ ] 7.1 Rewrite `src/routes/login.tsx` with pattern O — minimal centered, no card, aurora background.
- [ ] 7.2 Use shadcn `Input` + primary `Button`. No "remember me", no "forgot password".
- [ ] 7.3 Confirm redirect-after-login still honors the `?redirect=...` search param from the auth guard.

## 8. Localization

- [ ] 8.1 Add `locales/nl/shell.json` with keys for: sidebar labels, brand subtitle, command palette placeholder, user menu actions, page header crumb fallback.
- [ ] 8.2 Add `locales/nl/states.json` (or extend existing) with empty/error copy: `nog geen patiënten`, `kon dossier niet laden`, etc.
- [ ] 8.3 Run i18n lint — no raw JSX strings in new components.

## 9. Tests

- [ ] 9.1 `Shell.test.tsx` — renders sidebar; toggle keyboard shortcut flips collapsed state; localStorage round-trip.
- [ ] 9.2 `PageHeader.test.tsx` — required title; conditional rendering of each slot; auto-crumb renders from `useMatches`.
- [ ] 9.3 `CommandPalette.test.tsx` — `⌘K` opens; route selection navigates.
- [ ] 9.4 `Skeleton.test.tsx`, `EmptyState.test.tsx` — render + a11y (role, name).
- [ ] 9.5 `Login.test.tsx` — happy path + redirect param round-trip.

## 10. Spec deltas + scope ledger

- [ ] 10.1 Spec deltas under `changes/orchestrator-shell-restart/specs/` for `app-shell`, `design-system`, `routing` (see this change's `specs/`).
- [ ] 10.2 Update `openspec/scope.md` if the route narrowing changes any feature ID acceptance criterion.
- [ ] 10.3 Update `apps/orchestrator/AGENTS.md` if any new convention needs to be discoverable to future agents (e.g. "all routes mount inside `Shell`").

## 11. Verification

- [ ] 11.1 `moon run orchestrator:typecheck` — passes.
- [ ] 11.2 `moon run orchestrator:lint` — passes (i18n + no-dark-utilities).
- [ ] 11.3 `moon run orchestrator:test` — passes.
- [ ] 11.4 `moon run orchestrator:build` — passes; bundle does not emit requests to `fonts.googleapis.com`.
- [ ] 11.5 Visual smoke in browser: login → dashboard → toggle sidebar → ⌘K palette → trigger a fake error to see toast.
