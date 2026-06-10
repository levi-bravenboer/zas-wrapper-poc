## 0. Prerequisites

- [ ] 0.1 Confirm `patients-base`, `patient-profile-ui`, `users-base`, `care-teams-base` are archived
- [ ] 0.2 Confirm `<CareTeamSlot>` export path (`apps/orchestrator/src/modules/patient/components/CareTeamSlot.tsx`) and prop shape (`{ patientId: string }`) match what `patient-profile-ui` spec promised
- [ ] 0.3 Confirm `<PatientHistoryPanel>` export path matches what we will mount inside the kebab `Geschiedenis` dialog
- [ ] 0.4 Confirm `patientsListKeyPrefix` location + the realtime topic the current list page registers — both must transfer to `<PatientInbox>` unchanged
- [ ] 0.5 Confirm TanStack Router's `useSearch` exposes `?sort=` synchronously on first render (hydration-safe) — read the version pinned in `package.json` and skim its loader docs
- [ ] 0.6 Confirm no external consumers of `PatientDemographicsPanel` / `PatientIdentifiersPanel` / `PatientsColumns` outside `modules/patient` (these are dropped per design.md "Component reuse audit" → "Drop on archive")
- [ ] 0.7 Read `design.md` "Component reuse audit" section before writing any new component — the audit dictates whether a need is satisfied by an existing primitive, an extension, or a new component

## 1. Prototype (HTML, before any React or backend)

- [x] 1.1 Build inbox prototype iterations under `prototypes/inbox/v*.html`. **Accepted: `v8.html`** per `prototypes/inbox/README.md`. v8 locks: admin-page chrome, 3-state master/detail layout (D15), surface-agnostic `<PatientDetailView>` mount pattern (D16)
- [ ] 1.2 Confirm with the user that any future visual tweak lands as `vN+1.html` — never edit a prior version

## 2. Backend: appointment-base capability

- [ ] 2.1 Create enums at `app/core/enums/appointment.py`: `AppointmentKind`, `AppointmentStatus` (FHIR R4 — store `entered_in_error` symbol, serialise `entered-in-error`), `AppointmentModality`, `AppointmentParticipantRole`. Re-export from `app/core/enums/__init__.py`
- [ ] 2.2 Create ORM model `app/domain/appointment/appointment.py::Appointment` — inherits `TenantOwnedEntity` + `DeletableEntity`. Columns: `patient_id`, `pathway_block_instance_id` (nullable, FK conditional on table existence — without FK if not), `title`, `description`, `kind`, `starts_at`, `ends_at`, `modality`, `location_text`, `status`. Add `CHECK (ends_at > starts_at)`
- [ ] 2.3 Create ORM model `app/domain/appointment/appointment_participant.py::AppointmentParticipant` — inherits `BaseEntity` + `DeletableEntity`. Columns: `appointment_id` (FK CASCADE), `user_id` (FK RESTRICT), `role`. Partial unique indexes: `(appointment_id) WHERE role='lead' AND deleted_at IS NULL` + `(appointment_id, user_id) WHERE deleted_at IS NULL`
- [ ] 2.4 Generate alembic migration via `moon run backend:make-migration -- "add appointment-base"` and review autogen. Manually add the partial unique indexes if alembic missed them. Enum types created in `op.execute`
- [ ] 2.5 Create Pydantic schemas at `app/schemas/appointment/appointment.py`:
  - `NextAppointmentSummary` — `{ id, title, starts_at, ends_at, kind, modality }`
  - `AppointmentParticipantCreate` — `{ user_id, role }`
  - `AppointmentParticipantRead` — `{ id, user_id, role, user_display_name }`
  - `AppointmentCreate` — `{ patient_id, title, description?, kind, starts_at, ends_at, modality, location_text?, status? (default booked), participants: list[AppointmentParticipantCreate] (required, ≥1 with one lead) }`
  - `AppointmentPatch` — partial of `AppointmentCreate` MINUS `patient_id`, `participants`, `pathway_block_instance_id`
  - `AppointmentRead` — full row + `participants: list[AppointmentParticipantRead]`
