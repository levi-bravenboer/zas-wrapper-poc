## Context

The orchestrator today renders clinical pages exclusively as a standalone web app: each page lives under `routes/_auth/`, mounts inside the menu+sidebar `AppLayout`, and pulls data from the orchestrator backend via the `api` client. The proposal envisions the same pages running in two additional **surfaces**:

- **smart**: a standalone SMART-on-FHIR launch (browser tab opened from an EPD's app catalog) — keeps the menu chrome but swaps the data source to FHIR.
- **embed**: an iframe embed inside HiX EPD — drops the menu chrome entirely and runs on FHIR data, with iframe-specific constraints (CSP `frame-ancestors`, no localStorage tokens, `postMessage` host protocol, memory history).

The infrastructure that already exists is a useful base:

- TanStack Router with file-based routes and a typed router context (`routing` spec).
- One `AppLayout` + provider tree composed once (`app-shell` spec).
- A stub `/launch` route with `useLaunchContext` and a reserved `exchangeAuthCode` signature (`smart-launch-stub` spec).
- Recent renaming of section routes to English identifiers (`/tasks`, `/pathways`, `/patients`, `/settings`).

Stakeholders:

- Clinical product owners: want fast time-to-embed for new views.
- HiX integration vendor: needs a stable iframe contract (URL, CSP, postMessage protocol).
- Engineering: needs page code to stay surface-agnostic so we are not maintaining N copies.
- AI / agent contributors: need explicit rules so a new page never silently lands on the wrong surface.

Constraints:

- TS strict mode with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` (per `app-shell`).
- File-based routing — route tree generated, not committed (per `routing`).
- English identifiers in code; Dutch only in user-facing i18n values (per recent rule).
- HiX iframe context: third-party cookie blocking; CSP must be set by hosting layer.

## Goals / Non-Goals

**Goals:**

- A single declarative spec (`defineFeature`) is the source of truth for which surfaces a clinical page targets, which adapters it uses, and which SMART scopes it needs.
- Page components are surface-agnostic: they consume a typed port and never import a layout, an API client, or a FHIR client directly.
- Adding a new feature is at most: run a generator, fill in two adapters (or one if the feature is app-only), answer the surface question, commit.
- The iframe-embed contract for HiX is captured once and reused for every embeddable feature.
- Agentic contributors are forced to ask "which surface?" before they touch any code; this is enforced by both a project-local skill and a commit-time check.

**Non-Goals:**

- Building a full SMART backend. The orchestrator continues to be the standalone app's source of truth; FHIR is consumed read-mostly through `fhirclient`.
- Supporting a non-HiX EPD. The contract is shaped around HiX but should not be HiX-specific in its abstractions; bespoke vendor adapters (e.g. Epic, ChipSoft other modules) are out of scope here.
- Server-side rendering of embed surfaces.
- Migrating the orchestrator's auth from session cookies to FHIR identities.

## Decisions

### Decision: Surface = (data source × shell), declared per feature

We model a **surface** as the cartesian product of a data source (`orchestrator` | `fhir`) and a shell (`menu` | `bare`). Three surfaces are materialized:

| Surface | Data         | Shell | Base path | Use case                              |
| ------- | ------------ | ----- | --------- | ------------------------------------- |
| `app`   | orchestrator | menu  | `/`       | Standalone web app, own session       |
| `smart` | fhir         | menu  | `/s`      | Standalone SMART launch in browser    |
| `embed` | fhir         | bare  | `/embed`  | HiX iframe                            |

A feature declares which surfaces it supports as a literal tuple in `defineFeature`. The TS types ensure that declaring `'app'` requires an `orchestrator` adapter and declaring `'smart'`/`'embed'` requires a `fhir` adapter.

**Alternatives considered:**

- Two independent axes (`data` and `shell`) the contributor combines themselves at the route level. Rejected: invites 4 combinations even though only 3 are useful, and makes the registry hard to query ("which features are embeddable?").
- A single boolean `embeddable`. Rejected: collapses the distinction between "FHIR with menu" and "FHIR without menu", which we do need (standalone SMART tab is a real surface for QA and demo).

### Decision: Feature registry is module-import side-effect, read once at boot

`defineFeature(spec)` mutates a module-scoped `Map<string, FeatureSpec>` and returns the spec. Features are registered by importing `modules/<id>/index.ts`, which a single `modules/index.ts` barrel re-exports. `main.tsx` imports the barrel before constructing the router. The registry is then read to:

- Build the sidebar nav (filtered to features that include the current surface).
- Drive the route stub generator (or, in dev, the Vite codegen plugin).
- Build the SMART app manifest (union of scopes across embeddable features).

**Alternatives considered:**

- A YAML/JSON registry file. Rejected: loses type narrowing and forces a parallel definition site for the page component.
- Decorator-style API (`@feature(...)`). Rejected: TS class decorators are still ergonomically rough and the spec is naturally a value, not a class.

### Decision: Data port abstraction with per-surface adapters

Each feature defines a typed `Port<T>` (e.g. `TasksPort = { list, complete }`). Adapters implement that port against orchestrator and FHIR:

```ts
adapters: {
  orchestrator: ({ api }) => orchestratorTasksPort(api),
  fhir:         ({ client, ctx }) => fhirTasksPort(client, ctx),
}
```

The page consumes the port via `useTasksPort()` returned from `createPort`. It never sees the FHIR `Task` resource or the orchestrator DTO. **PoC scope:** FHIR adapters return static stub rows so the surface plumbing can be demonstrated end-to-end inside HiX without a real EPD wired up. Real schema validation (`zod`), `mapFhirTask` helpers, and `client.request` calls are deferred to a follow-on FHIR-integration change.

**Alternatives considered:**

- A single client object passed via context with surface branches inside the page (`if (surface === 'embed') ...`). Rejected: turns the page into a switch over surface, which is what we are trying to avoid.
- One large generic `FhirClient` injected directly. Rejected: leaks FHIR shape into pages and re-implements mapping per call site.

### Decision: Three layout shells, providers shared

`AppShell`, `SmartShell`, `EmbedShell` each compose a thin tree:

- `AppShell` = `<SurfaceProvider surface={SURFACES.app}><Sidebar /> {children}</SurfaceProvider>` and supplies the orchestrator data source.
- `SmartShell` = `<SurfaceProvider surface={SURFACES.smart}><SmartProvider><Sidebar /> {children}</SmartProvider>`.
- `EmbedShell` = `<SurfaceProvider surface={SURFACES.embed}><SmartProvider> {children}</SmartProvider>` plus iframe contract setup (CSP meta, `postMessage` host bridge, no devtools, memory router fallback).

The root provider tree (`QueryClientProvider`, `I18nextProvider`, error boundary, toaster) stays composed once in `src/app/providers.tsx`. Shells layer on top.

**Alternatives considered:**

- One mega-shell with a `surface` prop that branches internally. Rejected: hard to tree-shake (embed bundle ends up pulling the sidebar), and harder to read.
- Three separate React app bundles. Rejected: too much duplication for the current size; revisit when the embed bundle gets large.

### Decision: Route files generated from the registry, file-route prefix per surface

For each `defineFeature({ id, path, surfaces })`, the build emits route stubs at:

- `routes/_auth/<id>.tsx`   when `surfaces.includes('app')`
- `routes/_smart/<id>.tsx`  when `surfaces.includes('smart')`
- `routes/_embed/<id>.tsx`  when `surfaces.includes('embed')`

Each stub is a single line that calls `renderFeature(spec)`. We start with **committed stubs written by the generator** (low magic, reviewable) and only adopt a Vite codegen plugin once stub maintenance becomes painful.

**Alternatives considered:**

- One SPA with multiple `createRouter({ basepath })` instances. Rejected: TanStack Router file routes don't compose well across multiple routers in a single SPA.
- Single set of routes with the shell chosen at runtime by query param. Rejected: URLs are how HiX configures embed locations — they must be stable and surface-explicit.

### Decision: Real SMART launch flow, surface dispatched from launch state

`/launch` consumes `iss`, `launch`, plus a non-SMART `surface=smart|embed` param the EPD includes (HiX configuration). It performs PKCE + token exchange against `fhirclient`, persists the SMART context (in memory; `sessionStorage` only for the PKCE handshake), and redirects to `${SURFACES[surface].basePath}${returnPath}`.

`useLaunchContext()` comes from `platform/smart/` and exposes `{ iss, launch, surface, returnPath, client, token, ctx } | null`. The `SmartProvider` reads the same launch store and throws `SmartTokenMissingError` when no token is present; the route boundary translates that into a re-launch redirect. **PoC scope:** the FHIR query/mutation/pagination/validation helpers originally planned alongside `SmartProvider` are deferred — see `specs/fhir-client/spec.md` and the PoC rationale in the proposal.

The current `smart-launch-stub` `exchangeAuthCode` stub becomes the real implementation; `useLaunchContext` extends to expose `{ client, ctx, token }`.

**Alternatives considered:**

- Two launch routes (`/launch/smart`, `/launch/embed`). Acceptable fallback, but a single `/launch` route with a `surface` query param matches the typical EPD single-URL config pattern better.
- Writing our own OAuth + PKCE. Rejected: `fhirclient` is the de facto SMART JS library and supports all the bits we need.

### Decision: iframe contract owned by `embed-iframe-contract`

Embed-specific concerns live in one capability:

- CSP must set `frame-ancestors <hix-origin>` and omit `X-Frame-Options: DENY`.
- Tokens in memory; PKCE state in `sessionStorage` (scoped + nonce'd) only for the round-trip.
- `postMessage` host protocol with typed messages (`ready`, `resize`, `navigate`, `close`, `error`). Origin verification on every inbound message.
- `createMemoryHistory` fallback if the host swallows URL changes.
- Separate Vite chunk (`manualChunks: { embed: [...] }`); no router devtools or React Query devtools in embed.

### Decision: Feature generator is a TS script run via `pnpm gen:feature`

`apps/orchestrator/scripts/gen-feature.ts` (executed via `tsx`) prompts for or accepts:

- `id` (kebab-case)
- `path` (default `/<id>`)
- `surfaces` (subset of `app`/`smart`/`embed`)
- `fhir-scopes` (when any FHIR surface is selected)
- `requires` (`patient` / `encounter` / `user` context)

It writes the module skeleton, registers the feature in `modules/index.ts`, adds a `nav.<id>` i18n key (English keys, Dutch values left as TODO), and writes the route stub files matching declared surfaces. Lint must pass on the generated output without further edits.

### Decision: Agent guardrails layered

Three layers, each independent:

1. **Project rules** (`AGENTS.md` + `CLAUDE.md`): mandatory `## Feature surface gating` section instructing the agent to ask which surfaces before any feature work.
2. **Project skill** (`.claude/skills/new-feature/`): higher-precedence than prose, with a strict checklist (ask surfaces → ask scopes → run generator → verify).
3. **Commit-time hook** (`.claude/hooks/check-feature-surfaces.sh`): greps new `defineFeature(` calls in the diff and fails the commit when `surfaces:` is missing.

The skill is the primary enforcement; the hook is a last-line-of-defense check.

### Decision: Memory of the rule

A `feedback` memory ("ask surfaces before creating a feature page") is saved in `~/.claude/projects/.../memory/`. The rule lives in both the repo (for any agent / contributor) and the user memory (for Claude-specific sessions).

## Risks / Trade-offs

- [Registry import-order bug — features registered after router build are invisible] → enforce in `main.tsx` that `import '@/modules'` runs before `createRouter`, and add a startup assert that `getFeatures().length > 0`.
- [Type narrowing on `defineFeature` becomes hard to read] → keep the public type alias simple (`FeatureSpec<S extends Surface>`); document the inference rules in a short README in `platform/embed/`.
- [HiX iframe CSP varies by tenant] → make the `frame-ancestors` value an env var resolved at build/serve time; embed bundle hosting layer (e.g. Vercel headers / nginx) owns it, not the React app.
- [`fhirclient` types are loose] → wrap every FHIR response with a `zod` schema in the adapter; treat the unwrapped result as the source of truth.
- [Standalone SMART surface (`smart`) is half-used in production] → keep it cheap; it costs us one shell and zero adapters extra (reuses FHIR adapter from `embed`). If we don't ship it externally, it still doubles as our dev / QA harness for FHIR features.
- [Codegen plugin vs committed stubs] → start with committed stubs to stay debuggable; revisit if the count grows past ~20 features.
- [Agent skill drift — a future agent ignores the rule] → triple coverage (rules + skill + commit hook). The hook is the only one that fails CI.
- [Tokens in memory are lost on iframe reload inside HiX] → accept; on 401 re-trigger the launch flow rather than restoring stale tokens. Document this as expected behavior.
- [`postMessage` schema drift between us and HiX] → ship the protocol as a versioned TS module (`platform/embed/host.ts`) and include a vendor compatibility note in `embed-iframe-contract` spec.

## Migration Plan

The change ships in five reviewable steps, each independently mergeable. Each step keeps the existing app working.

1. **Platform scaffold (no behavior change)**: Add `platform/surface/`, `platform/ports/`, `platform/embed/` with `SurfaceProvider`, `createPort`, and a placeholder `defineFeature` that asserts on call (no consumers yet). Provide a `renderFeature` helper but do not wire any route to it.
2. **Migrate one feature (`tasks`) end-to-end**: Move `routes/_auth/tasks.tsx` placeholder into `modules/tasks/` with port, orchestrator adapter, and `defineFeature({ surfaces: ['app'] })`. Replace the route with a one-line `renderFeature(tasksFeature)` stub. App behavior identical.
3. **Add SMART + embed surfaces (FHIR mock)**: Implement `SmartShell`, `EmbedShell`, and a stubbed `SmartProvider` that yields a hard-coded patient. Add `tasksFeature.surfaces = ['app','smart','embed']` and a stubbed FHIR adapter. Generator scaffolds routes for the new surfaces. `/embed/tasks` renders without sidebar.
4. **Real SMART launch + FHIR**: Replace stub with `fhirclient`-backed PKCE flow, real `SmartProvider`, and real `fhirTasksPort` mapping FHIR `Task`. Add `embed-iframe-contract` plumbing (CSP env var, `postMessage` host module, memory history fallback).
5. **Generator + agent rules**: Ship `pnpm gen:feature`, lint rules, commit hook, `AGENTS.md` / `CLAUDE.md` updates, and the `.claude/skills/new-feature/` skill. Migrate `pathways`, `patients`, `settings` placeholders into feature modules using the generator (no surface change for them — stay `['app']` until a clinical owner asks for embed).

**Rollback**: Each step is a separate PR. Rolling back any step does not require reverting earlier ones because each leaves the existing `_auth` routes working. The largest blast radius is step 2 (route file move) — if reverted, the placeholder page returns to its current shape.

## Resolved Questions

Resolved 2026-05-12 during PoC kickoff. PoC is internal-only (not in HiX yet), but every decision is made to be production-ready so external HiX integration later is a config flip, not a refactor.

- **`smart` surface scope (PoC → prod)**: Internal QA harness only for the PoC. Build the launch flow, manifest, and OAuth/PKCE plumbing to production quality; gate the public SMART manifest entries and EPD-vendor registration behind a config flag (e.g. `SMART_MANIFEST_PUBLIC`). No "dev-only" shortcuts in the launch handler — same code path will serve external launches once flipped on.
- **FHIR client library**: `fhirclient` + `@types/fhir`. Chosen for the lean (~50kb) embed bundle, reference-implementation SMART launch flow, and zero lock-in. Resource typing comes from the HL7-official `@types/fhir` package. Wrap the raw `fhirclient` query API behind a thin typed accessor in `apps/orchestrator/src/platform/fhir/` (e.g. `getPatient(id): Promise<fhir4.Patient>`) so feature code stays ergonomic and the library is swappable.
- **Embed `postMessage` host protocol**: Contract-first. Define and ship the canonical message schema now in `embed-iframe-contract` (`embed:ready`, `embed:resize`, `embed:navigate`, `embed:close`, `embed:error`), with an env-driven origin allowlist (`EMBED_HOST_ORIGIN`). Child always emits via `ResizeObserver` + `postMessage`, regardless of whether anyone listens. Provide a local `/embed-host` dev harness page that listens and auto-resizes the iframe — proves the loop end-to-end and doubles as the demo we hand HiX when integration begins. No polling-only fallback; we don't want to encourage inner-scroll workarounds that rot.
- **Feature-generator test scaffolding**: Auto-generate a per-surface unit test using a shared `renderFeature` test helper (fast, jsdom, mocks router/providers). Do NOT auto-generate per-feature Playwright specs. Maintain one framework-level Playwright suite that exercises the `/embed-host` harness and the SMART launch + callback flow once; that suite is owned by the platform, not regenerated per feature.
- **Embed CSP headers hosting**: Hosting target deferred (no production deployment yet). Treat the required headers (`Content-Security-Policy: frame-ancestors`, `Referrer-Policy: strict-origin`, `Permissions-Policy` denylist, origin allowlist from env var) as a deploy-target-agnostic contract documented in `embed-iframe-contract`. For local dev, wire them via a Vite dev-server middleware so `/embed-host` exercises real CSP. For PoC deployment when needed, use Vercel `vercel.json` `headers` (10 lines, throwaway). Production hosting choice (Vercel / nginx / edge function) decided later; only the config file changes, not app code.
