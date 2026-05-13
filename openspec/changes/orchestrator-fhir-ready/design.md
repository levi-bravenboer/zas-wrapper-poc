## Context

The backend's `backend-setup` change establishes FHIR-readiness as a property of the system, not just the backend: every clinical concept inside the backend is a `fhir.resources` (R4) type, view-model DTOs cross the wire today, and error codes are namespaced `<fhir-issue-type>.<domain>.<reason>`. Pagination follows `Page<T> = { entries, total, next_cursor }` so a future raw-FHIR Bundle response maps trivially via `Bundle.link[next]`.

The orchestrator already speaks typed HTTP via `openapi-fetch` + `openapi-typescript`, has a `lib/fhir/` corner for SMART helpers, and uses TanStack Query with a `createQueryKeys` factory. The cost of making the frontend FHIR-ready is small: a types-only `@types/fhir` dependency, three short modules under `lib/fhir/`, and naming conventions tied to FHIR resource types.

Constraints:

- **Still a PoC**. No runtime FHIR client. No FHIR rendering UI. No FHIRPath. Conventions and types only.
- **No real patient data** anywhere. Synthetic FHIR fixtures under `src/mocks/fhir/*` typed via `@types/fhir`.
- **No backend coupling that can't change**. The error-code i18n map is the visible cross-stack contract; it must degrade gracefully (`errors.unknown` fallback) when codes drift.
- **No churn on the existing app-shell**. Routes, providers, queryClient, the router — all unchanged.

## Goals / Non-Goals

**Goals:**

- Adopt `@types/fhir` (R4) as the canonical TS FHIR namespace, available wherever the frontend needs to handle a FHIR concept.
- Land `lib/fhir/{types,references,codes}.ts` as the FHIR seam on the orchestrator side, mirroring the backend's `app/fhir/`.
- Lock module + query-key naming to FHIR resource types where the module is centred on one.
- Standardise a Bundle-compatible pagination shape across hooks; expose `usePagedQuery` once the first paginated list lands.
- Wire `ErrorResponse.code → i18n key` mapping into the HTTP client middleware so toasts speak the right language for the right error.
- Document the rules in `apps/orchestrator/AGENTS.md` so reviewers see one canonical "FHIR-Readiness Rules" section per stack.

**Non-Goals:**

- A runtime FHIR client (`fhirclient`, `fhir-kit-client`). Defer until a clinical screen needs one.
- Raw FHIR Bundle UI rendering, generic FHIR table component, FHIRPath. Same — defer.
- Auto-generating the error-code i18n key list from the backend's `app/fhir/codes.py`. Manual mirroring for now; revisit when the list exceeds ~30 codes.
- Switching the wire format the orchestrator consumes — it still gets view-model DTOs from non-`/fhir/*` endpoints. The future `/fhir/*` routes are typed via the same `openapi-fetch` codegen when they land.

## Decisions

### D1. `@types/fhir` over a runtime FHIR library

**Choice:** Add `@types/fhir` (DefinitelyTyped, R4 namespace `fhir4`) as a dev/types dependency. Do not add a runtime FHIR client today.

**Why:** Types-only addition keeps the bundle untouched. Anywhere the frontend handles a FHIR resource (SMART launch `Patient` context now; future raw-FHIR fixtures, future `/fhir/*` consumers), it can type the shape correctly. A runtime client is unnecessary while the backend keeps doing the heavy lifting (mapping FHIR → view-model DTOs server-side).

**Alternatives considered:**

- *`fhirclient` (SMART JS).* Considered. SMART launch flow is already implemented without it. Adopt when a real launch-context fetch needs the helpers; today the manual call is small.
- *`@medplum/fhirtypes`.* Considered. Equivalent type-coverage to `@types/fhir`; `@types/fhir` is closer to a "default for FHIR R4 types in TS" choice in the ecosystem. Either is fine — pick one and stay.
- *Generate FHIR types from the backend OpenAPI.* Rejected — backend doesn't emit raw FHIR today, so the OpenAPI lacks FHIR types. When `/fhir/*` endpoints land, those types come through codegen automatically and `@types/fhir` becomes a complementary general-purpose namespace.

