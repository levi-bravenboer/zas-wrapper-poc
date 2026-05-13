## Context

`apps/backend/` today is a Python 3.13 + FastAPI scaffold (managed by `uv`) with a single `main.py` exposing `/` and `/health`. It compiles, tests pass, and that's it. Every following backend capability — real SMART handshake, HiX FHIR proxy, Luscii integration, MCP host, IdP integration, persistence — needs the same foundations: package layout, settings, CORS, auth contract, error model, logging conventions, adapter pattern, health/readiness, OpenAPI metadata, test infrastructure.

Building these once now prevents drift across routers and gives reviewers a single place to argue about cross-cutting decisions before any clinical capability lands. It also unblocks `apps/orchestrator/` from MSW-only auth: the app-shell change already codes against `/auth/login`, `/auth/me`, `/auth/logout` and expects a stable `/openapi.json` for typegen.

Constraints:

- **Belgian clinical context**: PHI handling rules from `AGENTS.md`. No real patient data anywhere — fixtures, screenshots, logs.
- **POC scope**: June demo focuses on Holter + Rugrevalidatie. The backend foundation must enable those without locking in choices the production version will reject.
- **`uv`-managed** project. Python 3.13 minimum. All commands run through `uv run` or moon.
- **Belgian hosting / data residency** for any productionised deployment. Stub adapters are explicit "POC only" and never call out to non-Belgian hosts.
- **Spec-driven**: every behavioural change starts as an OpenSpec proposal. This is that proposal.

Stakeholders: backend team (FastAPI contracts), frontend team (orchestrator consumes the contracts), Luscii (will own the patient-engagement integration through `LusciiClient`), NewWave Care (will own IdP integration, replacing `auth-stub`), procurement reviewers (REQ traceability — adapters and auth get mapped to REQ-IDs in `docs/requirements/`).

## Goals / Non-Goals

**Goals:**

- Land the canonical `app/` package layout, settings, CORS, error model, logging, adapter pattern, health/readiness, OpenAPI metadata, and test infrastructure once so future backend changes drop in without bikeshedding.
- Lock naming, coding, layer-import, and testing rules in code, lint, and `apps/backend/AGENTS.md`.
- Ship a working auth stub (`/auth/login`, `/auth/me`, `/auth/logout`) so the orchestrator can drop MSW for auth and exercise the real backend end-to-end.
- Wire the adapter `Protocol` pattern with stub implementations for HiX and Luscii so later real implementations land behind unchanged callers.
- Make `/openapi.json` stable enough that `openapi-typescript` produces a useful `schema.d.ts` for the orchestrator.

**Non-Goals:**

- Real SMART-on-FHIR handshake — separate change.
- Real HiX FHIR proxy — separate change.
- Real Luscii API integration — separate change.
- Real IdP integration (eHealth, itsme, eID, CSAM) — separate change, will replace `auth-stub`.
- Database persistence — no DB until a capability demands it.
- MCP host — separate change.
- Observability (OpenTelemetry, Sentry, metrics) — separate change, lands when there is something worth observing.
- Production deployment topology — separate change tied to Belgian hosting decision.

## Decisions

### D1. `app/` package now, not "when the API grows"

**Choice:** Migrate from `main.py` (inline routes) to an `app/` package with `app/main.py` exposing `app = create_app()`, in this change.

**Why:** `apps/backend/AGENTS.md` already names this layout as the destination "when the API grows beyond ~150 lines or two domains." Adding auth + health + adapters in this change already crosses the second-domain threshold. Doing the layout migration alongside the new code keeps the diff in one proposal instead of a noisy follow-up rename PR. It also gives every following change a settled tree to add files to.

**Alternatives considered:**

- *Stay flat in `main.py` and migrate later.* Rejected — every subsequent change adds another reason to split, and "later" becomes "never" until something breaks. The cost of restructuring two routers is trivial; the cost of restructuring eight is friction debt.
- *Skip the factory and define `app = FastAPI(...)` at module level.* Rejected — factory enables test instances with overridden dependencies (e.g. a test app with stub adapters auto-registered) without globals.

### D2. `pydantic-settings` over hand-rolled env loading

**Choice:** Single `Settings(BaseSettings)` class in `app/core/settings.py`. All env vars surface as typed fields. Loaded once at startup, available via `Depends(get_settings)`.

**Why:** Type-checked, validated, single source of truth. `os.environ.get(...)` scattered across modules is the most common Python config bug in clinical systems we've shipped. `pydantic-settings` integrates with `.env` and gives Pydantic v2 validation for free.

