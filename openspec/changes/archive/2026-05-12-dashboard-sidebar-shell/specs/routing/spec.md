## ADDED Requirements

### Requirement: Authed section routes

The `_auth` segment SHALL host five sibling section routes — `/dashboard`, `/taken`, `/zorgpaden`, `/patienten`, `/instellingen` — each as its own file under `src/routes/_auth/`. All five MUST inherit the guard from `_auth.tsx` and the shared layout from `AppLayout`. Route paths MUST stay in lowercase Dutch (no English aliases).

#### Scenario: Section route inherits guard

- **WHEN** an unauthenticated user opens `/patienten`
- **THEN** the `_auth` guard redirects to `/login?redirect=%2Fpatienten`

#### Scenario: Section route inherits layout

- **WHEN** an authed user opens `/zorgpaden`
- **THEN** the rendered tree is `AppLayout` → section content
- **AND** the sidebar is present in the DOM

### Requirement: Authed root redirects to dashboard

The `/` path SHALL redirect authed users to `/dashboard` rather than rendering content. The redirect MUST happen in `beforeLoad` of `_auth/index.tsx` so it occurs before any component renders. Unauthenticated visitors to `/` MUST still fall through the guard to `/login` per the existing rule.

#### Scenario: Authed user hits root

- **WHEN** an authed user opens `/`
- **THEN** the router replaces the URL with `/dashboard` before mounting any page component

#### Scenario: Unauthenticated user hits root

- **WHEN** a user with no session opens `/`
- **THEN** the `_auth` guard wins first and redirects to `/login?redirect=%2F`
