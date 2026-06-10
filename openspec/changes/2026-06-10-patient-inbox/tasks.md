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

## 3. Backend: `tasks-base` capability

Per D21 — read-only domain in v1; pathway runtime adds writes later.

- [ ] 3.1 Create enums at `app/core/enums/task.py`: `TaskKind` (`review|follow_up|call|intake|signoff|other`), `TaskStatus` (`open|in_progress|completed|cancelled`), `TaskPriority` (`low|normal|high|urgent`). Re-export from `app/core/enums/__init__.py`
- [ ] 3.2 Create ORM model `app/domain/task/task.py::Task` — inherits `TenantOwnedEntity` + `DeletableEntity`. Columns: `patient_id` (FK RESTRICT), `assigned_user_id` (FK RESTRICT, nullable), `pathway_block_instance_id` (nullable, NO FK in v1 per D18), `title`, `description`, `kind`, `status` (default `open`), `due_at` (nullable timestamptz), `priority` (default `normal`)
- [ ] 3.3 Generate alembic migration via `moon run backend:make-migration -- "add tasks-base"`. Review autogen; ensure three enum types are created via `op.execute`. Add supporting index `CREATE INDEX tasks_patient_status_idx ON tasks(patient_id, status) WHERE deleted_at IS NULL` and `CREATE INDEX tasks_due_at_idx ON tasks(due_at NULLS LAST) WHERE deleted_at IS NULL`
- [ ] 3.4 Create Pydantic schemas at `app/schemas/task/task.py`:
  - `PatientInlineSummary`: `{ id, family_name, given_name, insz?: str | None, primary_organisation_id }`
  - `TaskRead`: full row + `patient: PatientInlineSummary` projected via join
- [ ] 3.5 Create `app/repositories/task_repository.py::TaskRepository` (subclass of `BaseListRepository`):
  - `filterable_fields`: `patient_id`, `status`, `kind`, `priority`, `assigned_user_id`, `due_at`
  - `searchable_fields`: `title`
  - `allowed_order_by`: `due_at` (NULLS LAST), `created_at`, `priority`
  - default `order_by=due_at`, `order=asc`
  - special filter handler: `assigned_user_id=me` resolves server-side to caller's user id
- [ ] 3.6 Create `app/services/task/task_service.py::TaskService`:
  - `list_in_tenant(list_query, caller)` — wraps repository, applies caregiver patient-access filter via subquery `WHERE patient_id IN (visible_patient_ids_for(caller))`. Admin bypass
  - `get_by_id(task_id, caller)` — applies same patient-access predicate
  - NO `create()` / `patch()` / `soft_delete()` v1 — no writes
- [ ] 3.7 Create `app/api/routers/task/task_router.py` — two read routes with `# AUTH-HARDEN` markers + `require_role(Role.ADMIN, Role.CAREGIVER)` (NOT `Role.PATIENT`):
  - `GET /tasks` (list)
  - `GET /tasks/{id}` (read)
- [ ] 3.8 Create `app/adapters/hix/tasks.py::HixTaskAdapter` with `fetch` + `upsert_from_hix` raising `NotImplementedError("HiX task adapter is MVP scope")`. Import-test coverage
- [ ] 3.9 Create `scripts/seed_tasks.py` — synthetic-only seed (header comment cites no-PHI invariant). Deterministic PRNG; for each seeded patient generates 0-3 tasks with varied `kind`, `status`, `priority`, `due_at` (past-due / due-today / due-this-week / undated mix). ~60% assigned to demo caregiver. Idempotent via deterministic uniqueness key
- [ ] 3.10 Tests (`tests/api/test_tasks_*.py`):
  - `test_list.py`: tenant scope; caregiver patient-access predicate; admin sees all; `assigned_user_id=me` resolves to caller; default sort `due_at` ascending with NULLS LAST; date-range filter on `due_at`
  - `test_read.py`: caregiver patient-access predicate (lost-access → 404); cross-tenant → 404
  - `test_no_write_routes.py`: OpenAPI document has no `POST/PATCH/DELETE` on `/tasks`
  - `test_patient_role_rejected.py`: 403 on patient-role session for both `GET /tasks` and `GET /tasks/{id}`
  - `test_embedded_patient.py`: `TaskRead.patient` populated with `{id, family_name, given_name, insz?, primary_organisation_id}`; INSZ is `null` when patient has no identifier row
  - `test_visibility_unassigned.py`: caregiver with patient access sees unassigned tasks for that patient; assignment to another caregiver does NOT hide the task
  - `test_visibility_assigned_no_access.py`: caregiver assigned to a task but without patient access → 404
  - `test_hix_adapter_stub.py`: import + NotImplementedError
  - `test_seed_tasks.py`: re-run idempotent; mix of past-due / due-today / undated represented; ~60% assigned ratio (allow ±10%)

