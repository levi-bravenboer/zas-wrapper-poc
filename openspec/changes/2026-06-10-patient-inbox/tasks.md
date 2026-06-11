## 0. Prerequisites

- [ ] 0.1 Confirm `patients-base`, `patient-profile-ui`, `user-base` (archived as `backend-user-auth-base`), `care-teams-base` are archived
- [ ] 0.2 Confirm `<CareTeamSlot>` is at `apps/orchestrator/src/modules/patient/components/CareTeamSlot.tsx` with prop signature `{ patientId: string }` (canonical path; supersedes any older spec mention of `features/patient-profile/CareTeamSlot.tsx`)
- [ ] 0.3 Confirm `<PatientHistoryPanel>` export path matches what we will mount inside the kebab `Geschiedenis` dialog
- [ ] 0.4 Confirm no external consumers of `PatientDemographicsPanel` / `PatientIdentifiersPanel` / `PatientsColumns` outside `modules/patient` (dropped per design.md "Component reuse audit" → "Drop on archive")
- [ ] 0.5 Confirm TanStack Router's `useSearch` (or loader) exposes URL search params synchronously on first render for the parent `/_auth/tasks` route — read the version pinned in `package.json` and skim its loader docs
- [ ] 0.6 Read `design.md` "Component reuse audit" section before writing any new component

## 1. Prototype (HTML, before any React or backend)

- [x] 1.1 Built inbox prototype iterations under `prototypes/inbox/v*.html`. **Accepted: `v8.html`** per `prototypes/inbox/README.md`. v8 locks: admin-page chrome, 3-state master/detail layout (D15), surface-agnostic `<PatientDetailView>` mount pattern (D16). Subsequent design decisions (D-FLAT, D-NOSORT, D10 two-tabs) supersede the prototype's pager strip, sort tabs, and three-tab patient detail — the React build follows design.md, not the prototype, where they conflict. Prototype directory keeps the name `prototypes/inbox/` (archival artifact, not a concept reference)
- [ ] 1.2 Confirm with the user that any future visual tweak lands as `vN+1.html` — never edit a prior version

## 2. Backend: `appointment-base` capability

- [ ] 2.1 Create enums at `app/core/enums/appointment.py`: `AppointmentKind`, `AppointmentStatus` (FHIR R4 — store `entered_in_error` symbol, serialise `entered-in-error`), `AppointmentModality`, `AppointmentParticipantRole`. Re-export from `app/core/enums/__init__.py`
- [ ] 2.2 Create ORM model `app/domain/appointment/appointment.py::Appointment` — inherits `TenantOwnedEntity` + `DeletableEntity`. Columns: `patient_id`, `pathway_block_instance_id` (nullable, NO FK in v1 per D18), `title`, `description`, `kind`, `starts_at`, `ends_at`, `modality`, `location_text`, `status`. Add `CHECK (ends_at > starts_at)`
- [ ] 2.3 Create ORM model `app/domain/appointment/appointment_participant.py::AppointmentParticipant` — inherits `BaseEntity` + `DeletableEntity`. Columns: `appointment_id` (FK CASCADE), `user_id` (FK RESTRICT), `role`. Partial unique indexes: `(appointment_id) WHERE role='lead' AND deleted_at IS NULL` + `(appointment_id, user_id) WHERE deleted_at IS NULL`
- [ ] 2.4 Generate alembic migration via `moon run backend:make-migration -- "add appointment-base"` and review autogen. Manually add the partial unique indexes if alembic missed them. Enum types created in `op.execute`. Supporting indexes: `appointments(patient_id, starts_at) WHERE status='booked' AND deleted_at IS NULL` for the aggregator hot path, and `appointment_participants(user_id) WHERE deleted_at IS NULL` for the participant predicate
- [ ] 2.5 Create Pydantic schemas at `app/schemas/appointment/appointment.py`:
  - `AppointmentParticipantCreate` — `{ user_id, role }`
  - `AppointmentParticipantRead` — `{ id, user_id, role, user_display_name }`
  - `AppointmentParticipantInlineSummary` — `{ user_id, role, user_display_name }` (used by `TaskItem.payload`)
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

