# design-system Specification

## Purpose
TBD - created by archiving change orchestrator-app-shell. Update Purpose after archive.
## Requirements
### Requirement: Tailwind v4 + shadcn/ui baseline

The orchestrator SHALL use Tailwind CSS v4 via `@tailwindcss/vite` and bootstrap shadcn/ui primitives into `src/components/ui/`. Tokens MUST live in `src/styles/tokens.css` as CSS custom properties consumed by Tailwind theme.

#### Scenario: Tailwind v4 active without PostCSS config

- **WHEN** `moon run orchestrator:dev` starts
- **THEN** Tailwind v4 compiles utility classes through the Vite plugin and no `postcss.config.*` file is required

#### Scenario: shadcn primitives owned in-repo

- **WHEN** a developer adds a `Button` from shadcn
- **THEN** its source is copied into `src/components/ui/button.tsx` (not consumed from `node_modules`)

### Requirement: Light theme only

The app SHALL render a single light theme for the POC. Token names MUST be theme-agnostic (`--color-surface-1`, not `--color-white`) so a dark theme can be added later by swapping token values, without changing component code. The dark token block MUST NOT exist in `src/styles/tokens.css` until a dedicated OpenSpec change introduces dark mode end-to-end (tokens, toggle UI, lint rule update).

#### Scenario: Token swap is the only thing needed for dark mode

- **WHEN** a future change introduces dark mode
- **THEN** it adds dark token values and a `data-theme="dark"` toggle, and component source remains untouched

#### Scenario: No dark utility classes in components

- **WHEN** `moon run orchestrator:lint` runs
- **THEN** no component contains `dark:` Tailwind variants

#### Scenario: No dormant dark token block

- **WHEN** `src/styles/tokens.css` is read
- **THEN** no `[data-theme="dark"]` block exists; reintroducing one requires its own OpenSpec change

### Requirement: Iconography via lucide-react

The orchestrator SHALL use `lucide-react` for all icons. Inline SVGs and other icon packs are forbidden unless wrapped in `src/components/ui/icon/` with an ADR.

#### Scenario: Icon import path

- **WHEN** a component needs a chevron icon
- **THEN** it imports `ChevronDown` from `lucide-react` directly

### Requirement: Localized user-visible strings

Every user-visible string rendered by components in `src/components/ui/` and module components SHALL come through `t('namespace.key')`. String literals in JSX text or attributes (`aria-label`, `placeholder`, etc.) are forbidden.

#### Scenario: Lint flags raw string

- **WHEN** a contributor writes `<button>Verzenden</button>`
- **THEN** the i18n lint rule flags it and CI fails until it is replaced with `t(...)`

### Requirement: ZAS brand palette

The orchestrator SHALL use the ZAS Antwerpen brand palette as the canonical color source. The primary brand color MUST be ZAS teal (`#266b5e`), with a teal-derived scale: pressed (`#08453c`), soft (`#cfede8`), and subtle (`#f1f8f7`). The `--color-primary-hover` token MAY be derived (interpolated between primary and pressed) and MUST carry a `/* derived from #266b5e */` comment instead of a source hex. Color tokens MUST be expressed in `oklch()`. Tokens with a direct ZAS source MUST carry an inline `/* #hex — role */` comment; derived tokens MUST carry a `/* derived from #hex */` comment.

#### Scenario: Primary button renders ZAS teal

- **WHEN** a `Button` is rendered with `variant="default"`
- **THEN** its background resolves to the oklch equivalent of `#266b5e`

#### Scenario: Hex source traceability

- **WHEN** a color token in `src/styles/tokens.css` is added or changed
- **THEN** the same line carries either a `/* #hex — role */` comment citing the ZAS source hex, or a `/* derived from #hex */` comment naming the source token it is derived from

#### Scenario: No standalone secondary or accent color

- **WHEN** `src/styles/tokens.css` is read
- **THEN** no `--color-secondary*` or `--color-accent*` tokens exist; their roles are filled by `--color-surface-2` and `--color-primary-soft`

### Requirement: Geist typography

The orchestrator SHALL use Geist Variable as the primary sans typeface and Geist Mono Variable as the monospace typeface. Both fonts MUST be self-hosted via `@fontsource-variable/geist` and `@fontsource-variable/geist-mono`. No remote font CDN (Google Fonts, Adobe Fonts, etc.) is permitted. A system-stack fallback chain MUST follow the Geist family in `--font-sans` and `--font-mono` so the app remains legible if a font fails to load.

#### Scenario: Self-hosted fonts only

- **WHEN** `moon run orchestrator:build` completes and the resulting bundle is loaded in a browser
- **THEN** no network requests are emitted to `fonts.googleapis.com` or `fonts.gstatic.com`

#### Scenario: System fallback retained

- **WHEN** Geist Variable fails to load
- **THEN** body text falls back to `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`

#### Scenario: Stylistic alternates active

- **WHEN** body text renders
- **THEN** `font-feature-settings: "ss01"` is applied so Geist's stylistic-set-1 alternates are visible

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

### Requirement: TooltipProvider mounted once

A single `<TooltipProvider>` from `@/components/ui/Tooltip` SHALL be mounted in `src/app/providers.tsx`, wrapping the existing provider tree. Module code MUST NOT mount its own `TooltipProvider`.

#### Scenario: Mount uniqueness

- **WHEN** `moon run orchestrator:lint` runs
- **THEN** no file under `src/modules/**` or `src/routes/**` references `TooltipProvider`

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

The body SHALL paint a soft aurora background on every authed route directly via `body { background: var(--gradient-aurora) fixed }` (no `body::before` pseudo). Intermediate wrappers (`#root`, `_auth` shell, `SidebarInset`) MUST stay transparent so the aurora reaches the canvas. The token `--gradient-aurora` is defined in `src/styles/tokens.css` as a single bottom-right mint bloom over a neutral base:

```css
--gradient-aurora:
  radial-gradient(ellipse 65% 55% at 100% 100%, rgba(111, 199, 182, 0.22) 0%, transparent 70%),
  linear-gradient(180deg, #f6f8f7 0%, #eef2f0 100%);
```

The aurora MUST NOT use `backdrop-filter`. The login route SHALL paint the same aurora.

#### Scenario: Aurora present on home

- **WHEN** an authed user opens `/`
- **THEN** `getComputedStyle(document.body).backgroundImage` includes a `radial-gradient` and `backgroundAttachment === 'fixed'`
- **AND** no wrapping element between body and page content paints an opaque `background-color`

#### Scenario: Aurora present on login

- **WHEN** an unauthenticated user opens `/login`
- **THEN** the same aurora layer is rendered

### Requirement: Active-state gradient

Active navigation items SHALL render with the token `--gradient-active`, defined in oklch space as `linear-gradient(135deg, oklch(0.48 0.06 175) 0%, oklch(0.32 0.05 175) 100%)` (derived from ZAS primary `#266b5e` → pressed `#08453c`). The active-state text colour MUST be `#ffffff`. The token MUST carry a `/* derived from #266b5e → #08453c */` comment.

#### Scenario: Active item background

- **WHEN** the user is on `/` and the sidebar nav renders
- **THEN** the home item's background resolves to the active gradient
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

