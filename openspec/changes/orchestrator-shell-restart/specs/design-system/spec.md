## MODIFIED Requirements

### Requirement: Restrained primitive set

The orchestrator SHALL provide a closed baseline of shadcn/ui primitives in `src/components/ui/`: `Alert`, `Avatar`, `Badge`, `Breadcrumb`, `Button`, `Card`, `Checkbox`, `Command`, `Dialog`, `DropdownMenu`, `Form`, `Icon`, `Input`, `Label`, `Select`, `Separator`, `Sheet`, `Sidebar`, `Skeleton`, `Switch`, `Tabs`, `Textarea`, `Toast`, `Toaster`, `Tooltip`. Adding a primitive outside this set MUST be proposed as its own OpenSpec change. Higher-level shell components (`Shell`, `PageHeader`, state surfaces, `CommandPalette`) MUST be built on top of these primitives — bespoke re-implementations of primitives in `node_modules` or shadcn are forbidden.

#### Scenario: Extending baseline gated

- **WHEN** a contributor adds a new file under `src/components/ui/` that is not in the baseline list
- **THEN** an OpenSpec change naming the new primitive MUST exist before the file is merged

#### Scenario: Primitives copied not re-exported

- **WHEN** a primitive is added
- **THEN** its source lives in `src/components/ui/<Name>.tsx` (PascalCase, named exports) and does not re-export raw Radix primitives from `@radix-ui/*`

#### Scenario: Higher-level components consume primitives

- **WHEN** the `Shell` is implemented
- **THEN** it composes `Sidebar`, `Sheet`, `DropdownMenu`, `Tooltip` from `@/components/ui/`
- **AND** does not duplicate their behavior with custom Radix wiring

## ADDED Requirements

### Requirement: Bold glass surface treatment

The orchestrator SHALL define a bold-glass surface treatment as the canonical visual language for high-level chrome (sidebar, modals, palette, page-level state surfaces). Tokens MUST be added to `src/styles/tokens.css`:

- `--glass-panel: rgba(255, 255, 255, 0.55)`
- `--glass-panel-strong: rgba(255, 255, 255, 0.7)`
- `--glass-border: rgba(255, 255, 255, 0.7)`
- `--glass-blur: 20px`
- `--glass-saturate: 180%`
- `--shadow-glass: 0 12px 32px rgba(38, 107, 94, 0.08), 0 1px 0 rgba(255, 255, 255, 0.6) inset` — both shadow lines MUST carry a `/* derived from #266b5e — primary glow */` comment per the existing palette traceability rule.

A `.glass` utility class in `src/styles/globals.css` SHALL set `background: var(--glass-panel)`, `backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate))`, the WebKit prefix, `border: 1px solid var(--glass-border)`, and `box-shadow: var(--shadow-glass)`. Module code MUST opt in via this class — bespoke `backdrop-filter` declarations on individual surfaces are forbidden so the visual language stays consistent and the performance budget stays inspectable.

#### Scenario: Sidebar uses glass utility

- **WHEN** the shell renders the sidebar
- **THEN** the sidebar root element carries the class `glass`
- **AND** no other CSS declaration on a sidebar descendant sets `backdrop-filter`

#### Scenario: Token traceability preserved

- **WHEN** `src/styles/tokens.css` is read
- **THEN** every `--glass-*` and `--shadow-glass` line carries a `/* derived from #hex */` comment

### Requirement: Aurora background layer

The body SHALL paint an aurora background on every authed route via a `body::before` pseudo-element. The pseudo MUST be `position: fixed; inset: 0; z-index: -1; pointer-events: none` and use the token `--gradient-aurora` defined in `src/styles/tokens.css` as:

```css
--gradient-aurora:
  radial-gradient(ellipse 60% 50% at 0% 0%, rgba(38, 107, 94, 0.20) 0%, transparent 55%),
  radial-gradient(ellipse 50% 40% at 100% 100%, rgba(207, 237, 232, 0.55) 0%, transparent 55%),
  linear-gradient(180deg, #fafaf9 0%, #f1efed 100%);
```

