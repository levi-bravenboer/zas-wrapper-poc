## Context

Today the orchestrator boots into a placeholder `_auth/index.tsx` card at `/`. There is no persistent chrome. The June demo (Holter + Rugrevalidatie pathway composer) needs a stable navigation surface so clinicians can move between dashboard, task inbox, pathway library, patient list, and settings without losing context.

Stack constraints: TanStack Router (file-based, generated tree), Tailwind v4 + shadcn semantic tokens (just migrated to OKLCH `--color-primary` etc.), `lucide-react` already installed, i18n is `nl`-only with module-scoped namespaces.

## Goals / Non-Goals

**Goals:**

- Single persistent layout for every authed route.
- Five primary nav items with Dutch labels and Lucide icons.
- Route-driven active state, no manual tracking.
- One source of truth for nav items so adding a sixth is trivial.
- All semantic — no arbitrary Tailwind colors, no inline SVG icons, no English fallback labels.

**Non-Goals:**

- Collapsible / icon-only sidebar (defer to follow-up).
- Top-bar header chrome (separate concern).
- Permission-gated nav (RBAC not yet modelled).
- Real dashboard content; this proposal only ships placeholders.
- Mobile breakpoint behavior; desktop-only for the demo.

## Decisions

### D1: Layout lives in `components/layout/`, not `modules/`

`AppLayout` and `Sidebar` are cross-cutting chrome consumed by every authed route — they cannot live inside a module without violating the `no modules→modules` import rule. Per `app-shell` requirement "Cross-module sharing promotes to lib/components", they go under `src/components/layout/`.

**Alternative considered**: a `modules/shell/` module. Rejected — every other module would import from it, recreating the forbidden cross-module dependency in disguise.

### D2: Nav inventory is a typed constant, not JSX inside `Sidebar`

`navItems.ts` exports `NavItem[]` with `{ to: string; labelKey: string; icon: LucideIcon }`. `Sidebar` maps over it. This lets tests assert nav inventory by importing the same array the UI uses — no scraping the DOM for fragile string matches.

```ts
export type NavItem = {
  to: '/dashboard' | '/taken' | '/zorgpaden' | '/patienten' | '/instellingen'
  labelKey: `nav.${string}`
  icon: LucideIcon
}
```

### D3: Active state via TanStack `Link` `activeProps`

Use `<Link to="..." activeProps={{ 'aria-current': 'page', className: 'bg-accent text-accent-foreground' }}>`. Router controls the comparison; we never read `location` manually. `aria-current="page"` doubles as test selector and accessibility hint.

**Alternative**: `useRouterState({ select: s => s.location.pathname })` + manual `startsWith`. Rejected — duplicates router logic and risks drift on nested routes.

### D4: Root redirect in `_auth/index.tsx` `beforeLoad`

`/` already resolves to `_auth/index.tsx`. Replace its component with a no-op and put `beforeLoad: () => { throw redirect({ to: '/dashboard' }) }`. Redirect happens before any render so there's no flash of placeholder content.

**Alternative**: render dashboard inline at `/`. Rejected — bookmarking `/dashboard` should be the canonical URL; ambiguous URLs hurt analytics and back-button behavior later.

### D5: Placeholder sections share a single `SectionPlaceholder` component, but dashboard does not

The four non-dashboard sections render `<SectionPlaceholder titleKey="nav.taken" />` etc. Dashboard gets its own `DashboardPage` file because it will be replaced with real content first — keeping it separate avoids a later refactor that splits the shared component back out.

### D6: i18n nav namespace, not extension of `common`

A separate `nav` namespace keeps sidebar copy independent from chrome/error strings. Future locales translate `nav.json` standalone. Matches the existing module-namespace convention.

## Risks / Trade-offs

- **[Sidebar persistence across routes]** TanStack Router file-based layouts via `_auth.tsx` already preserve the parent component across child route changes. Verified by reading `routing` spec — Outlet pattern. → Test in `AppLayout.test.tsx` that a stable DOM reference survives a `navigate()`.
- **[Active-state flicker on slow nav]** `Link` `activeProps` flips synchronously on click, so no visible lag. → No mitigation needed.
- **[Lucide tree-shake bloat]** Importing icons as named imports from `lucide-react` is already tree-shaken. → No mitigation needed; verify bundle size unchanged in `build` output.
- **[Hardcoded route literals diverging from `navItems`]** If someone adds `/taken/[id]` and forgets to update sidebar, the Taken item won't reflect subroutes. → Out of scope (subroutes don't exist yet); when they appear, switch active match to prefix-based via `<Link activeOptions={{ exact: false }}>`.

## Open Questions

- Should `Instellingen` be flagged as a separate section vs. tucked into a user menu? Decision: keep as primary nav for the demo; revisit when account chrome lands.
- Logo / brand at top of sidebar? Decision: scope-out for this change; add via follow-up once design exists.
