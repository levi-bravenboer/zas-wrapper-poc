# Tasks: access-management-ory

## 1. Governance re-tier

- [ ] 1.1 Update `openspec/scope.md`: move "Real authentication" rows into the current window (Kratos sessions + Keto relation authz in scope; itsme/Entra/eHealth/Hydra stay `[mvp]`); update the Auth row in PoC Mocks and the F1 delta row
- [ ] 1.2 Update `openspec/roadmap.md`: annotate Identity + access highlights (BL-042 session-revocation half landing now; BL-020/BL-053 landing now); keep current-tier flag in sync with scope.md
- [ ] 1.3 Update `openspec/backlog.md`: mark BL-020, BL-042 (revocation half), BL-053 as "Promoted to `changes/access-management-ory/` on 2026-06-04"; annotate BL-044/045/048/049; file new BL entry for the Hydra follow-on (mobile PKCE tokens + SMART platform-side authz server)

## 2. Infrastructure

- [ ] 2.1 Add `infra/ory/kratos/` config (kratos.yaml, identity schemas: default/practitioner/patient) with 8h session lifespan, pinned image version
- [ ] 2.2 Add `infra/ory/keto/` config (keto.yaml + OPL namespaces.ts: Organisation, CareTeam, Patient with view/view_shielded permits), pinned image version
- [ ] 2.3 Extend docker compose: `kratos`, `kratos-migrate`, `keto`, `keto-migrate` services + named volumes; document ports in AGENTS.md local-runtime notes
- [ ] 2.4 Backend settings: `kratos_public_url`, `kratos_admin_url`, `keto_read_url`, `keto_write_url`, `authz_keto_enabled` flag (default false); production fail-fast when URLs unset
- [ ] 2.5 CI smoke job: boot kratos+keto, run a login flow + a Keto check round-trip
- [ ] 2.6 Forge: provision Kratos via the Kratos primitive; deploy Keto as app + dedicated PG project; wire env/secrets (verify against `docs/setup.md` deploy story / PR #21 pipeline)

## 3. Kratos identity (authn swap)

- [ ] 3.1 `app/services/auth/kratos_client.py`: thin httpx client (whoami, admin identity CRUD, native login flow submit, session revocation endpoints)
- [ ] 3.2 Identity import script `scripts/import_identities_kratos.py`: idempotent argon2id hash import, writes back `external_idp`/`external_subject`; unit-tested against a live local Kratos in CI smoke
- [ ] 3.3 `KratosAuthenticator` implementing the `Authenticator` Protocol (native login flow submit → identity → local User mapping)
- [ ] 3.4 Swap `resolve_actor_from_request` to whoami + projection lookup; dual-accept window (Kratos cookie OR legacy itsdangerous cookie) behind a transition flag
- [ ] 3.5 Login route mints Kratos session (relay Set-Cookie via `Settings.session_cookie_name`); logout revokes server-side; keep route shapes + operation ids + audit events
- [ ] 3.6 User lifecycle propagation: deactivate → revoke all sessions + disable identity; admin "log out all sessions" service method
- [ ] 3.7 Remove legacy cookie acceptance + itsdangerous session path once 3.2–3.5 verified; update auth tests (FakeAuthenticator stays; add revoked-session cases)
- [ ] 3.8 Orchestrator MSW: add revoked-session handler + guard test; verify zero frontend contract drift (`/openapi-sync` no-op expected)

## 4. Keto authz (AME)

- [ ] 4.1 `app/services/authz/keto_client.py`: check + relation-query (list objects) helpers
- [ ] 4.2 `require_patient_permission(relation)` dependency: path patient-id resolution, admin short-circuit, flag-gated; wire into `require_patient_access` (single wiring point per BL-053)
- [ ] 4.3 Patient list scoping via relation query → `IN (...)` filter when flag on
- [ ] 4.4 Sweep `# AUTH-HARDEN` markers on patient/pathway routers: graduate to relation checks or document why role-only stays (partial BL-051)
- [ ] 4.5 Integration tests: care-team member allowed, org-ancestor allowed, unrelated caregiver 403, external carer view-but-not-shielded, flag-off regression suite

## 5. Tuple sync

- [ ] 5.1 Migration: `authz_outbox` table (id, op, namespace, object, relation, subject, created_at, processed_at) via `/new-migration`
- [ ] 5.2 Outbox writes in the same transaction for: practitioner_role open/close, care-team participant add/remove, organisation reparent, external episode start/end
- [ ] 5.3 Relay worker: apply pending rows to Keto in commit order, retry with backoff, idempotent on replay
- [ ] 5.4 Reconciler: derive full tuple set from Postgres, diff against Keto, converge; runs on demand + as initial population; drift warning logs with per-namespace counts
- [ ] 5.5 Episode sweeper: close date-lapsed external episodes through the same outbox path
- [ ] 5.6 Tests: crash-before-relay recovery, orphaned-tuple removal, revocation end-to-end (tuple delete → 403)

## 6. Verification + demo readiness

- [ ] 6.1 Seed demo tuples via reconciler against seeded domain data; verify demo storyboard steps 4–6 paths (external clinician scoped list, shielded item hidden, revoke → 403)
- [ ] 6.2 Decide + record PR #33 rebase plan (mobile auth onto Kratos sessions) in that PR's thread
- [ ] 6.3 Run `/verify backend` + `/verify orchestrator`; update `apps/backend/AGENTS.md` auth section + `docs/repo-security.md`
- [ ] 6.4 Archive readiness: specs delta applied to `openspec/specs/`, scope/roadmap/backlog merged, CHAIN.md untouched