**Alternatives considered:**

- *Stdlib `os.environ` + manual parsing.* Rejected — re-implements validation we get for free, drift across modules guaranteed.
- *`dynaconf`.* Rejected — more surface than we need, ties config to YAML/TOML layers we have no reason to add.

### D3. Cookie sessions via `itsdangerous` for the POC auth stub

**Choice:** `POST /auth/login` validates against an in-memory user store and sets a signed cookie (`itsdangerous.URLSafeTimedSerializer`). `GET /auth/me` reads + verifies the cookie. `POST /auth/logout` clears it. Cookie name `BACKEND_SESSION`, `HttpOnly`, `SameSite=Lax`, `Secure` when `Settings.env == "production"`.

**Why:** The orchestrator already codes against cookie auth (`credentials: 'include'` in `client.ts`). `itsdangerous` is a 0-dependency stdlib-compatible signer used by Flask and FastAPI extensions — well understood, no DB. Matches the future production shape (cookie issued by an IdP-backed session); the only thing that changes when real IdP lands is *who issues the cookie*, not the wire format.

**Alternatives considered:**

- *Bearer JWT in `Authorization` header.* Rejected — extra storage burden on the SPA, no automatic CSRF protection from `SameSite`, mismatch with the eventual IdP flow (which will also issue cookies).
- *Stub returns a static cookie without signing.* Rejected — invites cargo-culting the unsigned shape into later real implementations.
- *`fastapi-users` or similar.* Rejected — too much surface for a POC stub that we already plan to delete when IdP lands.

### D4. Adapter `Protocol` pattern from day one

**Choice:** Each external system (HiX, Luscii, future MCP servers) is a `typing.Protocol` in `app/adapters/<vendor>/protocol.py` with a stub implementation in `app/adapters/<vendor>/stub.py`. The active implementation is chosen by a `Depends` factory reading `Settings.<vendor>_mode` (`stub` | `live`). Today only `stub` exists.

**Why:** Routes and services bind to the Protocol, never to a concrete class. Swapping `stub` → `live` later is a one-line config change, no caller modifications. Stubs are first-class — they get the same `ping()` interface as the real implementations and feed into `/ready`. This also makes tests trivial: override the `Depends` with a fixture-built stub.

**Alternatives considered:**

- *Define adapter classes only when the real one lands.* Rejected — every route that touches HiX would then be retrofitted, and routes would couple to whatever shape the first implementation happens to have.
- *Abstract base classes (`abc.ABC`).* Rejected — `Protocol` is structurally typed, no inheritance ceremony, and plays better with `pyright`.

### D5. `ErrorResponse` shape + global handler

**Choice:** A single `ErrorResponse(code: str, message: str, details: dict | None)` model. Global handlers map `HTTPException`, `RequestValidationError`, and custom `AppError` subclasses into this shape. The orchestrator's HTTP client then has one parsing target.

**Why:** Uniform error shape is the single highest-leverage decision for orchestrator UX — `sonner` toasts and error-boundary fallbacks key off `code`, not status text. Without it, every consumer reimplements error parsing. With it, error UX is consistent across modules.

`code` is namespaced (`auth.invalid_credentials`, `fhir.resource_not_found`) so the orchestrator can i18n by key without parsing English `message` strings.

**Alternatives considered:**

- *Lean on FastAPI's default `{"detail": "..."}` shape.* Rejected — string-typed `detail` loses information, and the orchestrator already has to handle `RequestValidationError`'s shape (`detail: [{...}]`) separately. Standardizing is simpler than handling both.
- *RFC 7807 problem-details.* Considered. Defer to a later change if a regulatory reviewer asks for it; the shape we land is a superset and migrates cleanly.

### D6. Split `/health` and `/ready`

**Choice:** `/health` always returns 200 with `{status: "ok", version, started_at}`. `/ready` aggregates `adapter.ping()` results and returns 503 if any fail.

**Why:** Kubernetes-style liveness vs readiness distinction. Liveness = "process is up"; readiness = "process can serve traffic". Conflating them in one endpoint means a transient HiX outage looks like a crashloop signal. Splitting now is cheap; splitting after a production incident is not.

**Alternatives considered:**

- *One `/health` with a `deep` query parameter.* Rejected — query-flag dispatch is harder to point a load balancer at and obscures intent in dashboards.

### D7. `operation_id` set per route, manually

