# feature-generator Specification

## Purpose
TBD - created by archiving change multi-surface-feature-framework. Update Purpose after archive.
## Requirements
### Requirement: pnpm gen:feature scaffolds a feature module

The orchestrator SHALL provide a `pnpm gen:feature` script (`apps/orchestrator/scripts/gen-feature.ts`, run via `tsx`) that scaffolds a feature module from a single command. The script MUST accept either CLI flags or interactive prompts for:

- `id` (kebab-case, required)
- `path` (default `/<id>`)
- `surfaces` (CSV subset of `app,smart,embed`, required)
- `fhir-scopes` (CSV string, required when any FHIR surface is selected)
- `requires` (CSV subset of `patient,encounter,user`, required when any FHIR surface is selected)
- `title-nl` (Dutch label for `nav.<id>` value)

#### Scenario: CLI invocation creates module

- **WHEN** a contributor runs `pnpm gen:feature observations --surfaces app,embed --fhir-scopes "patient/Observation.read" --requires patient --title-nl "Observaties"`
- **THEN** the script exits with code 0 and creates the files listed below

#### Scenario: Missing required input rejected

- **WHEN** the contributor runs `pnpm gen:feature observations` with no `--surfaces` flag and the shell is non-interactive
- **THEN** the script exits non-zero with `Error: --surfaces is required`

### Requirement: Generated file set matches declared surfaces

For a feature declared with `surfaces = S`, the script SHALL produce:

- `apps/orchestrator/src/modules/<id>/index.ts` (calls `defineFeature`)
- `apps/orchestrator/src/modules/<id>/<Pascal>Page.tsx`
- `apps/orchestrator/src/modules/<id>/ports.ts`
- `apps/orchestrator/src/modules/<id>/types.ts`
- `apps/orchestrator/src/modules/<id>/adapters/orchestrator.ts` iff `app ∈ S`
- `apps/orchestrator/src/modules/<id>/adapters/fhir.ts` iff `smart ∈ S` or `embed ∈ S`
- `apps/orchestrator/src/modules/<id>/schemas.ts` iff any FHIR surface
- `apps/orchestrator/src/modules/<id>/__tests__/<Pascal>Page.test.tsx`
- `apps/orchestrator/src/routes/_auth/<id>.tsx` iff `app ∈ S`
- `apps/orchestrator/src/routes/_smart/<id>.tsx` iff `smart ∈ S`
- `apps/orchestrator/src/routes/_embed/<id>.tsx` iff `embed ∈ S`

The script MUST refuse to overwrite any existing file and MUST exit with a diff-style summary listing the planned writes when run with `--dry-run`.

#### Scenario: App-only feature produces minimal file set

- **WHEN** the script runs with `--surfaces app`
- **THEN** no FHIR adapter, no schema file, and no `_smart` / `_embed` route stubs are created

#### Scenario: Embed-only feature produces FHIR-only file set

- **WHEN** the script runs with `--surfaces embed`
- **THEN** no orchestrator adapter and no `_auth` route stub are created

#### Scenario: Existing module not overwritten

- **WHEN** `modules/tasks/index.ts` already exists and the script targets `tasks`
- **THEN** the script exits with `Error: feature 'tasks' already exists`

### Requirement: Generated output integrates with registry, i18n, nav

The script SHALL:

- Append the new module's export to `apps/orchestrator/src/modules/index.ts` (in alphabetical order).
- Add `"<id>": "<title-nl>"` to `apps/orchestrator/src/lib/i18n/locales/nl/nav.json`.
- If `app ∈ S`, append a `NavItem` to `apps/orchestrator/src/components/layout/navItems.ts` (default icon `Square`; contributor edits afterwards).

#### Scenario: Modules barrel updated

- **WHEN** the script completes
- **THEN** `modules/index.ts` contains an import line for the new module, ordered alphabetically by id

#### Scenario: nav.json gets the new key

- **WHEN** the script completes with `--title-nl "Observaties"`
- **THEN** `locales/nl/nav.json` contains `"observations": "Observaties"`

### Requirement: Generated output passes lint, typecheck, and tests

Running `pnpm tsc -b --noEmit`, `pnpm eslint .`, and `pnpm vitest run` immediately after `pnpm gen:feature` MUST exit zero with no manual edits required.

#### Scenario: Lint passes on fresh scaffold

- **WHEN** a fresh feature is generated and `pnpm eslint apps/orchestrator/src/modules/<id>` is run
- **THEN** the command exits zero with no errors and no warnings

#### Scenario: Tests pass on fresh scaffold

- **WHEN** a fresh feature is generated and `pnpm vitest run --reporter=verbose --grep <Pascal>Page` is run
- **THEN** the placeholder test passes (asserts the page renders the i18n title)

