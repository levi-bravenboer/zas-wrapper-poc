## MODIFIED Requirements

### Requirement: Block roster matches clinical pathway primitives

The pathway block-type catalogue SHALL contain exactly the following types: `appointment`, `task`, `message`, `form`, `decision`, `milestone`, `wait`, `pathway_link`. The catalogue SHALL NOT contain `timer` or `email`. The `pathway_link` entry SHALL carry catalogue metadata `source='internal'`, `provider='pathway'`, `kind='link'`, and a `nested_render` UI hint with values `'inline_preview'` or `'collapsed_card'`.

#### Scenario: Catalogue lists the expected eight block types

- **WHEN** a client calls `GET /pathway-block-types`
- **THEN** the response array contains exactly the codes `appointment`, `task`, `message`, `form`, `decision`, `milestone`, `wait`, `pathway_link`
- **AND** the codes `timer` and `email` are absent

#### Scenario: Message block accepts multiple channels

- **GIVEN** the catalogue entry `message`
- **THEN** its `config_schema.properties.channel.enum` contains exactly `email`, `sms`, `push`, `in_app`
- **AND** `channel`, `subject`, `body` are required fields
- **AND** `cta_label` and `cta_target` are optional fields

#### Scenario: Form block carries inline question definitions

- **GIVEN** the catalogue entry `form`
- **THEN** its `config_schema.properties.questions` is an array of objects
- **AND** each question object requires `id`, `type`, `label`, `required`
- **AND** `type` is one of `text`, `long_text`, `single_choice`, `multi_choice`, `scale`, `date`, `file`

#### Scenario: Wait block declares a closed event-type enum

- **GIVEN** the catalogue entry `wait`
- **THEN** its `config_schema.properties.event_type.enum` equals the codes returned by the event-type catalogue (`pathology_report`, `scan_report`, `lab_result`, `external_data`)
- **AND** `event_type` is required
- **AND** `timeout_days`, `on_timeout`, `source_block_id` are optional

#### Scenario: Pathway-link block requires target, mode, and version_pin

- **GIVEN** the catalogue entry `pathway_link`
- **THEN** its `config_schema.properties.target_pathway_id` requires a UUID
- **AND** its `config_schema.properties.mode.enum` contains exactly `blocking`, `fire_and_forget`
- **AND** its `config_schema.properties.version_pin.enum` contains exactly `latest_published`, `specific` with default `latest_published`
- **AND** its `config_schema.properties.pinned_version_id` is a UUID, required only when `version_pin='specific'`
- **AND** `target_pathway_id` and `mode` are required at all times

#### Scenario: Pathway-link catalogue entry carries internal source metadata

- **GIVEN** the catalogue entry `pathway_link`
- **THEN** the entry exposes `source='internal'`, `provider='pathway'`, `kind='link'`, and a `nested_render` value of either `'inline_preview'` or `'collapsed_card'`
