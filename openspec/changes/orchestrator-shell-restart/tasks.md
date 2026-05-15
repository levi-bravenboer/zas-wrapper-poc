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

- [x] 1.1 Add glass + aurora + active-gradient tokens to `src/styles/tokens.css` (see `design.md` D2).
- [x] 1.2 Add aurora `body::before` layer in `src/styles/globals.css`.
- [x] 1.3 Add `.glass` utility class (opt-in `backdrop-filter`) in `src/styles/globals.css`. Also added `.glass-strong` for the brighter panel variant.
- [x] 1.4 Verify no `dark:` Tailwind variants land alongside these tokens (light-only rule still holds). Removed shadcn-injected `@custom-variant dark` + `.dark` block. Sidebar tokens now map to ZAS palette.

## 2. Routing narrowing

- [x] 2.1 Delete `src/routes/_auth/{tasks,pathways,patients,settings}.tsx` (English names, not the Dutch placeholders the original task listed). 4 files removed.
- [x] 2.2 Keep `src/routes/_auth/dashboard.tsx` as the single webapp section route.
- [x] 2.3 Confirm `_auth/index.tsx` still redirects `/` → `/dashboard` (`-index.test.tsx` covers).
- [x] 2.4 Regenerated `routeTree.gen.ts` via `scripts/gen-route-tree.mjs`. Typecheck + lint + test clean.
- [x] 2.5 Keep `embed.tsx` + `s.tsx` shell layouts + their `tasks.tsx` route files as live reference for the three-shell pattern (`AppShell` / `EmbedShell` / `SmartShell`). Decided over full prune so future `[mvp]` SMART launch + HiX iframe surfaces don't need to rebuild the shells from scratch.
- [x] 2.6 Keep `routes/launch.tsx` + `launch.callback.tsx` (SMART-on-FHIR PKCE entry) for the same reason.
- [ ] 2.7 Stale nav-link cleanup in `navItems.ts` — deferred to section 3.10 (sidebar rebuild owns it).

## 2.5 Audit: foundation vs mockups + best practice

Before building the shell, verify everything landed in sections 0–2 matches the locked mockups and follows shadcn / Tailwind v4 / project conventions. Output of this audit is a written findings list (commit message body or short note appended below) plus any follow-up tickets carved into this tasks list.

- [x] 2.5.1 Cross-check tokens vs `design.md` D2. Glass alpha + saturate match. Aurora alpha matches D2 (0.20) — minor drift from mockup 04 (0.18) accepted as spec-authoritative. Active-gradient kept opaque oklch per D2 (mockup uses rgba @ 0.95; design.md opaque was deliberate — see commit `d9918ee`).
- [x] 2.5.2 Mockup glass placements use four blur tiers (8 / 14 / 20 / 24 px). Original utility only shipped one. Fixed: added `--glass-blur-xs/sm/strong` tokens + `.glass-xs/.glass-sm/.glass/.glass-strong` utilities. Visual parity to be confirmed when shell renders (section 3 build).
- [x] 2.5.3 Vendor primitives (`alert`, `breadcrumb`, `command`, `sheet`, `sidebar`, `use-mobile`) untouched since shadcn CLI install — only `git log` entry is the initial `feat(orchestrator): add sidebar sheet command breadcrumb alert prims` commit. Modifications limited to documented `button` icon size + `dialog` `showCloseButton`.
- [x] 2.5.4 `sidebar.tsx` consumes `bg-sidebar`, `text-sidebar-foreground`, `border-sidebar-border`, `bg-sidebar-accent`, `text-sidebar-accent-foreground` — every class is provided by the `@theme inline` bridge in `globals.css` over the ZAS palette aliases. No `hsl(...)` literals remain.
- [x] 2.5.5 components.json aliases match folder layout. Root `apps/orchestrator/tsconfig.json` previously lacked `baseUrl` + `paths`, so shadcn CLI mis-resolved `@/` and dropped files at a literal `@/components/ui/` path. Fixed: added `compilerOptions.baseUrl` + `paths` to root tsconfig (project-refs stub untouched otherwise; `tsc -b --noEmit` still clean).
- [x] 2.5.6 AGENTS.md closed primitive set matches `src/components/ui/` filesystem (25 entries).
- [x] 2.5.7 No `dark:` variants, no `.dark` selector, no `@custom-variant dark` in `src/` (`grep` clean).
- [x] 2.5.8 No `tailwind.config.js` exists. All tokens consumed via `var(--*)` or `@theme` / `@theme inline` bridge — pure v4 surface.
- [x] 2.5.9 Verify gate clean: `Test Files 17 passed (17)` · `Tests 55 passed (55)` · `lint ✖ 3 problems (0 errors, 3 warnings)` (all 3 pre-existing in `mockServiceWorker.js` + `auth/hooks.test.tsx` `vi.mock` hoist pattern — not introduced here) · `build ✓ built in 308ms`.
- [x] 2.5.10 Findings + follow-ups carved:
  - Active-gradient opacity drift vs mockup → kept opaque per user call (design.md authoritative).
  - Glass-blur tiers gap → fixed in 2.5.2.
  - shadcn CLI alias mis-resolution → fixed in 2.5.5.
  - `-_auth.test.tsx` referenced removed `/pathways` route as a redirect fixture → renamed to `/dashboard` for cleanliness.
  - Pre-existing lint warnings (mockServiceWorker / vi.mock hoist) deliberately untouched — owned by msw / vitest patterns, not shell work.

