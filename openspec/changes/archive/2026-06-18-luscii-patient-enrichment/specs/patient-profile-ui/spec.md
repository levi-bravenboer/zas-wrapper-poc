# patient-profile-ui Specification (delta)

## ADDED Requirements

### Requirement: Patient profile shows a Luscii monitoring tab

`PatientProfilePage` SHALL gain a `Luscii` tab alongside the existing tabs. The tab SHALL fetch `GET /patients/{id}/luscii-data` via its own TanStack Query — independent of the queries driving the rest of the page — and SHALL render exactly one of four states:

1. **Not configured** (`503 unavailable.luscii.not_configured`): a quiet informational note that the Luscii connection is not configured; no input controls.
2. **Not linked** (`200 {"state": "not_linked"}`): an empty state with a Luscii patient UUID input and a link action calling `PUT /patients/{id}/luscii-link`; validation errors (`422`, `409`, `502`) render inline.
3. **Error** (`502 unavailable.luscii.upstream` or network failure): an error state with a retry action, contained to the tab.
4. **Data**: a header with programme and protocol names, a planned-actions timeline for the window (each entry showing Luscii status and, when present, its embedded measurement's decoded values with labels and units), and an unmatched-measurements list. Display is passthrough-only: no client-side thresholds, colour-coding by value, or derived indicators.

A failure of the Luscii query MUST NOT affect rendering of the other tabs or the page header. Linked patients SHALL have an unlink affordance (calling `DELETE /patients/{id}/luscii-link`) and relinking SHALL be possible by submitting a new UUID. After a successful link or unlink the Luscii query SHALL be invalidated and refetched.

#### Scenario: Luscii failure leaves rest of page intact

- **WHEN** `GET /patients/{id}/luscii-data` fails while patient and organisation queries succeed
- **THEN** the header and other tabs render normally and only the Luscii tab shows the error state

#### Scenario: Unlinked patient can link with visual confirmation

- **WHEN** a caregiver submits a valid Luscii UUID in the empty state
- **THEN** the link succeeds, the response's programme/protocol names are surfaced as confirmation, and the tab refetches into the data state

#### Scenario: Invalid UUID shows inline error

- **WHEN** the link request returns `422 invalid.luscii.patient_not_found` or `409 conflict.luscii.already_linked`
- **THEN** an inline error message renders in the form and no navigation or page-level error occurs

#### Scenario: Decoded measurements render labels and units

- **WHEN** the data state renders a planned action with an embedded measurement item `{label: "Gewicht", value: "82", unit: "kg"}`
- **THEN** the timeline entry shows the label, value, and unit (raw values with null labels render as the value alone)

#### Scenario: Not-configured state is quiet

- **WHEN** the backend responds `503 unavailable.luscii.not_configured`
- **THEN** the tab shows an informational note without input controls or error styling