**Choice:** Every route declares `operation_id="<snake_case_verb_noun>"`. We do not rely on FastAPI auto-generated IDs.

**Why:** Auto-generated IDs are `path_method_function_name` and change whenever the Python function is renamed. The orchestrator's TanStack Query keys and `openapi-typescript`-generated type names depend on stable `operation_id`s. Manual control means refactors don't ripple into frontend type churn.

**Alternatives considered:**

- *Accept auto-generation.* Rejected — frontend type names like `paths['/auth/me']['get']['responses']['200']` are tolerable, but the Query Key + invalidation patterns rely on a friendly name we don't get for free.

### D8. `pyright` for type-checking, ahead of `mypy`

**Choice:** Add `pyright` as the typecheck tool via `backend:typecheck` moon task. Configure in `pyproject.toml` (`[tool.pyright]`).

**Why:** Pyright agrees with the editor (Pylance under the hood), runs faster than mypy on this codebase, and handles Pydantic v2 generics more gracefully today. Mypy stays as an option if a reviewer prefers it; the gate is "any sound type checker is wired up", not "mypy specifically".

**Alternatives considered:**

- *`mypy`.* Considered. Slower, more Pydantic v2 friction. Worth revisiting if the team standardizes on mypy elsewhere.
- *No typecheck task.* Rejected — type hints without enforcement decay within weeks.

### D9. Layered import rules enforced socially first, lint-enforced later

**Choice:** `proposal.md`'s "Layer Rules" table is the source of truth. Reviewers reject PRs that violate it. Lint enforcement via `ruff` `flake8-tidy-imports` `banned-module-level-imports` is a `TODO(backend)` once the rule pays for itself (~6 routers in).

**Why:** Today there are too few files to make lint configuration worth the maintenance. Reviewer enforcement is sufficient at this scale and surfaces design-intent discussions instead of mechanical complaints.

**Alternatives considered:**

- *Lint-enforce from day one.* Considered. The lint config drift becomes its own maintenance burden when the project is still finding shape. Revisit at the 6-router mark.

### D10. `fhir.resources` is the canonical internal model from day one

**Choice:** Add the `fhir.resources` (R4) Pydantic v2 library as a runtime dependency. Use its types (`Patient`, `Observation`, `Bundle`, `Reference`, …) anywhere the code holds a clinical concept in memory. Wire-format DTOs for the orchestrator stay thin (view models in `app/schemas/view/`) and are derived **from** these types by pure mappers in `app/fhir/mappers/`.

**Why:** The June demo needs simple JSON for the orchestrator (`PatientSummary`, not raw FHIR Patient). Building a parallel set of Pydantic models duplicates FHIR's shape and locks in subtle drift. Adopting `fhir.resources` now means: HiX adapter returns the right types natively; tests use synthetic FHIR fixtures with type-checked shape; the future `/fhir/*` raw-FHIR endpoint capability is "new routes, same mappers in reverse" — no rewrite of services or adapters.

The cost is one extra dependency and a small mapper layer. The cost of *not* doing this is a structural rewrite the day a procurement reviewer asks for a FHIR-compliant API surface.

**Alternatives considered:**

- *Roll our own Pydantic models for Patient / Observation / etc.* Rejected — duplicates a well-maintained spec, drifts the moment FHIR adds a field, and creates two sources of truth in tests.
- *Hold off on `fhir.resources` until a route actually serves FHIR.* Rejected — every route added before that point bakes in a non-FHIR shape that has to be refactored later.
- *`fhir.resources` R5.* Considered. HiX SMART-on-FHIR launch target is R4 (per `openspec/project.md`). Stay on R4 until HiX moves.

### D11. View-model DTOs vs raw FHIR on the wire

**Choice:** Today the orchestrator sees view-model DTOs (`PatientSummary`, `ObservationRow`, …) that are smaller and friendlier than raw FHIR. They live in `app/schemas/view/` and are built by `app/fhir/mappers/<resource>.to_<view>()` functions. Tomorrow, raw FHIR routes can be added under `/fhir/*` using the inverse mappers; the existing routes stay.

**Why:** Reviewers (and clinicians) reading the orchestrator network tab want to see `{ id, name, birthdate }` not a 40-field FHIR Patient with `extension[]` arrays. Forcing the orchestrator to consume raw FHIR would mean either coupling UI to FHIR types directly (locks in v4) or duplicating the mapper on the frontend (drift). Keeping the mapper backend-side and serving thin DTOs is the right scope for a PoC.

