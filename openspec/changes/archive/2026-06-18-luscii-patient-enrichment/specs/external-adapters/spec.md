# external-adapters Specification (delta)

## ADDED Requirements

### Requirement: Luscii builder picker serves program payloads from an in-memory constant

Per-vendor block routes (`GET /luscii/programs`, `GET /luscii/programs/{id}`) SHALL read directly from `app/adapters/luscii/programs.py`, a `# POC ONLY` static module exporting `LUSCII_STUB_PROGRAMS: tuple[LusciiProgramData, ...]` and `LUSCII_STUB_PROGRAMS_BY_ID: dict[str, LusciiProgramData]`. These routes SHALL NOT depend on the live `LusciiHttpClient`; migrating the picker to live data is a named follow-up change.

This deliberately avoids a cross-vendor `ExternalBlockClient` Protocol or factory. With one external vendor, the abstraction would be unused overhead. When a second external vendor ships block-shaped capabilities, the right shared abstraction is extracted *based on what both vendors need*, not on speculative symmetry today.

#### Scenario: Static program constant validates against LusciiProgramData

- **GIVEN** the module `app.adapters.luscii.programs`
- **WHEN** Python imports the module
- **THEN** every entry in `LUSCII_STUB_PROGRAMS` validates against `LusciiProgramData` (enforced at module load via Pydantic construction)
- **AND** `LUSCII_STUB_PROGRAMS_BY_ID` keys equal the set of `id` values across `LUSCII_STUB_PROGRAMS`

#### Scenario: Picker routes unaffected by Luscii configuration

- **WHEN** `GET /luscii/programs` is called with `BACKEND_LUSCII_API_TOKEN` unset
- **THEN** the route serves the static constant normally (no `503 unavailable.luscii.not_configured`)

#### Scenario: Future live-picker change replaces the constant without touching routes

- **WHEN** the future live-Luscii-picker change lands
- **THEN** it replaces the in-memory constant with a real fetch + cache layer
- **AND** the route shapes (`GET /luscii/programs`, `GET /luscii/programs/{id}`) and their response models (`LusciiProgramData`) stay unchanged

## MODIFIED Requirements

### Requirement: Mode-driven adapter factories

`get_hix_client` SHALL inspect `Settings.hix_mode` and return the stub when `"stub"`, the live client when `"live"`. Only `"stub"` is implemented; selecting `"live"` MUST raise `NotImplementedError` with a message naming the future change that adds the live client.

`get_luscii_client` SHALL NOT be mode-driven. It SHALL return a `LusciiHttpClient` when `Settings.luscii_api_token` is set and `None` when it is not (see `luscii-patient-data`). There SHALL be no `luscii_mode` setting and no `LusciiStubClient`.

#### Scenario: Stub returned by default

- **WHEN** the app starts with no `BACKEND_HIX_MODE` env override
- **THEN** `get_hix_client(settings)` returns an instance of `HixStubClient`

#### Scenario: Live mode not yet implemented

- **WHEN** the app starts with `BACKEND_HIX_MODE=live`
- **THEN** boot fails with `NotImplementedError("HIX live client lands in the hix-fhir-proxy change")`

#### Scenario: Luscii factory keys on token presence

- **WHEN** the app starts with `BACKEND_LUSCII_API_TOKEN` unset
- **THEN** `get_luscii_client(settings)` returns `None` and boot succeeds without a Luscii readiness entry

#### Scenario: Stale BACKEND_LUSCII_MODE ignored

- **WHEN** a developer's `.env` still contains `BACKEND_LUSCII_MODE=stub`
- **THEN** settings load succeeds and the variable has no effect (`extra="ignore"`)

## REMOVED Requirements

### Requirement: Luscii stub serves program payloads from an in-memory constant

**Reason**: Split. The stub-client half is deleted (Luscii now has a live client gated on token presence — see `luscii-patient-data`); the static-programs half survives as "Luscii builder picker serves program payloads from an in-memory constant" above.
**Migration**: Delete `app/adapters/luscii/stub.py`; `LusciiClient` Protocol gains the live methods; picker routes keep reading `programs.py` unchanged.
