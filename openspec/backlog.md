# Backlog

Parking lot for findings, ideas, and deferred work that is **not actionable as a change yet** but must not be lost.

## Legend

**Entry format.** Each item is:

```
### BL-NNN — Short title
- Tier: [poc] | [mvp] | [product]
- Source: where it came from (RFP doc, conversation, code review, etc.)

Note: one paragraph describing what this is and why it's parked here.
```

**Tier values.**
- `[poc]` — should be in PoC but isn't yet (rare; usually a missed-from-scope finding).
- `[mvp]` — needed for first paying release.
- `[product]` — productised expansion + polish after MVP.

**Graduation rule.** A backlog item becomes a real change when its tier matches the current scope window AND a stakeholder commits to the work. At that point: create `openspec/changes/<name>/`, cite the `BL-NNN` ID in `proposal.md`, and update this entry to note it has been promoted (don't delete — kept as audit trail).

**ID assignment.** IDs are stable. Never reuse. New entries get the next available `BL-NNN`.

---

## Integration

### BL-001 — HiX live FHIR adapter
- Tier: [mvp]
- Source: backend-setup change, openspec/project.md original purpose

Note: PoC uses no HiX integration. MVP requires SMART-on-FHIR launch + FHIR R4 read/write + adapter Protocol wired to live HiX endpoints.

### BL-002 — Raw `/fhir/*` passthrough routes
- Tier: [product]
- Source: backend-setup change

Note: Once the HiX adapter is live, expose raw FHIR endpoints (`/fhir/Patient/{id}` etc.) for callers that want unmediated access. Layered on top of the same adapter, no duplication.

### BL-003 — FHIR `CapabilityStatement`
- Tier: [product]
- Source: backend-setup change

Note: When `/fhir/*` lands, publish a `CapabilityStatement` resource at `/fhir/metadata` advertising supported resources + interactions. Discovery for downstream consumers.

### BL-004 — Full Luscii pathway mapping
- Tier: [mvp]
- Source: backend-setup change, Luscii research notes

Note: PoC stubs Luscii clinical care paths as static JSON blocks. MVP requires a real `pathway_to_careplan` mapper + reverse mapper, sourced from the Luscii Builder API, and observed task ingestion via webhook.

### BL-005 — `OperationOutcome` error translation
- Tier: [mvp]
- Source: backend-setup change

Note: PoC uses a flat `ErrorResponse` with FHIR-aligned error codes. MVP should translate to `OperationOutcome` resources on `/fhir/*` routes; non-FHIR routes can keep the flat envelope or adopt OperationOutcome too — TBD.

### BL-006 — `If-Match` / `ETag` versioning
- Tier: [mvp]
- Source: backend-setup change

Note: FHIR-conformant write endpoints need optimistic concurrency via `ETag` / `If-Match` headers. Out of scope for PoC since no write endpoints face HiX. Required when real HiX writes land.

### BL-007 — MCP server host
- Tier: [product]
- Source: openspec/project.md, agentic-research

Note: Backend is meant to host an MCP server for agentic tooling. Not in PoC scope. Track as `product` until product clarity on which capabilities are MCP-exposed.

### BL-008 — Luscii Vitals embed contract
- Tier: [mvp]
- Source: RFP working doc — "Luscii Vitals viewer embedded in Orchestrator"

Note: Caregivers need to view Luscii monitoring data from inside Orchestrator. Mechanism TBD: iframe? deep-link? SSO? **Promoted to `changes/luscii-patient-enrichment/` on 2026-06-10** — mechanism chosen: native render via the Luscii public API (live proxy, display-only, bearer token). Remaining MVP-tier follow-ups: response caching / sync-into-DB, builder programme-picker live migration, webhooks/alerts.

### BL-009 — Non-HiX patient enrollment
- Tier: [mvp]
- Source: RFP working doc, user disagreement noted

Note: External caregivers may need to enroll patients who don't exist in HiX. RFP author flagged user disagreement on this requirement. Resolve scope before MVP.

### BL-010 — HiX admin coordination
- Tier: [mvp]
- Source: RFP working doc

Note: Admin work spans Reaktor tools + Luscii + HiX. HiX admin tasks owned by ZAS, but we may need to coordinate config + integrations. Define the admin handoff at MVP.

---

## Product

### BL-011 — Order form necessity
- Tier: [mvp]
- Source: RFP working doc TBD

Note: Caregiver flow assumes an "order form" step to configure pathway parameters on enrollment. Whether this is a separate UI or inline in the enrollment flow is TBD. Decide before MVP enrollment work starts.

### BL-012 — Task list location
- Tier: [mvp]
- Source: RFP working doc TBD

Note: Where tasks live — only in HiX inbox (single inbox principle), only in Orchestrator, or both with sync. PoC puts them only in Orchestrator. MVP likely "both with sync" but confirm with ZAS clinical leads.

### BL-013 — Monitoring app branding
- Tier: [mvp]
- Source: RFP working doc TBD

Note: Patient-facing monitoring app — is it branded Luscii, ZAS, or co-branded? Affects patient-view shape (BL-014).

### BL-014 — Patient view shape
- Tier: [mvp]
- Source: RFP working doc, user PoC summary explicitly excludes patient

Note: Patient view of Pathway Orchestrator delivery channel TBD: email link, HiX Patient Portal link, Luscii deep-link, dedicated app, PWA. Decision blocks F5 (patient view) MVP delta. **Shell promoted to PoC via `digital-front-door-setup` on 2026-06-02 — dedicated Expo mobile app at `apps/digital-front-door` is the chosen vessel; feature shape + delivery-channel decisions remain MVP-tier.**

### BL-015 — Video call delivery
- Tier: [mvp]
- Source: RFP working doc TBD

Note: Video appointments part of pathways. Delivery mechanism (provider, embedding) TBD.

### BL-016 — Auto interpreter booking
- Tier: [product]
- Source: RFP working doc

Note: When patient's language is not spoken by the caregiver, auto-book an interpreter slot. Nice-to-have, not MVP-critical.

### BL-017 — Informed consent flow
- Tier: [mvp]
- Source: RFP working doc

Note: Pathways include informed consent step. Implementation (signed PDF, structured FHIR Consent, third-party tool) TBD.

### BL-018 — Document signing
- Tier: [mvp]
- Source: RFP working doc

Note: Pathways include patient-signed documents. Signature provider + storage TBD.

### BL-019 — Lab appointments, external visits, referrals, milestones
- Tier: [mvp]
- Source: RFP working doc

Note: Pathway block types beyond the PoC builder's vocabulary. Each likely needs its own backend integration story (LIS for labs, referral letter formats, etc.). Group together for now; split when scope clears.

### BL-020 — Access control granularity
- Tier: [mvp]
- Source: RFP working doc TBD

Note: Who can see which patient, which pathway, which task. PoC has none. Define ACL model before any external caregiver flow ships. **Promoted to `changes/access-management-ory/` on 2026-06-04 — ACL model is Keto relation tuples (care-team / org-tree / external-episode) behind `AUTHZ_KETO_ENABLED`.**

### BL-021 — Carepath Builder naming
- Tier: [product]
- Source: RFP working doc TBD

Note: "Pathway Designer" vs "Carepath Builder" vs other naming. Cosmetic but needs settling for marketing + UI strings.

### BL-022 — Patient-view enrollment activation
- Tier: [mvp]
- Source: RFP working doc

Note: From the patient view, patient can activate their enrollment (consent + Luscii download). PoC excludes patient touchpoint; revisit at MVP. **Shell promoted to PoC via `digital-front-door-setup` on 2026-06-02 (`apps/digital-front-door`); patient login promoted to PoC via `mobile-app-auth-setup` on 2026-06-03 (cookie-session reuse + biometric unlock + 30d session). Activation flow + consent UX remain MVP-tier (`oidc-login-providers` adds eID/itsme).**

---

## Process

### BL-023 — Tier validator hook
- Tier: [poc]
- Source: define-poc-scope change, Q11 decision

Note: Extend `openspec change validate` (or pre-commit) to fail when `proposal.md` lacks a tier line. Human enforcement first; automation later. Cheap if `openspec` CLI is extensible.

### BL-024 — Backlog item status field
- Tier: [product]
- Source: define-poc-scope change, Q9 decision

Note: Add `status: open | promoted | dropped` to each entry. Skipped at PoC because promoted items move to `changes/` (status is implicit). Reconsider if backlog grows past ~50 entries.

### BL-025 — Re-scope `backend-setup` change section 12 (FHIR-ready domain layer)
- Tier: [poc]
- Source: define-poc-scope change, section 6 of tasks.md

Note: Section 12 of `backend-setup` introduced FHIR-shaped domain artifacts (fhir.resources types, `PatientSummary`, view-model DTOs, search-param models, FHIR-verb HiX adapter, `/patients/{id}` route) that the new PoC scope flags as out-of-tier. **Resolved** by `align-stack-with-poc-scope` on 2026-05-13 — section 1 narrowed HiX to `ping()` and removed FHIR placeholders; section 3 added the structural foundation (persistence, repositories layer, UoW session, layered AGENTS.md); section 4 removed orchestrator smart-launch.

### BL-026 — Re-tier `orchestrator-fhir-ready` change
- Tier: [mvp]
- Source: define-poc-scope change, Q13 decision

Note: Pre-existing change. Re-tiered to `[mvp]` on 2026-05-13 — PoC has no FHIR per `openspec/scope.md`. Change folder kept (design work preserved) but tagged dormant in `proposal.md`. Promote when `[mvp]` window opens; re-read against `scope.md` first.

### BL-027 — Seed dev/demo data
- Tier: [poc]
- Source: define-poc-scope change, Q13 decision

Note: Re-tier task obsolete — original `dev-data-seeding` change folder lost in rebase (2026-05-13). Concept preserved here. Seeded fake patients + pathways + tasks are explicit PoC mocks (`scope.md` PoC Mocks). Author a fresh `[poc]` change when backend models stabilise enough to fixture against.

### BL-028 — Agent sandbox spike
- Tier: [product]
- Source: define-poc-scope change, Q13 decision; user note "dev experience"

Note: Re-tier task obsolete — original `agent-sandbox-spike` change folder lost in rebase (2026-05-13). Concept preserved here. Developer-experience prototype, no PoC dependency. Park at `[product]` unless a concrete PoC blocker surfaces.

### BL-029 — Dev sandbox skills
- Tier: [product]
- Source: define-poc-scope change, Q13 decision

Note: Re-tier task obsolete — original `dev-sandbox-skills` change folder lost in rebase (2026-05-13). Concept preserved here. Developer-experience adjacent. Park at `[product]`; revisit if a PoC use case emerges.

### BL-030 — Patient app shape decision
- Tier: [mvp]
- Source: openspec/project.md previous "patient app shell" mention

Note: Original `apps/` plan mentioned a patient app shell. New scope defers patient entirely to MVP. When MVP picks up F5 patient view, decide: separate `apps/patient` or extension of orchestrator? **Resolved by `digital-front-door-setup` on 2026-06-02: separate dedicated app at `apps/digital-front-door` (Expo SDK 55, RN + web). Shell promoted to PoC; feature shape + delivery-channel decisions remain MVP-tier.**

### BL-031 — Pathway publish step
- Tier: [mvp]
- Source: define-poc-scope review (gap analysis)

Note: PoC treats "saved in builder = enrollable". MVP likely needs a Publish step that signs off, versions, and exposes a pathway for enrollment. Audit trail + rollback semantics TBD.

### BL-032 — Task creation semantics
- Tier: [poc]
- Source: define-poc-scope review (gap analysis)

Note: F6 task view shows tasks but PoC scope does not define **how** tasks are created. Options: seeded in DB, auto-generated from pathway timeline, caregiver-created manually. Decision needed before F6 implementation lands.

### BL-033 — Demo pathway content
- Tier: [poc]
- Source: define-poc-scope review (gap analysis)

Note: Which pathway powers the June demo? Holter (cardiology), Rugrevalidatie (rehab), or a generic test pathway? Affects fixture content + Luscii mock JSON shape. Pick before F3/F5 implementation lands.

### BL-034 — Real patient data invariant — surface in CI
- Tier: [mvp]
- Source: define-poc-scope, hard constraint

Note: "No real patient data" is now a project-wide invariant. Consider a CI lint that scans fixtures + screenshots for RRN-shaped strings, real-looking names from a heuristic list. Out of PoC scope but should not be forgotten.

### BL-035 — F1 user + auth domain
- Tier: [poc]
- Source: align-stack-with-poc-scope, scope narrowed 2026-05-13; login-screen wiring carve-out added 2026-05-15

Note: F1 backend domain lands as its own `[poc]` change in its own worktree. Shape (tables, services, routes, schemas) is designed inside that change — not pre-decided here. Orchestrator `modules/auth/` already exists; the change wires it to the new backend surface.

Login-screen wiring carve-out: `orchestrator-shell-restart` builds the `/login` screen with a placeholder submit handler that navigates to `/dashboard` unconditionally (no validation, no auth call). BL-035 replaces that placeholder with: frontend field validation, `useLogin` mutation against the hard-coded user table, cookie-session set-cookie round-trip, `?redirect=` search-param honouring, and failure-state rendering. The screen visuals + layout MUST NOT change — BL-035 only wires behaviour to the already-built form.

Promoted to `changes/add-auth-provider-seam/` on 2026-05-15 (login-screen wiring carve-out + `LoginProvider` route-shape seam for the future eID / itsme® / CSAM swap; concrete OIDC providers track under a separate `[mvp]` backlog entry filed when this change archives).

### BL-036 — F3 pathway domain
- Tier: [poc]
- Source: align-stack-with-poc-scope, scope narrowed 2026-05-13
- Promoted: 2026-05-17 to `changes/pathway-builder-base/` (backend pathway + version domain, orchestrator builder canvas, version surface)

Note: F3 backend domain lands as its own `[poc]` change in its own worktree. Shape is designed inside that change. Orchestrator pathway module + composer skeleton land with the same change.

### BL-037 — F4 patient domain
- Tier: [poc]
- Source: align-stack-with-poc-scope, scope narrowed 2026-05-13
- Promoted: 2026-06-10 to `changes/2026-06-10-patient-inbox/` (inbox surface + appointment-base domain + master/detail split-pane + surface-agnostic `<PatientDetailView>`)

Note: F4 backend domain + orchestrator patients-overview land as their own `[poc]` change in their own worktree. Shape is designed inside that change.

### BL-038 — F5 / F6 enrollment + task runtime
- Tier: [poc]
- Source: align-stack-with-poc-scope, scope narrowed 2026-05-13

Note: F5 + F6 backend runtime + orchestrator task inbox + patient-view pathway viz land as their own `[poc]` change in their own worktree. Shape is designed inside that change. Depends on BL-036 + BL-037.

### BL-039 — F8 admin domain
- Tier: [poc]
- Source: align-stack-with-poc-scope, scope narrowed 2026-05-13

Note: F8 backend admin surface + orchestrator `instellingen.tsx` land as their own `[poc]` change in their own worktree. Shape is designed inside that change. Depends on BL-035.

### BL-040 — F2 dashboard counts
- Tier: [poc]
- Source: align-stack-with-poc-scope, scope narrowed 2026-05-13

Note: F2 backend aggregation + orchestrator dashboard wiring land as their own `[poc]` change in their own worktree. Shape is designed inside that change. Depends on BL-036 + BL-037 + BL-038.

### BL-041 — Seed data + MSW handlers
- Tier: [poc]
- Source: align-stack-with-poc-scope, scope narrowed 2026-05-13

Note: Seed-data strategy + orchestrator MSW handlers land as their own `[poc]` change in their own worktree once domain shapes stabilise. Depends on BL-035..BL-040.

## Auth compliance gaps (filed by `add-auth-provider-seam` on 2026-05-15)

The `add-auth-provider-seam` PoC change ships F1 login + the route-shape seam for Belgian IdPs and includes the cheap compliance items (audit log, `__Host-` cookie prefix in prod, RRN clause, production bootstrap-password guard). The items below are the deferred MVP compliance gates that block any deployment touching real patient data. They are NOT PoC blockers — the project-wide "no real patient data" invariant covers PoC. They become hard blockers at MVP, regardless of IdP integration progress.

### BL-042 — Server-side session revocation
- Tier: [mvp]
- Source: add-auth-provider-seam compliance review (2026-05-15)

Note: PoC session is a stateless `itsdangerous`-signed cookie carrying the user id. A stolen cookie is valid until the 8h expiry; logout only clears the client cookie. MVP needs a `sessions` table (id, user_id, issued_at, last_seen_at, expires_at, revoked_at, ip, user_agent) and the cookie payload becomes the opaque session id. `auth.logout`, password change, role demotion, and "log out all sessions" admin action all flip `revoked_at`. Promotes the PoC `auth.login.*` stdout log lines to a queryable `auth_audit` table at the same time. **Revocation half promoted to `changes/access-management-ory/` on 2026-06-04 — sessions live in Kratos (no bespoke `sessions` table needed); logout / deactivation / log-out-all revoke server-side. The `auth_audit` table half stays parked here.**

### BL-043 — Login rate limiting + account lockout
- Tier: [mvp]
- Source: add-auth-provider-seam compliance review (2026-05-15)

Note: `POST /auth/login/password` has no rate limit or lockout in PoC. GDPR Art 32 (appropriate security measures) + eHealth Platform deontological code require brute-force mitigation. MVP: per-IP and per-email sliding-window limit, account lockout after N consecutive failures with admin-unlock path. Lives in FastAPI middleware or `slowapi`; reuses the `auth.login.failure` event stream for counting.

### BL-044 — MFA / strong auth via OIDC IdPs (LoA High)
- Tier: [mvp]
- Source: add-auth-provider-seam compliance review (2026-05-15)

Note: Caregivers accessing patient data require strong authentication per eHealth Platform requirements (LoA High under eIDAS). MVP delegates to itsme® / eID — both provide LoA High natively, so MFA is the IdP's responsibility, not ours. The password provider MUST be locked to non-clinical roles (admin bootstrap only) or removed entirely at MVP. Decision lands in the future `oidc-login-providers` change. *(2026-06-04: `access-management-ory` moves credentials into Kratos — itsme®/eID arrive as Kratos OIDC methods, and Kratos TOTP/WebAuthn is available as an interim MFA fallback if needed.)*

### BL-045 — RP-initiated logout (OIDC `end_session_endpoint`)
- Tier: [mvp]
- Source: add-auth-provider-seam compliance review (2026-05-15)

Note: When a caregiver logs out from Orchestrator and the session was minted by an OIDC provider, MVP must call the IdP's `end_session_endpoint` so the session is revoked at the IdP too. Otherwise the next "Sign in with itsme®" click silently re-mints a session without the user noticing. Implementation: extend `LoginProvider` (or add a sibling Protocol) with `async def end_session(session: SessionUser) -> RedirectResponse | None`. Frontend respects the returned redirect. *(2026-06-04: after `access-management-ory`, local logout revokes the Kratos session server-side; this entry narrows to propagating logout upstream to federated IdPs once `oidc-login-providers` lands.)*

### BL-046 — DPIA pointer + skeleton
- Tier: [mvp]
- Source: add-auth-provider-seam compliance review (2026-05-15)

Note: GDPR Art 35 mandates a Data Protection Impact Assessment for processing health data on this scale. Not an auth-domain artifact, but auth flows are a section in the DPIA. Add `docs/compliance/dpia.md` with: data inventory (auth fields, audit log fields, session table fields), lawful basis (Art 6 + Art 9 — likely contract + medical purposes), recipients (NewWave Care broker, Luscii, ChipSoft), retention, risks + mitigations, sign-off. Skeleton goes in MVP; legal sign-off depends on ZAS DPO involvement.

### BL-047 — SMART-on-FHIR bearer-token auth path
- Tier: [mvp]
- Source: add-auth-provider-seam compliance review (2026-05-15)

Note: When the HiX live FHIR adapter (`BL-001`) lands, `/fhir/*` routes need to accept short-lived JWT bearer tokens issued by HiX's SMART authorization server alongside the orchestrator's cookie session. Architecturally compatible with current cookie-session: add an `Authorization: Bearer` dependency that resolves to the same `SessionUser` shape (mapping the SMART context to our user via tenant + `external_subject` / `email` lookup). Wires into `CurrentUserDep` as an additional auth resolver. Does not affect this change; filed so the seam stays present in design discussions.

### BL-048 — OIDC hardening requirements (PKCE, state, nonce, JWKS)
- Tier: [mvp]
- Source: add-auth-provider-seam compliance review (2026-05-15)

Note: Filed against the future `oidc-login-providers` change. Concrete provider implementations MUST: use PKCE on the authorization code flow; validate `state` round-trip; validate `nonce` in the ID token; verify ID token signature against the IdP's JWKS endpoint; validate `iss`, `aud`, `exp`, `iat`, `nbf` claims; reject unsupported `alg` values; bind the post-login redirect to the `state` so the OIDC callback cannot be replayed against a different destination. Codify these as `auth-stub` requirements when that change lands. *(2026-06-04: after `access-management-ory`, upstream IdPs land as Kratos OIDC methods — Kratos implements PKCE/state/nonce/JWKS validation; this entry becomes "verify Kratos OIDC method config meets these requirements" rather than hand-rolling them.)*

### BL-049 — Password reset / credential lifecycle
- Tier: [mvp]
- Source: add-auth-provider-seam compliance review (2026-05-15)

Note: No password reset flow exists. If the password provider survives MVP for bootstrap admins, it needs: time-boxed reset tokens, email delivery (notifications stack is `[mvp]` work too), forced rotation on first login, password complexity policy. If the password provider is retired at MVP (BL-044 outcome), this becomes a no-op — admin bootstrap moves to a CLI command that writes a one-time eID-link token. Decision deferred to BL-044 + `oidc-login-providers` planning. *(2026-06-04: after `access-management-ory`, credential lifecycle is Kratos's — its self-service recovery flow (link/code via courier) covers reset once SMTP exists; complexity/rotation are Kratos config, not custom code.)*

### BL-050 — Multi-pod realtime broadcaster
- Tier: [mvp]
- Source: add-datatable-base change (§8 backend docs)

Note: `add-datatable-base` ships an in-memory `RealtimePubSub` in `app/realtime/pubsub.py` that fans `after_commit` events out to SSE subscribers on `GET /events`. The bus is process-local — events published on pod A are invisible to subscribers on pod B. PoC runs single-pod so this is fine. MVP horizontal scale needs a shared broker (Redis pub/sub, NATS, or Postgres `LISTEN`/`NOTIFY`) sitting behind the same `RealtimePubSub` interface so any pod's `after_commit` reaches every subscriber regardless of which pod accepted the SSE connection. Keep the publish/subscribe seam stable so swapping the transport is a single-module change.

## Patients-base follow-ups (filed by `patients-base` on 2026-05-15)

### BL-051 — AUTH-HARDEN sweep
- Tier: [mvp]
- Source: patients-base change

Note: Every `# AUTH-HARDEN` marker in `app/api/routers/**` and `app/services/**` records a PoC-grade authorisation decision (role-only / tenant-only) that MVP needs to revisit once the patient-level ACL and org-tree visibility rules are defined. Sweep all markers in a single dedicated change before the first MVP cut.

### BL-052 — Patient identifier column encryption
- Tier: [mvp]
- Source: patients-base change

Note: `patient_identifiers.value` (INSZ today, MRN tomorrow) stores plaintext at PoC because the seed cohort is synthetic. Before BL-034's "no real patient data" guard is relaxed for an MVP customer, encrypt this column at rest (pgcrypto or app-level envelope) and re-test the partial-unique index path. Gated by BL-034.

### BL-053 — Patient-level ACL wiring on `require_patient_access`
- Tier: [mvp]
- Source: patients-base change

Note: `app/services/patient/deps.py::require_patient_access` is tenant-scope-only at PoC. MVP wires the BL-020 ACL model (caregiver sees only patients in their care-team / delegated-care subtree; admin keeps tenant-wide read). Body lives in `require_patient_access` so all four guarded routes pick up the new rule from one place. **Promoted to `changes/access-management-ory/` on 2026-06-04 — `require_patient_permission` (Keto check) wires into `require_patient_access` exactly as designed here.**

### BL-054 — Patient names / addresses / telecoms child tables
- Tier: [mvp]
- Source: patients-base change

Note: `patients-base` keeps a single `given_name` / `family_name` pair on the row. FHIR R4 `Patient.name`, `Patient.address`, `Patient.telecom` are all `0..*`. The HiX adapter (BL-001) will surface alternate names + contact rows on day one; land `patient_names` / `patient_addresses` / `patient_telecoms` child tables alongside the adapter so the projection stays lossless.

### BL-055 — Create-patient dialog (POST /patients) for the overview
- Tier: [poc]
- Source: patients-base change

Note: `patients-base` ships the `/_auth/patients` overview without a create-patient action to keep the PR scope tight. Backend `POST /patients` is live and tenant-scoped; the dialog needs a controlled form (demographics + at least one identifier, with INSZ Mod-97 validation surfaced inline), tied into the page header's actions slot, and invalidating the `patientsListKeyPrefix` query key on success. Should reuse shadcn Dialog + Form primitives. Pre-requisite for the Rugrevalidatie demo flow that wants ad-hoc patient creation outside the seed cohort.

### BL-056 — Pathway builder + runtime (auto-assignment of patients to teams)
- Tier: [mvp]
- Source: care-teams-base change

Note: `care-teams-base` ships manual team + participant management. MVP needs a pathway/workflow runtime that automatically assigns patients to organisations and care teams (e.g. on referral intake, on enrolment trigger). Until this lands, every team membership is hand-curated, which doesn't scale past the demo. Depends on a future workflow/pathway domain (see BL-036).

### BL-057 — `Encounter.participant` per-visit modelling
- Tier: [product]
- Source: care-teams-base change

Note: `CareTeam.participant` covers ongoing membership across the longitudinal record. FHIR `Encounter.participant` is the visit-scoped equivalent (who was actually in the room for this consult). Lands with the clinical-data change that introduces `Encounter`; out of scope for the administrative care-team chain.

### BL-058 — `EpisodeOfCare` wrapping CareTeam
- Tier: [product]
- Source: care-teams-base change

Note: FHIR `EpisodeOfCare` groups multiple care teams + encounters under one clinical reason (e.g. "rugrevalidatie 2026-Q3 cohort"). Useful when a patient has overlapping pathways or when reporting needs to aggregate across teams. Bundled into the future clinical-data work alongside `Encounter` and `Condition`.

### BL-059 — Free codeable concept for `role_in_care`
- Tier: [product]
- Source: care-teams-base change

Note: `role_in_care` is a closed Postgres enum (`primary | consulting | observer`) for PoC. FHIR `CareTeam.participant.role` is a `CodeableConcept`, allowing site-specific roles. Widen to a `(system, code, display)` tuple when a real customer needs roles beyond the three values. Additive — existing data maps cleanly onto the default coding system.

### BL-060 — `CareTeam.managingOrganization` column
- Tier: [mvp]
- Source: care-teams-base change

Note: FHIR `CareTeam.managingOrganization` records the organisation accountable for the team itself (separate from each participant's `on_behalf_of_organisation_id`). Useful for cross-organisation cases — e.g. a team owned by a specialist clinic with a GP participant on behalf of their practice. Adds a nullable FK to `organisations`; deferred until MVP customer requires the distinction.

### BL-061 — `PractitionerRole.specialty` as open CodeableConcept
- Tier: [product]
- Source: practitioner-role-split change

Note: `specialty` is nullable free text for PoC. FHIR `PractitionerRole.specialty` is a `CodeableConcept` (typically SNOMED). Widen to `(system, code, display)` tuple when a real customer needs structured specialty filtering — e.g. "all GPs with specialty=cardiology in tenant X". Additive — existing free-text values map to a default coding system.

### BL-062 — Free `PractitionerRoleCode` widening
- Tier: [product]
- Source: practitioner-role-split change

Note: `practitioner_role_code` is a closed Postgres enum (`gp | physiotherapist | psychologist | nurse | physician | other`) for PoC. FHIR `PractitionerRole.code` is a `CodeableConcept` so customers can register site-specific roles. Widen when a real tenant needs values beyond the closed set. Migration path: add `(system, code, display)` columns + view that preserves the enum during the transition.

### BL-063 — Cross-tenant Practitioner federation
- Tier: [product]
- Source: practitioner-role-split change

Note: `Practitioner` is tenant-owned (1 row per `User`). FHIR models `Practitioner` as a globally identifiable resource that can hold `PractitionerRole` rows in multiple organisations across tenants. Land when we have a real federation requirement (e.g. a GP who consults across two ZAS-style customers). Additive: introduce a tenant-shared `practitioners` projection plus a federation identifier; existing rows keep their tenant scoping.

### BL-064 — Dashboard KPI list endpoints
- Tier: [poc]
- Source: caregiver-shell change (`F2` Dashboard tile wiring)

Note: `DashboardLanding` needs counts for **Open care teams** and **Recent assignments**, but the backend only exposes patient-scoped `/patients/{id}/care-teams` and care-team-scoped `/care-teams/{id}/participants` — no global `GET /care-teams?is_open=true` or `GET /care-team-participants?period_start_gte=…`. PoC ships the tiles with `enabled: false` so they render em-dashes; promote when `care-teams-ui` exposes the global list routes (or when a thin aggregate endpoint is added).

### BL-065 — Real Inbox surface
- Tier: [poc]
- Source: caregiver-shell change (sidebar inventory)
- Promoted: 2026-06-10 to `changes/2026-06-10-patient-inbox/` (inbox-base capability + `/_auth/inbox` surface + polymorphic item dispatcher; v1 ships Appointment items)

Note: `/inbox` route is reserved in the sidebar but unimplemented. PoC ships a placeholder; replace with an Inbox view (task list across patients) once the tasks surface is fleshed out.

### ~~BL-066 — Per-semantic Zod schemas for `PathwayBlock.config`~~ — resolved by pathway-config-forms (2026-05-17)
- Tier: [mvp]
- Source: style-check review (2026-05-17), follows pathway-block-redesign

Resolved: `apps/orchestrator/src/modules/pathway/configSchemas.ts` now defines one Zod schema per `BlockSemantics`. `blockCatalogue.utils.ts` parses on read and the `asString` / `asArray` shims are gone. Inspector forms and the drawer error banner consume the typed `ConfigForSemantics<S>` discriminated union; parse failures surface a reset-to-default UX in `BuilderDrawer.tsx`.

## Filed by access-management-ory (2026-06-04)

### BL-067 — Hydra: OAuth2/OIDC token issuance (mobile PKCE + SMART platform side)
- Tier: [mvp]
- Source: access-management-ory design (Hydra explicitly excluded from the PoC slice)

Note: `access-management-ory` ships Kratos (sessions) + Keto (relation authz) but no token issuance. MVP adds Ory Hydra as the platform's OAuth2/OIDC authorization server: (a) the mobile app moves from cookie-session reuse to authorization-code + PKCE bearer tokens (interplays with BL-047's SMART bearer path on `/fhir/*`); (b) Hydra plays the platform-side SMART-on-FHIR authorization server for embedded/launched surfaces, with Kratos as its login+consent backend. Forge has a first-class Hydra primitive (`create_hydra_project`), so provisioning is cheap; the work is the consent app, token-accepting deps alongside `CurrentUserDep`, and client registration story.

## Filed by access-entitlements (2026-06-04)

### BL-068 — Post-closure read-only access with retention windows
- Tier: [mvp]
- Source: Lastenboek REQ-FUN-145 (deferred from `access-entitlements`)

Note: After a carepath closes, users keep configurable read-only access per user type (e.g. patient 1y, ZAS provider 3y, external via CoZo if the therapeutic relation existed during the active phase), with automatic archival/removal after the window. Temporal permits don't fit Keto set algebra directly — likely a derivation predicate (closed-carepath grants with end dates swept like break-glass) + read-only route mode. Needs the enrollment/closure lifecycle to exist first.

### BL-069 — Access audit log + admin dashboard
- Tier: [mvp]
- Source: Lastenboek REQ-FUN-122/128/129/130/131/156/161 (deferred from `access-entitlements`)

Note: Structured access-event log (login, view/modify patient data, shielded-access attempts incl. denials, break-glass usage) with metadata (timestamp, user, active role, action, IP, entity), admin dashboard with filter/export (CSV/JSON), near-real-time suspicious-action warnings, configurable retention, tamper-evidence (ordinary users cannot modify). PoC now has an append-only `audit_events` store (`backend-audit-event-logging` + `pathway-audit`) plus a minimal **read-only** admin viewer carved out as `[poc]` via `audit-log-view` (2026-06-17). This entry retains the `[mvp]` heavyweight DASHBOARD scope: export (CSV/JSON), near-real-time suspicious-action warnings, configurable retention, tamper-evidence, resource-name resolution/links, and access-enforcement events (shielded-access attempts/denials, break-glass usage). Break-glass grants (access-entitlements) already capture reason + grantor — the dashboard surfaces them.

### BL-070 — SCIM/IAM provisioning + AD/LDAP intake
- Tier: [mvp]
- Source: Lastenboek REQ-NON-5/6 (deferred from `access-entitlements`)

Note: ZAS wants user lifecycle (create/update/role-assign/deactivate, individual + bulk) driven by their central IAM over standards (SCIM, SAML, OIDC), with ZAS-identity intake (LDAP/AD codes). Kratos admin API is the natural SCIM target; role assignment maps to our `users` rows (one per role after `access-entitlements`' multi-role model). Bulk ops must ride the outbox so Keto stays in sync (bulk SQL caveat applies).

### BL-071 — CSAM Mandatenbeheer intake for representatives
- Tier: [mvp]
- Source: Lastenboek REQ-FUN-3 (deferred from `access-entitlements`; interplays with `oidc-login-providers` + BL-067)

Note: Representative/trusted-person relationships should come from CSAM mandate registration where possible, with self-service onboarding (invitation links, itsme/eID identification) and ZAS-assisted setup as fallback. In our model a mandate becomes a consent-backed grant (same shape as `external_grants`) whose source is the federal mandate registry instead of local administration. Requires the eHealth/itsme federation seam (`oidc-login-providers`).

## Filed by patient-inbox (2026-06-10)

### BL-072 — Frontend write actions on appointments
- Tier: [mvp]
- Source: patient-inbox change (frontend explicitly read-only in v1)

Note: `appointment-base` ships full backend CRUD but the orchestrator surface is read-only at PoC — no create/edit/delete dialogs, no status-change actions. MVP adds caregiver-facing dialogs (new appointment, edit, cancel, mark fulfilled / no-show) using existing shadcn primitives. Pathway runtime (BL-038) also calls into `AppointmentService.create()` to materialise appointment blocks; both paths share the same backend.

### BL-073 — Appointment participant edit endpoints
- Tier: [mvp]
- Source: patient-inbox change (participants frozen after create in v1)

Note: v1 freezes `appointment_participants` rows after the appointment is created — changing attendees requires delete + recreate. MVP adds a `PATCH /appointments/{id}` participants field with replace-all semantics (parent diff, partial unique index dance on `lead`), or alternatively dedicated `POST/DELETE /appointments/{id}/participants/{user_id}` endpoints. Decision lands with the write-actions UI.

### BL-074 — `Metingen` tab backend wiring
- Tier: [mvp]
- Source: patient-inbox change (clinical tab ships as empty-state)

Note: Patient detail's `Metingen` tab renders `<EmptyState>` in PoC. MVP wires the monitoring-koppeling (Luscii Vitals embed + measurement aggregates) into the tab body. Depends on the Luscii API contract (BL-004).

### BL-075 — `Labresultaten` tab backend wiring
- Tier: [mvp]
- Source: patient-inbox change (clinical tab ships as empty-state)

Note: Patient detail's `Labresultaten` tab renders `<EmptyState>` in PoC. MVP wires the HiX-koppeling (`Observation` / `DiagnosticReport` reads via FHIR adapter) into the tab body. Depends on the HiX FHIR adapter (BL-001).

### BL-076 — Realtime topic for appointments
- Tier: [mvp]
- Source: patient-inbox change (plain refetch v1)

Note: `appointment-base` ships without a realtime topic — orchestrator uses TanStack `staleTime` refetch. MVP adds the realtime publisher when pathway runtime mutates appointments or the frontend write UI lands (BL-072), so two clinicians editing the same patient see updates without manual refresh. Mirrors the patient-base realtime contract.

### BL-077 — Synthetic appointment seed
- Tier: [poc]
- Source: patient-inbox change (no seed v1 — sort renders trailing nulls)

Note: v1 ships without a seed for `appointments`. The inbox default sort (`next_appointment_starts_at`) returns the same arbitrary order until appointment rows exist. Demo storytelling improves if a deterministic seed populates 1-3 upcoming appointments per seeded patient. Author `scripts/seed_appointments.py` mirroring `seed_patients.py` (PRNG-seeded, synthetic-only header). Cheap to land; demo-quality lift.

### BL-078 — Patient-role mobile `/mobile/appointments` read route
- Tier: [mvp]
- Source: patient-inbox change (patient role explicitly forbidden on `/appointments` v1)

Note: `appointment-base` rejects `Role.PATIENT` sessions on every `/appointments` route in PoC. MVP adds `/mobile/appointments` (or similar) for the digital-front-door patient app to read their own appointments. Reuses `AppointmentRepository` with a patient-self predicate (patient sees only own rows). Patient-visibility predicate distinct from caregiver patient-access predicate. Depends on F9/F10 mobile patient features (BL-014, BL-022).

### BL-081 — Task write actions (create / complete / edit / delete)
- Tier: [mvp]
- Source: patient-inbox change (tasks-base ships read-only v1)

Note: `tasks-base` v1 ships only `GET /tasks` (list) and `GET /tasks/{id}` (read). Tasks are populated by `seed_tasks.py` and (at MVP) by the pathway runtime. MVP adds caregiver-facing write actions: `POST /tasks` (manual task creation), `PATCH /tasks/{id}` (status transitions including complete + cancel, plus title/description/priority edits), `DELETE /tasks/{id}` (soft). Frontend: inbox row gains a kebab with `Markeer voltooid` / `Bewerken` / `Verwijderen`; standalone create dialog from the inbox PageHeader. Depends on the task write UX design and on a decision about who can complete others' tasks (lock to assignee? team-wide? admin override?).

### BL-080 — Inbox 2nd surface kind (alerts / messages)
- Tier: [product]
- Source: patient-inbox change (single-domain inbox v1)

Note: PoC inbox surfaces tasks only. If a future product surface genuinely needs to merge tasks with other attention sources (measurement alerts, system messages, lab-result notifications), it gets its own route (e.g. `/_auth/notifications`) with its own architecture — the current `/_auth/inbox` stays a task list. Filed to document the rejected polymorphic-inbox alternative if it ever resurfaces.

### BL-079 — `appointments.pathway_block_instance_id` FK
- Tier: [poc]
- Source: patient-inbox change (column reserved, FK deferred per D18)

Note: v1 alembic creates `appointments.pathway_block_instance_id` as a nullable UUID column without a FOREIGN KEY constraint. Pathway runtime change (BL-038) introduces the `pathway_block_instances` table and a follow-up migration adds `FOREIGN KEY ... ON DELETE SET NULL` between the two. Tracking here so the FK isn't forgotten when the runtime lands.

## Filed by pathway-completion (2026-06-12)

### BL-082 — Cross-pathway handoff (`bridge` block)
- Tier: [mvp]
- Source: Urology demo flow (`openspec/changes/pathway-model-redesign/example-flow-urology.md`); deferred from `pathway-completion` § A6

Note: Terminal block kind that closes the current enrollment AND opens a new enrollment for the patient on a target pathway (e.g. "Cancer treatment" handoff). Touches enrollment lifecycle + identity carry-over to a new enrollment, neither of which is in PoC scope. Builder palette currently does NOT surface a "bridge" tile. Re-evaluate at MVP once enrollment-to-enrollment handoff semantics are designed.

### BL-083 — `aggregator_n_of_m(count, total)` input_logic aggregator
- Tier: [mvp]
- Source: Urology demo flow (`openspec/changes/pathway-model-redesign/example-flow-urology.md`); deferred from `pathway-completion` § B2

Note: Partial-completion aggregator on `InputLogic.aggregator` ("block eligible when ≥ N of M rules resolve true"). Originally scoped for MDO attendees; the MDO redesign in `pathway-completion` § A7 replaced the gate with leading-caregiver-completes, so no PoC consumer remains. Future MVP flows needing "N-of-M upstream gates" (e.g. partial team consensus, fallback paths) will promote this back. Small predicate — `NOfMArgs(count, total)` + evaluator branch + publish gate `1 <= count <= total`.

### BL-084 — Split `pathway_block` into class-table inheritance
- Tier: [mvp]
- Source: Esthetic / scale concern raised during `pathway-completion` § A4 (treatment block); slot #1 `pathway-model-foundations` D2 chose single-table inheritance for ship speed

Note: Today every block kind dumps its per-kind columns onto one wide `pathway_block` table (prefixed `appointment_*`, `treatment_*`, `task_*`, …). With 12 kinds × 4–6 columns each the table grows to ~60 nullable columns. Functionally fine on postgres, but ugly, hides per-kind constraints behind CHECKs, and complicates per-kind indexes. MVP refactor splits into a thin `pathway_block` envelope (`id`, `kind`, `name`, `lane_id`, `phase_id`, `input_logic`, `timing_policy`, audit) + one `pathway_block_<kind>` child table per concrete kind, joined on `id`. Mapper becomes a join + dispatch instead of column-prefix dispatch. Touch points: slot #1 mapper, every shipped kind's ORM block, alembic upgrade with backfill, all per-kind seed scripts, every test that hand-builds a `PathwayBlock` row. Do NOT attempt during PoC — refactor cost ≈ 1–2 days and resets the §A* + §B* implementation pipeline.
