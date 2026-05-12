## ADDED Requirements

### Requirement: Nav namespace

The i18n bundle SHALL include a `nav` namespace under `src/lib/i18n/locales/nl/nav.json` registered alongside `common` and `auth`. The namespace MUST define keys `dashboard`, `taken`, `zorgpaden`, `patienten`, `instellingen`, and a shared `placeholder` key used by section placeholder pages.

#### Scenario: Nav labels resolve from namespace

- **WHEN** a component calls `t('nav.zorgpaden')` from the `nav` namespace
- **THEN** the rendered output is the Dutch string from `nl/nav.json`

#### Scenario: Missing nav key warns in dev

- **WHEN** a component calls `t('nav.unknown')` in dev
- **THEN** a warning is logged and the key itself is rendered
- **AND** the surrounding UI does not throw
