**Tier**: [poc]

## Why

The orchestrator already has a Tailwind v4 + shadcn/ui baseline (`design-system` spec, archived from `orchestrator-app-shell`), but the visual layer is generic-blue placeholder tokens, system-stack typography, and only seven primitives copied in. F1 Login, F2 Dashboard, F3 Carepath builder, F4 Patients overview, F5 Patient view, F6 Task view, and F8 Admin all sit on top of this layer; every one of them needs Dialog, Select, Tooltip, Tabs, Badge, Skeleton, etc. before a real screen can be built. Locking the brand identity, typography, and the missing baseline primitives in one change avoids per-feature drift later — every feature change after this one builds on a single, frozen visual foundation.

The brand source is **ZAS Antwerpen** (Ziekenhuis aan de Stroom), the hospital we are building for; their site uses a teal-forward palette (`#266b5e` primary, `#6fc7b6` mint accent, `#101828` ink) that we adopt verbatim and rephrase as semantic, oklch-expressed tokens. The visual posture is **Linear-flavoured restraint**: tight type scale, hairline elevation, single accent, no dark-mode work, denser neutral spacing — applied through tokens and typography rather than by adding `dark:` variants (the current spec forbids those for the PoC).

This change is foundation-only. Specialty libraries (`@dnd-kit`, `@tanstack/react-table`, charts, code editor) are deferred to per-feature changes when the feature lands. Composed app-shell pieces (`PageHeader`, `EmptyState`, `Kbd`, `StatusDot`) are deferred too — first F1/F2 will show what we actually need.

## What Changes

- Replace the generic-blue token palette with the ZAS teal palette in `src/styles/tokens.css`. Tokens stay semantic (`--color-primary`, `--color-surface-1`) and oklch-expressed; hex source is documented inline. Add `--color-surface-1`, `--color-surface-2`, `--color-foreground-muted`, `--color-primary-hover`, `--color-primary-pressed`, `--color-border-strong`, `--shadow-xs`. Remove the unused `[data-theme="dark"]` block and the standalone `--color-secondary` / `--color-accent` tokens that the Linear-style restraint eliminates. Keep `--color-muted-foreground` as an alias of `--color-foreground-muted` so freshly generated shadcn primitives need no rewiring.
- Adopt **Geist Variable** (sans) and **Geist Mono Variable** (mono) as the primary typefaces, self-hosted via `@fontsource-variable/geist` and `@fontsource-variable/geist-mono`. No remote font CDN. System stack retained as fallback. Add a tight Linear-flavour type scale to `tokens.css` (`--font-size-xs`..`--font-size-3xl`, `--leading-tight/snug/normal`, `--tracking-tight`) and apply base layer rules in `globals.css` (denser body baseline, tighter tracking on headings, mono on `code/kbd/pre`, Geist stylistic-set-1 via `font-feature-settings: "ss01"`).
- Copy in twelve missing shadcn/ui primitives so the baseline covers any auth / dashboard / list / form screen without further primitive work: `Avatar`, `Badge`, `Checkbox`, `Dialog`, `DropdownMenu`, `Select`, `Separator`, `Skeleton`, `Switch`, `Tabs`, `Textarea`, `Tooltip`. PascalCase named exports per existing casing rules; `cn()` from `@/lib/style`; `cva` for variants; no raw English string literals (i18n lint applies).
- Mount a single `<TooltipProvider>` from the new `Tooltip` primitive in `src/app/providers.tsx` so module code never mounts its own.
- Sweep the existing primitives (`Button`, `Card`, `Form`, `Input`, `Label`, `Toast/Toaster`, `Icon`) for references to the removed `--color-secondary` / `--color-accent` tokens; repoint or drop the affected variants. No shape/density refactor of these existing primitives in this change.
- Update `apps/orchestrator/AGENTS.md` to cite ZAS teal as the brand primary, Geist as the type family, and the full enumerated `components/ui/` set (the new requirement makes this list closed).
- Add nine Radix dependencies (`@radix-ui/react-{avatar,checkbox,dialog,dropdown-menu,select,separator,switch,tabs,tooltip}`) and two fontsource dependencies (`@fontsource-variable/geist`, `@fontsource-variable/geist-mono`).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `design-system` — adds four requirements (ZAS brand palette, Geist typography, restrained primitive set, single TooltipProvider mount); the existing Light-theme-only requirement gains a scenario that forbids reintroducing the dark token block without its own change. Tailwind v4 + shadcn baseline, lucide iconography, and i18n string requirements stay as-is.

## Impact

- **Code**: full rewrite of `src/styles/tokens.css`; type-scale rules added to `src/styles/globals.css`; `src/app/providers.tsx` mounts `TooltipProvider`; font imports added at app root (`src/main.tsx` or current root); twelve new files under `src/components/ui/`; small variant fixups in existing `Button`/`Card` if `bg-secondary`/`bg-accent` references are found.
- **Dependencies added** (`apps/orchestrator/package.json`): `@radix-ui/react-avatar`, `@radix-ui/react-checkbox`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-select`, `@radix-ui/react-separator`, `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`, `@fontsource-variable/geist`, `@fontsource-variable/geist-mono`. No runtime-FHIR client, no charting lib, no DnD lib.
- **Build / hosting**: bundle gains roughly 80 KB for Geist Variable subsets plus the Radix primitives. No CSP / hosting changes. No PostCSS config (still Tailwind-via-Vite).
- **Tests**: existing component tests for `Button`, `Card`, `Form`, `Input`, `Label`, `Toast` must continue to pass after the token swap. No new test infrastructure (no Storybook, no visual-regression). Manual `/login` eyeball is part of the verification gate.
- **Out of scope**: specialty libraries (DnD, virtualised tables, charts, code editor); composed app-shell components (`PageHeader`, `EmptyState`, `Kbd`, `StatusDot`); dark mode; F1–F8 feature wiring; refactor of existing primitives' shape; visual-regression test infrastructure.
- **Cross-stack**: none. This change is orchestrator-only.
- **Agent rules**: the closed primitive set means any future "add primitive" intent triggers an OpenSpec change rather than a silent shadcn copy-in.
