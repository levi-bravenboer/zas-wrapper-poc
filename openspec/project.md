# Project Context

## Purpose

POC/MVP for **ZAS Telegeneeskunde** (procurement ref. 2026-0015). Reaktor Health consortium with Luscii Healthtech + NewWave Care.

Care-pathway operating layer for ZAS Antwerpen. **Pathway Designer** composes pathways. **Pathway Orchestrator** runs them with **Luscii clinical care paths** as sub-flows. Long-term: embed in HiX with two-way task sync. PoC validates the Designer + Orchestrator spine end-to-end with mocked HiX / Luscii / auth — no live integrations, no patient touchpoint.

June 2026 demo target: composer + caregiver web app over Holter / Rugrevalidatie pathways, fully mocked backends.

## Stakeholders

| Role | Who | Notes |
| --- | --- | --- |
| **Hospital** | ZAS Antwerpen | Commissioner; owns clinical pathways, caregivers, HiX admin. |
| **Consortium lead** | Reaktor Health | Builds Pathway Designer + Pathway Orchestrator. |
| **Clinical engine vendor** | Luscii Healthtech | Owns Luscii Builder, Luscii (monitoring app), Luscii Vitals (clinician viewer). |
| **IdP / auth partner** | NewWave Care | Owns Belgian IdP integration (eHealth / itsme® / eID / CSAM) for MVP. |
| **EHR vendor** | ChipSoft | Owns HiX + HiX Patient Portal. Embed + SMART-on-FHIR launch target for MVP. |
| **Caregiver (in-PoC)** | ZAS clinician | Primary PoC user. Logs in to Orchestrator, composes + runs pathways, completes tasks. |
| **External caregiver (post-PoC)** | Outside ZAS | MVP user. Logs in via eID; access scoped via ACL. |
| **Patient (NOT in PoC)** | — | Data only in PoC. Surface decisions deferred to MVP (`BL-014`). |
| **Admin (minimal in PoC)** | ZAS IT | Bootstrapped admin assigns caregiver role. Cross-tool admin deferred to MVP (`BL-010`). |

## Integrated Systems

| System | Owner | What it owns |
| --- | --- | --- |
| **HiX** | ChipSoft | EHR. Patient data, clinician inbox, task lists. SMART-on-FHIR launcher (MVP). Mocked in PoC. |
| **HiX Patient Portal** | ChipSoft | Patient-facing surface inside HiX. Patient view delivery channel candidate (MVP, `BL-014`). |
| **Luscii Builder** | Luscii Healthtech | Authoring tool for clinical care paths. MVP integration target. Stubbed JSON in PoC. |
| **Luscii (monitoring app)** | Luscii Healthtech | Patient-facing measurement + messaging app. MVP integration target. Stubbed in PoC. |
| **Luscii Vitals** | Luscii Healthtech | Clinician viewer for Luscii data. MVP embed target (`BL-008`). Not in PoC. |
| **eHealth / itsme® / eID / CSAM** | Belgian IdP stack | Real auth for caregivers + patients (MVP). PoC uses hard-coded user table. |
| **MCP host** | Reaktor (planned) | Agentic tooling surface. Post-MVP (`BL-007`). |

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
- **FHIR-ready seam, not FHIR-built**: PoC has no live FHIR (`openspec/scope.md` excludes HiX FHIR integration from PoC). The original "fhir.resources canonical internal model" bullet from `backend-setup` is deferred under `BL-025` — keep / narrow / revert decision pending. New work should preserve seams for the future MVP FHIR adapter without building FHIR-shaped code today.

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

- **June 2026 demo deadline** (hard). Holter + Rugrevalidatie are the must-have flows; others scaffolded only.
- **Architecture must not block future compliance**. PoC choices may stub HiX / Luscii / auth, but the structure has to absorb GDPR, FHIR R4, Belgian hosting / data residency, eID / itsme® / eHealth / CSAM auth, and MDR-relevant clinical pathways at MVP without a rewrite. Tracked as a project-wide invariant.
- **No real patient data — anywhere.** Synthetic fixtures only in code, screenshots, logs, demos. Project-wide invariant, not a PoC concession. CI lint candidate: `BL-034`.
- **REQ traceability**: Lastenboek REQ-IDs must map to modules + tests. Tracked under `docs/requirements/` (to be seeded).
- **Belgian hosting / data residency** for any productionised deployment.

## OpenSpec Layout

- `openspec/scope.md` — living PoC scope ledger (features, mocks, PoC → MVP delta). **Read before proposing or implementing.**
- `openspec/roadmap.md` — tier progression PoC → MVP → Product. Current-tier flag + exit criteria.
- `openspec/backlog.md` — parking lot for out-of-tier findings (`BL-NNN`).
- `openspec/changes/` — active proposals (each cites a tier).
- `openspec/changes/archive/` — shipped changes, frozen audit trail.
- `openspec/specs/` — current capabilities (post-archive).
- `openspec/AGENTS.md` — file map + scope discipline rules + usage examples.

## External Dependencies

- **HiX (ChipSoft)**: SMART-on-FHIR launch source-of-truth.
- **Luscii Healthtech**: patient engagement, clinical engine, messaging/video. Integration via Luscii API + embeds.
- **NewWave Care**: consortium partner, owns parts of the Belgian IdP integration.
