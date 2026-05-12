# i18n Specification

## Purpose
TBD - created by archiving change orchestrator-app-shell. Update Purpose after archive.
## Requirements
### Requirement: i18next bootstrap

The orchestrator SHALL initialize `i18next` + `react-i18next` in `src/lib/i18n/index.ts` with a single registered locale `nl`. Namespaces MUST map one-to-one to modules plus shared `common` and `auth` namespaces. Missing keys MUST log a warning in dev and fall back to the key.

#### Scenario: t() returns translated string

- **WHEN** a component calls `t('auth.login.submit')` and the `nl` bundle defines that key
- **THEN** the rendered output is the Dutch string from `src/lib/i18n/locales/nl/auth.json`

#### Scenario: Missing key falls back

- **WHEN** a component calls `t('auth.unknown.key')`
- **THEN** the rendered output is the key itself and a warning is logged in dev only

### Requirement: Locale switching API in place

The i18n setup SHALL expose a `useLocale()` hook and a `changeLocale(code)` function even though only `nl` is registered. Adding a new locale later MUST be a registration-only change (no API redesign).

#### Scenario: API exists but only nl works

- **WHEN** `changeLocale('fr')` is called and `fr` is not registered
- **THEN** the call is a no-op and a dev warning is logged
- **AND** the function's type signature still accepts `'nl' | 'fr' | 'en'` for future readiness

### Requirement: Namespace per module

Module-owned strings SHALL live under `src/lib/i18n/locales/<locale>/<module>.json` and be loaded into the namespace `<module>`. Shared chrome strings (header, error boundary, toast) MUST live in `common`.

#### Scenario: Auth strings isolated

- **WHEN** the auth module loads
- **THEN** its strings come from the `auth` namespace, not `common`

#### Scenario: Shared error string from common

- **WHEN** the root error boundary renders
- **THEN** it reads `t('common.error.generic')`

