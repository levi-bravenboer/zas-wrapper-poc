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

Note: Caregivers need to view Luscii monitoring data from inside Orchestrator. Mechanism TBD: iframe? deep-link? SSO?

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

Note: Patient view of Pathway Orchestrator delivery channel TBD: email link, HiX Patient Portal link, Luscii deep-link, dedicated app, PWA. Decision blocks F5 (patient view) MVP delta.

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

Note: Who can see which patient, which pathway, which task. PoC has none. Define ACL model before any external caregiver flow ships.

### BL-021 — Carepath Builder naming
- Tier: [product]
- Source: RFP working doc TBD

Note: "Pathway Designer" vs "Carepath Builder" vs other naming. Cosmetic but needs settling for marketing + UI strings.

### BL-022 — Patient-view enrollment activation
- Tier: [mvp]
- Source: RFP working doc

Note: From the patient view, patient can activate their enrollment (consent + Luscii download). PoC excludes patient touchpoint; revisit at MVP.

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

Note: Original `apps/` plan mentioned a patient app shell. New scope defers patient entirely to MVP. When MVP picks up F5 patient view, decide: separate `apps/patient` or extension of orchestrator?

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

Note: F3 backend domain lands as its own `[poc]` change in its own worktree. Shape is designed inside that change. Orchestrator pathway module + composer skeleton land with the same change.

### BL-037 — F4 patient domain
- Tier: [poc]
- Source: align-stack-with-poc-scope, scope narrowed 2026-05-13

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

Note: PoC session is a stateless `itsdangerous`-signed cookie carrying the user id. A stolen cookie is valid until the 8h expiry; logout only clears the client cookie. MVP needs a `sessions` table (id, user_id, issued_at, last_seen_at, expires_at, revoked_at, ip, user_agent) and the cookie payload becomes the opaque session id. `auth.logout`, password change, role demotion, and "log out all sessions" admin action all flip `revoked_at`. Promotes the PoC `auth.login.*` stdout log lines to a queryable `auth_audit` table at the same time.

### BL-043 — Login rate limiting + account lockout
- Tier: [mvp]
- Source: add-auth-provider-seam compliance review (2026-05-15)

Note: `POST /auth/login/password` has no rate limit or lockout in PoC. GDPR Art 32 (appropriate security measures) + eHealth Platform deontological code require brute-force mitigation. MVP: per-IP and per-email sliding-window limit, account lockout after N consecutive failures with admin-unlock path. Lives in FastAPI middleware or `slowapi`; reuses the `auth.login.failure` event stream for counting.

### BL-044 — MFA / strong auth via OIDC IdPs (LoA High)
- Tier: [mvp]
- Source: add-auth-provider-seam compliance review (2026-05-15)

Note: Caregivers accessing patient data require strong authentication per eHealth Platform requirements (LoA High under eIDAS). MVP delegates to itsme® / eID — both provide LoA High natively, so MFA is the IdP's responsibility, not ours. The password provider MUST be locked to non-clinical roles (admin bootstrap only) or removed entirely at MVP. Decision lands in the future `oidc-login-providers` change.

### BL-045 — RP-initiated logout (OIDC `end_session_endpoint`)
- Tier: [mvp]
- Source: add-auth-provider-seam compliance review (2026-05-15)

Note: When a caregiver logs out from Orchestrator and the session was minted by an OIDC provider, MVP must call the IdP's `end_session_endpoint` so the session is revoked at the IdP too. Otherwise the next "Sign in with itsme®" click silently re-mints a session without the user noticing. Implementation: extend `LoginProvider` (or add a sibling Protocol) with `async def end_session(session: SessionUser) -> RedirectResponse | None`. Frontend respects the returned redirect.

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

Note: Filed against the future `oidc-login-providers` change. Concrete provider implementations MUST: use PKCE on the authorization code flow; validate `state` round-trip; validate `nonce` in the ID token; verify ID token signature against the IdP's JWKS endpoint; validate `iss`, `aud`, `exp`, `iat`, `nbf` claims; reject unsupported `alg` values; bind the post-login redirect to the `state` so the OIDC callback cannot be replayed against a different destination. Codify these as `auth-stub` requirements when that change lands.

### BL-049 — Password reset / credential lifecycle
- Tier: [mvp]
- Source: add-auth-provider-seam compliance review (2026-05-15)

Note: No password reset flow exists. If the password provider survives MVP for bootstrap admins, it needs: time-boxed reset tokens, email delivery (notifications stack is `[mvp]` work too), forced rotation on first login, password complexity policy. If the password provider is retired at MVP (BL-044 outcome), this becomes a no-op — admin bootstrap moves to a CLI command that writes a one-time eID-link token. Decision deferred to BL-044 + `oidc-login-providers` planning.