## 3. Backend: `tasks-base` aggregator capability (NO table, NO ORM)

Per D-AGG — server-side aggregator over source domains. v1 source set: `appointment` only.

- [ ] 3.1 Add `PatientInlineSummary` to `app/schemas/patient/patient.py` — shape `{ id, family_name, given_name, insz: str | None, primary_organisation_id }`. Patient domain owns it; tasks-base imports
- [ ] 3.2 Create `app/schemas/task/task_item.py`:
  - `Source = Literal["appointment"]` (extends as sources are added)
  - `TaskPriority = Literal["low","normal","high","urgent"]` (envelope-level type, NOT a Postgres enum)
  - `AppointmentPayload` — `{ id, starts_at, ends_at, kind, modality, location_text, status, participants: list[AppointmentParticipantInlineSummary] }`
  - `TaskItem` — `{ id: str, source: Source, source_id: UUID, patient: PatientInlineSummary, due_at: datetime, title: str, kind: str | None, priority: TaskPriority | None, payload: AppointmentPayload }`
- [ ] 3.3 Create `app/services/tasks/sources/appointment_source.py::AppointmentSource`:
  - `name = "appointment"`
  - `list(caller, page, page_size) -> Page[TaskItem]`:
    - SQL: `SELECT a.*, p.* FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN appointment_participants ap ON ap.appointment_id = a.id WHERE a.status='booked' AND a.starts_at BETWEEN now() AND now()+INTERVAL '3 days' AND a.deleted_at IS NULL AND ap.user_id = :caller_id AND ap.deleted_at IS NULL AND a.tenant_id = :caller_tenant_id ORDER BY a.starts_at ASC LIMIT :page_size OFFSET ...`
    - Project each row into `TaskItem` (`id="appointment:{a.id}"`, `due_at=a.starts_at`, etc.)
    - Resolve `participants` for the payload via additional JOIN (or post-query batch) — `user_display_name` from the existing users projection
  - `get(caller, source_id) -> TaskItem | None` — same predicate + `a.id = :source_id`
- [ ] 3.4 Create `app/services/tasks/tasks_aggregator.py::TasksAggregator`:
  - `SOURCES: dict[Source, AppointmentSource]` — registry; v1 = `{"appointment": AppointmentSource()}`
  - `list(caller, page, page_size) -> Page[TaskItem]` — for v1 (one source) delegates directly; multi-source ordering becomes a top-K merge by `due_at asc` when 2nd source lands
  - `get(caller, source: Source, source_id: UUID) -> TaskItem` — dispatches to `SOURCES[source].get(...)`; raises NotFound on miss
- [ ] 3.5 Create `app/api/routers/task/task_router.py` — two read routes with `# AUTH-HARDEN` markers + `require_role(Role.ADMIN, Role.CAREGIVER)`:
  - `GET /tasks` — `ListQuery` envelope; `order_by` allow-list = `["due_at"]`; `order` allow-list = `["asc"]`; `filter[patient_id][eq]` accepted (tools/tests); other filters → 422; unknown FLAT query params (e.g. `?within=7d`) silently ignored
  - `GET /tasks/{source}/{source_id}` — read-one; 404 on miss or visibility fail
