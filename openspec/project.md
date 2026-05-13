# Project Context

## Purpose

POC/MVP for **ZAS Telegeneeskunde** (procurement ref. 2026-0015). Reaktor Health consortium with Luscii Healthtech + NewWave Care.

June demo target: SMART-on-FHIR launch from HiX → pathway composer (Orchestrator) → Holter / Rugrevalidatie end-to-end.

## Tech Stack

- **Monorepo**: `apps/` for runtime services, `docs/` for research and design artifacts, `openspec/` for spec-driven change proposals.
- **Frontend — `apps/orchestrator`**: React 19 + Vite 8 + TypeScript 6. Clinician composer + SMART launch surface.
- **Backend — `apps/backend`**: FastAPI on Python, managed with `uv`. FHIR gateway, MCP server host, integration glue.
- **FHIR**: targeting R4 (HiX SMART-on-FHIR launch).
- **MCP**: planned via official `@modelcontextprotocol/sdk` once surface stabilises.
- **Hosting**: Belgian cloud required per REQ-NON; local Docker for POC.

Additional apps (e.g. patient app shell, additional services) will land in `apps/` as scoped.

## Project Conventions

### Code Style

- TypeScript strict mode on the frontend; idiomatic ESLint flat config.
- Python: type hints required, formatted with `ruff format`, linted with `ruff check`.
- Conventional commits, lowercase after colon, no period, present tense, max 72 chars on the subject.

### Architecture Patterns

- Spec-driven development through OpenSpec: every behavioural change starts as a proposal in `openspec/changes/`, gets reviewed, then archived once shipped.
- Frontend and backend communicate over typed HTTP contracts (OpenAPI generated from FastAPI).
- Integration with external systems (HiX, Luscii) is isolated behind backend adapters.
- **FHIR-ready by construction**: the backend uses `fhir.resources` (R4) as the canonical internal model for any clinical concept. PoC routes expose thinner view-model DTOs, derived from FHIR types by pure mappers under `app/fhir/mappers/`. The orchestrator mirrors this with FHIR-shaped reference helpers, OperationOutcome-aligned error codes, and `@types/fhir` for any FHIR-shaped code paths. Full FHIR endpoint compliance is additive (new routes, same mappers in reverse) — not a structural rewrite.

### Testing Strategy

- Frontend: Vitest for units, Playwright for E2E flows (SMART launch, composer happy paths).
- Backend: `pytest` with FastAPI TestClient; contract tests against FHIR fixtures.
- Each veto-grade REQ ships with at least one automated acceptance test.

### Git Workflow

- Trunk-based with short-lived feature branches.
- One concern per commit; one capability per change proposal.
- AI assistance is never mentioned in commit messages.

## Domain Context

- Targets the Belgian clinical setting (ZAS Antwerpen) with regulated data flows: eHealth, itsme®, eID, CSAM auth; MDR-relevant clinical pathways.
- Care pathways covered first (per strategy §5.1): Holter → Rugrevalidatie → Pneumologie → Oncologie → Blaaskanker.
- See `docs/research/` for deeper research notes (`agentic-research.md`, `hix-api-capabilities.md`, `luscii-care-pathways-research.md`).
- See `docs/wireframes/` and `docs/screenshots/` for the current orchestrator design exploration.

## Important Constraints

- **REQ traceability**: Lastenboek REQ-IDs must map to modules + tests. Tracked under `docs/requirements/` (to be seeded).
- **Belgian hosting / data residency** for any productionised deployment.
- **Demo deadline**: June. Holter + Rugrevalidatie are the must-have flows; others are scaffolded only.

## External Dependencies

- **HiX (ChipSoft)**: SMART-on-FHIR launch source-of-truth.
- **Luscii Healthtech**: patient engagement, clinical engine, messaging/video. Integration via Luscii API + embeds.
- **NewWave Care**: consortium partner, owns parts of the Belgian IdP integration.
