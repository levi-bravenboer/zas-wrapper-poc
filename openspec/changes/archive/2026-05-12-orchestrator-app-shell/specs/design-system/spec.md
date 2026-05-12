## ADDED Requirements

### Requirement: Tailwind v4 + shadcn/ui baseline

The orchestrator SHALL use Tailwind CSS v4 via `@tailwindcss/vite` and bootstrap shadcn/ui primitives into `src/components/ui/`. Tokens MUST live in `src/styles/tokens.css` as CSS custom properties consumed by Tailwind theme.

#### Scenario: Tailwind v4 active without PostCSS config

- **WHEN** `moon run orchestrator:dev` starts
- **THEN** Tailwind v4 compiles utility classes through the Vite plugin and no `postcss.config.*` file is required

#### Scenario: shadcn primitives owned in-repo

- **WHEN** a developer adds a `Button` from shadcn
- **THEN** its source is copied into `src/components/ui/button.tsx` (not consumed from `node_modules`)

### Requirement: Light theme only

The app SHALL render a single light theme for the POC. Token names MUST be theme-agnostic (`--color-surface-1`, not `--color-white`) so a dark theme can be added later by swapping token values, without changing component code.

#### Scenario: Token swap is the only thing needed for dark mode

- **WHEN** a future change introduces dark mode
- **THEN** it adds dark token values and a `data-theme="dark"` toggle, and component source remains untouched

#### Scenario: No dark utility classes in components

- **WHEN** `moon run orchestrator:lint` runs
- **THEN** no component contains `dark:` Tailwind variants

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
