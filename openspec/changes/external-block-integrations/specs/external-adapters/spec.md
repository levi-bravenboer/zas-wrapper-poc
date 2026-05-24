## ADDED Requirements

### Requirement: Luscii stub serves program payloads from an in-memory constant

The existing `LusciiStubClient` (`app/adapters/luscii/stub.py`) SHALL keep its single `ping()` method — no new methods, no new Protocol slices. Per-vendor block routes (`GET /luscii/programs`, `GET /luscii/programs/{id}`) SHALL read directly from `app/adapters/luscii/programs.py`, a `# POC ONLY` static module exporting `LUSCII_STUB_PROGRAMS: tuple[LusciiProgramData, ...]` and `LUSCII_STUB_PROGRAMS_BY_ID: dict[str, LusciiProgramData]`.

This deliberately avoids a cross-vendor `ExternalBlockClient` Protocol or factory. With one external vendor, the abstraction would be unused overhead. When a second external vendor ships block-shaped capabilities, the right shared abstraction is extracted *based on what both vendors need*, not on speculative symmetry today.

#### Scenario: Luscii stub still implements only ping

- **WHEN** `LusciiStubClient` is type-checked against the `LusciiClient` Protocol
- **THEN** the only required method is `ping()`
- **AND** no new abstract methods (`list_blocks`, `get_block_schema`, `resolve_block`) appear on either the Protocol or the stub

#### Scenario: Static program constant validates against LusciiProgramData

- **GIVEN** the module `app.adapters.luscii.programs`
- **WHEN** Python imports the module
- **THEN** every entry in `LUSCII_STUB_PROGRAMS` validates against `LusciiProgramData` (enforced at module load via Pydantic construction)
- **AND** `LUSCII_STUB_PROGRAMS_BY_ID` keys equal the set of `id` values across `LUSCII_STUB_PROGRAMS`

#### Scenario: Future live-Luscii adapter replaces the constant without touching routes

- **WHEN** the future live-Luscii-adapter change lands
- **THEN** it replaces the in-memory constant with a real fetch + cache layer
- **AND** the route shapes (`GET /luscii/programs`, `GET /luscii/programs/{id}`) and their response models (`LusciiProgramData`) stay unchanged