## 4. Backend: `patients-base` modifications

- [ ] 4.1 Extend `PatientRepository.allowed_order_by` with `created_at` (skip if already present). Explicitly REJECT `next_appointment_starts_at` (no projection added on `PatientRead` — sort lives on `/inbox/items`)
- [ ] 4.2 Tests (`tests/api/test_patient_list_sort.py`):
  - `order_by=created_at&order=desc` returns newest first
  - `order_by=next_appointment_starts_at` → 422 (rejected; sort moved to `/inbox/items`)
  - `order_by=banana` → 422 (unchanged)

## 4b. OpenAPI + typed client regen

- [ ] 4b.1 `moon run backend:openapi`
- [ ] 4b.2 `moon run orchestrator:typegen`

## 5. Frontend: reusable primitives (built first, before patient + inbox modules)

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

## 7. Frontend: inbox module — sort registry + hooks + query

Lives under `apps/orchestrator/src/modules/inbox/`. Per D19, the inbox is a task list — no polymorphism, no dispatcher.

- [ ] 7.1 Create `modules/inbox/sorts/index.ts` exporting `InboxSortStrategy` type `{ id, label, queryParams }` and readonly `inboxSortStrategies` array
- [ ] 7.2 Create `modules/inbox/sorts/nextAttention.ts` — id `next_attention`, label via `t('inbox.sort.next_attention')`, `queryParams()` returns `{ order_by: 'due_at', order: 'asc' }`
- [ ] 7.3 Create `modules/inbox/sorts/newlyAdded.ts` — id `newly_added`, label via `t('inbox.sort.newly_added')`, `queryParams()` returns `{ order_by: 'created_at', order: 'desc' }`
- [ ] 7.4 Create `modules/inbox/useSelectedInboxSort.ts` — reads `?sort=` via TanStack Router `useSearch` synchronously, returns active strategy on first render (no flash). Unknown id → fallback to `next_attention` + `console.warn`. `setSort(id)` calls `navigate({ search: prev => ({ ...prev, sort: id }) })`
- [ ] 7.5 Create `modules/inbox/useInboxQuery.ts` — `useInfiniteQuery` wrapper over `GET /tasks` keyed `[...tasksListKeyPrefix, { sort }]`. Sets `getNextPageParam` based on `total_pages`. Returns flattened `TaskRead[]` + `hasNextPage` + `fetchNextPage`
- [ ] 7.6 Create `modules/inbox/types.ts` — re-exports typegen-derived `TaskRead`, `PatientInlineSummary`. Local helpers: `dueLabel(task): string` (relative-time copy "vandaag" / "morgen" / "over 3 dagen" / "verlopen 2 dagen" / "geen deadline")

## 8. Frontend: inbox module — row + list components

- [ ] 8.1 Create `modules/inbox/TaskInboxRow.tsx` — composes generic `<InboxRow>` with task bindings: `<Avatar tintBy={task.patient.id}>` initials from `task.patient.family_name` + `given_name`, `family, given` as primary line, secondary line = `INSZ · TaskKind label · dueLabel(task)`. Trailing slot:
  - priority Badge (variant: `urgent`→destructive, `high`→warning, `normal|low`→muted)
  - status Badge (muted, ONLY rendered when `task.status !== 'open'`, Dutch label per status)
