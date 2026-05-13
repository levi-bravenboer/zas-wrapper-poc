## ADDED Requirements

### Requirement: `fhir.resources` is the canonical internal model

The backend SHALL use the [`fhir.resources`](https://pypi.org/project/fhir.resources/) Pydantic v2 library (R4) as the canonical, in-memory representation of any clinical concept that maps to a FHIR resource. Service code, mappers, adapters, and tests SHALL exchange `fhir.resources` types — not vendor-specific dicts, not bespoke Pydantic clones of FHIR shapes.

Wire-format DTOs for the orchestrator are allowed to be thinner view models (see "View-model DTOs"). They are derived **from** `fhir.resources` types, never substituted for them.

#### Scenario: Service receives a typed FHIR resource

- **WHEN** a service calls `hix.read("Patient", "abc-123")`
- **THEN** the return type is `fhir.resources.patient.Patient`, not `dict` and not a custom Pydantic model

#### Scenario: Re-implementing a FHIR shape is rejected

- **WHEN** a PR adds `class Patient(BaseModel)` to `app/schemas/`
- **THEN** the change is rejected; the author is directed at `fhir.resources.patient.Patient`

### Requirement: View-model DTOs live in `app/schemas/view/`

Orchestrator-facing JSON SHALL be served as view models defined under `app/schemas/view/`. Each view model SHALL be built by a pure function in `app/fhir/mappers/` that accepts one or more `fhir.resources` resources and returns the DTO. Routes SHALL call the mapper, not assemble the DTO inline.

The reverse direction — orchestrator request → FHIR resource — uses an `app/fhir/mappers/` function with the inverse signature when the route mutates clinical state.

#### Scenario: Patient summary built from FHIR Patient

- **WHEN** `GET /patients/{id}` runs
- **THEN** the route fetches a `fhir.resources.patient.Patient` from the adapter, calls `mappers.patient.to_summary(patient)` returning `PatientSummary`, and serialises that

#### Scenario: Orchestrator never receives a raw FHIR resource

- **WHEN** the orchestrator hits any non-`/fhir/*` route
- **THEN** the response body is a view-model DTO from `app/schemas/view/`, not a `fhir.resources` resource

### Requirement: FHIR-style references and IDs everywhere internal

Resource references in domain code SHALL use FHIR `Reference` objects (`fhir.resources.reference.Reference`) populated with a `reference` string of the form `<ResourceType>/<id>`. Plain string IDs (`"abc-123"`) MUST NOT cross module boundaries — convert at the boundary.

View-model DTOs MAY include plain IDs for orchestrator convenience, but the DTO field name SHALL preserve the resource type (e.g. `patient_id: str` not `subject: str`).

#### Scenario: Observation references a Patient

- **WHEN** an `Observation` is built in a service
- **THEN** `obs.subject = Reference(reference="Patient/abc-123")`, not `obs.subject = "abc-123"` and not `obs.subject = Patient(...)`

### Requirement: Meta fields populated on internal resources

When constructing or returning a `fhir.resources` resource internally, services SHALL populate `Meta.versionId` and `Meta.lastUpdated` when the source provides them. Stub adapters MAY set `versionId="1"` and `lastUpdated=datetime.utcnow()`. Field absence is acceptable when the source has none; fabricated values are not.

#### Scenario: Stub patient carries Meta

- **WHEN** `HixStubClient.read("Patient", "abc-123")` returns
- **THEN** the returned `Patient.meta.versionId == "1"` and `Patient.meta.lastUpdated` is set to the resource's fixture timestamp

### Requirement: `ErrorResponse.code` vocabulary aligns with `OperationOutcome.issue.code`

`ErrorResponse.code` values used in the backend SHALL be drawn from, or extend, the FHIR `IssueType` value set (`not-found`, `invalid`, `security`, `forbidden`, `conflict`, `processing`, `transient`, `informational`). Backend-specific subcodes SHALL be prefixed with the FHIR code as the first segment and a domain segment second: `<issue-type>.<domain>.<reason>`.

This makes a later `ErrorResponse → OperationOutcome` mapper mechanical: split on the first dot, populate `issue.code`, carry the rest in `issue.diagnostics`.

#### Scenario: Invalid login uses aligned code

- **WHEN** `/auth/login` rejects bad credentials
- **THEN** `ErrorResponse.code == "security.auth.invalid_credentials"`

#### Scenario: Missing resource uses aligned code

- **WHEN** an adapter cannot find a Patient
- **THEN** the raised `AppError.code == "not-found.fhir.patient"`

### Requirement: Pagination shape is Bundle-compatible

Any list endpoint SHALL return JSON of shape `{ entries: T[], total: int, next_cursor: str | None }`. The `next_cursor` field opaquely encodes whatever the underlying source needs (offset, page token, FHIR `Bundle.link[next].url`). Routes SHALL NOT expose source-specific pagination tokens.

#### Scenario: Empty page

- **WHEN** a list endpoint has no results
- **THEN** the response is `{ entries: [], total: 0, next_cursor: null }`

#### Scenario: Cursor opaque to caller

- **WHEN** an orchestrator decodes `next_cursor`
- **THEN** the value is treated as a black-box string and passed back to the same endpoint to fetch the next page; no parsing

### Requirement: Search filters as typed objects

Service-layer search APIs SHALL accept typed Pydantic filter objects, one per searchable resource (e.g. `PatientSearch(name: str | None, birthdate: date | None, identifier: str | None)`). Route handlers SHALL parse query parameters into the filter object and pass it to the service. Adapters SHALL translate the filter object to the source-specific search shape (FHIR search params for HiX, vendor query for Luscii).

#### Scenario: Adding a search field is one place

- **WHEN** a new search field is added
- **THEN** the change touches the filter Pydantic model and the adapter mapper; routes and services are unchanged

### Requirement: `app/fhir/` package layout

The backend SHALL contain an `app/fhir/` package with the following sub-modules:

- `app/fhir/mappers/` — pure functions mapping between `fhir.resources` and view-model DTOs (both directions). One module per FHIR resource (`patient.py`, `observation.py`, ...).
- `app/fhir/search.py` — typed search filter Pydantic models.
- `app/fhir/codes.py` — re-exports the subset of `OperationOutcome.IssueType` codes used by `ErrorResponse.code`.
- `app/fhir/__init__.py` — public surface re-exports only.

This package does NOT contain HTTP routes today. A future `fhir-endpoints` capability adds `app/api/routers/fhir_router.py` exposing raw FHIR resources under `/fhir/*` using the same mappers in reverse.

#### Scenario: View-model derived via mapper

- **WHEN** a developer needs a `PatientSummary` from a `Patient`
- **THEN** they call `app.fhir.mappers.patient.to_summary(patient)`; they do not write the field copy inline in the route

### Requirement: Adapter Protocols use FHIR-shaped methods when the source is FHIR

Adapters whose source system is FHIR-native (HiX) SHALL expose a FHIR-verb Protocol: `read(resource_type, resource_id) -> Resource`, `search(resource_type, params) -> Bundle`, `create(resource) -> Resource`. Adapters whose source is not FHIR (Luscii) SHALL expose vendor-shaped methods, paired with a sibling `app/adapters/<vendor>/mappers.py` that returns `fhir.resources` types to callers.

The service layer SHALL only ever see `fhir.resources` types regardless of which adapter is in use.

#### Scenario: HiX adapter speaks FHIR verbs

- **WHEN** a service needs a Patient from HiX
- **THEN** it calls `hix.read("Patient", id)` and receives `fhir.resources.patient.Patient`

#### Scenario: Luscii adapter wraps vendor shape into FHIR

- **WHEN** a service needs a care pathway from Luscii
- **THEN** the adapter's vendor method returns the raw Luscii payload, and `luscii.mappers.pathway_to_careplan(payload)` produces `fhir.resources.careplan.CarePlan` before the service sees it

### Requirement: Documented "FHIR-Readiness" rules in `apps/backend/AGENTS.md`

`apps/backend/AGENTS.md` SHALL contain a top-level "FHIR-Readiness Rules" section enumerating the conventions in this capability. The section is the canonical reference for reviewers asking "is this PoC code FHIR-ready or not?".

#### Scenario: Reviewer references the rules

- **WHEN** a reviewer flags a PR that introduces a non-FHIR Patient model
- **THEN** the review comment links to `apps/backend/AGENTS.md#fhir-readiness-rules`
