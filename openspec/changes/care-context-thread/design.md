## Context

`care-teams-base` adds the backend model (`CareTeam`, `CareTeam.participant`, `RoleInCare`) and rewrites `require_patient_access` + `GET /patients` visibility so caregivers see only patients they have an open participant row on, or — PoC fallback — patients in their organisation subtree. The participant row carries `on_behalf_of_organisation_id`, capturing the dual-org reality (a practitioner may act for a different unit than their primary affiliation).

The orchestrator currently has:
- A patients overview wired through `usePaginatedQuery` + `DataTable` (organisation column resolved by `GET /organisations` lookup).
- A placeholder `/_auth/patients/$patientId/index.tsx` route that renders `t('detail.placeholder', { id })`.
- No care-team UI, no shared entity-page header, no convention forcing future clinical entities to thread the same context.

This change closes those gaps by:
1. Shipping the care-team UI on patient detail.
2. Introducing a shared `EntityContextHeader` component that every clinical-entity page mounts.
3. Codifying the `care-context` capability so future entity proposals MUST honour the same contract.

## Goals / Non-Goals

**Goals:**

- Render the active + historical care teams for a patient on the detail screen.
- Add / remove / reassign participants from the UI; mutations invalidate the `paginated` patients key so the overview reflects new visibility immediately.
- Establish a single header component that surfaces `(patient, active care team, acting-on-behalf-of organisation)` on every clinical-entity page.
- Codify the cross-cutting convention as a spec so it is enforceable in review, not folklore.
- Zero new backend code — purely orchestrator + spec.

**Non-Goals:**

- Backend changes (lives in `care-teams-base`).
- Organisations admin tree / CRUD (filed as follow-up; counts only make sense once care-team data exists).
- Encounter / observation / condition / medication / note entities — this change only sets the contract they MUST follow when they ship.
- Federated cross-tenant participants (BL-021 area; out of PoC).
- Real-time care-team membership updates over WebSocket (rely on `realtime-invalidation` only for patient-list invalidation; participant mutations refetch via react-query).

## Decisions

### 1. Patient detail becomes a tabbed shell, `Care team` is the first tab

Why: The detail screen will host multiple clinical-entity tabs over time (encounters, conditions, medications). Starting with a tab shell now avoids a layout refactor when the next entity lands. shadcn `Tabs` is already in the design system per `add-datatable-base`; no new primitive.

Alternative considered: dedicated `/_auth/patients/$patientId/care-team` sub-route. Rejected because deep-linking individual entity tabs is desirable later; TanStack Router's nested file routes give us that for free under `/_auth/patients/$patientId/<entity>/`. Sub-route per entity is the v2; the tabbed shell renders the active sub-route content.

### 2. `EntityContextHeader` is owned by `src/components/layout/`, not `src/modules/patient/`

Why: The header is reused by every clinical-entity page, not just patient detail. Owning it under `layout/` advertises that ownership. The component takes `{ patient, activeCareTeam, onBehalfOfOrganisation }` props and renders three slots; data fetching stays at the route level so the component is testable without react-query context.

Alternative considered: A `<CareContextProvider>` context. Rejected for PoC: extra plumbing for one consumer; props are clearer. Re-evaluate when the third entity lands.

### 3. Active care team = first row where `period.end IS NULL`; tie-break by `period.start DESC`

Why: `care-teams-base` allows multiple concurrent open teams (e.g., orthopedic + cardiology). For the header we pick the most recently opened active team; the tab body still lists all teams (active + historical) for management. The picker logic lives in `src/modules/care-team/selectors.ts` to keep route components thin.

Alternative considered: surface a switcher in the header. Rejected for PoC; the tab body already lets the user switch teams. Header re-evaluate at MVP if multi-team patients are common in the demo.

### 4. `care-context` capability spec carries acceptance criteria for future entities

