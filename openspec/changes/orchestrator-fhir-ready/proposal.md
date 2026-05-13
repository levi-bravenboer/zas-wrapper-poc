**Tier**: [mvp]

**Status**: dormant — out of current tier window (`[poc]`). Proposal is preserved for the MVP FHIR work but **must not be implemented now**. Tracked under `BL-026`. Promote by re-reading against `openspec/scope.md` when the `[mvp]` window opens.

## Why

The backend `backend-setup` change adopts `fhir.resources` (R4) as the canonical internal model, exposes thinner view-model DTOs to the orchestrator, namespaces error codes under FHIR `OperationOutcome.issue.code`, and ships a Bundle-compatible pagination shape. The orchestrator needs a small set of mirror-side conventions so that:

1. PoC UI stays simple — view-model DTOs render cleanly, no Bundle/Reference rendering today.
2. Tomorrow's `/fhir/*` raw-FHIR endpoints land without restructuring modules, query keys, or the HTTP client.
3. Reviewers reading both stacks see the same vocabulary on either side of the wire.

This change adds the FHIR-aware conventions to the orchestrator: a typed FHIR layer under `lib/fhir/`, a module/query-key naming convention tied to FHIR resource types, an error-code → i18n key mapper aligned with the backend vocabulary, and a Bundle-compatible pagination helper. It does **not** introduce a runtime FHIR client, FHIR rendering UI, or FHIRPath. It is a thin, type-only readiness layer.

## What Changes

- Adopt **`@types/fhir`** (DefinitelyTyped HL7 R4 types) as the canonical TypeScript representation of any FHIR concept. Types-only, zero runtime footprint. Used for: any code that handles a FHIR resource directly (today: SMART launch context; tomorrow: raw FHIR endpoints, FHIR-shaped fixtures), MSW handler shape contracts, ad-hoc Reference parsing.
- Expand **`lib/fhir/`** beyond today's SMART helpers:
  - `lib/fhir/types.ts` — re-export the `fhir4.*` namespace from `@types/fhir`.
  - `lib/fhir/references.ts` — `parseReference("Patient/abc-123") -> { type, id }`, `formatReference({ type, id })`, plus a Zod schema for the `"<Type>/<id>"` shape.
  - `lib/fhir/codes.ts` — `ErrorResponse.code` → i18n key map, mirroring the backend `<fhir-issue-type>.<domain>.<reason>` vocabulary. Falls back to `errors.unknown` when no key is registered.
- Adopt **module + query-key naming tied to FHIR resource types** where the module is centred on one: `modules/patient/`, `modules/observation/`, `modules/careplan/`. Non-clinical modules (`auth/`, `smart-launch/`, `tasks/`) keep their names.
- Adopt a **shared query-key convention**: `<resource>Keys.detail(id) -> ["fhir", "Patient", id]`, `<resource>Keys.list(filters) -> ["fhir", "Patient", "list", filters]`. Cache invalidation keys carry the FHIR resource type, so a future `/fhir/Patient/{id}` mutation can target the same cache slice.
- Adopt a **Bundle-compatible pagination shape** in hooks: `Page<T> = { entries: T[]; total: number; nextCursor: string | null }`. Add a thin helper `usePagedQuery` that holds the cursor in state and exposes `{ entries, total, hasNext, loadNext }`. Cursor is opaque.
- Adopt an **error-code → toast pipeline**: the HTTP client middleware reads `ErrorResponse.code`, looks up `errors.<code>` via i18next; `sonner` shows the resolved string. Unknown codes log a warning in dev and surface `errors.unknown` in production.
- Adopt a **synthetic FHIR fixture convention**: MSW handlers and tests that need a FHIR resource (today: SMART launch context Patient; tomorrow: more) use `@types/fhir` `fhir4.*` types to type the fixture, and live under `src/mocks/fhir/<resource>.ts`. No real-looking names, no real MRNs.
- Update **`apps/orchestrator/AGENTS.md`** with a new "FHIR-Readiness Rules" section mirroring the backend's.
- Update the **error-handling section** of `apps/orchestrator/AGENTS.md` to call out the OperationOutcome vocabulary on `ErrorResponse.code`.

## Capabilities

### New Capabilities

- `fhir-ready-frontend`: `@types/fhir` (R4) as canonical FHIR TS types, `lib/fhir/` package with `types`, `references`, `codes`, module + query-key naming tied to FHIR resources, Bundle-compatible pagination shape, error-code → i18n pipeline, synthetic FHIR fixture convention.

### Modified Capabilities

None — the orchestrator's existing app-shell capability stays as-is; this is purely additive plumbing under `lib/fhir/` and naming convention adoption.

## Impact

- **Code**: new `lib/fhir/references.ts`, `lib/fhir/codes.ts`; `lib/fhir/types.ts` grows from "SMART helpers" alone. `lib/api/client.ts` middleware reads `ErrorResponse.code` and surfaces toasts via the codes map. Existing modules (`auth/`, `smart-launch/`) get no behaviour change.
- **Dependencies added** (`apps/orchestrator/package.json`):
  - Dev / types: `@types/fhir` (DefinitelyTyped R4 namespace).
  - No runtime additions — no `fhirclient`, no `fhir-kit-client`, no FHIRPath today.
- **Explicitly out of scope** (separate later changes): a runtime FHIR client SDK, raw FHIR Bundle UI rendering, FHIRPath evaluation, FHIR-search URL builder, paged Bundle navigation in lists with more than one page.
- **Cross-stack**: the error-code i18n map is the visible coupling. When the backend introduces a new error code, the orchestrator adds the i18n key in the same PR or the toast falls through to `errors.unknown`. Lint helper (optional) flags codes used in code but missing from `locales/nl/errors.json`.
- **Docs**: `apps/orchestrator/AGENTS.md` gains "FHIR-Readiness Rules". `openspec/project.md` already mentions the cross-stack FHIR-ready posture (added in `backend-setup`).
