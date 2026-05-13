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

Note: Section 12 of `backend-setup` introduced FHIR-shaped domain artifacts (fhir.resources types, `PatientSummary`, view-model DTOs, search-param models, FHIR-verb HiX adapter, `/patients/{id}` route) that the new PoC scope flags as out-of-tier. Follow-up change reviews each artifact and decides keep / narrow / revert. Concrete artifact list lives in `openspec/changes/define-poc-scope/tasks.md` § 6.1. **Caveat**: section 12 work-in-progress was lost during a rebase; follow-up needs to either re-implement or skip the section-12 work entirely depending on the keep/narrow/revert decision.

### BL-026 — Re-tier `orchestrator-fhir-ready` change
- Tier: [mvp]
- Source: define-poc-scope change, Q13 decision

Note: Pre-existing change. Re-tiered to `[mvp]` on 2026-05-13 — PoC has no FHIR per `openspec/scope.md`. Change folder kept (design work preserved) but tagged dormant in `proposal.md`. Promote when `[mvp]` window opens; re-read against `scope.md` first.

### BL-027 — Re-tier `dev-data-seeding` change
- Tier: [poc]
- Source: define-poc-scope change, Q13 decision

Note: Pre-existing change. No tier tag. Read against new `scope.md` and either add tier or backlog. Likely `[poc]` (seeded fake patients are explicitly part of PoC mocks).

### BL-028 — Re-tier `agent-sandbox-spike` change
- Tier: [poc]
- Source: define-poc-scope change, Q13 decision; user note "dev experience"

Note: Pre-existing change. Developer-experience work (agent sandbox prototype). Re-tier — `[poc]` if it accelerates PoC build, else `[product]`.

### BL-029 — Re-tier `dev-sandbox-skills` change
- Tier: [poc]
- Source: define-poc-scope change, Q13 decision

Note: Pre-existing change. Developer-experience adjacent. Re-tier or move to backlog after reading proposal.

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
