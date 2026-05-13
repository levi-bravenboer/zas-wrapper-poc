# cors Specification

## Purpose
TBD - created by archiving change backend-setup. Update Purpose after archive.
## Requirements
### Requirement: CORS allows the orchestrator dev origin

The backend SHALL install `CORSMiddleware` with `allow_origins=Settings.cors_origins`, `allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]`. The default dev `cors_origins` in `.env.example` MUST include `http://localhost:5173`.

#### Scenario: Preflight from orchestrator dev

- **WHEN** the browser issues `OPTIONS /auth/login` with `Origin: http://localhost:5173` and `Access-Control-Request-Method: POST`
- **THEN** the response includes `Access-Control-Allow-Origin: http://localhost:5173`, `Access-Control-Allow-Credentials: true`, and the request method in the allow list

#### Scenario: Cookie travels with cross-origin request

- **WHEN** the orchestrator calls `client.GET('/auth/me')` from `http://localhost:5173` with `credentials: 'include'` and a valid session cookie
- **THEN** the request reaches the route and the cookie is read by the auth dependency

### Requirement: Unknown origins are rejected

Requests from origins NOT listed in `Settings.cors_origins` SHALL receive responses without CORS headers, blocking the browser from reading the body. Server-side handling of the request is unaffected (CORS is a browser-side rule), but the response MUST NOT carry `Access-Control-Allow-Origin` for unlisted origins.

#### Scenario: Unlisted origin blocked

- **WHEN** a browser at `http://evil.example` issues a credentialed `GET /auth/me`
- **THEN** the response has no `Access-Control-Allow-Origin` header and the browser refuses to expose the body to JavaScript