- [ ] 2.6 Create `app/repositories/appointment_repository.py::AppointmentRepository` (subclass of `BaseListRepository`):
  - `filterable_fields`: `patient_id`, `status`, `kind`, `modality`, `starts_at`
  - `searchable_fields`: `title`
  - `allowed_order_by`: `starts_at`, `created_at`, `status`
  - default `order_by=starts_at`, `order=asc`
- [ ] 2.7 Create `app/services/appointment/appointment_service.py::AppointmentService`:
  - `create()` — validates participants (≥1, exactly one `lead`, no duplicate user_id, all same-tenant as appointment), validates `ends_at > starts_at`, validates `modality='on_site' ⇒ location_text non-empty`, opens row + participant rows in single UoW
  - `list_in_tenant()` — wraps repository, applies caregiver patient-access filter via subquery `WHERE patient_id IN (visible_patient_ids_for(caregiver))`
  - `get_by_id()` — applies same patient-access predicate
  - `patch()` — rejects `participants` / `patient_id`, validates time + location rules on the merged row
  - `soft_delete()` — stamps `deleted_at` + `deleted_by` on appointment + all participant rows in same transaction
- [ ] 2.8 Create `app/api/routers/appointment/appointment_router.py` — five routes, each with `# AUTH-HARDEN` markers and `require_role(Role.ADMIN, Role.CAREGIVER)` (no `Role.PATIENT`):
  - `GET /appointments` (list)
  - `GET /appointments/{id}` (read)
  - `POST /appointments` (create)
  - `PATCH /appointments/{id}` (patch)
  - `DELETE /appointments/{id}` (soft delete)
- [ ] 2.9 Create `app/adapters/hix/appointments.py::HixAppointmentAdapter` with `fetch` + `upsert_from_hix` raising `NotImplementedError("HiX appointment adapter is MVP scope")`. Import-test coverage
- [ ] 2.10 Tests (`tests/api/test_appointments_*.py`):
  - `test_create.py`: ok-cases; 422 on `ends_at <= starts_at`; 422 on `on_site` + null `location_text`; 422 on zero / multi `lead`; 422 on duplicate user_id; cross-tenant patient → domain error; cross-tenant participant → domain error
  - `test_read.py`: caregiver patient-access predicate (sees only patients they can see); cross-tenant returns 404
  - `test_list.py`: tenant scope; patient-access filter; pagination envelope; `filter[patient_id]`, `filter[status]`, `filter[kind]`, `filter[modality]`, `filter[starts_at][gte/lte]`; `order_by=starts_at` default; `q=title-substring`; unknown filter rejected
  - `test_patch.py`: title / description / kind / starts_at / ends_at / modality / location_text / status updates; reject `participants`, `patient_id`, `pathway_block_instance_id`; free status transitions accepted; time + location validation on merged row
  - `test_delete.py`: soft delete + cascade soft delete of participants in same transaction; subsequent read returns 404
  - `test_status_enum.py`: `entered_in_error` symbol round-trips as `entered-in-error` on wire
  - `test_patient_role_rejected.py`: patient-role session gets 403 on each route
  - `test_hix_adapter_stub.py`: import + NotImplementedError

## 3. Backend: PatientRead.next_appointment + sort allow-list

