## ADDED Requirements

### Requirement: Uniform `ErrorResponse` shape

All non-2xx responses from the backend SHALL serialise to `ErrorResponse { code: str, message: str, details: dict | None }`. `code` MUST be namespaced `<fhir-issue-type>.<domain>.<reason>`, where the first segment is drawn from FHIR `IssueType` (`not-found`, `invalid`, `security`, `forbidden`, `conflict`, `processing`, `transient`, `informational`). Examples: `security.auth.invalid_credentials`, `not-found.fhir.patient`, `invalid.validation.body`. This alignment makes a future `ErrorResponse → OperationOutcome` mapper mechanical.

#### Scenario: HTTPException mapped to ErrorResponse

- **WHEN** a route raises `HTTPException(status_code=404, detail={"code": "not-found.fhir.patient", "message": "Patient not found"})`
- **THEN** the response body deserialises as `ErrorResponse` with `code == "not-found.fhir.patient"` and `details == None`

#### Scenario: Validation error mapped

- **WHEN** a request body fails Pydantic validation
- **THEN** the response is 422 with `ErrorResponse { code: "invalid.validation.body", message: "Request body failed validation", details: { errors: [...] } }` and `details.errors` mirrors the Pydantic error list

#### Scenario: Custom AppError mapped

- **WHEN** a service raises a subclass of `AppError` with `code="transient.luscii.unavailable"`, `status_code=502`, `message="Luscii is unreachable"`
- **THEN** the response is 502 with the same `code`, `message`, and `details` (defaulting to `None`)

### Requirement: `AppError` base class

`app/core/errors.py` SHALL define `class AppError(Exception)` with attributes `code: str`, `status_code: int`, `message: str`, `details: dict | None = None`. Custom errors SHALL subclass it.

#### Scenario: Subclass carries defaults

- **WHEN** a developer defines `class InvalidCredentialsError(AppError)` with class-level `code`, `status_code`, `message`
- **THEN** raising `InvalidCredentialsError()` produces the mapped response without further wiring

### Requirement: Logging configured on startup

`create_app()` SHALL invoke `app.core.logging.configure_logging(settings)` exactly once on startup. JSON formatter MUST be installed when `settings.env == "production"`; human-readable formatter MUST be installed otherwise.

#### Scenario: Dev logs human-readable

- **WHEN** the dev server starts with `BACKEND_ENV=dev`
- **THEN** log records are emitted to stdout with the format `<timestamp> <level> <logger> <message> <extras-as-key=value>`

#### Scenario: Production logs JSON

- **WHEN** the server starts with `BACKEND_ENV=production`
- **THEN** log records are emitted as one JSON object per line on stdout

### Requirement: PHI logging guard

`app/core/logging.py` SHALL provide `log_fhir_ref(resource_type: str, resource_id: str) -> str` as the only sanctioned helper for mentioning FHIR resources in logs. The helper MUST return `"<resource_type>/<resource_id>"` and emit nothing else. Routes, services, and adapters MUST NOT log full FHIR payloads.

#### Scenario: Logging a FHIR resource by reference only

- **WHEN** a service logs the completion of a Patient fetch
- **THEN** the log line contains `resource=Patient/abc123` and never the full FHIR JSON body

#### Scenario: Reviewer rejects payload logging

- **WHEN** a PR adds `logger.info("fetched", extra={"payload": patient.model_dump()})`
- **THEN** the change is rejected and the diff is rewritten to use `log_fhir_ref`
