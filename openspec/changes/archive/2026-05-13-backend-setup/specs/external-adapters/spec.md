## ADDED Requirements

### Requirement: Adapter Protocol per external vendor

Each external system SHALL be modelled as a `typing.Protocol` in `app/adapters/<vendor>/protocol.py`. Concrete implementations (`<Vendor>StubClient`, future `<Vendor>LiveClient`) live alongside in the same package.

#### Scenario: Route binds to Protocol

- **WHEN** a future router types its adapter dependency as `client: Annotated[HixClient, Depends(get_hix_client)]`
- **THEN** the route compiles against the Protocol and swapping the stub for a live client requires no route change

### Requirement: FHIR-verb surface for FHIR-native adapters

Adapters whose source system is FHIR-native (today: HiX) SHALL expose a FHIR-verb Protocol surface returning `fhir.resources` types:

- `async def read(self, resource_type: str, resource_id: str) -> fhir.resources.resource.Resource`
- `async def search(self, resource_type: str, params: BaseModel) -> fhir.resources.bundle.Bundle`
- `async def create(self, resource: fhir.resources.resource.Resource) -> fhir.resources.resource.Resource`

Routes and services bind to these methods directly. Stub implementations construct synthetic `fhir.resources` resources; live implementations call the vendor's FHIR HTTP API and validate the response into the same types.

#### Scenario: HiX adapter reads a Patient

- **WHEN** a service calls `await hix.read("Patient", "abc-123")`
- **THEN** the return value is an instance of `fhir.resources.patient.Patient` with `id == "abc-123"`

#### Scenario: HiX adapter search returns a Bundle

- **WHEN** a service calls `await hix.search("Patient", PatientSearch(name="Demo"))`
- **THEN** the return value is `fhir.resources.bundle.Bundle` with `entry: list[BundleEntry]` populated

### Requirement: Vendor-shaped Protocol + mapper for non-FHIR adapters

Adapters whose source is not FHIR (today: Luscii) SHALL expose vendor-named methods on the Protocol (e.g. `get_pathway`, `get_episode`). A sibling module `app/adapters/<vendor>/mappers.py` SHALL provide pure functions converting vendor payloads into `fhir.resources` types. Service code SHALL only ever hold `fhir.resources` types — the vendor shape MUST NOT leak past the adapter package.

#### Scenario: Luscii pathway converted to CarePlan before service sees it

- **WHEN** a service requests a pathway via the Luscii adapter
- **THEN** the adapter calls the vendor API, the mapper translates the payload to `fhir.resources.careplan.CarePlan`, and the service receives the `CarePlan` — never the raw vendor dict

### Requirement: Mode-driven adapter factories

`get_hix_client` and `get_luscii_client` SHALL inspect `Settings.<vendor>_mode` and return the stub when `"stub"`, the live client when `"live"`. In this change, only `"stub"` is implemented; selecting `"live"` MUST raise `NotImplementedError` with a message naming the future change that adds the live client.

#### Scenario: Stub returned by default

- **WHEN** the app starts with no `BACKEND_HIX_MODE` env override
- **THEN** `get_hix_client(settings)` returns an instance of `HixStubClient`

#### Scenario: Live mode not yet implemented

- **WHEN** the app starts with `BACKEND_HIX_MODE=live`
- **THEN** boot fails with `NotImplementedError("HIX live client lands in the hix-fhir-proxy change")`

### Requirement: Adapter `ping()` contract

Every adapter Protocol SHALL declare `async def ping(self) -> None`. Stub implementations MUST return without raising. Future live implementations MUST raise on transport or auth failure with an error mapped to a typed `AppError`.

#### Scenario: Stub ping succeeds

- **WHEN** `HixStubClient().ping()` is awaited
- **THEN** the coroutine resolves without raising

### Requirement: Adapter banner for stub modules

Every stub adapter module SHALL carry a top-of-file `# POC ONLY` banner naming the future change that replaces it.

#### Scenario: Banner present

- **WHEN** a developer opens `app/adapters/hix/stub.py`
- **THEN** the first comment in the file reads `# POC ONLY — replaced by hix-fhir-proxy. Synthetic fixtures only.`