- [ ] 8.2 `onSelect → navigate({ to: '/_auth/inbox/p/$patientId', params: { patientId: task.patient.id } })`. Below `md` breakpoint, navigate to `/_auth/patients/$patientId` (standalone) instead — `useMediaQuery` hook reads viewport
- [ ] 8.3 Create `modules/inbox/InboxList.tsx` — composes:
  - PageHeader with title `t('inbox.title')` + sub `t('inbox.subtitle')`
  - Filter row: search Input (placeholder via `t()`), Status Select + Priority Select dropdowns (v1 stub — inputs render but only sort tabs drive query; filter wiring is task-7-follow-up)
  - Sort tabs via `useSelectedInboxSort` (underline Tabs primitive)
  - List body — `useInboxQuery` → maps `TaskRead[]` through `<TaskInboxRow>`
  - `"Meer laden"` button while `hasNextPage`
  - Pager strip
  - Empty state via shared `<EmptyState>` — role-aware copy (`t('inbox.empty.caregiver.*')` vs `t('inbox.empty.admin.*')`)
- [ ] 8.4 Realtime topic registration on `<InboxList>` is a SEAM ONLY (commented placeholder) — actual topic lands in BL-076. No-op for v1

## 9. Frontend: patient module — detail components (unchanged from item-reframe)

- [ ] 9.1 Build `<PatientDetailHeader>` at `modules/patient/components/PatientDetailHeader.tsx`. Props `{ patient: PatientRead; actions?: ReactNode }`. Avatar + h2 name + INSZ default Badge + DOB + org soft Badge + actions slot. Surface-agnostic
- [ ] 9.2 Build `<PatientDetailView>` at `modules/patient/components/PatientDetailView.tsx`. Props per D16: `{ patient; defaultTab?; actions?; onClose?; onEdit?; onDelete? }`. Composes `<PatientDetailHeader>` + `<CareTeamSlot patientId={patient.id} />` (self-fetching) + `<EntityDetailTabs>` underline Tabs with `Metingen` / `Labresultaten` / `Afspraken` triggers + tab bodies. Surface-agnostic — MUST NOT import from `@tanstack/react-router` or any inbox module. Verified by `eslint-no-router-imports` test
- [ ] 9.3 Build `<PatientKebab>` at `modules/patient/components/PatientKebab.tsx`. `Bewerken` opens existing `EditPatientDialog`; `Verwijderen` uses existing `useEntityDelete`; `Geschiedenis` opens new `<Dialog>` with `<PatientHistoryPanel>` inside
- [ ] 9.4 Delete `modules/patient/components/PatientDemographicsPanel.tsx`, `PatientIdentifiersPanel.tsx`, `PatientsColumns.tsx` after confirming task 0.6 found no external consumers

## 10. Frontend: routes

- [ ] 10.1 Create `routes/_auth/inbox/route.tsx` (parent layout) — renders `<MasterDetailLayout master={<InboxList />} detail={<Outlet />} masterCollapsed={hasPatientIdParam} onMasterCollapsedChange={setLocalCollapsed}>`. Local `masterHidden` state owned here (not URL). `validateSearch` accepts `sort?: 'next_attention' | 'newly_added'`
- [ ] 10.2 Create `routes/_auth/inbox/index.tsx` (child index) — empty-state right pane ("Selecteer een item") via shared `EmptyState`. Master is full-width
- [ ] 10.3 Create `routes/_auth/inbox/p/$patientId/index.tsx` (child detail) — fetches patient via existing `usePatient`. Renders `<PatientDetailView patient={...} actions={<PatientKebab patient={...} />} onClose={() => navigate({ to: '/_auth/inbox' })} />`. Master collapses to 320px rail
- [ ] 10.4 Modify `routes/_auth/patients/$patientId/index.tsx` (standalone) — now mounts new `<PatientDetailView>` inside `<EntityDetailPage back={{ to: '/_auth/inbox' }}>` chrome. Used by admin/users links, care-team links, mobile fallback (per D17), and any non-inbox-context entry
- [ ] 10.5 DELETE `routes/_auth/patients/index.tsx` (per D24). Verify with task 0.6 that no internal callers depend on this URL
- [ ] 10.6 DELETE `routes/_auth/tasks.tsx` AND `modules/tasks/*` (TasksPage, tasksPort, placeholder adapter, types). The placeholder is fully replaced by the new inbox module
- [ ] 10.7 Update sidebar (`components/layout/navItems.ts` or `AppSidebar.tsx`) — REMOVE `"Mijn patiënten"` AND `"Taken"` entries. ADD single `"Inbox"` entry pointing to `/_auth/inbox` with lucide `inbox` icon

