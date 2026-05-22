## ADDED Requirements

### Requirement: External block client Protocol slice

The `external-adapters` package SHALL declare an `ExternalBlockClient` Protocol exposing `async list_blocks(kind: str) -> list[ExternalBlockOption]`, `async get_block_schema(kind: str) -> dict`, and `async resolve_block(kind: str, ref: str) -> ExternalBlockResolution`. The Protocol SHALL live alongside existing per-vendor protocols (`app/adapters/<vendor>/block_protocol.py`) so a single vendor module can expose multiple capability slices.

The schema returned by `get_block_schema` SHALL describe **author-time** pathway-builder fields only and SHALL NOT describe per-patient enrollment fields (see `external-block-integrations` capability for the binding requirement).

#### Scenario: Protocol is satisfied by Luscii stub

- **WHEN** a unit test asserts `isinstance(LusciiStubClient(), ExternalBlockClient)` (structural)
- **THEN** mypy / pyright confirms the stub implements all three methods with the expected signatures

### Requirement: Luscii stub implements external-block Protocol via the `luscii_program` table

`LusciiStubClient` SHALL implement `ExternalBlockClient` by querying the `luscii_program` table (single `JSONB data` column keyed by Luscii program id; see `external-block-integrations` capability for shape). The stub SHALL NOT perform any network I/O and SHALL NOT load fixtures from the filesystem at request time.

The stub SHALL support exactly one kind: `program`. Calling any method with a different kind SHALL raise `UnknownLusciiKindError` naming the requested kind and listing `program` as the supported value.

#### Scenario: list_blocks queries the table for program options

- **WHEN** `await LusciiStubClient().list_blocks('program')` is awaited
- **THEN** the result is a non-empty list of `ExternalBlockOption` objects (`ref`, `label`) built from rows in `luscii_program` (`ref = id`, `label = data->>'name'`)
- **AND** the order is stable (alphabetical by `data->>'name'`)

#### Scenario: resolve_block returns the full payload from the table

- **GIVEN** a row in `luscii_program` with `id = 'luscii-hartfalen-monitoring-v4'`
- **WHEN** `await LusciiStubClient().resolve_block('program', 'luscii-hartfalen-monitoring-v4')` is awaited
- **THEN** the result has `provider='luscii'`, `kind='program'`, `ref` equal to the input, `display_label` from `data->>'name'`, `is_stub=True`
- **AND** the result carries a `summary` field equal to the row's `data` JSON (the full `LusciiProgramData` payload — protocols, instruments, alert_thresholds, care_network, layout)

#### Scenario: resolve_block on unknown id returns 404-equivalent

- **WHEN** `await LusciiStubClient().resolve_block('program', 'does-not-exist')` is awaited
- **THEN** the call raises `ExternalBlockNotFoundError` naming the requested id

#### Scenario: get_block_schema returns the static author-time schema (not table-derived)

- **WHEN** `await LusciiStubClient().get_block_schema('program')` is awaited
- **THEN** the result is a JSON Schema with `properties` containing `program_id`, `protocol_id`, `mode`, `version_pin`, `patient_identifier_system` (per the `external-block-integrations` capability)
- **AND** the schema is NOT derived from the `luscii_program` table — it is the author-time config contract, not the program payload

#### Scenario: list_blocks returns fixture program options

- **WHEN** `await LusciiStubClient().list_blocks('program')` is awaited
- **THEN** the result is a non-empty list of `ExternalBlockOption` objects, each with `ref` (synthetic Luscii program id) and `label` (program name, e.g. `"Hartfalen thuismonitoring"`)
- **AND** repeated calls return the same list in the same order

#### Scenario: list_blocks rejects unsupported kind

- **WHEN** `await LusciiStubClient().list_blocks('questionnaire')` is awaited
- **THEN** the call raises `UnknownLusciiKindError` whose message names `questionnaire` and lists `program` as the supported kind

#### Scenario: resolve_block returns a stub program resolution

- **GIVEN** an option ref present in the fixtures
- **WHEN** `await LusciiStubClient().resolve_block('program', ref)` is awaited
- **THEN** the result has `provider='luscii'`, `kind='program'`, `ref` equal to the input, and `display_label` set
- **AND** the result carries `is_stub=True`
- **AND** the result carries a `summary` object with at least `instruments`, `alert_thresholds`, `protocols` arrays (synthetic, used by the inspector's read-only program-contents card)

### Requirement: Live mode for external-block capability is not yet implemented

`get_external_block_client('luscii', settings)` SHALL return the stub when `Settings.luscii_mode == 'stub'`. When `Settings.luscii_mode == 'live'`, the factory SHALL raise `NotImplementedError` naming the future change that adds the live client.

#### Scenario: Stub returned by default

- **WHEN** the app starts with no `BACKEND_LUSCII_MODE` env override
- **THEN** `get_external_block_client('luscii', settings)` returns an instance of `LusciiStubClient`

#### Scenario: Live mode not yet implemented for external blocks

- **WHEN** the app starts with `BACKEND_LUSCII_MODE=live` and a route requests an `ExternalBlockClient`
- **THEN** boot or first dispatch fails with `NotImplementedError` whose message names the future change that adds the live Luscii external-block client
