## Why

**Tier**: `[poc]`

PoC now needs a patient-facing surface alongside the orchestrator. We pull the "patient app shape" decision (`BL-030`) and "patient view shape" channel question (`BL-014`) forward into PoC by committing to a **dedicated Expo SDK 54 mobile app** at `apps/digital-front-door` (iOS / Android / web targets). This change scaffolds the empty app only — no clinical features, no live integrations. Subsequent changes layer F-level patient features on top.

The scaffold needs to land first so:
- Subsequent feature changes (`F9` patient login, `F10` patient pathway view, etc., to be proposed separately) have a target tree.
- Moon's task graph + the agent permission allowlist learn the new app boundary before any code lands.
- pnpm + Expo SDK 54 monorepo compatibility (`node-linker=hoisted`) is proven against this repo's stack.

## What Changes

- **Re-tier patient surface from `[mvp]` to `[poc]`.** Update `openspec/scope.md`:
  - Remove **Patient surface** `[mvp]` from PoC Out-of-Scope.
  - Add `F9 Digital front door (shell)` to PoC In-Scope with a one-line acceptance criterion (app boots, lints, typechecks, runs on iOS / Android / web targets).
  - Update PoC → MVP Delta to reflect the new starting point.
- **Update `openspec/roadmap.md`** so the patient-surface MVP gate item reflects "shell shipped in PoC, feature delivery + delivery-channel decisions remain MVP work."
- **Update `openspec/backlog.md`**: mark `BL-014`, `BL-022`, `BL-030` notes as "shell promoted to PoC via `digital-front-door-setup` on 2026-06-02; feature shape + delivery-channel decisions remain MVP-tier."
- **Scaffold `apps/digital-front-door/`** via `pnpm create expo-app` against Expo SDK 54:
  - TypeScript template.
  - `expo-router` ~6 default routing.
  - `.npmrc` with `node-linker=hoisted` for Metro/pnpm compatibility.
  - Self-contained pnpm (own `pnpm-lock.yaml`), matches `apps/orchestrator` pattern; no root workspace introduced.
- **Wire moon tasks** in `apps/digital-front-door/moon.yml`:
  - `install`, `lint`, `typecheck`, `format`, `dev`, `build`.
  - Pre-approve them in `CLAUDE.md` "Pre-approved moon tasks" list and `AGENTS.md`.
- **Update `AGENTS.md`**: add `apps/digital-front-door` to the apps inventory; add a stub per-app `apps/digital-front-door/AGENTS.md` declaring stack (Expo SDK 56, React Native 0.85, React 19.2.3, Node 22.13, pnpm, expo-router 6) + locked conventions (NativeWind v4, `@rn-primitives` wrapping, modules folder shape, TanStack `queryOptions` factory, Jotai, kebab-case filenames, ESLint rule set, Prettier).
- **Consolidate `CLAUDE.md` → `AGENTS.md`.** Move all tool-agnostic content (pre-approved moon tasks per app, worktree-directory rule, feature-surface gating, behavioural reminders, moon-as-canonical-task-runner rule, pointers section) from root `CLAUDE.md` into root `AGENTS.md`. Reduce root `CLAUDE.md` to a thin pointer ("read `AGENTS.md` first") plus the truly Claude-harness-specific notes (slash commands at `.claude/commands/`, enforcement hooks at `.claude/settings.json`). No per-app `CLAUDE.md` files exist; every app uses `AGENTS.md`. Goal: any agent that respects the `AGENTS.md` convention (Codex, Cursor, others) works out of the box.
- **Backend: add `/mobile/*` route prefix + `GET /mobile/health` stub.** Convention for every future mobile-app endpoint. Mobile boot fires one connectivity check. OpenAPI regenerated.
- **MDR boundary**: scaffold contains **no clinical logic, no Luscii vitals embed, no measurement display, no decision support**. Any feature change layered on top MUST repeat the MDR check in its own proposal.

## Capabilities

### New Capabilities
- `digital-front-door`: the patient-facing mobile app shell — boot, routing, lint/typecheck/dev/build task graph, stack invariants (Expo SDK 54, RN 0.81, React 19.1, expo-router 6, pnpm). No features beyond shell.

### Modified Capabilities
<!-- None. Re-tier touches scope.md/roadmap.md/backlog.md which are not capability specs. -->

## Impact

- **New app tree**: `apps/digital-front-door/` (self-contained pnpm).
- **Moon**: new project + tasks; root moon graph picks it up automatically; CI matrix grows by one app.
- **Permission allowlist**: pre-approve `moon run digital-front-door:{install,lint,typecheck,format,dev,build}`.
- **Docs**: `AGENTS.md` apps inventory, `CLAUDE.md` moon task list, new per-app `apps/digital-front-door/AGENTS.md`.
- **Scope ledger**: `openspec/scope.md`, `openspec/roadmap.md`, `openspec/backlog.md`.
- **MDR**: scaffold is non-clinical → no `mdr-watchlist.md` entry. Future patient feature proposals MUST re-check.
- **Backend (minimal)**: introduce the `/mobile/*` route prefix convention and ship one stub endpoint — `GET /mobile/health` → `{"status": "ok"}` — so the mobile app can prove backend connectivity on boot. OpenAPI is regenerated via `/openapi-sync`. All future mobile-app endpoints live under `/mobile/*`. No new schemas, no migrations, no auth surface.
- **Out of scope for this change**: patient auth, patient pathway view, Luscii deep-link, push notifications, EAS build config, real device testing matrix — all separate changes.