### D2. `lib/fhir/` is the seam, mirror to backend's `app/fhir/`

**Choice:** Expand the existing `lib/fhir/` package with three modules: `types.ts` (re-exports `fhir4.*`), `references.ts` (parse/format `<Type>/<id>`), `codes.ts` (error-code → i18n key map). SMART helpers stay where they are inside `lib/fhir/`.

**Why:** Mirrors `app/fhir/` on the backend so reviewers find the same vocabulary on both sides. Co-locates FHIR-aware utilities so feature modules import from `@/lib/fhir/*` and never inline a Reference parser or hard-code an error key.

**Alternatives considered:**

- *Spread the helpers across feature modules.* Rejected — guarantees drift; one PR adds `parseReference` in `modules/patient`, another reinvents it in `modules/observation`.
- *Put references + codes under `lib/utils/`.* Rejected — these are FHIR-specific; the name should say so.

### D3. Modules and query keys named after FHIR resource types

**Choice:** Where a module is centred on a FHIR resource, name it after the resource (lowercase): `modules/patient/`, `modules/observation/`, `modules/careplan/`. Non-clinical modules keep their names (`auth/`, `smart-launch/`, `tasks/`). Query-key factories follow the shape `<resource>Keys.detail(id) -> ["fhir", "Patient", id]`.

**Why:** Vocabulary alignment. A `modules/patient/` directory whose `keys.ts` exports `["fhir", "Patient", id]` makes it obvious which backend resource the module is the orchestrator-side view of. Cache invalidation in a future `/fhir/Patient/{id}` mutation can target the exact slice by FHIR resource type without renaming keys.

**Alternatives considered:**

- *Match orchestrator-domain naming instead (e.g. `modules/pathway-composer/`).* Acceptable for cross-resource UX modules — those keep their orchestrator-domain names. The convention applies only when one FHIR resource dominates a module.
- *Use lowercase `"patient"` in query keys, not capitalised `"Patient"`.* Rejected — capitalised matches FHIR resource type strings exactly and avoids one more "is it the URL-style or the type-string?" decision.

### D4. Bundle-compatible pagination shape from day one

**Choice:** Hooks that return lists hold `{ entries, total, nextCursor }`. A small helper `usePagedQuery` in `lib/query/usePagedQuery.ts` keeps cursor state in `useReducer` and exposes `{ entries, total, hasNext, loadNext, isLoading }`. The cursor is opaque to the consumer.

**Why:** The view-model DTO shape today carries `next_cursor`. Once the backend grows a list endpoint, the orchestrator helper exists. When `/fhir/*` lands later, the cursor opaque-ness means the same hook consumes raw FHIR `Bundle.link[next].url` without code changes.

**Alternatives considered:**

- *`useInfiniteQuery` directly.* Acceptable — the helper is a thin wrapper that picks the right `getNextPageParam` from `nextCursor`. Build on top of it; do not replace it.
- *Defer the helper until needed.* Rejected — three list hooks reinventing the cursor handling is the alternative. Cheap to land once.

### D5. Error-code i18n mapping is manual, mirrors backend vocabulary

**Choice:** `lib/fhir/codes.ts` exports `codeToI18nKey(code: string) -> string`, returning `errors.<code>` when registered in `lib/i18n/locales/nl/errors.json` and `errors.unknown` otherwise. The HTTP client middleware calls this on every non-2xx response.

**Why:** The codes are stable. Adding 5–30 namespaced keys in `nl/errors.json` is no real maintenance burden. Auto-generating from the backend would couple build steps for very little gain at PoC scale.

**Alternatives considered:**

- *Codegen the keys from `app/fhir/codes.py`.* Rejected for now — premature; revisit at the 30-code mark.
- *Free-form `message` strings on the wire, no codes.* Rejected — kills i18n and ties the orchestrator to the backend's English copy.