- [ ] 3.6 Tests (`tests/api/test_tasks_*.py`):
  - `test_no_table_or_orm.py`: assert no SQLAlchemy model named `Task` is registered; assert `tasks` table absent in metadata (or covered by a fresh-DB assertion)
  - `test_window.py`: appointments outside `[now, now+3d]` excluded; non-`booked` excluded; soft-deleted excluded; past `starts_at` excluded
  - `test_visibility.py`: caregiver participant on A1+A2 but not A3 → sees A1+A2; lost participation → 404 on read-one; admin same predicate (empty unless participant); patient role → 403; cross-tenant → 404
  - `test_envelope.py`: `id == f"appointment:{source_id}"`; `due_at == appointment.starts_at`; `title == appointment.title`; `priority is null`; `payload` matches `AppointmentPayload` (incl. participants list with `user_display_name`)
  - `test_sort_and_pagination.py`: default `order_by=due_at order=asc`; alternative `order_by` → 422; `order=desc` → 422; pagination envelope shape
  - `test_no_write_routes.py`: OpenAPI document has no `POST/PATCH/DELETE` on `/tasks`
  - `test_filter_patient_id.py`: `filter[patient_id][eq]=<id>` restricts within the existing predicate
  - `test_within_param_silently_ignored.py`: `?within=7d` returns same response as no param (NOT 422)
  - `test_patient_inline_summary.py`: INSZ resolves correctly, `null` when missing; same-tenant guarantee

## 4. Backend: `patients-base` modifications

- [ ] 4.1 Tests (`tests/api/test_patient_list_sort.py`):
  - `order_by=next_appointment_starts_at` → 422 (rejected; no embedded next_appointment field)
  - `order_by=banana` → 422 (unchanged)

## 4b. OpenAPI + typed client regen

- [ ] 4b.1 `moon run backend:openapi`
- [ ] 4b.2 `moon run orchestrator:typegen`

## 5. Frontend: reusable primitives

Per design.md "Component reuse audit". Only ONE genuinely reusable primitive ships. Tested in isolation, no domain coupling.

- [ ] 5.1 Build `<MasterDetailLayout>` at `apps/orchestrator/src/components/layout/MasterDetailLayout.tsx`. Props: `{ master: ReactNode; detail: ReactNode | null; masterCollapsed: boolean; onMasterCollapsedChange: (v: boolean) => void }`. Implements the 3-state CSS (full / compact 320px / hidden) with 250ms ease width transition. Renders the floating "panel-left-open" reopen button when master is hidden. **Mobile fallback per D17:** below `md` breakpoint the layout SHALL render master full-width and skip the detail column entirely (route swap handles detail display). NO content opinions — pure layout primitive. Tests: state transitions, reopen-button visibility, prop-driven width, mobile fallback
- [ ] 5.2 Lift `<Avatar>` from `components/ui/avatar.tsx` — add optional `tintBy?: string` prop. When set, derives a deterministic background colour from `hash(tintBy) % 8` against a curated ZAS-teal palette with WCAG AA white-text contrast. Default behaviour unchanged. Tests: same `tintBy` → same colour-class; missing `tintBy` → default; palette accessibility
- [ ] 5.3 Confirm `components/states/EmptyState.tsx` already renders icon-in-circle + headline + body. NO new `<TabEmptyState>` wrapper needed — use `<EmptyState>` directly with `icon` + `title` + `body` props

## 6. Delete placeholder before creating new (per D-RENAME)

The new `/_auth/tasks/` directory route and the new `modules/tasks/` directory collide in name with the old placeholders. Delete first to avoid conflict.

- [ ] 6.1 DELETE `apps/orchestrator/src/routes/_auth/tasks.tsx` (single-file placeholder route)
- [ ] 6.2 DELETE `apps/orchestrator/src/modules/tasks/` directory entirely (`TasksPage.tsx`, `tasksPort.ts`, placeholder adapter, `types.ts`, `__tests__/`)

## 7. Frontend: tasks module — query hook + types

Lives under `apps/orchestrator/src/modules/tasks/` (new dir, after task 6.2 deleted the placeholder).

- [ ] 7.1 Create `modules/tasks/types.ts` — re-exports typegen-derived `TaskItem`, `AppointmentPayload`, `PatientInlineSummary`
- [ ] 7.2 Create `modules/tasks/dueLabel.ts` — `dueLabel(item): string` helper (relative-time copy "vandaag X uur" / "morgen X uur" / "over N dagen"). Pure function, no React
- [ ] 7.3 Create `modules/tasks/useTasksQuery.ts` — `useQuery` wrapper over `GET /tasks` keyed `tasksListKeyPrefix`. Single page (no `useInfiniteQuery`). Returns `TaskItem[]` + `isLoading` + `isError`. No `?sort=` param sent

