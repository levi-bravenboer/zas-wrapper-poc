# external-adapters Specification

## Purpose
TBD - created by archiving change backend-setup. Update Purpose after archive.
## Requirements
### Requirement: Adapter Protocol per external vendor

Each external system SHALL be modelled as a `typing.Protocol` in `app/adapters/<vendor>/protocol.py`. Concrete implementations (`<Vendor>StubClient`, future `<Vendor>LiveClient`) live alongside in the same package.

#### Scenario: Route binds to Protocol

- **WHEN** a future router types its adapter dependency as `client: Annotated[HixClient, Depends(get_hix_client)]`
- **THEN** the route compiles against the Protocol and swapping the stub for a live client requires no route change

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