- [ ] 3.1 Add `next_appointment: NextAppointmentSummary | None = None` to `PatientRead` in `app/schemas/patient/patient.py`
- [ ] 3.2 Project the field in `PatientRepository.list_in_tenant` and `get_by_id` via `LEFT JOIN LATERAL (SELECT id, title, starts_at, ends_at, kind, modality FROM appointments WHERE patient_id = p.id AND status='booked' AND starts_at >= now() AND deleted_at IS NULL AND tenant_id = p.tenant_id ORDER BY starts_at ASC LIMIT 1) na ON TRUE`
- [ ] 3.3 Add supporting index in same migration as 2.4 (or new migration): `CREATE INDEX appointments_patient_upcoming_idx ON appointments(patient_id, starts_at) WHERE status='booked' AND deleted_at IS NULL`
- [ ] 3.4 Extend `PatientRepository.allowed_order_by` with `next_appointment_starts_at` (map to `na.starts_at NULLS LAST`) and `created_at` (skip if already present)
- [ ] 3.5 Tests:
  - `tests/api/test_patient_list_sort.py`: `order_by=next_appointment_starts_at&order=asc` returns ascending with null-`next_appointment` patients last; `&order=desc` still puts nulls last; `order_by=created_at&order=desc` returns newest first; `order_by=banana` → 422
  - `tests/api/test_patient_next_appointment_field.py`: patient with one upcoming booked has matching summary; patient with multiple upcoming booked gets earliest; patient with only `cancelled`/`fulfilled`/`noshow`/past-`booked` returns null; patient with soft-deleted future booked returns null; field present on detail endpoint; cross-tenant defence-in-depth (synthetic crafted scenario)

## 4. OpenAPI + typed client regen

- [ ] 4.1 `moon run backend:openapi`
- [ ] 4.2 `moon run orchestrator:typegen`

## 5. Frontend: reusable primitives (built first, before patient module)

Per design.md "Component reuse audit" → "New reusable primitives (broader value)". These are generic, tested in isolation, no patient-domain coupling.

- [ ] 5.1 Build `<MasterDetailLayout>` at `apps/orchestrator/src/components/layout/MasterDetailLayout.tsx`. Props: `{ master: ReactNode; detail: ReactNode | null; masterCollapsed: boolean; onMasterCollapsedChange: (v: boolean) => void }`. Implements the 3-state CSS (full / compact 320px / hidden) with 250ms ease width transition. Renders the floating "panel-left-open" reopen button when master is hidden. **Mobile fallback per D17:** below `md` breakpoint the layout SHALL render master full-width and skip the detail column entirely (route swap handles detail display). NO content opinions — pure layout primitive. Tests: state transitions, reopen-button visibility, prop-driven width, mobile fallback
- [ ] 5.2 Build `<InboxRow>` at `apps/orchestrator/src/components/list/InboxRow.tsx`. Props: `{ leading?: ReactNode; primary: ReactNode; secondary?: ReactNode; trailing?: ReactNode; selected?: boolean; onSelect?: () => void; compact?: boolean }`. Flat clickable button row. NO patient-domain logic. `compact` variant tightens padding + smaller `leading` size. Tests: slot rendering, selected highlight, onSelect callback, keyboard nav
- [ ] 5.3 Lift `<Avatar>` from `components/ui/avatar.tsx` — add optional `tintBy?: string` prop. When set, derives a deterministic background colour from `hash(tintBy) % 8` against a curated ZAS-teal palette with WCAG AA white-text contrast. Default behaviour unchanged. Tests: same `tintBy` → same colour-class; missing `tintBy` → default; palette accessibility
- [ ] 5.4 Reuse `components/states/EmptyState.tsx` — confirm it already supports the icon-in-circle + headline + hint shape. If not, extend with a `variant="centered"` prop. Locks the empty-state visual for tabs + inbox + selection-empty right pane

## 6. Frontend: appointment primitives

These live under `modules/appointment/components/` — reused by inbox row meta + Afspraken tab + (future) caregiver appointments dashboard.

- [ ] 6.1 Build `<KindTile>` at `apps/orchestrator/src/modules/appointment/components/KindTile.tsx`. Props: `{ kind: AppointmentKind; size?: 'sm' | 'md' }`. Renders a subtle color-mix background tile per kind with the matching lucide icon. Tests: each kind maps to expected tint + icon
- [ ] 6.2 Build `<AppointmentRow>` at `apps/orchestrator/src/modules/appointment/components/AppointmentRow.tsx`. Props: `{ appointment: AppointmentRead; variant: 'upcoming' | 'history' }`. Composes `<KindTile>` + title + (history variant adds status Badge) + Dutch-locale time/location/modality line + participants strip (lead first, max 3, `+N` overflow). NO inline actions / no menus
- [ ] 6.3 Build `<AppointmentsSection>` at `apps/orchestrator/src/modules/appointment/components/AppointmentsSection.tsx`. Props: `{ upcoming: AppointmentRead[]; history: AppointmentRead[] }`. Upcoming section always expanded + count. History section collapsible (default closed). Both empty → renders shared `EmptyState`