The constraint "view models are derived from `fhir.resources` types via a pure mapper" is what keeps the door open. The mapper is the contract; adding a `/fhir/Patient/{id}` route later is a 5-line addition.

**Alternatives considered:**

- *Serve raw FHIR from day one.* Rejected — orchestrator UX cost is high; bundles for trivial list endpoints are user-hostile in DevTools; and the PoC has no FHIR-aware consumers yet.
- *Skip view models and serve `fhir.resources.Patient.model_dump()` directly.* Rejected — same problem as above, plus locks the orchestrator into FHIR types via `openapi-typescript` codegen.
- *Build view models inline in routes.* Rejected — guarantees drift and inline copies that the next refactor misses.

### D12. Adapter Protocols speak FHIR when the source is FHIR

**Choice:** `HixClient` Protocol exposes FHIR verbs: `async read(resource_type: str, resource_id: str) -> Resource`, `async search(resource_type: str, params: SearchParams) -> Bundle`, `async create(resource: Resource) -> Resource`. Return types are `fhir.resources` types. `LusciiClient` Protocol stays vendor-shaped (`get_pathway`, `get_episode`) but pairs with `app/adapters/luscii/mappers.py` that translates vendor payloads into `fhir.resources` types before they cross the service boundary.

**Why:** HiX is FHIR-native. Making the adapter speak the same vocabulary erases the impedance mismatch and means the live HiX adapter is essentially `httpx.get(f"{base}/{resource_type}/{resource_id}")` + Pydantic validation — no translation layer to maintain. Luscii is not FHIR; pretending otherwise at the Protocol level hides where translation actually happens. Putting it in `mappers.py` makes the seam explicit and reviewable.

The service layer only ever holds `fhir.resources` types regardless of where they came from. This is the load-bearing invariant: every clinical service routine reads and writes typed FHIR resources, full stop.

**Alternatives considered:**

- *Both adapters expose FHIR verbs.* Rejected for Luscii — it forces the adapter to invent FHIR resources for vendor-native concepts that don't have a clean mapping today (e.g. Luscii "pathways" vs FHIR `CarePlan` has known gaps). Letting the adapter speak vendor and mapping at a labelled seam keeps reviewers honest.
- *Both adapters expose vendor verbs.* Rejected for HiX — pointless conversion layer for a FHIR-native source.

### D13. Error code vocabulary mirrors `OperationOutcome.issue.code`

**Choice:** `ErrorResponse.code` values are namespaced `<fhir-issue-type>.<domain>.<reason>`. The first segment is drawn from FHIR `IssueType` (`not-found`, `invalid`, `security`, `forbidden`, `conflict`, `processing`, `transient`, `informational`). The second and third segments are app-specific. Examples: `security.auth.invalid_credentials`, `not-found.fhir.patient`, `invalid.validation.body`.

**Why:** A later `ErrorResponse → OperationOutcome` translator is one line: `issue.code = code.split('.', 1)[0]`. The orchestrator can still pivot on the full code string for i18n keys. Reviewers eyeballing logs see "this is a `not-found`, not a `security`" without parsing English `message` strings.

**Alternatives considered:**

- *Free-form `code` strings.* Rejected — defers the alignment problem until it's a structural cost.
- *Skip the FHIR prefix today, add it later.* Rejected — same as above; renaming every code in flight is friction.

### D14. `app/fhir/` package is the seam

**Choice:** New package `app/fhir/` carries the FHIR-aware code: `mappers/` (one module per resource), `search.py` (typed filters), `codes.py` (issue-type vocabulary). It does NOT contain HTTP routes today. The future `fhir-endpoints` capability adds `app/api/routers/fhir_router.py` and reuses the mappers in reverse.

**Why:** Centralises the "FHIR-shaped" parts of the codebase in one place. Reviewers asking "what does the FHIR-readiness story look like in code?" have one directory to read. Services depend on `app/fhir/mappers/<resource>`; that import is the visible coupling and is easy to grep.

**Alternatives considered:**

- *Scatter mappers next to each module that uses them.* Rejected — drift across modules, no single place to reason about FHIR shape.
- *Put mappers under `app/schemas/`.* Rejected — schemas describe *shape*, mappers describe *transformation*. Different concerns; different homes.

### D15. Synchronous test client only; defer async tests

**Choice:** `pytest` + `TestClient` (sync, backed by `httpx`) for all route tests. Async fixtures land when a route uses async dependencies whose test would meaningfully differ.

