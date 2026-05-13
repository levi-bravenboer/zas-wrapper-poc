## Why

The orchestrator needs to ship the same feature page across multiple runtime surfaces — the standalone web app (own session, orchestrator API), a standalone SMART-on-FHIR launch (own chrome but FHIR data), and an iframe embed inside HiX EPD (FHIR data, no chrome). Today each page is hard-wired to one surface (`_auth/*`, orchestrator API, sidebar layout). Adding a new view that should work in HiX requires duplicating page code, shells, and data wiring, which will not scale across the dozens of clinical views we plan to embed. We also have no guardrail to make sure a contributor (human or AI) declares which surfaces a new view supports — surface intent is the single most important early decision and must not be implicit.

## What Changes

- Introduce a declarative `defineFeature` registry in `apps/orchestrator/src/platform/` so each clinical view exposes one spec describing its supported surfaces (`app` | `smart` | `embed`), its data port, per-surface adapters, page component, and SMART scopes.
- Add a `Surface` model (`{ data: 'orchestrator' | 'fhir', shell: 'menu' | 'bare', basePath }`) and a `SurfaceProvider` so pages can branch on surface without coupling to a specific shell or data source.
- Add three layout shells under `platform/embed/`: `AppShell` (orchestrator + menu), `SmartShell` (FHIR + menu), `EmbedShell` (FHIR + bare, iframe-friendly).
- Add a typed data port abstraction (`createPort<T>()`) plus per-feature adapter pairs (`orchestratorAdapter`, `fhirAdapter`) so pages consume one port interface and never see FHIR resources or orchestrator DTOs directly.
- Replace today's hand-written route files for embeddable features with a registry-driven layout: feature opts into one or more of `_auth/`, `_smart/`, `_embed/` and the matching route stub is generated (Vite plugin + script).
- Add a SMART-on-FHIR launch flow (`/launch` + `/launch/callback`) that authorizes once and dispatches to `_smart` or `_embed` based on a launch-state `surface` field. The `SmartProvider` exposes the `fhirclient`-backed client + SMART context to subtree adapters. **Out of scope for the PoC:** FHIR-specific query/mutation helpers (`useFhirQuery`/`useFhirMutation`), pagination helpers (`fhirPager`), and resource-level zod validation — these are deferred to a follow-on FHIR-integration change once a real EPD wiring task is scheduled. Feature FHIR adapters return static stub data until then.
- Provide iframe-specific behavior on `_embed`: CSP `frame-ancestors`, token-in-memory (no localStorage), `postMessage` host protocol (`ready`, `resize`, `navigate`, `close`, `error`), memory history fallback, separate bundle entry without devtools.
- Ship a feature generator `pnpm gen:feature <id> --surfaces app,embed` that scaffolds the module folder, port, adapters, schemas, i18n keys, and registers the feature.
- Add lint guardrails (`no-restricted-imports` for `modules/**` ↔ `components/layout/**`, cross-feature isolation, registry-required fields) and a commit hook that fails when a new `defineFeature` call lacks a `surfaces` declaration.
- Add agent rules so any future Claude / agent session MUST ask the user which surfaces a new page targets before writing code: extend `CLAUDE.md` and `AGENTS.md`, add a project-local `.claude/skills/new-feature/` skill that gates feature creation behind a surface-selection prompt and the generator.
- **BREAKING** Tighten the `routing` capability: the `_auth` segment is no longer the only place clinical pages live, and the existing requirement that paths stay "lowercase Dutch" is replaced by an English-identifier rule with surface-based path prefixes (`/`, `/s`, `/embed`). Existing `/tasks`, `/pathways`, `/patients`, `/settings` paths stay valid.
- **BREAKING** Tighten `app-shell`: the single `AppLayout` is one of several shells; module code MUST NOT import layout components directly and MUST receive shell composition from the platform.

## Capabilities

### New Capabilities