## 8. Frontend: tasks module — row + list components

- [ ] 8.1 Create `modules/tasks/components/KindTile.tsx` — `<KindTile>` with props `{ kind: AppointmentKind; size?: 'sm' | 'md' }`. Renders subtle color-mix background tile + matching lucide icon. Tests: each kind maps to expected tint + icon
- [ ] 8.2 Create `modules/tasks/TaskRow.tsx` — flat clickable row built directly (no `<InboxRow>` abstraction):
  - **Leading**: `<Avatar tintBy={item.patient.id}>` initials from `item.patient.family_name` + `given_name`
  - **Primary**: `family, given`
  - **Secondary** (muted): `INSZ · <t('appointment:kind.<value>') via cross-ns lookup> · dueLabel(item)`
  - **Trailing**: `<KindTile kind={item.payload.kind} size="sm" />`
  - **Chevron** at right
  - **Click**: `navigate({ to: '/_auth/tasks/p/$patientId', params: { patientId: item.patient.id } })`. Below `md`, navigate to `/_auth/patients/$patientId` standalone — `useMediaQuery` reads viewport
  - No per-row kebab. No checkbox. No inline action
- [ ] 8.3 Create `modules/tasks/TaskList.tsx`:
  - PageHeader with title `t('tasks:title')` ("Taken") + sub `t('tasks:subtitle')` (optional)
  - `useTasksQuery` → maps `TaskItem[]` through `<TaskRow>`
  - Empty state via `<EmptyState>` (used directly): `icon`, `title=t('tasks:empty.title')` ("Geen taken"), `body=t('tasks:empty.body')` ("Nieuwe taken verschijnen automatisch")
  - NO filter row, NO sort tabs, NO counter, NO pager, NO "Meer laden" button (per D-FLAT + D-NOSORT)
- [ ] 8.4 Realtime topic registration on `<TaskList>` is a SEAM ONLY (commented placeholder). No-op for v1

## 9. Frontend: patient module — detail components

- [ ] 9.1 Build `<PatientDetailHeader>` at `modules/patient/components/PatientDetailHeader.tsx`. Props `{ patient: PatientRead; actions?: ReactNode }`. Avatar + h2 name + INSZ default Badge + DOB + org soft Badge + actions slot. Surface-agnostic — no router import
- [ ] 9.2 Build `<PatientDetailView>` at `modules/patient/components/PatientDetailView.tsx`. Props per D16: `{ patient; defaultTab?; actions?; onClose?; onEdit?; onDelete? }`. Composes `<PatientDetailHeader>` + `<CareTeamSlot patientId={patient.id} />` + `<EntityDetailTabs>` underline Tabs with TWO tabs `Metingen` / `Labresultaten` (no Afspraken) + two tab bodies (both render `<EmptyState>`). Surface-agnostic — MUST NOT import from `@tanstack/react-router` or any tasks module. Verified by `eslint-no-router-imports` test
- [ ] 9.3 Build `<PatientKebab>` at `modules/patient/components/PatientKebab.tsx`. `Bewerken` opens existing `EditPatientDialog`; `Verwijderen` uses existing `useEntityDelete`; `Geschiedenis` opens new `<Dialog>` with `<PatientHistoryPanel>` inside
- [ ] 9.4 Delete `modules/patient/components/PatientDemographicsPanel.tsx`, `PatientIdentifiersPanel.tsx`, `PatientsColumns.tsx` after confirming task 0.4 found no external consumers

## 10. Frontend: routes (new dirs, created after task 6 deletion)

