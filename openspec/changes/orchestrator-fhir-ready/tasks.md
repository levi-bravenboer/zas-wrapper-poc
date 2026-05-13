## 1. Dependency

- [ ] 1.1 Add `@types/fhir` to `apps/orchestrator/package.json` `devDependencies`; `pnpm install`
- [ ] 1.2 Confirm `moon run orchestrator:typecheck` stays clean after the install

## 2. `lib/fhir/` expansion

- [ ] 2.1 Create `src/lib/fhir/types.ts` re-exporting the `fhir4` namespace: `export type { fhir4 } from 'fhir/r4'` (or namespace re-export equivalent). Document that consumers import as `import type { Patient } from '@/lib/fhir/types'`
- [ ] 2.2 Create `src/lib/fhir/references.ts` with `parseReference(value: string) -> { type: string; id: string } | null`, `formatReference(ref: { type: string; id: string }) -> string`, and a Zod schema `ReferenceStringSchema` matching `/^[A-Z][A-Za-z]+\/[A-Za-z0-9-.]+$/`
- [ ] 2.3 Create `src/lib/fhir/codes.ts` with `IssueType = "not-found" | "invalid" | "security" | "forbidden" | "conflict" | "processing" | "transient" | "informational"`, `issueTypeOf(code: string) -> IssueType | null`, `codeToI18nKey(code: string) -> string` (returns `errors.<code>` when the key is registered, else `errors.unknown`)
- [ ] 2.4 Vitest: `src/lib/fhir/references.test.ts` covers parse/format round-trip, invalid input returning `null`, and Zod schema acceptance/rejection
- [ ] 2.5 Vitest: `src/lib/fhir/codes.test.ts` covers known codes mapping correctly, unknown codes falling back, `issueTypeOf` splits on first dot

## 3. i18n catalogue

- [ ] 3.1 Add `src/lib/i18n/locales/nl/errors.json` with keys for the backend's seed vocabulary: `security.auth.invalid_credentials`, `not-found.fhir.patient`, `invalid.validation.body`, `transient.luscii.unavailable`, `unknown`. Translations in Dutch
- [ ] 3.2 Register the `errors` namespace in `src/lib/i18n/bootstrap.ts`

## 4. HTTP client error pipeline

- [ ] 4.1 In `src/lib/api/client.ts`, add a `Middleware` (openapi-fetch) that runs on non-2xx responses: parse `ErrorResponse` via a Zod schema (`ErrorResponseSchema { code, message, details? }`), call `codeToI18nKey`, dispatch a `sonner` toast with the resolved string
- [ ] 4.2 Dev-mode `console.warn("unknown ErrorResponse.code:", code)` from `codes.ts` when the key falls through to `errors.unknown`
- [ ] 4.3 Existing inline error handling in `modules/auth/` (if any) migrates to rely on the middleware; module-specific surface (inline form error vs toast) is configurable per-call via an option
- [ ] 4.4 Component test: `modules/auth/__tests__/login_flow.test.tsx` asserts that a 401 from MSW with `code: "security.auth.invalid_credentials"` surfaces the localised Dutch toast text

## 5. Query-key convention

- [ ] 5.1 Document the convention in `apps/orchestrator/AGENTS.md` (handled in §7): `<resource>Keys.detail(id) -> ["fhir", "Patient", id]`, `<resource>Keys.list(filters) -> ["fhir", "Patient", "list", filters]`. Resource segment is the **capitalised FHIR type string**
- [ ] 5.2 Adopt the convention in any existing query key factories where the module is centred on a FHIR resource. The current orchestrator has `authKeys` and `smartLaunchKeys` — neither is FHIR-resource-centred, so no rename today. New FHIR-centred modules follow the rule from day one

## 6. Pagination shape

- [ ] 6.1 Define `type Page<T> = { entries: T[]; total: number; nextCursor: string | null }` in `src/lib/query/pagination.ts`
- [ ] 6.2 Add `usePagedQuery<T>(queryKey, fetcher: (cursor: string | null) => Promise<Page<T>>)` building on `useInfiniteQuery`, exposing `{ entries, total, hasNext, loadNext, isLoading }`. Only land in this PR if a consumer ships in the same change — otherwise document the type and defer the helper
- [ ] 6.3 Vitest for `usePagedQuery` (when shipped): covers empty page, single page, cursor advancement

## 7. Documentation

- [ ] 7.1 Add "FHIR-Readiness Rules" section to `apps/orchestrator/AGENTS.md` covering: `@types/fhir` as canonical, `lib/fhir/` layout, module + query-key naming, pagination shape, error-code pipeline, fixture conventions, reviewer checklist
- [ ] 7.2 Update the casing table in `apps/orchestrator/AGENTS.md` with `Backend error code` row → `<fhir-issue>.<domain>.<reason>` and a link to `lib/fhir/codes.ts`
- [ ] 7.3 Document MSW fixture convention `src/mocks/fhir/<resource>.ts` typed via `fhir4.*` in the testing section

## 8. Fixtures

- [ ] 8.1 Create `src/mocks/fhir/` directory; add `patient.ts` exporting a typed `fhir4.Patient` named `demoPatient` (synthetic data: `"Demo Patient"`, fake MRN, fake birthdate). Banner comment `// Synthetic — no real patient data.`
- [ ] 8.2 Update any SMART launch MSW handler that materialises a Patient to import from `src/mocks/fhir/patient.ts` instead of defining inline

## 9. Verification

- [ ] 9.1 `moon run orchestrator:lint` — clean
- [ ] 9.2 `moon run orchestrator:typecheck` — clean
- [ ] 9.3 `moon run orchestrator:test` — green (covers references, codes, error pipeline)
- [ ] 9.4 `moon run orchestrator:build` — green
- [ ] 9.5 Manual: start the dev server with `VITE_API_MODE=live` against the (`backend-setup`-built) backend; trigger a `/auth/login` with wrong credentials; observe the Dutch toast keyed off `security.auth.invalid_credentials`
- [ ] 9.6 `openspec change validate orchestrator-fhir-ready --strict` — passes
