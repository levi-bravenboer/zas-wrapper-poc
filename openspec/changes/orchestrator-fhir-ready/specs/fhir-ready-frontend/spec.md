## ADDED Requirements

### Requirement: `@types/fhir` is the canonical FHIR TS namespace

The orchestrator SHALL use `@types/fhir` (DefinitelyTyped R4 namespace `fhir4`) as the canonical TypeScript representation of FHIR resources. No runtime FHIR library is added today. Re-exports SHALL go through `src/lib/fhir/types.ts` so feature modules import from a single seam.

#### Scenario: Module imports a Patient type

- **WHEN** a feature module needs a Patient type
- **THEN** it writes `import type { Patient } from '@/lib/fhir/types'`, not `import type { Patient } from 'fhir/r4'` and not a bespoke local interface

#### Scenario: Bespoke FHIR type rejected

- **WHEN** a PR adds `interface Patient { id: string; ... }` to a feature module
- **THEN** the change is rejected; the author is directed at `@/lib/fhir/types`

### Requirement: `lib/fhir/` is the FHIR seam

The orchestrator SHALL contain a `src/lib/fhir/` package with the following modules:

- `types.ts` — re-exports `fhir4.*` from `@types/fhir`.
- `references.ts` — parsing / formatting helpers for `"<Type>/<id>"` reference strings, plus a Zod schema.
- `codes.ts` — `IssueType` literal, `issueTypeOf(code)` splitting on first dot, `codeToI18nKey(code)` returning the i18n key.
- Existing SMART helpers stay where they are inside `lib/fhir/`.

#### Scenario: Reference parsed centrally

- **WHEN** a module needs to extract `{ type, id }` from `"Patient/abc-123"`
- **THEN** it calls `parseReference(value)` from `@/lib/fhir/references`, not a local regex

#### Scenario: i18n key resolved via codes module

- **WHEN** a toast needs the localised string for `code === "security.auth.invalid_credentials"`
- **THEN** it calls `codeToI18nKey(code)` from `@/lib/fhir/codes`, which returns `"errors.security.auth.invalid_credentials"`, and the i18next lookup resolves that to the Dutch translation

### Requirement: Module + query-key naming tied to FHIR resource types

Modules centred on one FHIR resource SHALL be named after the lowercased resource type (`modules/patient/`, `modules/observation/`, `modules/careplan/`). Modules not centred on a single FHIR resource keep orchestrator-domain names (`modules/auth/`, `modules/smart-launch/`, `modules/tasks/`).

Query-key factories for FHIR-centred modules SHALL emit keys of the shape `["fhir", "<ResourceType>", ...]` where `<ResourceType>` is the capitalised FHIR type string. Example: `patientKeys.detail("abc-123") -> ["fhir", "Patient", "abc-123"]`.

#### Scenario: Patient module follows naming

- **WHEN** a contributor creates a module to fetch and render a Patient
- **THEN** the module directory is `src/modules/patient/`, `api.ts` exports `patientKeys.detail(id) -> ["fhir", "Patient", id]`

#### Scenario: Non-FHIR module exempt

- **WHEN** a contributor creates a module for the pathway composer (cross-resource UX)
- **THEN** the module directory takes an orchestrator-domain name (e.g. `src/modules/pathway-composer/`); the rule does not apply

### Requirement: Bundle-compatible pagination shape

List hooks SHALL hold and return `Page<T> = { entries: T[]; total: number; nextCursor: string | null }`. The `nextCursor` value is opaque — modules SHALL NOT parse it. A `usePagedQuery` helper in `src/lib/query/pagination.ts` builds on `useInfiniteQuery` and exposes `{ entries, total, hasNext, loadNext, isLoading }`.

#### Scenario: Empty list

- **WHEN** a list hook returns no results
- **THEN** the consumer sees `{ entries: [], total: 0, hasNext: false }`

#### Scenario: Cursor advancement

- **WHEN** the consumer calls `loadNext()` with a non-null cursor
- **THEN** the hook fetches the next page and appends new entries; the cursor is passed back unchanged to the fetcher

### Requirement: Error-code → i18n toast pipeline

The HTTP client (`src/lib/api/client.ts`) SHALL register an openapi-fetch middleware that, on any non-2xx response with an `ErrorResponse`-shaped body, calls `codeToI18nKey(code)` and dispatches a `sonner` toast with the resolved string. Unknown codes fall through to `errors.unknown` and emit a dev-mode `console.warn`.

Per-call opt-out is available: callers SHALL be able to suppress the global toast (for forms that render the error inline) via an option recognised by the middleware.

#### Scenario: Known code surfaces localised toast

- **WHEN** the backend returns `{ code: "security.auth.invalid_credentials", message: "..." }`
- **THEN** a `sonner` toast appears with the Dutch translation registered under `errors.security.auth.invalid_credentials`

#### Scenario: Unknown code falls back

- **WHEN** the backend returns `{ code: "weird.new.code", message: "..." }`
- **THEN** a toast appears with the `errors.unknown` translation; dev console logs `"unknown ErrorResponse.code: weird.new.code"`

#### Scenario: Inline form error suppresses toast

- **WHEN** a login form call sets the suppress-toast option
- **THEN** the middleware does not dispatch a toast; the caller receives the parsed `ErrorResponse` and renders the error inline

### Requirement: Synthetic FHIR fixtures under `src/mocks/fhir/*`

MSW handlers and tests that need a FHIR resource SHALL import a typed fixture from `src/mocks/fhir/<resource>.ts`. Fixtures SHALL be typed via `fhir4.*` from `@/lib/fhir/types`, MUST contain obviously synthetic data, and MUST carry a top-of-file `// Synthetic — no real patient data.` banner.

#### Scenario: Patient fixture imported by MSW handler

- **WHEN** an MSW handler returns a Patient for a SMART launch context call
- **THEN** the handler imports `demoPatient` from `@/mocks/fhir/patient`; the value's type is `fhir4.Patient`

#### Scenario: Real-looking name rejected

- **WHEN** a PR adds a fixture named "Jan Janssens" with a Belgian-format RRN
- **THEN** the change is rejected; fixtures use obviously synthetic strings ("Demo Patient", fake IDs)

### Requirement: Documented "FHIR-Readiness Rules" in `apps/orchestrator/AGENTS.md`

`apps/orchestrator/AGENTS.md` SHALL contain a top-level "FHIR-Readiness Rules" section enumerating the conventions in this capability. The section mirrors the backend's section in `apps/backend/AGENTS.md` and is the canonical reference for reviewers asking "is this orchestrator code FHIR-ready or not?".

#### Scenario: Reviewer references the rules

- **WHEN** a reviewer flags a PR that inlines a Reference parser instead of importing from `@/lib/fhir/references`
- **THEN** the review comment links to `apps/orchestrator/AGENTS.md#fhir-readiness-rules`
