## MODIFIED Requirements

### Requirement: Adapter Protocol per external vendor

Each external system SHALL be modelled as a `typing.Protocol` in `app/adapters/<vendor>/protocol.py`. Concrete implementations (`<Vendor>StubClient`, future `<Vendor>LiveClient`) live alongside in the same package.

#### Scenario: Route binds to Protocol

- **WHEN** a future router types its adapter dependency as `client: Annotated[HixClient, Depends(get_hix_client)]`
- **THEN** the route compiles against the Protocol and swapping the stub for a live client requires no route change

## REMOVED Requirements

### Requirement: FHIR-verb surface for FHIR-native adapters

**Reason**: PoC scope (`openspec/scope.md`) excludes live HiX and any FHIR-shaped surface from PoC. Carrying FHIR verbs on the HiX Protocol forces `app/schemas/fhir.py` placeholders and out-of-tier `fhir.resources` types. Per scope discipline rule 1 (proposal must cite tier) and the "FHIR-ready seam, not FHIR-built" principle in `openspec/project.md`, the seam (Protocol existence) survives; the FHIR-shaped surface does not.

**Migration**: HiX Protocol is narrowed to `ping()` only (see `## MODIFIED Requirements` for the adapter ping contract elsewhere in this spec). FHIR verbs (`read`, `search`, `create`) return at `[mvp]` via the future `hix-fhir-proxy` change, which restores this requirement against the real FHIR client. `app/schemas/fhir.py`, `app/adapters/hix/_fixtures.py`, and `tests/fixtures/fhir.py` are deleted.

### Requirement: Vendor-shaped Protocol + mapper for non-FHIR adapters

**Reason**: This requirement assumed all adapters converge to `fhir.resources` types in the service layer. With FHIR removed from PoC, the Luscii adapter no longer maps to `CarePlan` — instead, the Luscii block stores `static_payload: dict` and the orchestrator renders it as-is (see `patient-view` capability).

**Migration**: Luscii adapter exposes a vendor-shaped Protocol (today: returning the seeded JSON for a clinical care path). The mapper-to-FHIR concern returns at `[mvp]` alongside live Luscii integration. No fhir.resources types are used in PoC.
