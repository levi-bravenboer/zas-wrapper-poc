## 1. i18n

- [x] 1.1 Create `src/lib/i18n/locales/nl/nav.json` with keys `dashboard`, `taken`, `zorgpaden`, `patienten`, `instellingen`, `placeholder`
- [x] 1.2 Register `nav` namespace in `src/lib/i18n/index.ts`

## 2. Nav inventory + layout component

- [x] 2.1 Create `src/components/layout/navItems.ts` exporting typed `NavItem[]` (route, labelKey, Lucide icon)
- [x] 2.2 Create `src/components/layout/Sidebar.tsx` rendering items via TanStack `Link` with `activeProps` setting `aria-current="page"` + `bg-accent text-accent-foreground`
- [x] 2.3 Create `src/components/layout/AppLayout.tsx` composing `Sidebar` + `<Outlet />` in a two-column flex layout
- [x] 2.4 Add a `SectionPlaceholder` component (same folder) accepting `titleKey` and rendering `<h1>` + paragraph

## 3. Routes

- [x] 3.1 Update `src/routes/_auth.tsx` to render `AppLayout` instead of bare `<Outlet />`
- [x] 3.2 Replace `src/routes/_auth/index.tsx` body with a `beforeLoad` redirect to `/dashboard`
- [x] 3.3 Create `src/routes/_auth/dashboard.tsx` exporting a dedicated `DashboardPage` component (placeholder content for now)
- [x] 3.4 Create `src/routes/_auth/taken.tsx`, `zorgpaden.tsx`, `patienten.tsx`, `instellingen.tsx` each rendering `<SectionPlaceholder titleKey="nav.<slug>" />`
- [x] 3.5 Verify `routeTree.gen.ts` regenerates and includes the five routes

## 4. Tests

- [x] 4.1 Add `src/components/layout/Sidebar.test.tsx` asserting every entry in `navItems` renders a link with the translated label
- [x] 4.2 Add `src/components/layout/AppLayout.test.tsx` covering active state — render under a memory router at `/zorgpaden`, assert only the Zorgpaden item has `aria-current="page"`
- [x] 4.3 Add a route-redirect test for `/` → `/dashboard` (authed) and `/` → `/login` (unauthed)
- [x] 4.4 Update `tests-e2e/smoke-login.spec.ts` to assert the user lands on `/dashboard` and the sidebar is visible after login

## 5. Docs

- [x] 5.1 Update `apps/orchestrator/README.md` route table with the five section routes
- [x] 5.2 Update `apps/orchestrator/AGENTS.md` to note `src/components/layout/` as the home for cross-route chrome

## 6. Verify

- [x] 6.1 `moon run orchestrator:typecheck` — must pass
- [x] 6.2 `moon run orchestrator:lint` — must pass
- [x] 6.3 `moon run orchestrator:test` — must pass with coverage thresholds intact
- [x] 6.4 `moon run orchestrator:test-e2e` — smoke must pass on `/dashboard`
- [x] 6.5 `moon run orchestrator:build` — must produce `dist/`
- [x] 6.6 `npx openspec validate dashboard-sidebar-shell --strict` — must pass