## 10. i18n

## 11. i18n

- [ ] 11.1 Create `nl/inbox.json`: `inbox.title`, `inbox.subtitle`, `inbox.empty.caregiver.headline`, `inbox.empty.caregiver.hint`, `inbox.empty.admin.headline`, `inbox.empty.admin.hint`, `inbox.empty.selection.headline`, `inbox.empty.selection.hint`, `inbox.load_more`, `inbox.sort.next_attention`, `inbox.sort.newly_added`, `inbox.unknown_kind` (with `{resourceType}` placeholder), `inbox.filter.team`, `inbox.filter.status`, `inbox.search_placeholder`, sidebar nav label `nav.inbox`
- [ ] 11.2 Extend `nl/patient-profile-ui.json`: `detail.tab.measurements`, `detail.tab.lab_results`, `detail.tab.appointments`, `detail.tab.empty.measurements.headline/hint`, `detail.tab.empty.lab_results.headline/hint`, `detail.kebab.history`, `detail.kebab.history_dialog_title`
- [ ] 11.3 Create `nl/patient-appointments.json`: `appointments.upcoming.title`, `appointments.history.title`, `appointments.empty.headline`, `appointments.empty.hint`, status chip labels (10 FHIR values), participants overflow `+N`. Plus kind-icon labels (`kind.consultation/lab/imaging/procedure/other`) and modality labels (`modality.online/on_site`) — shared with inbox row rendering
- [ ] 11.4 Remove i18n keys for dropped `Overzicht` / `Zorgteam` / `Geschiedenis` tab labels (preserve `Geschiedenis` kebab + dialog keys). Remove `Mijn patiënten` sidebar nav key
- [ ] 11.5 Verify no raw strings outside `t()` in changed files

## 12. Frontend tests

Reusable primitives:
- [ ] 12.1 `MasterDetailLayout.test.tsx`: state 1 renders master only; state 2 (detail prop set) renders 320px master + detail; `masterCollapsed=true` hides master and shows floating reopen button; mobile fallback (<md) renders master full-width + skips detail
- [ ] 12.2 `InboxRow.test.tsx`: renders all slots; onSelect on click + Enter/Space; `selected` highlight; `compact` reduces padding
- [ ] 12.3 `Avatar.test.tsx`: same `tintBy` → same colour-class twice; missing `tintBy` → default tint; never renders `<img>`

Appointment primitives:
- [ ] 12.4 `KindTile.test.tsx`: each `AppointmentKind` maps to expected tint class + icon
- [ ] 12.5 `AppointmentRow.test.tsx`: kind tile + title + formatted local-time line + modality icon + participants strip with `+N` overflow; History variant shows status Badge; mock `Europe/Brussels` timezone
- [ ] 12.6 `AppointmentsSection.test.tsx`: Upcoming always expanded; History collapsed by default and expands on click; both-empty renders `EmptyState`

