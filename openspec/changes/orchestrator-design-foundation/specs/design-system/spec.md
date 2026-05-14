## ADDED Requirements

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

The orchestrator SHALL provide a closed baseline of shadcn/ui primitives in `src/components/ui/`: `Avatar`, `Badge`, `Button`, `Card`, `Checkbox`, `Dialog`, `DropdownMenu`, `Form`, `Icon`, `Input`, `Label`, `Select`, `Separator`, `Skeleton`, `Switch`, `Tabs`, `Textarea`, `Toast`, `Toaster`, `Tooltip`. Adding a primitive outside this set MUST be proposed as its own OpenSpec change.

#### Scenario: Extending baseline gated

- **WHEN** a contributor adds a new file under `src/components/ui/` that is not in the baseline list
- **THEN** an OpenSpec change naming the new primitive MUST exist before the file is merged

#### Scenario: Primitives copied not re-exported

- **WHEN** a primitive is added
- **THEN** its source lives in `src/components/ui/<Name>.tsx` (PascalCase, named exports) and does not re-export raw Radix primitives from `@radix-ui/*`

### Requirement: TooltipProvider mounted once

A single `<TooltipProvider>` from `@/components/ui/Tooltip` SHALL be mounted in `src/app/providers.tsx`, wrapping the existing provider tree. Module code MUST NOT mount its own `TooltipProvider`.

#### Scenario: Mount uniqueness

- **WHEN** `moon run orchestrator:lint` runs
- **THEN** no file under `src/modules/**` or `src/routes/**` references `TooltipProvider`

## MODIFIED Requirements

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

