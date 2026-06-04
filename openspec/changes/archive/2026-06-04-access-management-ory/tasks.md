# Tasks: access-management-ory

## 1. Governance re-tier

- [x] 1.1 Update `openspec/scope.md`: move "Real authentication" rows into the current window (Kratos sessions + Keto relation authz in scope; itsme/Entra/eHealth/Hydra stay `[mvp]`); update the Auth row in PoC Mocks and the F1 delta row
- [x] 1.2 Update `openspec/roadmap.md`: annotate Identity + access highlights (BL-042 session-revocation half landing now; BL-020/BL-053 landing now); keep current-tier flag in sync with scope.md
- [x] 1.3 Update `openspec/backlog.md`: mark BL-020, BL-042 (revocation half), BL-053 as "Promoted to `changes/access-management-ory/` on 2026-06-04"; annotate BL-044/045/048/049; file new BL entry for the Hydra follow-on (mobile PKCE tokens + SMART platform-side authz server)

## 2. Infrastructure

- [x] 2.1 Add `infra/ory/kratos/` config (kratos.yaml, identity schemas: default/practitioner/patient) with 8h session lifespan, pinned image version
- [x] 2.2 Add `infra/ory/keto/` config (keto.yaml + OPL namespaces.ts: Organisation, CareTeam, Patient with view/view_shielded permits), pinned image version
- [x] 2.3 Extend docker compose: `kratos`, `kratos-migrate`, `keto`, `keto-migrate` services + named volumes; document ports in AGENTS.md local-runtime notes
- [x] 2.4 Backend settings: `kratos_public_url`, `kratos_admin_url`, `keto_read_url`, `keto_write_url`, `authz_keto_enabled` flag (default false); production fail-fast when URLs unset
- [x] 2.5 CI smoke job: boot kratos+keto, run a login flow + a Keto check round-trip
- [ ] 2.6 Forge: provision Kratos via the Kratos primitive; deploy Keto as app + dedicated PG project; wire env/secrets (verify against `docs/setup.md` deploy story / PR #21 pipeline) — **deferred to Linear ZAS-84**: deployment work, lands with the aws-poc-deploy pipeline (PR #21); no spec delta depends on it

## 3. Kratos identity (authn swap)

- [x] 3.0 Relocate `app/services/auth/` → `app/services/access/identity/` (mechanical move + import sweep; design D9)
- [x] 3.1 `app/services/access/identity/kratos_client.py`: thin httpx client (whoami, admin identity CRUD, native login flow submit, session revocation endpoints)
- [x] 3.2 Identity import script `scripts/import_identities_kratos.py`: idempotent argon2id hash import, writes back `external_idp`/`external_subject`; unit-tested against a live local Kratos in CI smoke
- [x] 3.3 `KratosAuthenticator` implementing the `Authenticator` Protocol (native login flow submit → identity → local User mapping)
- [x] 3.4 Swap `resolve_actor_from_request` to whoami + projection lookup (dual-accept window dropped — no deployed env holds live legacy sessions; PR #21 deploy unmerged)
- [x] 3.5 Login route mints Kratos session (relay Set-Cookie via `Settings.session_cookie_name`); logout revokes server-side; keep route shapes + operation ids + audit events
- [x] 3.6 User lifecycle propagation: deactivate → revoke all sessions + disable identity; admin "log out all sessions" service method
- [x] 3.7 Remove legacy cookie acceptance + itsdangerous session path once 3.2–3.5 verified; update auth tests (FakeAuthenticator stays; add revoked-session cases)
- [x] 3.8 Orchestrator MSW: add revoked-session handler + guard test; verify zero frontend contract drift (`/openapi-sync` no-op expected)

## 4. Keto authz (AME)

- [x] 4.1 `app/services/access/permissions/keto_client.py`: check + relation-query (list objects) helpers
- [x] 4.2 `require_patient_permission(relation)` dependency (`app/services/access/permissions/deps.py`): path patient-id resolution, admin short-circuit, flag-gated; wire into `require_patient_access` (single wiring point per BL-053)
- [x] 4.3 Patient list scoping stays SQL-derived (design D5 amendment — Keto read API walks direct tuples only); detail checks via Keto
- [x] 4.4 Sweep `# AUTH-HARDEN` markers on patient/pathway routers: graduate to relation checks or document why role-only stays (partial BL-051)
- [x] 4.5 Integration tests: care-team member allowed, org-ancestor allowed, unrelated caregiver 403, external carer view-but-not-shielded, flag-off regression suite

## 5. Tuple sync (`app/services/access/sync/`)

- [x] 5.1 Migration: `authz_outbox` table (id, op, namespace, object, relation, subject, created_at, processed_at) via `/new-migration`
- [x] 5.2 Outbox writes in the same transaction via centralized before_flush hook (covers practitioner_role, care-team participant, organisation, patient, care-team mutations from any code path; external episodes have no domain table yet)
- [x] 5.3 Relay worker: apply pending rows to Keto in commit order, retry with backoff, idempotent on replay
- [x] 5.4 Reconciler: derive full tuple set from Postgres, diff against Keto, converge; runs on demand + as initial population; drift warning logs with per-namespace counts
- [x] 5.5 Episode sweeper: collapsed into scheduled `reconcile_all` (no external-episode domain table yet; participant/role closes are event-driven via the hook)
- [x] 5.6 Tests: crash-before-relay recovery, orphaned-tuple removal, revocation end-to-end (tuple delete → 403)

## 6. Verification + demo readiness

- [x] 6.1 Verified live against real Kratos+Keto: seeded identities + 33 reconciled tuples; login → Keto-checked detail 200 → logout replay 401; membership+role close → outbox → relay → 404; shielded-vs-view + external_carer proven in smoke + tests (no external-clinician UI surface exists yet — that's the Transmural project)
- [x] 6.2 PR #33 merged before this change landed; its `/mobile/auth/*` routes were rebased onto Kratos sessions in-place (design D7) — no separate plan needed
- [x] 6.3 Backend lint+typecheck+627 tests green; orchestrator lint+typecheck green, suite green except pre-existing `-users.test.tsx` load-flake (fails on main too); `apps/backend/AGENTS.md` access-plane section rewritten (`docs/repo-security.md` is GitHub-repo access docs — not applicable)
- [x] 6.4 Archive readiness: specs delta applied to `openspec/specs/`, scope/roadmap/backlog merged, CHAIN.md untouched