- `surface-model`: Defines the runtime surface concept (data source × shell), the surface registry, the `SurfaceProvider`/`useSurface` API, and the per-surface base paths.
- `feature-registry`: Defines `defineFeature`, the typed feature spec, the runtime registry of features, and the rules linking declared `surfaces` to required adapters and SMART scopes.
- `surface-shells`: Defines the three layout shells (`AppShell`, `SmartShell`, `EmbedShell`), what each renders, and how each wires data sources, providers, and chrome.
- `data-ports`: Defines the port abstraction (`createPort`), the adapter contract, and the rule that pages may only consume the port (never raw FHIR or orchestrator clients).
- `fhir-client`: Defines the `fhirclient`-backed SMART client setup and the SMART context provider that exposes `{ client, ctx, token }` to subtree adapters. `useFhirQuery` / `useFhirMutation` / patient / encounter / user hooks and FHIR resource validation/pagination helpers are deferred to a follow-on FHIR-integration change.
- `embed-iframe-contract`: Defines the iframe behavior for HiX: CSP, token storage, memory history, `postMessage` host protocol, bundle isolation.
- `feature-generator`: Defines the `pnpm gen:feature` CLI: prompts, generated file set per surface combination, registry registration, i18n key injection.
- `agent-feature-rules`: Defines the agent guardrails that force surface selection before any feature work — `CLAUDE.md` / `AGENTS.md` sections, the `.claude/skills/new-feature/` skill, and the commit hook.

### Modified Capabilities

- `routing`: Section routes are no longer limited to `_auth/` and Dutch identifiers; the spec moves to surface-prefixed path segments (`/`, `/s`, `/embed`), enforces English file/route identifiers, and requires the route tree be generated from the feature registry.
- `app-shell`: The "one provider tree, one layout" rule is generalized — providers compose once at the root, but layout chrome is supplied by a surface shell selected per route segment. Modules MUST NOT import `components/layout/*` directly.
- `smart-launch-stub`: Replaced with a real launch flow: the stub's `exchangeAuthCode` becomes a working PKCE exchange, the placeholder redirect becomes a surface-aware dispatch to `_smart` or `_embed`, and `useLaunchContext` extends to expose the SMART client.

## Impact

- **Code**: New `apps/orchestrator/src/platform/` tree (`surface/`, `embed/`, `ports/`, `smart/`, `fhir/`). New `apps/orchestrator/scripts/gen-feature.ts`. Migration of existing `tasks`, `pathways`, `patients`, `settings` placeholder routes into `modules/<id>/` feature modules with `defineFeature` calls. Generated route stubs under `routes/_auth/`, `routes/_smart/`, `routes/_embed/`.
- **Dependencies**: Add `fhirclient` (or `@medplum/core`) for SMART client + PKCE; add `zod` schemas for FHIR resource validation in adapters (`zod` already present). Add a Vite plugin for route stub codegen (or commit stubs and skip the plugin).
- **Build / hosting**: Embed surface needs CSP headers (`frame-ancestors`) and no `X-Frame-Options: DENY`. Embed bundle should be split via `manualChunks` and may eventually have its own HTML entry. Existing dev/build commands unchanged.
- **Routing surface**: New paths `/s/*` and `/embed/*` join existing `/dashboard`, `/tasks`, `/pathways`, `/patients`, `/settings`. `/launch` and `/launch/callback` become real (not stubs).
- **Tests**: New `renderFeature(spec, { surface, port })` helper. Existing route/layout tests stay; new tests verify (a) feature appears in declared surfaces only, (b) `_embed` shell omits sidebar, (c) lint rule blocks `modules → components/layout` imports, (d) generator output compiles.
- **Agent workflow**: New skill at `.claude/skills/new-feature/` is consulted on intents like "add page" / "new view". `CLAUDE.md` and `AGENTS.md` get a "Feature surface gating" section. Optional pre-commit hook checks new `defineFeature` calls for the `surfaces` field.
- **Security**: SMART tokens stored in memory only; embed surface uses `frame-ancestors`-restricted CSP; `postMessage` handlers verify host origin; no orchestrator session cookies present in embed.
