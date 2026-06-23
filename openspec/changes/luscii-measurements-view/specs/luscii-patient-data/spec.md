## ADDED Requirements

### Requirement: Alerts fetched from the Luscii public API
The live Luscii HTTP client SHALL expose a `get_alerts` call against the
public-API alerts endpoint, using the same bearer auth, cursor pagination, and
client-side patient filtering as measurements (the API ignores server-side
patient/program filters). Failures SHALL degrade gracefully and never block the
rest of the merged payload.

#### Scenario: Alerts retrieved
- **WHEN** the client requests alerts for a configured org
- **THEN** it returns the fired alert records (each with `measurementId`, `instrumentId`, and `flag`)

#### Scenario: Alerts endpoint unavailable
- **WHEN** the alerts call fails upstream
- **THEN** the merged Luscii payload still returns without alert flags rather than erroring

### Requirement: Measurements expose their alert flag
The aggregation endpoint SHALL join fired alerts onto measurements by
`measurementId` and expose each measurement's alert flag (e.g. `red`/`orange`)
in the patient-data payload, so the frontend can colour points and rows. A
measurement with no matching alert SHALL expose a null/absent flag.

#### Scenario: Flagged measurement
- **WHEN** a measurement has a matching fired alert
- **THEN** the payload includes that measurement's alert flag

#### Scenario: Unflagged measurement
- **WHEN** a measurement has no matching alert
- **THEN** the payload exposes no flag for it