## 7. Frontend: patient module — sort registry + hooks

- [ ] 7.1 Create `apps/orchestrator/src/modules/patient/inbox/sorts/index.ts` exporting `PatientSortStrategy` type + readonly `patientSortStrategies` array
- [ ] 7.2 Create `apps/orchestrator/src/modules/patient/inbox/sorts/nextAppointment.tsx` — id `next_appointment`, label via `t('inbox.sort.next_appointment')`, `queryParams()` returns `{ order_by: 'next_appointment_starts_at', order: 'asc' }`, `rowMeta()` renders `<KindTile size="sm">` + tabular time + muted kind+modality line when `p.next_appointment != null`, or muted `t('inbox.meta.next_appointment.none')` text when null
- [ ] 7.3 Create `apps/orchestrator/src/modules/patient/inbox/sorts/newlyAdded.tsx` — id `newly_added`, label via `t('inbox.sort.newly_added')`, `queryParams()` returns `{ order_by: 'created_at', order: 'desc' }`, `rowMeta()` returns muted text via `t('inbox.meta.newly_added.added_days_ago', { count })` (today/yesterday/N variants)
- [ ] 7.4 Create `apps/orchestrator/src/modules/patient/inbox/useSelectedSort.ts` — reads `?sort=` via TanStack Router's `useSearch` synchronously, returns active strategy on first render (no flash). Unknown id → fallback to `next_appointment` + `console.warn`. `setSort(id)` calls `navigate({ search: prev => ({ ...prev, sort: id }) })`

## 8. Frontend: patient module — components

- [ ] 8.1 Build `<PatientInboxRow>` at `apps/orchestrator/src/modules/patient/components/PatientInboxRow.tsx`. Composes `<InboxRow>` with patient bindings: `<Avatar tintBy={patient.id}>` initials, `family, given` primary, `INSZ • DOB • org tree-path` secondary, team `<Badge variant="soft">`, sort-strategy `rowMeta()` slot in trailing, kebab. Surface-agnostic — no router import
- [ ] 8.2 Build `<PatientDetailHeader>` at `apps/orchestrator/src/modules/patient/components/PatientDetailHeader.tsx`. Props `{ patient: PatientRead; actions?: ReactNode }`. Avatar + h2 name + INSZ default Badge + DOB + org soft Badge + actions slot. Surface-agnostic
- [ ] 8.3 Build `<PatientDetailView>` at `apps/orchestrator/src/modules/patient/components/PatientDetailView.tsx`. Props per D16: `{ patient; defaultTab?; actions?; onClose?; onEdit?; onDelete? }`. Composes `<PatientDetailHeader>` + `<CareTeamSlot patientId={patient.id} />` (self-fetching — preserves existing `care-teams-ui` consumer seam) + `<EntityDetailTabs>` underline Tabs with `Metingen` / `Labresultaten` / `Afspraken` triggers + tab bodies. Surface-agnostic — MUST NOT import from `@tanstack/react-router` or any inbox module. Verified by `eslint-no-router-imports` test
- [ ] 8.4 Build `<PatientKebab>` at `apps/orchestrator/src/modules/patient/components/PatientKebab.tsx`. `Bewerken` opens existing `EditPatientDialog`; `Verwijderen` uses existing `useEntityDelete`; `Geschiedenis` opens new `<Dialog>` with `<PatientHistoryPanel>` inside
- [ ] 8.5 Build `<PatientInbox>` at `apps/orchestrator/src/modules/patient/components/PatientInbox.tsx`. Composes underline `<Tabs>` sort control bound to `useSelectedSort`, `useInfiniteQuery` keyed `[...patientsListKeyPrefix, { sort }]` calling `getPatients({ ...strategy.queryParams(), page })`, maps rows through `<PatientInboxRow>` with `onSelect → navigate({ to: '/_auth/patients/$patientId', params: { patientId } })`. `"Meer laden"` button at end while `hasNextPage`. Empty-state via shared `EmptyState`. Header (PageHeader + filter row + sort Tabs) + body + pager
- [ ] 8.6 Register existing realtime topic on `<PatientInbox>` — same topic, same `patientsListKeyPrefix`. No new realtime work

