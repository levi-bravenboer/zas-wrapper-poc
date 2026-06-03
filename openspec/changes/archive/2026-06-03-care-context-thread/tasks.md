## 0. Chain prerequisite

- [ ] 0.1 `care-teams-base` PR merged to `main`; this change is rebased on top of it before any orchestrator code is written. Verify by running `git log --oneline origin/main | grep care-teams` and `npx openspec list` shows `care-teams-base` in `openspec/changes/archive/`.
- [ ] 0.2 Regenerate `apps/orchestrator/src/lib/api/schema.d.ts` against the post-`care-teams-base` backend (`moon run orchestrator:typegen`); confirm the care-team endpoints appear in `paths`.

## 1. Orchestrator types + API wrappers

- [ ] 1.1 Add `apps/orchestrator/src/modules/care-team/types.ts` re-exporting `CareTeamRead`, `CareTeamParticipantRead`, `RoleInCare` from the generated `lib/api/schema` (no hand-rolled interfaces).
- [ ] 1.2 Add `apps/orchestrator/src/modules/care-team/api.ts` exporting:
  - `careTeamListKey(patientId)` returning `['care-team', 'list', patientId] as const`.
  - `useCareTeamListQuery(patientId)` wrapping `useQuery({ queryKey, queryFn: api.GET('/patients/{patient_id}/care-teams', ...) })`.
  - Mutations: `useCreateCareTeam(patientId)`, `useAddParticipant(careTeamId)`, `useUpdateParticipantRole(careTeamId, userId)`, `useUnassignParticipant(careTeamId, userId)`. Each mutation's `onSuccess` invalidates `careTeamListKey(patientId)` AND `paginatedQueryKey('/patients')`.
- [ ] 1.3 Add `apps/orchestrator/src/modules/care-team/selectors.ts` exporting `selectActiveCareTeam(teams)` returning the team with `period.end === null` and the most recent `period.start`; tie-break by `id` ascending; `null` when there is no active team.

## 2. `EntityContextHeader`

- [ ] 2.1 Add `apps/orchestrator/src/components/layout/EntityContextHeader.tsx`. Props: `{ patient: PatientRead; activeCareTeam: CareTeamRead | null; onBehalfOfOrganisation: OrganisationRead | null }`. Renders three flex slots; em-dash for nulls; component contains no data fetching.
- [ ] 2.2 Add `EntityContextHeader.test.tsx` covering: (a) renders patient + team + org, (b) `onBehalfOfOrganisation === null` renders em-dash, (c) `activeCareTeam === null` renders em-dash without throwing.
- [ ] 2.3 Document the component contract in `apps/orchestrator/AGENTS.md` under §<next free>: "Clinical-entity routes — every route nested under `/_auth/patients/$patientId/**` MUST mount `EntityContextHeader` (`openspec/specs/care-context/spec.md`)".

## 3. Patient detail tabbed shell

- [ ] 3.1 Add `apps/orchestrator/src/routes/_auth/patients/$patientId/route.tsx` as the layout route: fetches `GET /patients/{id}`, fetches care-team list, derives `activeCareTeam` via `selectActiveCareTeam`, derives `onBehalfOfOrganisation` from the current user's participant row on the active team, renders `<EntityContextHeader>` then `<Tabs>` then `<Outlet/>`. Tabs read tab id from URL search param `tab` (default `care-team`).
- [ ] 3.2 Move the existing `apps/orchestrator/src/routes/_auth/patients/$patientId/index.tsx` placeholder into `apps/orchestrator/src/routes/_auth/patients/$patientId/care-team.tsx` and replace its body with the care-team panel (see §4).
- [ ] 3.3 Regenerate `routeTree.gen.ts` via `npx tsr generate`; commit the diff in the same commit as §3.2.
- [ ] 3.4 Update `src/routes/_auth/patients/index.tsx` row-click navigator to `to: '/_auth/patients/$patientId', params: { patientId: row.id }, search: { tab: 'care-team' }` (verify the typed router accepts this; fall back to `to: '/patients/$patientId'` shorthand if needed per `patients-base` §11.4 precedent).

