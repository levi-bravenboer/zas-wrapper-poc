# auth-session Delta

## ADDED Requirements

### Requirement: Revoked sessions surface as logged-out
The orchestrator session handling SHALL treat a 401 caused by server-side session revocation identically to an expired session: `useSession()` resolves to `null`, protected routes redirect to `/login?redirect=<href>`, and the one-shot 401 retry MUST NOT mask the redirect (a revoked session fails the retry too). No frontend contract changes are required beyond this semantic: route shapes, `SessionUser` schema, and provider discovery remain as specified.

#### Scenario: Mid-session revocation redirects to login
- **WHEN** a logged-in caregiver's session is revoked server-side and they trigger any query or navigation
- **THEN** the app lands on `/login` with the prior location preserved in `?redirect=`

#### Scenario: MSW covers the revoked case
- **WHEN** frontend tests exercise the revoked-session path
- **THEN** an MSW handler simulates `GET /auth/me` returning 401 after a previously-successful session, and the guard behavior is asserted