## 3. Sidebar shell (built on shadcn `Sidebar` block)

The shadcn `Sidebar` block already ships: collapsible rail (`icon` variant ≈ our 64px), mobile drawer via `Sheet`, keyboard shortcut (`SidebarTrigger`), state provider, tooltip-on-collapsed, persistence cookie. Override only what conflicts with our locks.

- [x] 3.1 `src/components/layout/Shell.tsx` reads `useSurface()`. `shell: "bare"` renders `<main data-shell="bare" data-surface={id}><Outlet /></main>` (no provider, no chrome). `shell: "menu"` renders controlled `<SidebarProvider>` + `<AppSidebar>` + `<SidebarInset data-shell="menu"><Outlet /></SidebarInset>`. Route files no longer decide chrome — `AppShell`/`SmartShell`/`EmbedShell` all mount `<Shell />`.
- [x] 3.2 `AppSidebar` configured `variant="sidebar"`, `side="left"`, `collapsible="icon"`. `className` overrides drop default rounded edges + right border on the inner container.
- [x] 3.3 `.glass` class on `<Sidebar>` root.
- [x] 3.4 localStorage persistence at `orchestrator.sidebar.collapsed` (string `"true"` / `"false"`). Cookie write removed from forked `sidebar.tsx`. Controlled `SidebarProvider` reads on mount + writes on `onOpenChange` (effect-based to keep SSR-safety).
- [x] 3.5 Forked `SIDEBAR_KEYBOARD_SHORTCUT` constant `"b"` → `"\\"` so the upstream listener fires on `⌘\` / `Ctrl+\`.
- [x] 3.6 Brand block: gradient ZAS mark + product name `t('shell:brand.name')`. Version pill dropped (user call — surface elsewhere if needed; no `__APP_VERSION__` plumbing).
- [x] 3.7 Nav items via `<SidebarMenu>` + `<SidebarMenuItem>` + `<SidebarMenuButton asChild>` wrapping TanStack `<Link>`. Active-gradient applied via `data-[active=true]` class overrides on the button.
- [x] 3.8 User block in `<SidebarFooter>`: `DropdownMenu` triggered by an `lg` `SidebarMenuButton` rendering avatar (initials fallback over active-gradient) + name + role. Items: profile stub, settings stub, sign-out → `useLogout()`.
- [x] 3.9 Tooltip-on-collapsed: `SidebarMenuButton tooltip={label}` for nav + user button — out-of-box.
- [x] 3.10 `navItems.ts` shrunk to Dashboard only. Feature registry merge path preserved for later modules.

## 4. Command palette (built on shadcn `Command`)

- [x] 4.1 Created `src/components/command-palette/` module: `CommandPalette.tsx` (UI, groups entries by `entry.group`), `CommandPaletteProvider.tsx` (state + key listener), `context.ts` (`useCommandPalette`, `useRegisterCommands` page-level hook keyed by string), `useRouteCommands.ts` (built-in nav registry), `types.ts`, `index.ts` barrel. Pages can contribute commands via `useRegisterCommands('<scope-key>', useMemo<CommandEntry[]>(...))`.
- [x] 4.2 Provider attaches a `keydown` listener that flips `open` on ⌘K / Ctrl+K (`event.metaKey || event.ctrlKey`).
- [x] 4.3 `useRouteCommands` merges `hardWiredNavItems` + `getFeaturesForSurface('app')` into palette entries. Uses `router.history.push(path)` to keep the registry's `string` path type (vs `navigate({ to })` which demands a route-tree literal).
- [x] 4.4 Mounted once in `MenuShell` via `<CommandPaletteProvider>` + `<CommandPalette />` + `<RouteCommandsRegistry />`. Bare (embed) shell skips it deliberately.

## 5. Page header (built on shadcn `Breadcrumb` + `Tabs`)

- [x] 5.1 Created `src/components/layout/PageHeader.tsx` with slots: `eyebrow`, `title` (required), `sub`, `actions`, `tabs`.
- [x] 5.2 Auto-crumb via `useMatches()` when depth > 2; renders shadcn `Breadcrumb` + items. Labels read from `staticData.breadcrumb` via defensive `readBreadcrumb` reader (TanStack `staticData` typed `unknown` here, no module augmentation). Home crumb prefixed via `t('shell:header.crumb.home')`.
- [x] 5.3 Tabs slot accepts `ReactNode` — consumers compose `Tabs` + `TabsTrigger asChild` themselves to keep PageHeader router-agnostic. Wiring pattern documented in component file via slot name `page-header-tabs`.
- [x] 5.4 Mounted `<PageHeader title={t('dashboard')} sub={t('placeholder')} />` in `routes/_auth/dashboard.tsx`.

## 6. State surfaces (built on shadcn `Skeleton` + `Alert`, Sonner)

- [x] 6.1 Created `src/components/states/Skeleton.tsx` exporting `RowSkeleton`, `CardSkeleton`, `DetailSkeleton`. Each composes the shadcn `Skeleton` primitive directly via `animate-pulse` (no new shimmer impl).
- [x] 6.2 Created `src/components/states/EmptyState.tsx` with `{ icon?, title, body?, action? }`. `role="status"` wrapper + `<h3>` title — dashed border, centered, muted body copy.
- [x] 6.3 Created `src/components/states/InlineAlert.tsx` wrapping shadcn `Alert variant="destructive"` with optional `retry` slot rendered in the description column.
- [x] 6.4 Created `src/components/states/ErrorState.tsx` full-page composition: lucide icon in destructive tint pill, title heading, body copy, optional `onRetry` primary button + arbitrary `action` slot.
- [x] 6.5 Created `src/components/states/RefetchOverlay.tsx` — wraps children, overlays `Loader2` spinner + label when `active={true}`. Uses `role="status"` + `aria-live="polite"` + `aria-busy="true"`.
- [x] 6.6 Created `src/lib/notifications/toast.ts` — `toastError(title, { description?, retryLabel?, onRetry? })` wraps Sonner with action shorthand. FHIR error-code → i18n mapping stays at the call site.

## 7. Login screen

- [x] 7.1 Rewrote `src/routes/login.tsx` with pattern O — minimal centered, no card, aurora background visible through.
- [x] 7.2 Uses shadcn `Input` + `Label` + primary `Button`. No "remember me", no "forgot password".
- [x] 7.3 `LoginForm.tsx` collapsed to PoC placeholder: `handleSubmit` `event.preventDefault()` then `navigate({ to: '/dashboard' })`. No `useLogin`, no `zod`/`useForm`. BL-035 carries the real wiring.
- [x] 7.4 Confirmed: only `src/routes/login.tsx` exists. No `embed/login.tsx` registered.
- [x] 7.5 `Route.validateSearch` still parses `?redirect=` so the auth guard's redirect param stays type-safe; placeholder ignores it for now (guard reinstates at BL-035).

## 8. Localization

- [x] 8.1 `locales/nl/shell.json` shipped with brand, user menu, palette, header crumb keys; registered in `src/lib/i18n/index.ts`.
- [x] 8.2 `locales/nl/states.json` shipped with `empty.{patients,tasks}`, `error.{generic,fhir,retry}`, `refetch.label`; registered alongside other namespaces.
- [x] 8.3 ESLint i18next `no-literal-string` rule clean on all shell/state components (only fixture strings disabled per line in test files).

## 9. Tests

- [x] 9.1 `Shell.test.tsx` shipped — sidebar slot present, ⌘\ toggle flips localStorage round-trip (`'false'` → `'true'` → `'false'`), pre-seeded `'true'` renders `data-state="collapsed"`.
- [x] 9.2 `PageHeader.test.tsx` shipped — mocked `useMatches` + `Link`, asserts required `<h1>` heading, eyebrow/sub/actions/tabs slot rendering, and auto-crumb chain (home + intermediate link + final `BreadcrumbPage`).
- [x] 9.3 `CommandPalette.test.tsx` — ⌘K opens the palette and lists registered entries; clicking an item invokes its `perform` callback.
- [x] 9.4 `Skeleton.test.tsx` (presentational slot checks) + `EmptyState.test.tsx` (role=status + heading lookup + body/action conditional) shipped.
- [x] 9.5 `LoginForm.test.tsx` rewritten — mocks `useNavigate`, asserts empty submit calls `navigate({ to: '/dashboard' })` exactly once, no `role="alert"` rendered, no fetch path imported.
- [x] 9.6 Surface branching coverage spread across three files: `SmartShell.test.tsx` (menu surface → sidebar slot present), `Shell.test.tsx` (app surface → sidebar + persistence), `EmbedShell.test.tsx` (embed surface → `data-shell="bare"`, no sidebar). One consolidated `Shell.surface.test.tsx` would duplicate — left as-is.

## 10. Spec deltas + scope ledger

- [x] 10.1 Spec deltas under `changes/orchestrator-shell-restart/specs/` for `app-shell`, `design-system`, `routing` shipped. `openspec validate orchestrator-shell-restart --strict` → valid.
- [x] 10.2 `openspec/scope.md` unchanged — F1–F8 acceptance criteria preserved. Route narrowing to dashboard-only is implementation-deferred via BL-035, not a scope mutation.
- [x] 10.3 Update `apps/orchestrator/AGENTS.md` — added "Surfaces — ask before building a new page" section (three-surface registry table, route-shim recipe, mandatory question to ask, page composition contract).

## 11. Verification

- [x] 11.1 `moon run orchestrator:typecheck` — clean.
- [x] 11.2 `moon run orchestrator:lint` — 0 errors. 1 pre-existing warning in `public/mockServiceWorker.js` unrelated to this change.
- [x] 11.3 `moon run orchestrator:test` — 24 files / 88 tests passed.
- [x] 11.4 `moon run orchestrator:build` — `✓ built in 299ms`; bundle emits no `fonts.googleapis.com` requests (Geist via `geist/font` only).
- [ ] 11.5 Visual smoke in browser: login → dashboard → toggle sidebar → ⌘K palette → trigger a fake error to see toast. *(manual — left for user)*