- [ ] 10.1 Create `routes/_auth/tasks/route.tsx` (parent layout) — renders `<MasterDetailLayout master={<TaskList />} detail={<Outlet />} masterCollapsed={hasPatientIdParam} onMasterCollapsedChange={setLocalCollapsed}>`. Local `masterHidden` state owned here (not URL). No `validateSearch` for `?sort=` (single fixed sort)
- [ ] 10.2 Create `routes/_auth/tasks/index.tsx` (child index) — empty-state right pane ("Selecteer een taak") via shared `<EmptyState>`. Master is full-width
- [ ] 10.3 Create `routes/_auth/tasks/p/$patientId/index.tsx` (child detail) — fetches patient via existing `usePatient`. Renders `<PatientDetailView patient={...} actions={<PatientKebab patient={...} />} onClose={() => navigate({ to: '/_auth/tasks' })} />`. Master collapses to 320px rail
- [ ] 10.4 Modify `routes/_auth/patients/$patientId/index.tsx` (standalone) — now mounts new `<PatientDetailView>` inside `<EntityDetailPage back={{ to: '/_auth/tasks' }}>` chrome. Used by admin/users links, care-team links, mobile fallback (per D17)
- [ ] 10.5 DELETE `routes/_auth/patients/index.tsx` (per D24). Verify with task 0.4 that no internal callers depend on this URL
- [ ] 10.6 Update sidebar (`components/layout/navItems.ts` or `AppSidebar.tsx`) — REMOVE `"Mijn patiënten"` entry. The old placeholder `"Taken"` was already removed when `routes/_auth/tasks.tsx` was deleted (task 6.1) — ADD single `"Taken"` entry pointing to `/_auth/tasks` with lucide `inbox` icon (icon-name only). Ensure exactly one nav item with that label exists post-change

## 11. i18n

- [ ] 11.1 Create `nl/tasks.json` namespace: `title` ("Taken"), `subtitle` (optional), `empty.title` ("Geen taken"), `empty.body` ("Nieuwe taken verschijnen automatisch"), `due.today` ("vandaag {time}"), `due.tomorrow` ("morgen {time}"), `due.in_days` ("over {n} dagen"), `selection.title` ("Selecteer een taak"), `selection.body` (optional), `nav.tasks` ("Taken")
- [ ] 11.2 Create `nl/appointment.json` namespace: `kind.consultation`, `kind.lab`, `kind.imaging`, `kind.procedure`, `kind.other`, `modality.online`, `modality.on_site`. Owned by appointment domain. `<TaskRow>` calls `t('appointment:kind.<value>')` via cross-namespace lookup — no duplication
- [ ] 11.3 Extend `nl/patient-profile-ui.json`: `detail.tab.measurements`, `detail.tab.lab_results`, `detail.tab.empty.measurements.title/body`, `detail.tab.empty.lab_results.title/body`, `detail.kebab.history`, `detail.kebab.history_dialog_title`. Remove any prior `detail.tab.appointments` key (no Afspraken tab)
- [ ] 11.4 Remove i18n keys for dropped `Overzicht` / `Zorgteam` / `Geschiedenis` tab labels (preserve `Geschiedenis` kebab + dialog keys). Remove `Mijn patiënten` sidebar nav key. Remove old placeholder `Taken` key if its value differed
- [ ] 11.5 Verify no raw strings outside `t()` in changed files

## 12. Frontend tests

Reusable primitives:
- [ ] 12.1 `MasterDetailLayout.test.tsx`: state 1 renders master only; state 2 (detail prop set) renders 320px master + detail; `masterCollapsed=true` hides master and shows floating reopen button; mobile fallback (<md) renders master full-width + skips detail
- [ ] 12.2 `Avatar.test.tsx`: same `tintBy` → same colour-class twice; missing `tintBy` → default tint; never renders `<img>`

