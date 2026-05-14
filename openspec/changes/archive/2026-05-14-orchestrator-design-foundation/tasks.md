## 1. Dependencies

- [x] 1.1 Add Radix primitives: `pnpm -F orchestrator add @radix-ui/react-avatar @radix-ui/react-checkbox @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-switch @radix-ui/react-tabs @radix-ui/react-tooltip`
- [x] 1.2 Add fonts: `pnpm -F orchestrator add @fontsource-variable/geist @fontsource-variable/geist-mono`
- [x] 1.3 Verify `pnpm -F orchestrator install` clean; no peer-dep warnings beyond pre-existing ones

## 2. Token revision (`src/styles/tokens.css`)

- [x] 2.1 Replace primary/secondary/accent palette with ZAS teal scale (`#266b5e` primary, `#6fc7b6` mint, `#08453c` pressed, `#cfede8` soft, `#f1f8f7` subtle); express in `oklch()` with `/* #hex — role */` comment on each token line
- [x] 2.2 Add neutral surface scale: `--color-surface-1`, `--color-surface-2`, `--color-foreground-muted`, `--color-border-strong`
- [x] 2.3 Add hover/pressed states: `--color-primary-hover`, `--color-primary-pressed`
- [x] 2.4 Update status tokens: `--color-destructive` (`#ef4123`), `--color-warning` (`#ff9800`), `--color-success` (teal-aligned)
- [x] 2.5 Update `--color-ring` to ZAS teal (`#266b5e`)
- [x] 2.6 Tighten radii (`--radius-xs/sm/md/lg`) and shadows (`--shadow-xs/sm/md/lg`) per Linear-flavour spec section 1
- [x] 2.7 Add `--color-muted-foreground` as alias of `--color-foreground-muted` to keep generated shadcn templates working
- [x] 2.8 Remove `[data-theme="dark"]` block entirely
- [x] 2.9 Remove standalone `--color-secondary*` and `--color-accent*` tokens (folded into surface scale + primary-soft)
- [x] 2.10 Update `--font-sans` and `--font-mono` to lead with Geist Variable, Geist Mono Variable; keep system fallback chain

## 3. Type scale + base layer (`src/styles/globals.css`)

- [x] 3.1 Add type-scale tokens to `tokens.css`: `--font-size-xs/sm/base/md/lg/xl/2xl/3xl`, `--leading-tight/snug/normal`, `--tracking-tight`
- [x] 3.2 In `globals.css` `@layer base`, set `body { font-size: var(--font-size-base); line-height: var(--leading-snug); font-feature-settings: "ss01"; }`
- [x] 3.3 Add `h1..h6 { font-weight: 600; letter-spacing: var(--tracking-tight); }`
- [x] 3.4 Add `code, kbd, pre { font-family: var(--font-mono); }`

## 4. Font bootstrap

- [x] 4.1 Add `import "@fontsource-variable/geist";` and `import "@fontsource-variable/geist-mono";` at the same module that already imports `globals.css` (likely `src/main.tsx`)
- [x] 4.2 Run `moon run orchestrator:dev`, open Network tab, confirm zero requests to `fonts.googleapis.com` / `fonts.gstatic.com`

## 5. New primitives (`src/components/ui/`)

- [x] 5.1 `Avatar.tsx` — wrap `@radix-ui/react-avatar`; sizes `sm`/`md`/`lg` via cva; named exports `Avatar`, `AvatarImage`, `AvatarFallback`
- [x] 5.2 `Badge.tsx` — no Radix; variants `default`/`secondary`/`destructive`/`outline`/`success`/`warning` via cva; named export `Badge`
- [x] 5.3 `Checkbox.tsx` — wrap `@radix-ui/react-checkbox`; supports indeterminate; named export `Checkbox`
- [x] 5.4 `Dialog.tsx` — wrap `@radix-ui/react-dialog`; named exports `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`
- [x] 5.5 `DropdownMenu.tsx` — wrap `@radix-ui/react-dropdown-menu`; full set including `Sub`, `Separator`, `Shortcut`, `CheckboxItem`, `RadioGroup`
- [x] 5.6 `Select.tsx` — wrap `@radix-ui/react-select`; primitive only — TanStack Form integration deferred to whichever change first introduces `src/lib/form/` (out of scope here)
- [x] 5.7 `Separator.tsx` — wrap `@radix-ui/react-separator`
- [x] 5.8 `Skeleton.tsx` — no Radix; pulse animation via Tailwind `animate-pulse`; token-driven background
- [x] 5.9 `Switch.tsx` — wrap `@radix-ui/react-switch`
- [x] 5.10 `Tabs.tsx` — wrap `@radix-ui/react-tabs`; underline + pill variants via cva
- [x] 5.11 `Textarea.tsx` — no Radix; mirror `Input.tsx` styling
- [x] 5.12 `Tooltip.tsx` — wrap `@radix-ui/react-tooltip`; export `TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent`
- [x] 5.13 For each: PascalCase file + named exports, `cn()` from `@/lib/style`, no raw English string literals, no re-export of raw Radix from `components/ui/`

## 6. Provider wiring

- [x] 6.1 Mount `<TooltipProvider delayDuration={200} skipDelayDuration={100}>` in `src/app/providers.tsx`, wrapping the existing provider tree
- [x] 6.2 Confirm no other file under `src/modules/**` or `src/routes/**` references `TooltipProvider`

## 7. Re-skin sweep of existing primitives

- [x] 7.1 Grep `bg-accent`, `text-accent-foreground`, `bg-secondary`, `text-secondary-foreground` across `src/components/ui/` and `src/modules/**`
- [x] 7.2 Repoint hover-accent usages to `bg-surface-2`; repoint or drop `secondary` button variant
- [x] 7.3 Confirm `Button`, `Card`, `Form`, `Input`, `Label`, `Toast/Toaster`, `Icon` still compile and render with new tokens — no shape/density refactor

## 8. Docs

- [x] 8.1 Update `apps/orchestrator/AGENTS.md` Stack section: cite Geist Variable as primary type family
- [x] 8.2 Update `apps/orchestrator/AGENTS.md` Folder rules section: enumerate the closed `components/ui/` set (Avatar, Badge, Button, Card, Checkbox, Dialog, DropdownMenu, Form, Icon, Input, Label, Select, Separator, Skeleton, Switch, Tabs, Textarea, Toast, Toaster, Tooltip)
- [x] 8.3 Add a one-line note that ZAS teal (`#266b5e`) is the brand primary

## 9. Verification gate

- [x] 9.1 `moon run orchestrator:lint` — quote final summary line
- [x] 9.2 `moon run orchestrator:typecheck` — quote final summary line
- [x] 9.3 `moon run orchestrator:test` — quote final summary line; existing component tests for re-skinned primitives must pass
- [x] 9.4 `moon run orchestrator:build` — must complete with no `theme(...)` resolution errors; quote bundle size delta from output
- [x] 9.5 `moon run orchestrator:dev` → open `/login`; confirm teal primary button, Geist body, no FOUT; quote pass/fail
- [x] 9.6 `moon run orchestrator:test-e2e` if any e2e currently exists — quote final summary line
