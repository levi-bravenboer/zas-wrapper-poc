# Roadmap

Tier progression for the ZAS Telegeneeskunde build: PoC → MVP → Product. Cross-cuts `openspec/scope.md` (what's in *now*) and `openspec/backlog.md` (parked ideas).

## How to read this

- **Current tier** flagged at the top.
- Each tier section lists **theme**, **exit criteria** (what "done with this tier" means), **highlights** (the load-bearing work), and **non-goals** (deliberately deferred).
- Per-feature PoC → MVP delta lives in `scope.md`. This file is the **sequence** view; `scope.md` is the **state** view.
- Backlog entries (`BL-NNN`) are referenced inline where they block or define a tier exit.

**Current tier**: `[poc]` (June 2026 demo target).

---

## `[poc]` — June 2026 demo

**Theme.** Validate the composer + caregiver web app spine end-to-end with everything external mocked. Prove the pathway model + Luscii sub-flow shape on real clinical content (Holter / Rugrevalidatie / `BL-033`).

**Exit criteria.**
- All `F1`..`F8` features in `scope.md` PoC In-Scope demo-ready against synthetic data.
- A caregiver can log in, compose a pathway, enroll a (seeded) patient, see the pathway run, complete tasks.
- Read-aloud test passes: someone unfamiliar opens `scope.md` + `project.md` and answers "what is the PoC?" in under two minutes.
- No real patient data anywhere — fixtures, screenshots, logs all synthetic.
- Architecture review: no choice locks out MVP compliance (GDPR, FHIR R4, Belgian hosting, eID / itsme® / eHealth / CSAM auth).

**Highlights.**
- `F1` hard-coded auth + cookie session.
- `F3` Pathway Designer composing blocks → DB; saved = enrollable (no publish step).
- `F5` patient view with Luscii block rendered from static JSON.
- `F7` pathway backend on our own DB with stubbed HiX + Luscii adapters.
- `F9` Digital front door shell (`apps/digital-front-door`, Expo SDK 56) — empty mobile app on iOS / Android / web (dev). Boots, lints, typechecks; backend `/mobile/health` returns 200. No clinical UI.
- `F10` Patient login — cookie-session reuse, FHIR-aligned identity model (`users.patient_id` FK, `role='patient'`), `POST /mobile/auth/login/password` + lean `PatientSession`, biometric unlock + 30d session on supported devices, seeded demo (`patient@zas.local`).
- Tooling: OpenAPI typegen, MSW + Vitest + Playwright on orchestrator, pytest + ruff + pyright on backend, ESLint + Prettier + jest-expo + `expo-local-authentication` on digital-front-door.

**Non-goals (in this tier).** Live HiX, live Luscii, federated patient IdP (eID / itsme / eHealth), HiX embed, two-way task sync, **patient pathway/task features** (login is in PoC; clinical-display features are not), orchestrator patient-user admin UI, notifications, multi-tool admin. All deferred to `[mvp]` per `scope.md` PoC Out-of-Scope + Mocks tables.

---

## `[mvp]` — first paying release

**Theme.** Replace every PoC mock with a live integration. Add the patient surface and external-caregiver access. Make the product safe to ship into a regulated Belgian clinical setting.

**Exit criteria.**
- Every row in `scope.md` "PoC Mocks" table has been replaced by its real-thing counterpart.
- Every `F1`..`F8` row in `scope.md` "PoC → MVP Delta" has its MVP blocker resolved.
- ACL model (`BL-020`) ships before any external-caregiver flow.
- Compliance: GDPR DSR flows, OperationOutcome error envelope, audit log, ETag versioning.
- Real patient data invariant enforced in CI (`BL-034`).

**Highlights (load-bearing).**
- **Integration**
  - HiX live FHIR adapter — SMART-on-FHIR launch + FHIR R4 read/write (`BL-001`).
  - Full Luscii pathway mapping — Builder API + task webhook + Vitals embed (`BL-004`, `BL-008`).
  - HiX embed for orchestrator screens + two-way task sync.
  - `OperationOutcome` error translation (`BL-005`); `If-Match` / `ETag` versioning (`BL-006`).
- **Identity + access**
  - IdP integration: eHealth / itsme® / eID / CSAM (ZAS + external caregivers) via NewWave Care — lands as `oidc-login-providers` change on top of the PoC `LoginProvider` seam.
  - Access-control granularity (`BL-020`); HiX admin coordination (`BL-010`).
  - **Auth compliance gates** (filed by `add-auth-provider-seam`): server-side session revocation (`BL-042`), login rate-limit + lockout (`BL-043`), MFA delegated to LoA High IdPs (`BL-044`), RP-initiated logout against IdP `end_session_endpoint` (`BL-045`), DPIA pointer + skeleton (`BL-046`), SMART-on-FHIR bearer-token auth path on `/fhir/*` (`BL-047`), OIDC hardening — PKCE / state / nonce / JWKS / iss+aud+exp (`BL-048`), password reset / credential lifecycle if password provider survives (`BL-049`). All MUST close before any real patient data touches the system.
- **Product**
  - Patient surface — shell shipped in PoC via `digital-front-door-setup` (`F9`); patient login shipped in PoC via `mobile-app-auth-setup` (`F10`) using cookie-session reuse + biometric unlock + `users.patient_id` FK; MVP delivers concrete patient features (view, tasks, Luscii deep-link), federated identity (eID / itsme / eHealth / CSAM), FHIR `Person` layer for RelatedPerson family-member login, server-side session revocation, and orchestrator patient-user admin UI; `BL-014` / `BL-022` (consent + activation) remain MVP-tier; `BL-030` resolved (separate Expo app at `apps/digital-front-door`).
  - Pathway publish step + versioning (`BL-031`).
  - Pathway block types beyond PoC: video calls, lab appointments, referrals, milestones, signed documents, informed consent (`BL-015`, `BL-017`, `BL-018`, `BL-019`).
  - Non-HiX patient enrollment (`BL-009`); order-form decision (`BL-011`); task-list location decision (`BL-012`); monitoring app branding (`BL-013`).
- **Backend rescope**
  - Backend-setup section 12 (FHIR-ready domain layer) keep/narrow/revert decision (`BL-025`).
  - `orchestrator-fhir-ready`, `dev-data-seeding`, `agent-sandbox-spike`, `dev-sandbox-skills` re-tier (`BL-026`..`BL-029`).

**Non-goals.** `/fhir/*` raw passthrough, `CapabilityStatement`, MCP host, auto-interpreter booking — all deferred to `[product]`.

---

## `[product]` — productised expansion + polish

**Theme.** Productise the platform beyond ZAS pilot. Expose the underlying FHIR surface for third parties. Layer agentic tooling. Polish the long tail.

**Exit criteria (indicative — refined as MVP lands).**
- Public FHIR endpoints + discoverable capability statement.
- MCP host operational for at least one agentic capability.
- Carepath Builder naming + IA settled (`BL-021`).

**Highlights.**
- Raw `/fhir/*` passthrough routes layered on the same adapter (`BL-002`).
- FHIR `CapabilityStatement` at `/fhir/metadata` (`BL-003`).
- MCP server host for agentic tooling (`BL-007`).
- Auto interpreter booking when patient language ≠ caregiver language (`BL-016`).
- Backlog status field (`BL-024`) if the parking lot grows past ~50 entries.

**Non-goals.** Anything still on the backlog without a `[product]` tier — those stay parked.

---

## Tier rules

- **Don't skip tiers in scope.** PoC work that turns out to be MVP-shaped goes to `backlog.md`, not the active change. MVP work that turns out to be Product-shaped same rule.
- **Promotion only from backlog.** `BL-NNN` becomes an active change when the tier matches the **current** roadmap tier AND a stakeholder commits to the work.
- **Maintenance.** Edit this file when a tier's exit criteria shift, a major item lands or moves, or a tier completes. The current-tier flag at the top is the single source of truth — keep it in sync with `scope.md`.
- **Relation to other files.** `project.md` (long-lived context). `scope.md` (current state ledger). `backlog.md` (parked ideas). **This file** (sequence + tier exits). `changes/` (active work; each cites a tier).