## 4. Care-team panel

- [ ] 4.1 Add `apps/orchestrator/src/modules/care-team/components/CareTeamPanel.tsx` rendering one card per team, header `category` + period + status, body `<ParticipantList>`, footer "Add participant" button.
- [ ] 4.2 Add `apps/orchestrator/src/modules/care-team/components/ParticipantList.tsx` rendering rows of `display_name | role_in_care | period.start | period.end | on_behalf_of_organisation`, sorted active-first then by `period.start desc`. Em-dash for missing `period.end`. Fallback to `user.organisation_id` (italicised) when `on_behalf_of_organisation_id` is null.
- [ ] 4.3 Add `apps/orchestrator/src/modules/care-team/dialogs/CreateCareTeamDialog.tsx`, `AddParticipantDialog.tsx`, `ChangeRoleDialog.tsx`, `UnassignParticipantDialog.tsx`. Each composes shadcn `Dialog` + `Form` + `Input`/`Select`/`DatePicker` primitives; mutations from §1.2; loading/error states from the mutation result.
- [ ] 4.4 Add row-action `kebab` to participant rows: `Change role`, `Unassign`. Open the corresponding dialog.

## 5. i18n

- [ ] 5.1 Add `apps/orchestrator/src/lib/i18n/locales/nl/care-team.json` with keys for: tab labels, panel headers, dialog titles + fields + buttons, role-in-care enum labels (`primary` → `Hoofdbehandelaar`, `consulting` → `Consulent`, `observer` → `Observator`), empty / loading / error states, confirm copy. Zero inline Dutch literals in `.tsx`.
- [ ] 5.2 Register the `care-team` namespace in `apps/orchestrator/src/lib/i18n/index.ts` (import + namespace entry + resources entry).
- [ ] 5.3 Add `actions.unassignConfirm` ("Weet je zeker dat je {{name}} wilt afmelden van dit care team?") and use it from `UnassignParticipantDialog`.

## 6. Documentation + convention enforcement

- [ ] 6.1 Add one paragraph to `apps/orchestrator/AGENTS.md` referencing `openspec/specs/care-context/spec.md` and stating the `EntityContextHeader` mount rule; cross-link the spec.
- [ ] 6.2 Add one paragraph to `apps/backend/AGENTS.md` stating that any new clinical-entity router MUST depend on `require_patient_access` (from `care-teams-base`) and link the same spec.
- [ ] 6.3 Add `BL-NNN — Organisations admin tree (read-only + member counts)` to `openspec/backlog.md`, gated on `care-context-thread` shipping (count source needs participant data).
- [ ] 6.4 Add `BL-NNN — Participant CSV bulk-import for care-team dialog` to `openspec/backlog.md`, MVP scope.

## 7. Verification

- [ ] 7.1 `moon run orchestrator:lint` — green (warnings allowed; no new errors).
- [ ] 7.2 `moon run orchestrator:typecheck` — green.
- [ ] 7.3 `moon run orchestrator:test -- src/modules/care-team src/components/layout` — green when the rolldown native-binding env gap is resolved; otherwise quote the blocker in the PR per `patients-base` §12.8 precedent.
- [ ] 7.4 `npx openspec validate care-context-thread --strict` — change is valid.
- [ ] 7.5 Manual smoke: seed DB, log in as caregiver, open a patient, add self to a new care team, navigate back to `/_auth/patients` and verify the patient now appears in the overview (visibility filter from `care-teams-base` consults the new participant row).

## 8. Docs, follow-ups, archive

- [ ] 8.1 PR title: `feat(orchestrator): add care-team management on patient detail and codify care-context convention`.
- [ ] 8.2 PR description quotes verification results from §7.1–§7.4 and links to `care-teams-base` PR + this change folder.
- [ ] 8.3 At archive time: capability docs land at `openspec/specs/care-context/` and the `patients-base` delta is merged into `openspec/specs/patients-base/spec.md` (deferred to archive step — `openspec-archive-change` skill handles the move).