## 9. Frontend: route layout (nested per D16)

- [ ] 9.1 Create `apps/orchestrator/src/routes/_auth/patients/route.tsx` (parent layout) — renders `<MasterDetailLayout master={<PatientInbox />} detail={<Outlet />} masterCollapsed={hasPatientIdParam} onMasterCollapsedChange={...}` where the local `masterHidden` state is owned by this layout (NOT in URL). `validateSearch` accepts `sort?: 'next_appointment' | 'newly_added'`
- [ ] 9.2 Rewrite `apps/orchestrator/src/routes/_auth/patients/index.tsx` (child index) — renders an empty right-pane state ("Selecteer een patiënt") via shared `EmptyState`. Master is full-width because this child does not match a `$patientId`
- [ ] 9.3 Rewrite `apps/orchestrator/src/routes/_auth/patients/$patientId/index.tsx` (child detail) — fetches patient via existing `usePatient`. Renders `<PatientDetailView patient={...} actions={<PatientKebab patient={...} />} onClose={() => navigate({ to: '/_auth/patients' })} />`. `<CareTeamSlot>` inside the view self-fetches the team data. Browser back/forward works for free via TanStack Router
- [ ] 9.4 Delete `modules/patient/components/PatientDemographicsPanel.tsx`, `PatientIdentifiersPanel.tsx`, `PatientsColumns.tsx` after confirming task 0.6 found no external consumers
- [ ] 9.5 Verify `<CareTeamSlot>` import path and prop signature unchanged. Do NOT modify component body

## 10. i18n

- [ ] 10.1 Create `nl/patient-inbox.json`: `inbox.title`, `inbox.empty.caregiver.headline`, `inbox.empty.caregiver.hint`, `inbox.empty.admin.headline`, `inbox.empty.admin.hint`, `inbox.empty.selection`, `inbox.load_more`, `inbox.sort.next_appointment`, `inbox.sort.newly_added`, `inbox.meta.next_appointment.none`, `inbox.meta.newly_added.added_days_ago` (with `{count}` plural), kind-icon labels, modality-icon labels
- [ ] 10.2 Extend `nl/patient-profile-ui.json`: `detail.tab.measurements`, `detail.tab.lab_results`, `detail.tab.appointments`, `detail.tab.empty.measurements.headline/hint`, `detail.tab.empty.lab_results.headline/hint`, `detail.kebab.history`, `detail.kebab.history_dialog_title`
- [ ] 10.3 Create `nl/patient-appointments.json`: `appointments.upcoming.title`, `appointments.history.title`, `appointments.empty.headline`, `appointments.empty.hint`, status chip labels (`status.proposed`, `status.pending`, `status.booked`, `status.arrived`, `status.fulfilled`, `status.cancelled`, `status.noshow`, `status.entered_in_error`, `status.checked_in`, `status.waitlist`), participants overflow `+N`
- [ ] 10.4 Remove i18n keys for dropped `Overzicht` / `Zorgteam` / `Geschiedenis` tab labels (preserve `Geschiedenis` kebab + dialog keys)
- [ ] 10.5 Verify no raw strings outside `t()` in changed files

## 11. Frontend tests

