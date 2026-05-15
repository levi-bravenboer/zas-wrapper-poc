## MODIFIED Requirements

### Requirement: Authed section routes

The `_auth` segment SHALL host exactly one section route in PoC: the home overview at `/`, implemented as `src/routes/_auth/index.tsx`. The route MUST inherit the guard from `_auth.tsx` and the shared layout from `Shell`. The previously specified siblings (`/taken`, `/zorgpaden`, `/patienten`, `/instellingen`) are removed from this requirement; each MUST be reintroduced through its own OpenSpec change at the time its feature work begins. Route paths added in the future MUST stay in lowercase Dutch (no English aliases).

#### Scenario: Single section route in PoC

- **WHEN** the generated `routeTree.gen.ts` is read
- **THEN** the only route file under `src/routes/_auth/` (besides `_auth.tsx`) is `index.tsx`

#### Scenario: Home inherits guard and shell

- **WHEN** an unauthenticated user opens `/`
- **THEN** the `_auth` guard redirects to `/login?redirect=%2F`

- **WHEN** an authed user opens `/`
- **THEN** the rendered tree is `Shell` → home overview content
- **AND** the sidebar is present in the DOM

#### Scenario: Reintroducing a dropped route requires a change

- **WHEN** a PR adds `src/routes/_auth/patienten.tsx`
- **THEN** an OpenSpec change naming the new route MUST exist before the file is merged

## ADDED Requirements

### Requirement: Breadcrumb data via route staticData

Routes that render below depth 2 (root + auth wrap + content) SHALL declare their breadcrumb label as either `staticData: { breadcrumb: string }` on the route definition, or as a `crumb` field returned from the route's loader. The `PageHeader` component reads these and auto-renders the crumb path. Routes MUST NOT pass a `breadcrumb` prop to `PageHeader` manually — the path is derived from route matches only.

#### Scenario: staticData crumb surfaces

- **WHEN** a route declares `staticData: { breadcrumb: 'Patiënt' }`
- **THEN** the crumb segment for that match reads "Patiënt" in the rendered breadcrumb

#### Scenario: Loader crumb surfaces

- **WHEN** a route's loader returns `{ crumb: 'De Smet, J.' }`
- **THEN** the crumb segment for that match reads "De Smet, J."

#### Scenario: Missing crumb is skipped, not derived from URL

- **WHEN** a route has neither `staticData.breadcrumb` nor a loader `crumb`
- **THEN** the breadcrumb skips that segment (no URL slug, no `_auth` literal, no fallback string)

### Requirement: Login route PoC behaviour

The `/login` route SHALL be implemented at `src/routes/login.tsx` and render the Minimal Login Layout defined in the `design-system` delta (aurora background, centered column, ZAS mark, email + password inputs, single primary teal CTA, no card chrome, no remember-me, no forgot-password). In this change the submit handler MUST NOT validate inputs, MUST NOT call an auth endpoint, and MUST navigate to `/` via TanStack Router unconditionally — the handler exists only so the screen can be built and end-to-end navigated. The real wiring (frontend field validation, `useLogin` mutation against the hard-coded user table, cookie-session round-trip, `?redirect=` honouring, failure-state rendering) is explicitly out of scope here and is tracked on the `[poc]` roadmap under `BL-035` (F1 user + auth domain). The `/login` route MUST NOT be reachable on the `embed` surface — HiX provides its own authentication context for embedded use.

#### Scenario: Submit navigates without validating

- **WHEN** an unauthenticated user opens `/login`, leaves both fields empty, and clicks the primary CTA
- **THEN** the router navigates to `/`
- **AND** no network request is issued to an auth endpoint
- **AND** no validation error is rendered

#### Scenario: Login uses minimal layout

- **WHEN** the login route renders
- **THEN** no `Card` element wraps the form
- **AND** the aurora layer is visible behind the form
- **AND** no "Wachtwoord vergeten" or "Onthoud mij" element is present

#### Scenario: Login unreachable on embed surface

- **WHEN** a user opens `/embed/login` or any `/login` variant under the embed base path
- **THEN** the route does not resolve (404 or surface redirect)
- **AND** the embed surface does not register a `/login` route file

#### Scenario: Validation is a follow-up change

- **WHEN** a future PR adds input validation, credential exchange, or a redirect target to the login submit handler
- **THEN** that PR MUST be backed by `BL-035` (F1 user + auth domain) or a successor OpenSpec change that updates this requirement
