# tests-lint

Fixture-driven smoke tests that prove the DataTable encapsulation lint rules
(see `openspec/changes/add-datatable-base` §26) actually fire on disallowed
patterns. The files under `violations/` intentionally break the rules and are
excluded from the default `eslint .` pass via a `globalIgnores` entry in
`eslint.config.js`; they are linted programmatically by `tests-lint.test.ts`
using the `ESLint` Node API and asserted against expected error messages.
