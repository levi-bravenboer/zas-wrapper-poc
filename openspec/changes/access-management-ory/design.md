# Design: access-management-ory

## Context

The PoC ships a deliberately swappable auth stub: `PasswordAuthenticator` behind an `Authenticator` Protocol, a `LoginProviderRegistry` with the `oidc` kind reserved, an itsdangerous-signed stateless cookie (`__Host-BACKEND_SESSION`, 8h), `require_role(ADMIN|CAREGIVER)`, and `User.external_idp/external_subject` columns already migrated but null. Authorization is coarse: role enum + tenant scoping + `# AUTH-HARDEN` markers on every route that needs finer rules.

The target architecture (`docs/diagrams/*.mmd`) requires an Identity Broker and an Access Management Engine: per-request entitlement checks, therapeutic-relationship scoping, episode-bound external access with immediate server-side revocation, and shielding policy (items hidden from external roles). The June 24 demo storyboard (Linear, Zas-demo) exercises exactly those flows in steps 4–6.

Decision taken in exploration (2026-06-04): adopt self-hosted Ory — **Kratos** (authn) + **Keto** (authz/AME) now, **Hydra** (token issuance) as a follow-on. "Path of least friction" is the stated selection criterion.

## Goals / Non-Goals

**Goals:**
- Server-side revocable sessions (BL-042) with zero password resets (argon2id hash import).
- Relation-based authorization for patient-scoped routes: care-team membership, org-tree reachability, episode-bound external access (BL-020, BL-053).
- Shielded-vs-normal visibility as a permission, not UI logic.
- Postgres remains source of truth; Keto is a rebuildable derived index.
- Orchestrator frontend contract unchanged (same `/auth/*` routes and `SessionUser` shape).
- Local dev (docker compose) + Forge deployment both work.

**Non-Goals:**
- Hydra / OAuth2 token issuance, SMART-on-FHIR platform-side authz server (follow-on change; BL entry filed).
- Upstream IdP federation (itsme, Entra, eHealth) — Kratos OIDC methods are configured when real IdP contracts exist (`oidc-login-providers`).
- Replacing `require_role` everywhere — admin/back-office routes stay role-guarded; Keto is for patient/pathway-scoped access.
- Patient-surface authorization via Keto (patient sees own data; ownership check in SQL is sufficient for now — revisit with mobile feature work).
- Multi-tenant Kratos topology (single ZAS tenant in this window).

## Decisions

### D1 — Kratos verified via `whoami`, backend stays the BFF
Frontend keeps calling our `/auth/login/password`, `/auth/me`, `/auth/logout`. The backend translates these to Kratos self-service flows server-side (native flow API), and `resolve_actor_from_request` (`app/services/auth/deps.py:50`) swaps cookie-signature verification for a `GET /sessions/whoami` call with the forwarded cookie. **Why**: zero frontend churn, one function changes; Kratos UI/flow redirects (browser flows) avoided entirely. **Alternative considered**: Kratos browser flows + its hosted UI — rejected, larger blast radius for no demo value.

### D2 — Argon2id hash import, users become projections
One-shot migration: for each active user, `PUT /admin/identities` with `credentials.password.config.hashed_password` (Kratos accepts argon2id natively) + traits (email, display_name, role hint). Write back `external_idp='kratos'`, `external_subject=<identity.id>`. `password_hash` column retained but dead (cleanup in a later change). **Why**: no resets, reversible (column intact → rollback is config).

### D3 — Keto model: three namespaces, two permits
OPL config:
- `Organisation`: `parent` (org), `member` (practitioner, + subject-set inheritance down the tree).
- `CareTeam`: `member` (practitioner).
- `Patient`: `treating_org` (Organisation), `care_team` (CareTeam), `external_carer` (user; tuple-existence == active episode).
- Permits: `Patient.view = care_team.member ∪ treating_org.view-chain ∪ external_carer`; `Patient.view_shielded = view − external_carer`.
**Why**: maps 1:1 onto existing tables (`practitioner_roles` open rows, `care_team_participants`, org edges). Shielding as set subtraction avoids a policy DSL. **Alternative**: OPA/custom policy engine — rejected: more moving parts, no graph semantics; staying in Ory was the brief.

### D4 — Tuple sync: transactional outbox + reconciler
Domain writes that affect access (practitioner_role open/close, care-team participant add/remove, org reparent, episode end) append an `authz_outbox` row in the same transaction; a relay applies tuple insert/delete to Keto. A reconciler derives the full expected tuple set from Postgres and diffs against Keto (`expand`/list APIs) — run on deploy (migration path), nightly, and on demand. **Why**: dual-write safety with an always-available rebuild; the reconciler IS the initial migration. **Alternative**: write tuples inline in request path — simpler but drift-on-crash with no detection; rejected as the default (acceptable behind the relay as an optimization later).