The aurora MUST NOT use `backdrop-filter`. The login route SHALL paint the same aurora.

#### Scenario: Aurora present on dashboard

- **WHEN** an authed user opens `/dashboard`
- **THEN** `getComputedStyle(document.body, '::before').position === 'fixed'`
- **AND** the layer is below `z-index: 0`

#### Scenario: Aurora present on login

- **WHEN** an unauthenticated user opens `/login`
- **THEN** the same aurora layer is rendered

### Requirement: Active-state gradient

Active navigation items SHALL render with the token `--gradient-active`, defined in oklch space as `linear-gradient(135deg, oklch(0.48 0.06 175) 0%, oklch(0.32 0.05 175) 100%)` (derived from ZAS primary `#266b5e` → pressed `#08453c`). The active-state text colour MUST be `#ffffff`. The token MUST carry a `/* derived from #266b5e → #08453c */` comment.

#### Scenario: Active item background

- **WHEN** the user is on `/dashboard` and the sidebar nav renders
- **THEN** the Dashboard item's `::before` (or background) resolves to the active gradient
- **AND** its text colour resolves to `#ffffff`

### Requirement: State-surface component set

The orchestrator SHALL ship a state-surface component set under `src/components/states/` covering every async state the shell can encounter:

- `Skeleton.tsx` exporting `RowSkeleton`, `CardSkeleton`, `DetailSkeleton` — each renders shimmering placeholders that match the shape of real content. Shimmer animation is `shimmer 1.4s ease-in-out infinite` keyframes defined in `tokens.css`.
- `EmptyState.tsx` — props `{ glyph, title, body, action? }`. Tone is calm; copy uses no exclamation marks and no celebratory emoji.
- `InlineAlert.tsx` — danger-soft band for partial-failure surfaces; props `{ title, body, onRetry? }`.
- `ErrorState.tsx` — full-page error; props `{ title, body, code?, onRetry?, secondaryAction? }`.
- `RefetchOverlay.tsx` — veil + spinner wrapping its children when a query is refetching with stale data still visible.

A Sonner toast helper at `src/lib/notifications/toast.ts` SHALL expose `toastError({ message, retry? })` with a 5-second auto-dismiss default. Error toasts MUST resolve their message through the FHIR `OperationOutcome` → i18n pipeline already defined under `fhir-ready-frontend`.

#### Scenario: Skeleton matches real shape

- **WHEN** a list route renders while `query.isPending`
- **THEN** the skeleton uses `RowSkeleton` with the same number of placeholder rows and avatar+text layout as the real list

#### Scenario: Stale data not replaced on refetch

- **WHEN** `query.isFetching && query.data` is true
- **THEN** the route renders the data inside `RefetchOverlay`, NOT a skeleton

#### Scenario: Empty state copy tone

- **WHEN** the empty state for "no patients" renders
- **THEN** the copy uses no exclamation marks
- **AND** the action button uses sentence-case Dutch labels (e.g. "Patiënt toevoegen", not "🎉 Add Patient!")

### Requirement: Minimal login layout

The login route SHALL render its surface without card chrome — no `<Card>` border or panel background around the form. The route SHALL place a centered column containing the ZAS mark, a title, the email + password inputs, and a single primary teal CTA. The aurora background layer SHALL be visible behind the form. The PoC login MUST NOT render "remember me" or "forgot password" links.

#### Scenario: No card around form

- **WHEN** an unauthenticated user opens `/login`
- **THEN** no element with the `Card` class wraps the form fields

#### Scenario: No PoC-out-of-scope affordances

- **WHEN** the login page renders
- **THEN** no element with the text "Wachtwoord vergeten" or "Onthoud mij" is present in the DOM