### D6. Synthetic FHIR fixtures live under `src/mocks/fhir/*`, typed via `@types/fhir`

**Choice:** Any MSW handler or test that needs a FHIR resource imports a fixture from `src/mocks/fhir/<resource>.ts`. Fixtures are typed `fhir4.Patient`, `fhir4.Observation`, etc. They contain obviously synthetic data — `"Demo Patient"`, fake MRNs.

**Why:** Mirrors the backend's `tests/fixtures/` discipline. Synthetic + typed prevents both PHI accidents and shape drift. Future MSW handlers for `/fhir/*` endpoints get realistic-shaped fixtures already typed correctly.

**Alternatives considered:**

- *Share fixtures with the backend via codegen.* Rejected for now — manual mirror is fine until both sides need the same 20 fixtures. Revisit then.

### D7. The error-code map is the only cross-stack coupling we add

**Choice:** Treat `ErrorResponse.code` strings as the contract. No other cross-stack codegen, no JSON-shared error catalog file.

**Why:** One coupling, well-understood, degrades gracefully (`errors.unknown` fallback). Anything more — generated keys, shared JSON enum — is build-system overhead that buys little until the catalog is large.

## Risks / Trade-offs

- **Codes can drift** between backend and frontend i18n keys. **Mitigation:** dev-mode `console.warn("unknown ErrorResponse.code: ...")` from `lib/fhir/codes.ts` surfaces drift loudly; reviewer checklist line in `apps/orchestrator/AGENTS.md`. Optional later: a lint helper that diffs backend code emission against the keys file.
- **`@types/fhir` R4 ≠ R5**. The backend pinned R4 in `backend-setup`. If HiX moves to R5, both packages flip together; the namespace change ripples through `lib/fhir/types.ts`. **Acceptable** — single point of change.
- **Naming convention pressure**. A module that *almost* matches a FHIR resource type (e.g. `modules/encounter/` that's actually about appointments) may force a clean-or-rename decision. **Mitigation:** the rule applies only when one FHIR resource dominates the module; ambiguous cases keep orchestrator-domain naming.
- **`usePagedQuery` becomes dead code** if no list endpoint ships in this change. **Acceptable** — the helper is ~30 lines, lands when the first list hook needs it. Defer the *helper* if no list hook lands in the same PR; keep the *shape* (`{ entries, total, nextCursor }`) as the rule from day one.

## Migration Plan

This change is additive to `apps/orchestrator/`. Sequencing:

1. **Add `@types/fhir`** to `devDependencies`; `pnpm install`. Confirm `tsc --noEmit` stays clean.
2. **Expand `lib/fhir/`**: add `types.ts`, `references.ts`, `codes.ts`. Add Vitest unit tests for the reference parser and the code-to-i18n mapper.
3. **Wire the error toast pipeline**: HTTP client middleware reads `ErrorResponse.code`, calls `codeToI18nKey`, dispatches a `sonner` toast. Existing toasts (if any) migrate to the same pipeline.
4. **Seed `nl/errors.json`** with the backend's known codes (`security.auth.invalid_credentials`, `not-found.fhir.patient`, `invalid.validation.body`, `transient.luscii.unavailable`, plus `unknown`).
5. **Document conventions** in `apps/orchestrator/AGENTS.md` (new "FHIR-Readiness Rules" section).
6. **Optional**: build `usePagedQuery` in the same PR if a list hook is incoming; otherwise wait for the first consumer.

Each step is one commit (or two when tests grow). Commits follow the global rules: lowercase after colon, present tense, ≤72 chars, no AI attribution.

## Open Questions

- **Capitalised vs lowercase FHIR resource in query keys** (`"Patient"` vs `"patient"`). Default to capitalised (matches FHIR type strings). Reversible if it grates in practice.
- **Auto-generating the error-code i18n key list**. Decide at the 30-code mark.
- **`fhir4` vs a custom namespace re-export name**. Default to re-exporting `fhir4` as-is (`import type { Patient } from '@/lib/fhir/types'`). Revisit if R5 lands.
