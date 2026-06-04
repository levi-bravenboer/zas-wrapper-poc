# Proposal: access-management-ory

**Tier**: [poc] — *re-tier*: pulls "real authentication + access control" forward from `[mvp]` into the current window. The June 24 demo plan (Linear: Zas-demo workspace, Platform Foundation + Transmural & Interop projects, both Urgent) requires role-based access, patient login, and episode-bound external-clinician scoping that the stub cannot honestly demo. This change edits `scope.md` / `roadmap.md` accordingly (see tasks). Promotes backlog items `BL-020`, `BL-042`, `BL-053`; materially advances `BL-044`, `BL-048`, `BL-049`.

## Why

The PoC auth stub (signed stateless cookie + password table + a two-value role enum) was built as a deliberate placeholder — `auth_service.py` literally documents the swap seam. The target architecture in `docs/diagrams/` (Identity Broker + Access Management Engine, itsme/Entra/eHealth federation, episode-bound external access with immediate server-side revocation) is unbuildable on it: stateless cookies cannot be revoked, and `require_role(ADMIN|CAREGIVER)` cannot express "this GP may see this patient until this episode closes."

We adopt the self-hosted Ory stack as the access plane: **Kratos** for identity + sessions (authn), **Keto** as the AME (authz, Zanzibar-style relation tuples). Hydra (OAuth2/OIDC token issuance for mobile PKCE + SMART platform side) is staged as a follow-on change, not here. Postgres stays the source of truth; Keto holds a derived permission index.

## What Changes

- **Kratos replaces local credential + session handling.** Argon2id password hashes import verbatim (no resets). Backend verifies the `ory_kratos_session` cookie via `whoami` instead of itsdangerous — sessions become server-side revocable (closes `BL-042`). Identity schemas per user type (practitioner, patient, external). Existing login/logout/me route shapes preserved by proxying Kratos self-service flows — orchestrator frontend contract unchanged.
- **Keto becomes the AME.** OPL namespaces for Organisation (tree), Patient (care-team membership, treating-org chain, external episode carers), with `view` / `view_shielded` permits. New `require_permission(...)` dependency joins `require_role(...)`; `# AUTH-HARDEN` routes graduate from role-only to relation checks (closes `BL-020`, `BL-053`).
- **Tuple derivation pipeline.** Transactional-outbox writer derives tuples from `practitioner_roles`, `care_teams` participants, and org edges; a reconciler rebuilds the full tuple set from Postgres (also the day-one migration path). Episode end ⇒ tuple delete ⇒ immediate revocation, matching the External Clinician diagram.
- **User rows become projections.** `external_idp='kratos'` + `external_subject=<identity id>` populated; `password_hash` retired from the hot path (schema already permits this).
- **Local + Forge runtime.** Kratos via Forge's first-class Kratos provisioning (`create_kratos_project`); Keto as a Forge app + small PG project; docker-compose additions for local dev.
- **Governance re-tier.** `scope.md` PoC Out-of-Scope "Real authentication [mvp]" row and Mocks table updated; `roadmap.md` Identity + access items annotated; backlog entries promoted/cross-referenced.
- **NOT in this change**: Hydra, itsme/Entra/eHealth upstream IdPs (Kratos OIDC method config lands later with real IdP contracts), SMART backend, mobile token auth (PR #33 interplay noted in design).

## Capabilities

### New Capabilities
- `kratos-identity`: Kratos deployment, identity schemas, argon2 import, whoami-based session resolution, self-service flow proxying, session revocation semantics.
- `keto-authz`: Keto deployment, OPL namespace model (Organisation/Patient/CareTeam), `require_permission` dependency, shielding via permission subtraction, check/expand usage on routes.
- `authz-tuple-sync`: outbox-driven tuple writes, full-rebuild reconciler, episode-revocation flow, drift detection.

### Modified Capabilities
- `auth-stub`: session verification requirement changes from "itsdangerous signed cookie, 8h max-age" to "Kratos session cookie verified via whoami; logout revokes server-side". Login provider registry now backed by Kratos flows; password provider becomes a Kratos-proxied method.
- `user-base`: users SHALL carry `external_idp`/`external_subject` for every active identity; local `password_hash` no longer consulted for login; user lifecycle (deactivate) MUST propagate to Kratos session revocation.
- `auth-session`: frontend contract nominally preserved (same routes/shapes); requirement added that 401 semantics include server-side-revoked sessions.

## Impact

- **Backend**: `app/services/auth/*` relocates to `app/services/access/identity/*` (authenticator, deps, providers — Kratos-backed); new `app/services/access/permissions/*` (Keto client, permission deps) and `app/services/access/sync/*` (outbox relay, reconciler, sweeper); outbox table migration; settings. Layout decision: design.md D9.
- **Frontend (orchestrator)**: no route/shape changes expected; MSW handlers gain revoked-session case.
- **Mobile (PR #33)**: open PR's cookie-based `/mobile/auth/*` should rebase onto Kratos sessions (decision recorded in design.md).
- **Infra**: docker-compose (kratos, keto, migrators), Forge manifests; new env/secrets.
- **Governance**: `openspec/scope.md`, `openspec/roadmap.md`, `openspec/backlog.md` (BL-020, BL-042, BL-053 promoted; BL-044/045/048/049 annotated), new BL entry for Hydra follow-on.
- **Dependencies**: `ory-kratos-client` / `ory-keto-client` (or plain httpx), Kratos ≥ v1.x, Keto ≥ v0.12.
