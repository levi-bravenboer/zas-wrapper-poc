## 1. Project context

- [x] 1.1 Expand `openspec/project.md` with: project idea (one paragraph), stakeholders (hospital, vendors, clinician, patient), integrated systems (HiX, Luscii) with one-line "what they own", hard constraints (June demo deadline + arch must not block future GDPR/FHIR/hosting compliance)
- [x] 1.2 Keep existing Tech Stack / Conventions / Testing sections; only edit where the new context contradicts them

## 2. Scope ledger

- [x] 2.1 Create `openspec/scope.md` with sections: Project Idea, PoC In-Scope (bulleted, each with one-line acceptance + feature ID `Fn`), PoC Out-of-Scope (explicit "no for now" list), PoC Mocks (table: mock → real thing for MVP), PoC → MVP Delta (table: feature | PoC state | MVP delta | MVP blocker)
- [x] 2.2 Tag every line with `[poc]`, `[mvp]`, or `[product]`
- [x] 2.3 Add a top-of-file "How to read this" block: who updates it, when, how it interacts with `changes/` and `backlog.md`

## 3. Backlog

- [x] 3.1 Create `openspec/backlog.md` with a top-of-file legend (entry format, tier values, "graduation" rule = backlog item becoming a real change, stable `BL-NNN` ID rule)
- [x] 3.2 Seed it with the carry-over findings: HiX live FHIR adapter, `/fhir/*` raw passthrough routes, `CapabilityStatement`, MCP server, full Luscii pathway mapping, `OperationOutcome` translation, `If-Match`/`ETag` versioning; plus RFP TBDs and process items
- [x] 3.3 Each seeded entry gets: title, tier, source (where it came from), one-paragraph note, stable `BL-NNN` ID

## 4. Agent documentation — file map

- [x] 4.1 Update root `AGENTS.md` with an "OpenSpec File Map" section listing every artifact under `openspec/` (project.md, scope.md, backlog.md, changes/, specs/, archive/, AGENTS.md) with one-line "what it is" + "when to read" + one usage example
- [x] 4.2 Add the file map to `openspec/AGENTS.md` (new) so the rules live next to the files they describe
- [x] 4.3 Cross-reference the file map from `apps/backend/AGENTS.md` and `apps/orchestrator/AGENTS.md` — short pointer, not a duplicate

## 5. Agent documentation — drift safety net

- [x] 5.1 In root `AGENTS.md`, add a "Scope Discipline" rule: every change proposal MUST cite its tier (`[poc]`, `[mvp]`, `[product]`) in `proposal.md`; out-of-tier work goes to `backlog.md`, not an active change folder; implementers re-read `scope.md` before starting tasks
- [x] 5.2 Update the existing openspec skill commands (`.claude/skills/openspec-propose`, `.claude/skills/openspec-apply-change`) docs to mention the tier check
- [x] 5.3 Add a one-line reminder to `apps/backend/AGENTS.md` and `apps/orchestrator/AGENTS.md`: "Before implementing any task, re-read `openspec/scope.md` to confirm in-tier."

## 6. Backend-setup re-evaluation (preparation only — not the work itself)

- [x] 6.1 List, in this change's notes, every artifact added by `backend-setup` section 12 (FHIR-ready domain layer) so the follow-up re-scoping change has a concrete checklist (tracked as `BL-025`)
- [x] 6.2 Do NOT revert anything in this change — that's the follow-up's job

### 6.1 — Section 12 artifact inventory (input for follow-up re-scope `BL-025`)

`backend-setup` section 12 = "FHIR-ready domain layer". The follow-up re-scoping change reviews each item against the new PoC scope and decides **keep / narrow / revert**. PoC scope says no FHIR in PoC → most of this is `[mvp]+` material.

**Runtime dependency added**

- `apps/backend/pyproject.toml` runtime dep: `fhir-resources>=8.0`

**New modules under `apps/backend/app/`**

- `app/fhir/__init__.py` — re-exports `codes`, `search`.
- `app/fhir/codes.py` — `IssueType` Literal + `code(issue_type, domain, reason)` helper. Reused by non-FHIR routes (`security.auth.invalid_credentials`, `not-found.fhir.patient`). Candidate **keep** even after re-scope.
- `app/fhir/search.py` — `PatientSearch`, `ObservationSearch`. Candidate **revert**.
- `app/fhir/mappers/__init__.py` — docstring only.
- `app/fhir/mappers/patient.py` — `to_summary(Patient) -> PatientSummary`. Candidate **revert**.
- `app/schemas/fhir.py` — re-exports from `fhir.resources.R4B`. Candidate **revert** if runtime dep is dropped.
- `app/schemas/view/__init__.py`, `app/schemas/view/patient.py` — `PatientSummary` view DTO. Candidate **revert**.
- `app/schemas/view/pagination.py` — `Page[T]` generic. Candidate **keep** (useful for any list endpoint).
- `app/adapters/hix/_fixtures.py` — `fhir.resources` synthetic patients / observations / encounters. Candidate **revert**.
- `app/adapters/luscii/mappers.py` — `pathway_to_careplan(payload: dict) -> CarePlan` stub. Candidate **revert**.
- `app/api/routers/patient_router.py` — `GET /patients/{patient_id}` returning `PatientSummary`. Candidate **revert**.

**Updates to existing modules**

- `app/main.py`, `app/api/__init__.py` — register `patient_router`. Revert with router.
- `app/adapters/hix/protocol.py` — FHIR verbs (`read`, `search`, `create`). Candidate **narrow** to stub `ping()` Protocol; restore at `[mvp]`.
- `app/adapters/hix/stub.py` — implements FHIR-verb interface. Tied to protocol.py decision.

**Tests added / updated**

- `tests/fhir/__init__.py`, `tests/fhir/test_mappers_patient.py` — 5 mapper tests. Revert with mapper.
- `tests/api/test_patient_router.py` — patient route tests. Revert with router.
- `tests/adapters/test_hix_stub.py` — FHIR-verb adapter tests. Narrow / restore alongside protocol.py.
- `tests/fixtures/fhir.py` — synthetic `fhir.resources` types. Candidate **revert** to plain dicts.

**Updates to `apps/backend/AGENTS.md`**

- "FHIR-Readiness Rules" section (~lines 108–205). Candidate **narrow** to a one-paragraph pointer: "FHIR rules apply when FHIR work lands ([mvp]+); see `openspec/scope.md`."

**Note**: at the time `define-poc-scope` is being authored, these artifacts are NOT present in this worktree (the `feat/define-poc-scope` branch was cut from `feat/backend-setup` before section 12 work was committed). The follow-up change runs in whichever worktree carries the section-12 artifacts (currently the prior `feat/backend-setup` working tree, now lost — section 12 will need to be re-implemented before or alongside the re-scope).

## 7. Verification

- [x] 7.1 `openspec change validate define-poc-scope --strict` — passes
- [x] 7.2 Read-aloud test: someone unfamiliar can open `openspec/scope.md` + `openspec/project.md` and answer "what is the PoC?" in under two minutes — **owner: user**, manual. Friction points found and fixed: builder framing (not clinical), care-pathway vs clinical care path defined upfront, June 2026 deadline + demo content in scope.md, stakeholder split (Organizations / PoC Users), redundant `[poc]` tags dropped, F7 surface fixed to `F1`–`F8`, "External Dependencies" section removed (duplicated Integrated Systems), MDR-never invariant added + `openspec/mdr-watchlist.md` seeded.
- [x] 7.3 No application code touched in this change. Backend pytest unaffected; orchestrator build unaffected.