Inbox module:
- [ ] 12.7 `nextAttention.test.ts` + `newlyAdded.test.ts`: `queryParams()` shape
- [ ] 12.8 `useSelectedInboxSort.test.ts`: returns default when search param absent; honours valid `?sort=`; falls back + warn on unknown; resolves synchronously on first render (no flash)
- [ ] 12.9 `useInboxQuery.test.ts`: TanStack `useInfiniteQuery` integration; `fetchNextPage` advances `page`; key changes with sort
- [ ] 12.10 `TaskInboxRow.test.tsx`: composes `<InboxRow>` with `Avatar tintBy={task.patient.id}`, `family, given` as primary, secondary line includes INSZ + kind label + dueLabel relative-time copy; priority Badge variant matches priority (urgent→destructive, high→warning, normal|low→muted); status Badge only renders when `status !== 'open'`; click on viewport ≥md navigates to `/_auth/inbox/p/$id`; click on <md navigates to `/_auth/patients/$id`
- [ ] 12.11 `dueLabel.test.ts`: relative-time helper returns expected Dutch copy for vandaag / morgen / over N dagen / verlopen N dagen / geen deadline
- [ ] 12.12 `InboxList.test.tsx`: empty list renders `EmptyState` with role-aware copy (mock caregiver vs admin role); `useInboxQuery` with 0 pages → empty; with 1 page → list; with 2 pages → "Meer laden" visible + click fetches next; switching sort updates URL `?sort=`; deep-link `?sort=newly_added` does not flash default sort

Patient module:
- [ ] 12.14 `PatientDetailHeader.test.tsx`: renders all demographics fields; takes an `actions` slot; surface-agnostic (no router import)
- [ ] 12.15 `PatientDetailView.test.tsx`: composes header + `<CareTeamSlot>` + clinical Tabs; default tab `Metingen`; Metingen + Labresultaten render `<EmptyState>`; tabs switch; surface-agnostic (no router import); `onClose` / `onEdit` / `onDelete` invoked

Routes:
- [ ] 12.16 `routes/_auth/inbox/route.test.tsx`: URL `/_auth/inbox` → master full-width, empty-state on right; URL `/_auth/inbox/p/$id` → master 320px + `<PatientDetailView>` loaded; master-hidden toggle is local (URL unchanged); browser back from detail → state 1
- [ ] 12.17 `routes/_auth/patients/$patientId.test.tsx` (standalone): renders `<PatientDetailView>` inside `<EntityDetailPage>` chrome; `back` link points to `/_auth/inbox`
- [ ] 12.18 Sidebar nav test: `"Inbox"` item present, points to `/_auth/inbox`; `"Mijn patiënten"` item ABSENT

## 13. Verification

- [ ] 13.1 `moon run backend:lint` + `moon run backend:typecheck` + `moon run backend:test`
- [ ] 13.2 `moon run orchestrator:lint` + `moon run orchestrator:typecheck` + `moon run orchestrator:test`
- [ ] 13.3 Manual smoke (desktop ≥md): sidebar `"Inbox"` item visible (no `"Mijn patiënten"`). Open `/_auth/inbox` → state 1 (inbox full, empty seeded → empty-state copy). Switch sort, confirm URL updates + list reorders. Deep-link `/_auth/inbox?sort=newly_added` directly, confirm no default-flash. Click an item → navigate to `/_auth/inbox/p/$id` → state 2 (compact rail + `<PatientDetailView>`). Activate Afspraken tab → Upcoming + History sections render. Kebab `Geschiedenis` dialog opens. Toggle master hidden → state 3 (detail full-width + floating reopen). Reopen → state 2. Close detail → state 1. Browser back/forward preserves URL state. Direct deep-link `/_auth/patients/$id` opens the standalone full-page detail (no inbox column)
- [ ] 13.4 Manual smoke (mobile <md): viewport ~375px wide. Open `/_auth/inbox` → list full-width, no detail pane. Click item → full-page nav to `/_auth/patients/$id` rendering standalone detail. Browser back → inbox. No master-hidden toggle visible
- [ ] 13.5 Manual smoke (seeded tasks): after running `seed_tasks.py`, `/_auth/inbox` shows mix of past-due (red priority chip) / due-today / undated tasks per patient. Sort `Volgende afspraak` puts past-due + due-today first; switch to `Nieuw vs oud` and confirm reorder + URL update
- [ ] 13.6 Run `/verify` for both apps before reporting done
