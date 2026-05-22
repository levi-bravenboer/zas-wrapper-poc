---
name: new-feature
description: Use when the user asks to add a new clinical view / page / module to the orchestrator. Enforces surface-first decision before any code, runs `pnpm gen:feature`, then verifies the scaffold builds. Skip for admin pages under `/_auth/admin/*`, `/_auth/settings`, or `/_auth/pathways/*` — those are app-only by intent and bypass the generator.
---

# new-feature

Before writing a single line of code for a new orchestrator page, follow this workflow.

## Step 0 — opt-out check

Look at the path the user wants. If it matches any of:

- `/_auth/admin/*`
- `/_auth/settings`
- `/_auth/pathways/*`
- (other entries in `openspec/changes/multi-surface-feature-framework/page-surface-catalogue.md` or its archived path → "Admin opt-out" section)

then **stop this skill**. Hand-write the route under `routes/_auth/` without `defineFeature`. Prepend `// surface-opt-out: app-only` so scanners recognise the exception. Do not ask the surface question.

## Step 1 — consult the catalogue

Read `openspec/changes/multi-surface-feature-framework/page-surface-catalogue.md` (or its archived path under `openspec/changes/archive/`). If the page is already listed, its surfaces are pre-decided — skip to Step 3.

## Step 2 — ask the surface question

If the page is not in the catalogue, ask the user verbatim:

> Which surfaces should `<id>` ship on? Options: `app`, `smart`, `embed`, or a combination. Default is `app` only.

Do not guess from context. Wait for a clear answer.

If any FHIR surface (`smart` or `embed`) is chosen, also ask:

> Which FHIR scopes does `<id>` need (e.g. `patient/Observation.read`), and which context does it require (`patient`, `encounter`, `user`)?

## Step 3 — run the generator

Invoke:

```bash
pnpm gen:feature <id> \
  --surfaces <list> \
  --fhir-scopes "<scope1>,<scope2>" \
  --requires <ctx1>,<ctx2> \
  --title-nl "<dutch label>"
```

If only `app` is selected, drop `--fhir-scopes` and `--requires` — they're not required.

## Step 4 — verify

```bash
moon run orchestrator:typecheck
moon run orchestrator:lint
moon run orchestrator:test
```

Quote the result before claiming the scaffold is done.

## What the generator produces

- `src/modules/<id>/` — `index.ts` (`defineFeature` call), `<Pascal>Page.tsx`, `ports.ts`, `types.ts`, `adapters/` (per surface), `__tests__/`, `schemas.ts` (if FHIR).
- Route shims: `routes/_auth/<id>.tsx`, `routes/s/<id>.tsx`, `routes/embed/<id>.tsx` (only for declared surfaces).
- `modules/index.ts` — appends export in alphabetical order.
- `lib/i18n/locales/nl/nav.json` — adds the new key.
- Regenerates `routeTree.gen.ts` via `tsr generate`.

Generated files are placeholders. The next conversation step is implementing the real page UI, port signature, and adapters.
