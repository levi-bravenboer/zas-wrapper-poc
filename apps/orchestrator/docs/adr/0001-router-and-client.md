# ADR 0001 — Router, API client, forms, design system

Date: 2026-05-12
Status: Accepted
Source: `openspec/changes/orchestrator-app-shell/design.md` (D1–D4)

## D1. TanStack Router (file-based)

Use `@tanstack/react-router` with the Vite plugin emitting a route tree from `src/routes/`.

- Type-safe routes + search-param schemas + loader integration with TanStack Query.
- File-based discovery removes route-tree boilerplate.
- Single ecosystem (Router + Query + Form) reduces cognitive load.

Rejected: React Router v7 (no type-safe search params, no first-class Query integration), Next.js / Remix (kill the SPA model, force SSR runtime decisions).

## D2. openapi-typescript + openapi-fetch

Generate `lib/api/schema.d.ts` from `apps/backend`'s `/openapi.json` via `openapi-typescript`. Use `openapi-fetch` as the runtime client.

- Tiny runtime (~2 KB), full type safety on path / query / body / response.
- Schema drift breaks TS compile — that is the contract test.
- Each module defines its own Query hooks shaped how the module needs them.

Mitigation for first-run friction: commit the last-known-good `schema.d.ts` so a fresh clone compiles offline. `npm run typegen` refreshes it; CI runs typegen against the live backend and fails on drift.

Rejected: orval / kubb (pin to a regeneration step, auto-generated hooks fight module-specific shaping), hand-written client (loses contract guarantees).

## D3. Forms via TanStack Form + Zod

Use `@tanstack/react-form` with a `zodValidator` adapter from `lib/form/`.

- Same ecosystem as Router/Query.
- Field-level subscriptions avoid form-wide re-renders.
- Zod schemas double as parsers for the matching HTTP payloads.

Rejected: React Hook Form — battle-tested but its API encourages controlled fields + a separate resolver; TanStack Form's headless model maps better to clinical form complexity (dynamic question dependencies) we will hit later.

## D4. shadcn/ui + Tailwind v4, light theme only

Bootstrap shadcn primitives into `src/components/ui/`. Tailwind v4 via `@tailwindcss/vite`. Single light theme.

- Copy-paste primitives = full ownership.
- Tailwind v4 ditches PostCSS config.
- Light-only halves the design-review surface.
- Token system (`src/styles/tokens.css`) is designed so a dark theme is a token + class-toggle change later, not a redesign.

## Consequences

- `routes/**` default-exports are an ESLint exception, scoped via `import/no-default-export` overrides.
- Module isolation enforced by `eslint-plugin-import` `no-restricted-paths` — modules cannot import sibling modules; promote to `lib/`, `components/`, or `hooks/`.
- No barrel `index.ts` files. Deep imports only.
- `VITE_API_MODE=mock|live` switches between MSW handlers and the real backend.