Why: A convention codified in `AGENTS.md` rots. A capability spec carries WHEN / THEN scenarios that future change proposals reference. Each later clinical-entity proposal MUST link to `care-context` in its `Capabilities` section and either add a delta or reaffirm conformance.

The spec MUST include:
- A scenario asserting that every clinical-entity backend route accepts `patient_id` from the URL path or body and inherits visibility from `require_patient_access`.
- A scenario asserting that every clinical-entity orchestrator route mounts `EntityContextHeader`.
- A scenario asserting that mutations on a clinical entity invalidate (a) the entity's own paginated key and (b) the patient detail care-team key when the mutation touches the active team.

### 5. Mutations invalidate both care-team key AND patients overview key

Why: Adding a participant to a team changes who sees the patient. The participant himself MUST see the patient appear in his overview without a manual refresh. Mutation `onSuccess` invalidates:
- `['care-team', 'list', patientId]`
- `paginatedQueryKey('/patients')`

Trade-off: the patients overview refetch on every participant change is slightly chatty. Acceptable because participant changes are rare (handovers / shift-end / on-call swaps). Re-evaluate if the demo creates >100 mutations per session.

### 6. Org affiliation column on participant table = `on_behalf_of_organisation_id`, resolved via the existing `GET /organisations` lookup

Why: Reuses the organisation cache the patients overview already warms (`useQuery({ queryKey: ['organisations', 'list'] })`, `staleTime: 5min`). No new query, no duplication. Fallback to `participant.user.organisation_id` only if the participant row has `on_behalf_of_organisation_id IS NULL` (still allowed per `care-teams-base`).

### 7. `EntityContextHeader` shows `on_behalf_of_organisation` from the **active care team's** current-user participant row, if any

Why: When the logged-in caregiver opens a patient page they should see "you are looking at this patient as part of <team X>, acting on behalf of <organisation Y>". If the caregiver has no participant row on any of the patient's active teams (admin / wide-scope case), the slot renders `—`.

Trade-off: makes the header per-user. Cannot be cached across users. Acceptable: data is already in the care-team list response; no extra fetch.

## Risks / Trade-offs

- **Risk**: `care-teams-base` ships visibility filter via `require_patient_access`, but the orchestrator could land before the backend visibility rewrite is fully tested → caregivers see ghost patients. **Mitigation**: gate this change on `care-teams-base` PR being merged; the chain prerequisite in `proposal.md` enforces this and the orchestrator schema regen will fail typecheck if the care-team endpoints are missing.

- **Risk**: The `care-context` capability becomes a paper convention if future PR authors do not link to it. **Mitigation**: add a one-line reference in `apps/orchestrator/AGENTS.md` ("any new clinical-entity route must mount `EntityContextHeader` per `openspec/specs/care-context/spec.md`") and in `apps/backend/AGENTS.md` (same for `require_patient_access` propagation). Code review reviewers MUST refuse PRs that violate.

- **Risk**: Tabbed shell breaks the existing `/patients/$patientId` deep-link tests. **Mitigation**: keep the route path unchanged; the placeholder body is replaced, route key is the same. Run `npx tsr generate` and verify `routeTree.gen.ts` diff matches expectations.

- **Trade-off**: We are introducing a shared header component before the third entity proves the need. Risk of premature abstraction. **Mitigation**: keep the component flat (one file, ~80 LOC), zero context, props-only API. Re-evaluate when entity #3 lands; refactor cost is low if shape needs to change.

- **Risk**: NL i18n drift. Care-team UI introduces ~30 new keys. **Mitigation**: single `care-team.json` namespace, ESLint `i18next/no-literal-string` catches inline strings in `.tsx`.

- **Risk**: Vitest still blocked by the rolldown native-binding env gap on darwin-arm64 (see `patients-base` §12.8). **Mitigation**: ship typecheck + lint quotes in the PR, file `BL-NNN` to re-run the suite on a clean Node 22 install before merging the chain to `main`.