Reusable primitives (tested in isolation, no patient-domain mocks):
- [ ] 11.1 `MasterDetailLayout.test.tsx`: state 1 renders master only; state 2 (detail prop set) renders 320px master + detail; `masterCollapsed=true` hides master and shows floating reopen button; transitions reach final widths
- [ ] 11.2 `InboxRow.test.tsx`: renders all slots; onSelect on click + Enter/Space; `selected` highlight; `compact` reduces padding
- [ ] 11.3 `Avatar.test.tsx`: renders initials uppercased; same `tintBy` → same colour-class on two renders; missing `tintBy` → default tint; never renders `<img>`

Appointment primitives:
- [ ] 11.4 `KindTile.test.tsx`: each `AppointmentKind` maps to expected tint class + icon
- [ ] 11.5 `AppointmentRow.test.tsx`: kind tile + title + formatted local-time line + modality icon + lead-first participants strip with `+N` overflow; History variant shows status Badge; mock `Europe/Brussels` timezone for time-format assertion
- [ ] 11.6 `AppointmentsSection.test.tsx`: Upcoming always expanded; History collapsed by default and expands on click; both-empty renders `EmptyState`

Patient module:
- [ ] 11.7 `nextAppointmentStrategy.test.tsx` + `newlyAddedStrategy.test.tsx`: `queryParams()` shape; `rowMeta()` renders mini-card for non-null, muted text for null; relative-time copy correct for today/yesterday/N days
- [ ] 11.8 `useSelectedSort.test.ts`: returns default when search param absent; honours valid `?sort=`; falls back + warn on unknown; resolves synchronously on first render (no flash)
- [ ] 11.9 `PatientInboxRow.test.tsx`: composes `<InboxRow>` with correct slots; surface-agnostic (no router import — renders in plain `render()`)
- [ ] 11.10 `PatientDetailHeader.test.tsx`: renders all demographics fields; takes an `actions` slot; surface-agnostic (no router import)
- [ ] 11.11 `PatientDetailView.test.tsx`: composes header + Zorgteam line + clinical Tabs; default tab `Metingen`; Metingen + Labresultaten render `<EmptyState>`; tabs switch; surface-agnostic (no router import); `onClose` / `onEdit` / `onDelete` invoked
- [ ] 11.12 `PatientInbox.test.tsx`: default sort `next_appointment`; switching tabs updates URL `?sort=`; rows render `sortMeta` from active strategy; clicking a row navigates to `/_auth/patients/<id>`; empty-state when list empty; realtime invalidation under `patientsListKeyPrefix` refetches; `"Meer laden"` fetches next page via `useInfiniteQuery`; deep-link `?sort=newly_added` renders correctly on first paint (no default flash); sort survives row-click + browser-back

Routes:
- [ ] 11.13 `routes/_auth/patients/route.test.tsx`: URL `/_auth/patients` → master full-width, detail empty-state; URL `/_auth/patients/$id` → master 320px + detail loaded; master-hidden toggle is local (URL unchanged); browser back from detail → state 1

## 12. Verification

- [ ] 12.1 `moon run backend:lint` + `moon run backend:typecheck` + `moon run backend:test`
- [ ] 12.2 `moon run orchestrator:lint` + `moon run orchestrator:typecheck` + `moon run orchestrator:test`
- [ ] 12.3 Manual smoke (desktop ≥md): open `/_auth/patients` → state 1 (inbox full); switch sort, confirm URL updates + list reorders; deep-link `/_auth/patients?sort=newly_added` directly, confirm no default-flash; click a row → state 2 (compact rail + detail); activate Afspraken tab, confirm Upcoming/History sections render (both empty since no seed); kebab Geschiedenis dialog opens; toggle master hidden → state 3 (detail full-width + floating reopen); reopen → back to state 2; close detail → back to state 1; browser back/forward preserves URL state
- [ ] 12.4 Manual smoke (mobile <md): viewport ~375px wide. Open `/_auth/patients` → inbox full-width, no detail pane. Click row → full-page nav to `/_auth/patients/$id` rendering `<PatientDetailView>` full-screen. Browser back → inbox. No master-hidden toggle visible
- [ ] 12.5 Run `/verify` for both apps before reporting done