**Why:** FastAPI's `TestClient` works for both sync and async route handlers because it runs the app on an internal event loop. Async test setup (`pytest-asyncio` + `httpx.AsyncClient`) adds ceremony for no signal at this scale. Adopt when a real reason appears (long-running streaming endpoint, websocket flow).

**Alternatives considered:**

- *Async tests from day one.* Rejected — premature; doubles test boilerplate.

## Risks / Trade-offs

- **In-memory user store** is intentionally fake. Risk: a contributor wires a real flow against it and forgets it isn't persisted. **Mitigation:** docstring on the module reads `# POC ONLY — replaced by IdP integration. Do not extend.` plus a banner in `auth-stub/spec.md`.
- **Cookie auth + CORS with credentials** requires the orchestrator origin to be on the allow list. Misconfigure in production and auth silently breaks. **Mitigation:** `Settings.cors_origins` is a typed list with a runtime check on startup that the list is non-empty in production mode.
- **`operation_id` discipline** depends on reviewer attention. Drift means orchestrator type names churn. **Mitigation:** review checklist line in `apps/backend/AGENTS.md`; consider an OpenAPI validator script later that fails CI on missing/duplicate IDs.
- **Migrating layout in the same change as adding behaviour** makes the diff larger. **Mitigation:** tasks are sequenced so the layout migration is the first commit, behaviour follows on top. Easier to review in stages.
- **No DB means** the auth stub state is per-process. Restart wipes sessions. **Acceptable** — POC dev experience, documented in README.
- **Stub adapters that always succeed** mean `/ready` is meaningless until real adapters land. **Acceptable** — the wiring is the value; the probe is honest about being a stub.
- **`fhir.resources` adds a heavy dep tree** (full R4 model coverage). Risk: import time and disk footprint grow. **Mitigation:** acceptable for a backend container; revisit if it materially affects cold-start in production.
- **Mappers can drift from FHIR** (e.g. forget to populate `Meta.lastUpdated`). Risk: `fhir-ready` becomes a label, not a property. **Mitigation:** mapper tests assert round-trip identity for representative resources; reviewer checklist in `apps/backend/AGENTS.md` mentions Meta and References explicitly.
- **View-model DTO drift from FHIR semantics**. Risk: a view model invents a field that doesn't map cleanly to FHIR (e.g. a denormalised "doctor name" that crosses two FHIR resources). **Mitigation:** mappers are pure functions over their FHIR inputs; if a view-model field needs more than one resource, the mapper signature shows it.

## Migration Plan

This change is additive to `apps/backend/`. No archived specs to modify. Sequencing:

1. **Layout migration first.** Move `main.py` content into `app/main.py` behind `create_app()`, keep `main.py` as a one-line entrypoint. Confirm `uv run fastapi dev main.py` still serves `/health`.
2. **Settings + CORS** next. Add `app/core/settings.py`, wire `CORSMiddleware` into the factory. Confirm orchestrator dev origin can hit `/health` with `credentials: 'include'` (manual curl + Origin header).
3. **Error model + logging** next. They underpin every following route's error path.
4. **Health + ready split**. Move `/health`, add `/ready`. Update existing test, add a new one.
5. **Adapter Protocols + stubs**. Define both, register, wire into `/ready`.
6. **Auth stub** last (depends on settings + errors + cookie middleware). Add three routes + tests.
7. **FHIR-ready domain layer**. Add `fhir.resources` dep, create `app/fhir/` package, refactor adapter Protocols to FHIR verbs, add view-model DTOs + example `/patients/{id}` route + mapper.
8. **OpenAPI polish + typegen task**. Add `operation_id`s, tags, response models. Add `backend:openapi` moon task.
9. **Docs**: update `apps/backend/AGENTS.md` (incl. new "FHIR-Readiness Rules" section) and `apps/backend/README.md`.

Each step is one commit (or two if tests + code grow large). Tests ship in the same commit as the code they cover.

## Open Questions

- **Cookie domain** in production: tied to the chosen Belgian hosting topology. Default to leaving `domain` unset for now (host-only cookie); revisit when a production domain exists.
- **`tests/fixtures/` shape**: Pydantic dicts vs raw JSON files? Lean Pydantic for type-safety, but if frontend tests share fixtures via codegen later, JSON wins. Decide when the orchestrator asks to share. Default for now: Pydantic dicts under `tests/fixtures/*.py`.
- **Pyright strictness level**: `basic` to start; `strict` once the codebase is comfortable. Configurable in `pyproject.toml`; revisit at the 6-router mark.