Tasks module:
- [ ] 12.3 `KindTile.test.tsx`: each `AppointmentKind` maps to expected tint class + icon
- [ ] 12.4 `useTasksQuery.test.ts`: single-page `useQuery` integration; key matches `tasksListKeyPrefix`; no `?sort=` param sent
- [ ] 12.5 `dueLabel.test.ts`: relative-time helper returns expected Dutch copy for `vandaag X uur` / `morgen X uur` / `over N dagen`
- [ ] 12.6 `TaskRow.test.tsx`: `<Avatar tintBy={item.patient.id}>`, `family, given` as primary, secondary line includes INSZ + kind label (via cross-ns lookup) + dueLabel; trailing slot renders `<KindTile>`; click on viewport ≥md navigates to `/_auth/tasks/p/$patientId`; click on <md navigates to `/_auth/patients/$patientId`
- [ ] 12.7 `TaskList.test.tsx`: empty list renders `<EmptyState>` with fixed copy ("Geen taken" / "Nieuwe taken verschijnen automatisch") — same for caregiver + admin role mocks; populated list renders one `<TaskRow>` per `TaskItem`; no counter, no pager, no `"Meer laden"` button anywhere in the DOM

Patient module:
- [ ] 12.8 `PatientDetailHeader.test.tsx`: renders all demographics fields; takes an `actions` slot; surface-agnostic (no router import)
- [ ] 12.9 `PatientDetailView.test.tsx`: composes header + `<CareTeamSlot>` + clinical Tabs with TWO triggers (`Metingen`, `Labresultaten`) only; default tab `Metingen`; both tabs render `<EmptyState>`; tabs switch; surface-agnostic (no router import); `onClose` / `onEdit` / `onDelete` invoked; NO `Afspraken` trigger anywhere

Routes:
- [ ] 12.10 `routes/_auth/tasks/route.test.tsx`: URL `/_auth/tasks` → master full-width, empty-state on right; URL `/_auth/tasks/p/$id` → master 320px + `<PatientDetailView>` loaded; master-hidden toggle is local (URL unchanged); browser back from detail → state 1
- [ ] 12.11 `routes/_auth/patients/$patientId.test.tsx` (standalone): renders `<PatientDetailView>` inside `<EntityDetailPage>` chrome; `back` link points to `/_auth/tasks`
- [ ] 12.12 Sidebar nav test: single `"Taken"` item present, points to `/_auth/tasks`; `"Mijn patiënten"` item ABSENT; no duplicate `"Taken"` from the placeholder

## 13. Verification

- [ ] 13.1 `moon run backend:lint` + `moon run backend:typecheck` + `moon run backend:test`
- [ ] 13.2 `moon run orchestrator:lint` + `moon run orchestrator:typecheck` + `moon run orchestrator:test`
- [ ] 13.3 Manual smoke (desktop ≥md): sidebar `"Taken"` item visible (no `"Mijn patiënten"`, exactly one `"Taken"`). Open `/_auth/tasks` → state 1 (task list full, no seed → empty-state copy `"Geen taken"`). Click an item (once data exists) → navigate to `/_auth/tasks/p/$id` → state 2 (compact rail + `<PatientDetailView>`). Patient detail shows TWO tabs (Metingen + Labresultaten), both empty-state. Kebab `Geschiedenis` dialog opens. Toggle master hidden → state 3 (detail full-width + floating reopen). Reopen → state 2. Close detail → state 1. Browser back/forward preserves URL state. Direct deep-link `/_auth/patients/$id` opens the standalone full-page detail (no master column)
- [ ] 13.4 Manual smoke (mobile <md): viewport ~375px wide. Open `/_auth/tasks` → list full-width, no detail pane. Click item → full-page nav to `/_auth/patients/$id` rendering standalone detail. Browser back → tasks list. No master-hidden toggle visible
- [ ] 13.5 Manual smoke (when appointments exist): create an appointment via `POST /appointments` (e.g. via API call or test fixture) with `starts_at = now() + 1 day`, caller as `lead` participant → row appears in `/_auth/tasks`. Create one with `starts_at = now() + 5 days` → does NOT appear. Create one without caller as participant → does NOT appear. Append `?within=7d` to URL — no effect on results (param silently ignored)