### D5 — `require_permission` joins, not replaces, `require_role`
New dependency `require_patient_permission(relation: "view" | "view_shielded")` resolves patient id from path, calls Keto `check`, 403 on deny. Wired into `require_patient_access` (`app/services/patient/deps.py`) so all guarded routes inherit it from one place (per BL-053's design note). Admin keeps tenant-wide read via role short-circuit. List endpoints use Keto list-objects/expand to build an `IN (...)` filter rather than N checks.

### D6 — Episode revocation = tuple delete (+ sweeper)
`EpisodeEnded` (care-team participant period closed / external episode closed) → outbox → relay deletes the `external_carer` tuple → next request 403s. A small sweeper closes date-lapsed episodes that never fired an event. **Why**: matches the External Clinician diagram's revoke flow exactly; Keto has no tuple TTLs.

### D7 — PR #33 (mobile auth) rebases onto Kratos sessions
The open PR's `/mobile/auth/*` cookie flow is kept shape-wise but minted by Kratos (same whoami resolution; identity schema `patient`). Token-based mobile auth (PKCE) arrives with Hydra later. **Why**: avoids merging a second bespoke session system days before swapping session systems.

### D8 — Deployment: Forge Kratos primitive + Keto as app
Forge `create_kratos_project` provisions Kratos; Keto runs as a Forge app with its own small PG project (no Forge primitive exists). Local dev: `docker compose` services `kratos`, `kratos-migrate`, `keto`, `keto-migrate` with config mounted from `infra/ory/`. Demo env seeds tuples via the reconciler against seeded domain data.

### D9 — Backend layout: one `app/services/access/` package, not a separate app
The access plane lives in a single package mirroring the spec capabilities and the diagrams: `access/identity/` (Kratos — client, authenticator, session deps; relocated from `app/services/auth/`), `access/permissions/` (Keto — check client, `require_patient_permission`), `access/sync/` (outbox, relay, reconciler, sweeper). **Why**: WHO / WHAT / SYNC is the mental model; two near-identical sibling names (`auth` / `authz`) blur it. A separate FastAPI app was rejected — Kratos and Keto already *are* the separate services; our code is thin glue that must live next to the routes and transactions it guards. Decided with the user 2026-06-04. Path references to `app/services/auth/` in pre-existing spec text resolve to `app/services/access/identity/` (swept at archive, task 6.4).

## Risks / Trade-offs

- [Keto/Postgres drift] → outbox in same tx, reconciler diff on deploy + nightly, alert on non-empty diff.
- [whoami adds a network hop per request] → Kratos co-located; sessions cached per-request only (no cross-request cache in this window); acceptable at demo scale, measure before MVP.
- [Kratos flow-proxying is more code than browser-redirect flows] → contained in one provider class; the registry seam was built for exactly this.
- [Ory version churn / config complexity] → pin versions; config in-repo under `infra/ory/`; smoke test in CI that boots both and runs login + check round-trip.
- [Demo-date risk: two new infra services] → stage order puts Kratos swap first (independently shippable); Keto guards land behind a settings flag `AUTHZ_KETO_ENABLED` — off ⇒ current role-only behavior, so the demo never blocks on Keto.
- [Re-tier widens PoC scope] → explicitly bounded: no Hydra, no upstream IdPs, no patient-surface Keto.

## Migration Plan

1. Infra up (compose + Forge), smoke-tested, app untouched.
2. Kratos identity import (idempotent script) → dual-accept window: `resolve_actor_from_request` accepts Kratos cookie OR legacy cookie → flip login to mint Kratos sessions → drop legacy acceptance.
3. Keto namespaces + reconciler initial build → `require_permission` behind `AUTHZ_KETO_ENABLED` → enable in dev/demo → outbox relay on.
4. Rollback: flag off (Keto), legacy-cookie path retained until step-2 completion makes it dead; Kratos rollback = re-enable password authenticator (hashes still in Postgres).

## Open Questions

- Identity schema traits: does `role` live as a Kratos trait (convenient) or stay only in Postgres (single source)? Leaning Postgres-only, trait carries nothing authz-relevant.
- Keto check latency budget per request once lists use expand — measure; may need the relay to also maintain a local materialized `patient_ids` cache per user at MVP scale.
- Does the demo need shielded items visibly toggling (step 4 storyboard), or is a seeded shielded block sufficient? Affects how much UI work rides along (none in this change either way).
