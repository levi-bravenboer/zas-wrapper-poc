# Project Context

## Purpose

POC/MVP for **ZAS Telegeneeskunde** (procurement ref. 2026-0015). Reaktor Health consortium with Luscii Healthtech + NewWave Care.

**We are a care-pathway orchestration builder, not a clinician.** Hospitals author their own care pathways with our tool, composing operational workflow steps — send email, create HiX task, schedule an appointment, branch on a decision, milestone, embed a Luscii clinical care path as a sub-flow. We do not encode clinical reasoning. Clinical sub-flows live inside Luscii and are opaque to us.

**Pathway Designer** is the composer. **Pathway Orchestrator** runs the composed pathway. Long-term: embed in HiX with two-way task sync. PoC validates the Designer + Orchestrator spine end-to-end with mocked HiX / Luscii / auth — no live integrations, no patient touchpoint.

June 2026 demo target: composer + caregiver web app driven over hospital-authored demo content (Rugrevalidatie + one more), fully mocked backends. Demo content is an example of what a hospital could build with the tool — we don't own the clinical domain.

## Stakeholders

### Organizations

| Role | Who | Notes |
| --- | --- | --- |
| **Hospital** | ZAS Antwerpen | Commissioner; owns clinical pathways, caregivers, HiX admin. |
| **Consortium lead** | Reaktor Health | Builds Pathway Designer + Pathway Orchestrator. |
| **Clinical engine vendor** | Luscii Healthtech | Owns Luscii Builder, Luscii (monitoring app), Luscii Vitals (clinician viewer). |
| **IdP / auth partner** | NewWave Care | Owns Belgian IdP integration (eHealth / itsme® / eID / CSAM) for MVP. |
| **EHR vendor** | ChipSoft | Owns HiX + HiX Patient Portal. Embed + SMART-on-FHIR launch target for MVP. |

### PoC Users

| Role | Who | Notes |
| --- | --- | --- |
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

- Targets the Belgian clinical setting (ZAS Antwerpen) with regulated data flows: eHealth, itsme®, eID, CSAM auth.
- We are a **builder**: hospitals author their own pathway content with our tool. We do not own a clinical-pathway list. Demo content for the June 2026 demo is hospital-authored example content (Rugrevalidatie + one more), not pathways we encode.
- See `docs/research/` for deeper research notes (`agentic-research.md`, `hix-api-capabilities.md`, `luscii-care-pathways-research.md`).
- See `docs/wireframes/` and `docs/screenshots/` for the current orchestrator design exploration.

## Important Constraints

- **June 2026 demo deadline** (hard). Rugrevalidatie demo content is the must-have flow; one more scaffolded.
- **Never an MDR medical device.** Hard invariant across PoC / MVP / Product. If a proposal or implementation could push us into MDR territory (clinical decision logic, diagnostic output, automated dosing, anything labelled or used as a medical device), **stop and flag**. Log the case in `openspec/mdr-watchlist.md`, propose a non-MDR alternative shape, and only proceed once a decision is recorded. Holter (medical device) is out of PoC and MVP scope.
- **Architecture must not block future compliance**. PoC choices may stub HiX / Luscii / auth, but the structure has to absorb GDPR, FHIR R4, Belgian hosting / data residency, eID / itsme® / eHealth / CSAM auth at MVP without a rewrite.
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
- `openspec/mdr-watchlist.md` — log of cases that could push us toward MDR; decision per entry.
