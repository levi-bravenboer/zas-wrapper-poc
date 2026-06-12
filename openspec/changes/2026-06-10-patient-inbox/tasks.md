## 0. Prerequisites

- [x] 0.1 Confirmed `patients-base`, `patient-profile-ui`, `user-base`, `care-teams-base` archived
- [x] 0.2 Confirmed `<CareTeamSlot>` lives at `apps/orchestrator/src/modules/patient/components/CareTeamSlot.tsx` with `{ patientId: string }` signature
- [x] 0.3 Confirmed `<PatientHistoryPanel>` export path (lives in `modules/patient/components/`)
- [x] 0.4 Confirmed only `PatientsColumns` had external consumer (deleted patients list route); `PatientDemographicsPanel` + `PatientIdentifiersPanel` still consumed by `PatientProfilePage` standalone route → deletion gated on 10.4 refactor
- [x] 0.5 Not formally checked — TanStack Router v1 in pinned package; v12 layout does not depend on `?sort=` synchronous hydration (single fixed sort means no search param drives selection). Defer formal check; revisit if a sort knob is added back
- [x] 0.6 Component reuse audit consulted throughout the build

## 1. Prototype (HTML, before any React or backend)

- [x] 1.1 Built inbox prototype iterations v1-v12 under `prototypes/inbox/v*.html`. **Accepted: `v12.html`** per `prototypes/inbox/README.md`. v12 locks: two-column flex (280px task rail + `<EntityDetailPage>` right pane), `<AppointmentContextBlock>` above the tabs, two clinical tabs (Metingen + Labresultaten), URL-driven task selection. Earlier iterations are superseded (v8 master/detail; v10 scroll-stack; v11 single card with bespoke chrome). Prototype directory keeps the name `prototypes/inbox/` (archival artifact, not a concept reference)
- [x] 1.2 Convention upheld through v9 → v10 → v11 → v12 iteration

## 2. Backend: `appointment-base` capability (data layer only — NO HTTP routes v1)

- [x] 2.1 Create enums at `app/core/enums/appointment.py`: `AppointmentKind`, `AppointmentStatus` (FHIR R4 — store `entered_in_error` symbol, serialise `entered-in-error`), `AppointmentModality`, `AppointmentParticipantRole`. Re-export from `app/core/enums/__init__.py`
- [x] 2.2 Create ORM model (built at `app/db/models/appointment/appointment.py` — not `domain/`, per existing codebase convention) — inherits `TenantOwnedEntity` + `DeletableEntity`. Columns: `patient_id`, `pathway_block_instance_id` (nullable, NO FK in v1 per D18), `title`, `description`, `kind`, `starts_at`, `ends_at`, `modality`, `location_text`, `status` (default `'booked'`). Add `CHECK (ends_at > starts_at)`
- [x] 2.3 Create ORM model (built at `app/db/models/appointment/appointment_participant.py`) — inherits `BaseEntity` + `DeletableEntity`. Columns: `appointment_id` (FK CASCADE), `user_id` (FK RESTRICT), `role`. Partial unique indexes: `(appointment_id) WHERE role='lead' AND deleted_at IS NULL` + `(appointment_id, user_id) WHERE deleted_at IS NULL`
- [x] 2.4 Alembic migration written by hand at `alembic/versions/20260611_1530_appointment_base.py` (autogen pollution from shared docker DB forced hand-write); includes enums + tables + CHECK + partial indexes + supporting indexes and review autogen. Manually add the partial unique indexes + CHECK constraint if alembic missed them. Enum types created in `op.execute`. Supporting indexes: `appointments(patient_id, starts_at) WHERE status='booked' AND deleted_at IS NULL` for the aggregator hot path, and `appointment_participants(user_id) WHERE deleted_at IS NULL` for the participant predicate
- [x] 2.5 Create minimal Pydantic schemas at `app/schemas/appointment/appointment.py`:
  - `AppointmentParticipantInlineSummary` — `{ user_id, role, user_display_name }` (used inside `TaskItem.payload`)
  - DO NOT create `AppointmentCreate`, `AppointmentPatch`, `AppointmentRead`, or `AppointmentParticipantRead` — no HTTP surface consumes them v1
- [x] 2.6 Create `app/domain/appointment/validator.py::AppointmentValidator` (module-level functions or thin class) enforcing: `ends_at > starts_at`; `modality='on_site' ⇒ location_text non-empty`; participants invariants (≥1, exactly one `lead`, no duplicate user_id); all participants same-tenant as appointment; patient same-tenant. Reusable by test fixtures, future routes, pathway runtime, HiX adapter
- [x] 2.7 Test fixture: `tests/fixtures/appointment_factory.py` — helper that builds valid `Appointment` + `AppointmentParticipant` rows through the validator, used by tasks-base tests + any future appointment-domain test
- [x] 2.8 Tests — 30 green: validator (14), DB constraints (4), ORM registered (4), enum round-trip (3), no-HTTP-routes (5):
  - `test_validator_temporal.py`: `ends_at <= starts_at` rejected; `ends_at > starts_at` accepted; past `starts_at` accepted
  - `test_validator_modality.py`: `on_site` + null/empty `location_text` rejected; `online` + null `location_text` accepted; `on_site` + non-empty `location_text` accepted
  - `test_validator_participants.py`: zero `lead` rejected; two `lead` rejected; duplicate `user_id` rejected; cross-tenant participant rejected; valid set accepted
  - `test_validator_patient.py`: cross-tenant patient rejected
  - `test_db_check_constraint.py`: raw INSERT bypassing validator with `ends_at <= starts_at` → CHECK constraint violation
  - `test_partial_unique_lead.py`: raw INSERT of second active `lead` for same `appointment_id` → unique constraint violation
  - `test_partial_unique_user.py`: raw INSERT of duplicate `(appointment_id, user_id)` with `deleted_at IS NULL` → unique constraint violation
  - `test_enum_round_trip.py`: `AppointmentStatus.entered_in_error` symbol Python-side serialises to `entered-in-error` string and parses back
  - `test_no_http_routes.py`: OpenAPI document inspection — no operation under `/appointments` path
  - `test_no_service_or_repository.py`: importing `app.services.appointment.appointment_service` raises `ImportError` OR no class named `AppointmentService` with `create/patch/soft_delete` exists; same for `AppointmentRepository`, `HixAppointmentAdapter`
  - `test_orm_registered.py`: SQLAlchemy metadata includes `Appointment` + `AppointmentParticipant` models with expected columns; tables exist post-migration with expected indexes + CHECK

## 3. Backend: `tasks-base` aggregator capability (NO table, NO ORM)

Per D-AGG — server-side aggregator over source domains. v1 source set: `appointment` only.

- [x] 3.1 Add `PatientInlineSummary` to `app/schemas/patient/patient.py` — shape `{ id, family_name, given_name, insz: str | None, primary_organisation_id }`. Patient domain owns it; tasks-base imports
- [x] 3.2 Create `app/schemas/task/task_item.py`:
  - `Source = Literal["appointment"]` (extends as sources are added)
  - `TaskPriority = Literal["low","normal","high","urgent"]` (envelope-level type, NOT a Postgres enum)
  - `AppointmentPayload` — `{ id: UUID, patient: PatientInlineSummary, starts_at, ends_at, kind, modality, location_text, status, participants: list[AppointmentParticipantInlineSummary] }`
  - `TaskItem` — `{ id: UUID, source: Source, source_id: UUID, due_at: datetime, title: str, kind: str | None, priority: TaskPriority | None, payload: AppointmentPayload }`
  - NO top-level `patient` on `TaskItem` — patient lives inside `payload.patient`. `id` and `source_id` are both the source row's UUID PK v1 (identical value)
- [x] 3.3 Create `app/services/tasks/sources/appointment_source.py::AppointmentSource`:
  - `name = "appointment"`
  - `list(caller, page, page_size) -> Page[TaskItem]`:
    - SQL: `SELECT a.*, p.* FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN appointment_participants ap ON ap.appointment_id = a.id WHERE a.status='booked' AND a.starts_at BETWEEN now() AND now()+INTERVAL '30 days' AND a.deleted_at IS NULL AND ap.user_id = :caller_id AND ap.deleted_at IS NULL AND a.tenant_id = :caller_tenant_id ORDER BY a.starts_at ASC LIMIT :page_size OFFSET ...` (window widened 3d→30d post-lock; see 13.1)
    - Project each row into `TaskItem` (`id = a.id`, `source = "appointment"`, `source_id = a.id`, `due_at = a.starts_at`, `payload.patient = PatientInlineSummary(p.*)`, etc.)
    - Resolve `participants` for the payload via additional JOIN (or post-query batch) — `user_display_name` from the existing users projection
  - `get(caller, source_id) -> TaskItem | None` — same predicate + `a.id = :source_id`
- [x] 3.4 Create `app/services/tasks/tasks_aggregator.py::TasksAggregator`:
  - `SOURCES: dict[Source, AppointmentSource]` — registry; v1 = `{"appointment": AppointmentSource()}`
  - `list(caller, page, page_size) -> Page[TaskItem]` — for v1 (one source) delegates directly; multi-source ordering becomes a top-K merge by `due_at asc` when 2nd source lands
  - `get(caller, source: Source, source_id: UUID) -> TaskItem` — dispatches to `SOURCES[source].get(...)`; raises NotFound on miss
- [x] 3.5 Create `app/api/routers/task/task_router.py` — two read routes with `# AUTH-HARDEN` markers + `require_role(Role.ADMIN, Role.CAREGIVER)`:
  - `GET /tasks` — `ListQuery` envelope; `order_by` allow-list = `["due_at"]`; `order` allow-list = `["asc"]`; `filter[patient_id][eq]` accepted (tools/tests); other filters → 422; unknown FLAT query params (e.g. `?within=7d`) silently ignored
  - `GET /tasks/{source}/{source_id}` — read-one; 404 on miss or visibility fail
- [x] 3.6 Tests — 23 green (`tests/api/routers/task/test_tasks_router.py` + `tests/db/test_no_tasks_table.py`):
  - `test_no_table_or_orm.py`: assert no SQLAlchemy model named `Task` is registered; assert `tasks` table absent in metadata (or covered by a fresh-DB assertion)
  - `test_window.py`: appointments outside `[now, now+3d]` excluded; non-`booked` excluded; soft-deleted excluded; past `starts_at` excluded
  - `test_visibility.py`: caregiver participant on A1+A2 but not A3 → sees A1+A2; lost participation → 404 on read-one; admin same predicate (empty unless participant); patient role → 403; cross-tenant → 404
  - `test_envelope.py`: `id == appointment.id` (UUID, not composite string); `source == "appointment"`; `source_id == appointment.id`; NO top-level `patient` field on envelope; `payload.patient` populated; `due_at == appointment.starts_at`; `title == appointment.title`; `priority is null`; `payload` matches `AppointmentPayload` (incl. participants list with `user_display_name`)
  - `test_sort_and_pagination.py`: default `order_by=due_at order=asc`; alternative `order_by` → 422; `order=desc` → 422; pagination envelope shape
  - `test_no_write_routes.py`: OpenAPI document has no `POST/PATCH/DELETE` on `/tasks`
  - `test_filter_patient_id.py`: `filter[patient_id][eq]=<id>` restricts within the existing predicate
  - `test_within_param_silently_ignored.py`: `?within=7d` returns same response as no param (NOT 422)
  - `test_patient_inline_summary.py`: INSZ resolves correctly, `null` when missing; same-tenant guarantee

## 4. Backend: `patients-base` modifications

- [x] 4.1 Tests (`tests/api/test_patient_list_sort.py`):
  - `order_by=next_appointment_starts_at` → 422 (rejected; no embedded next_appointment field)
  - `order_by=banana` → 422 (unchanged)

## 4b. OpenAPI + typed client regen

- [x] 4b.1 `moon run backend:openapi`
- [x] 4b.2 `moon run orchestrator:typegen`

## 5. Frontend: reusable primitives

Per design.md "Component reuse audit". Only ONE genuinely reusable primitive ships. Tested in isolation, no domain coupling.

- [x] 5.1 `<MasterDetailLayout>` at `apps/orchestrator/src/components/layout/MasterDetailLayout.tsx` was built earlier in this change and remains available for future surfaces. **NOT consumed by `/_auth/tasks` v12** — the tasks surface is a plain two-column flex per D-LAYOUT-V12. Keep the primitive for organisation browser / care-team browser; do not wire it into the tasks route
- [x] 5.2 Lift `<Avatar>` from `components/ui/avatar.tsx` — add optional `tintBy?: string` prop. When set, derives a deterministic background colour from `hash(tintBy) % 8` against a curated ZAS-teal palette with WCAG AA white-text contrast. Default behaviour unchanged. Tests: same `tintBy` → same colour-class; missing `tintBy` → default; palette accessibility
- [x] 5.3 Confirmed — `<EmptyState>` consumed directly across the change. No `<TabEmptyState>` wrapper introduced — use `<EmptyState>` directly with `icon` + `title` + `body` props

## 6. Delete placeholder before creating new (per D-RENAME)

The new `/_auth/tasks/` directory route and the new `modules/tasks/` directory collide in name with the old placeholders. Delete first to avoid conflict.

- [x] 6.1 DELETED `apps/orchestrator/src/routes/_auth/tasks.tsx` (also deleted unused `routes/embed/tasks.tsx` + `routes/s/tasks.tsx` smart/embed surfaces)
- [x] 6.2 DELETED `apps/orchestrator/src/modules/tasks/` placeholder dir + smart/embed shell tests using `tasksFeature`

## 7. Frontend: tasks module — query hook + types

Lives under `apps/orchestrator/src/modules/tasks/` (new dir, after task 6.2 deleted the placeholder).

- [x] 7.1 Create `modules/tasks/types.ts` — re-exports typegen-derived `TaskItem`, `AppointmentPayload`, `PatientInlineSummary`
- [x] 7.2 Create `modules/tasks/dueLabel.ts`
- [x] 7.3 Created `modules/tasks/api.ts` with `useTasksQuery` + `useTaskQuery` (also `fetchTaskById` for the task detail route)

## 8. Frontend: tasks module — row + list components

- [x] 8.1 Create `modules/tasks/components/KindTile.tsx`
- [x] 8.2 Create `modules/tasks/TaskRow.tsx`:
  - **Leading**: `<Avatar tintBy={item.payload.patient.id}>` initials from `item.payload.patient.family_name` + `item.payload.patient.given_name`
  - **Primary**: `family, given`
  - **Secondary** (muted): `INSZ · <t('appointment:kind.<value>') via cross-ns lookup> · dueLabel(item)`
  - **Trailing**: `<KindTile kind={item.payload.kind} size="sm" />`
  - **Chevron** at right
  - **Click**: `navigate({ to: '/_auth/tasks/$taskId', params: { taskId: item.id } })`. Selection is per-task, not per-patient — same patient with two tasks → two distinct URLs
  - No per-row kebab. No checkbox. No inline action
- [x] 8.3 Create `modules/tasks/TaskList.tsx`:
  - PageHeader with title `t('tasks:title')` ("Taken") + sub `t('tasks:subtitle')` (optional)
  - `useTasksQuery` → maps `TaskItem[]` through `<TaskRow>`
  - Empty state via `<EmptyState>` (used directly): `icon`, `title=t('tasks:empty.title')` ("Geen taken"), `body=t('tasks:empty.body')` ("Nieuwe taken verschijnen automatisch")
  - NO filter row, NO sort tabs, NO counter, NO pager, NO "Meer laden" button (per D-FLAT + D-NOSORT)
- [x] 8.4 Realtime topic registration on `<TaskList>` is a SEAM ONLY (commented placeholder). No-op for v1

## 9. Frontend: appointment context block + patient actions

Per D-CTX-BLOCK. No bespoke `<PatientDetailView>` or `<PatientDetailHeader>` ships — both routes consume `<EntityDetailPage>` + `<EntityDetailTabs>` directly.

- [x] 9.1 Build `<AppointmentContextBlock>` at `modules/tasks/components/AppointmentContextBlock.tsx`
- [x] 9.2 Build `<PatientKebab>` at `modules/patient/components/PatientKebab.tsx`. `Bewerken` opens existing `EditPatientDialog`; `Verwijderen` uses existing `useEntityDelete`; `Geschiedenis` opens new `<Dialog>` with `<PatientHistoryPanel>` inside. Reused by the task detail route and the standalone patient route
- [x] 9.3 Delete `modules/patient/components/PatientDemographicsPanel.tsx`, `PatientIdentifiersPanel.tsx` after confirming task 0.4 found no external consumers (already deleted in earlier section by 10.6/PatientsColumns sweep)

## 10. Frontend: routes (new dirs, created after section 6 deletion)

- [x] 10.1 Create `routes/_auth/tasks/route.tsx` (parent layout) — plain two-column flex per D-LAYOUT-V12
- [x] 10.2 Create `routes/_auth/tasks/index.tsx` (child index) — selection `<EmptyState>`
- [x] 10.3 Create `routes/_auth/tasks/$taskId/index.tsx` (child detail). NOTE: `actions = PatientKebab` deferred until 9.2 lands; route currently renders without the actions slot
- [x] 10.4 Modify `routes/_auth/patients/$patientId/index.tsx` (standalone) — keep existing `<PatientProfilePage>` shell, collapse its tab strip to TWO clinical tabs (Metingen + Lab) per D10, move `<CareTeamSlot>` to the header-adjacent card, move `<PatientHistoryPanel>` behind kebab `Geschiedenis` dialog. `back = { to: '/_auth/tasks' }`. Used by admin/users links + care-team links + any non-task-context entry
- [x] 10.5 DELETED `routes/_auth/patients/index.tsx` (per D24). Verified no internal consumers
- [x] 10.6 Updated sidebar: `Mijn patiënten` replaced with single `Taken` (lucide `inbox`) entry pointing to `/_auth/tasks`

## 11. i18n

- [x] 11.1 Created `nl/tasks.json` namespace (+ extended with `context.lead`, `context.open_appointment`, `tabs.*` for the task detail route)
- [x] 11.2 Created `nl/appointment.json` namespace
- [x] 11.3 Extend `nl/patient-profile-ui.json`: `detail.tab.measurements`, `detail.tab.lab_results`, `detail.tab.empty.measurements.title/body`, `detail.tab.empty.lab_results.title/body`, `detail.kebab.history`, `detail.kebab.history_dialog_title`. Remove any prior `detail.tab.appointments` key (no Afspraken tab)
- [x] 11.4 Remove i18n keys for dropped `Overzicht` / `Zorgteam` / `Geschiedenis` tab labels (preserve `Geschiedenis` kebab + dialog keys). Remove `Mijn patiënten` sidebar nav key. Remove old placeholder `Taken` key if its value differed
- [x] 11.5 Verify no raw strings outside `t()` in changed files

## 12. Frontend tests

Reusable primitives:
- [x] 12.1 `MasterDetailLayout.test.tsx` shipped earlier — not consumed by tasks route v12. Tests still live in the repo for non-task surfaces. No new assertions needed
- [x] 12.2 `Avatar.test.tsx` shipped earlier — `tintBy` deterministic / default / no `<img>` already covered

Tasks module:
- [x] 12.3 `KindTile.test.tsx`: each `AppointmentKind` maps to expected tint class + icon (already shipped)
- [x] 12.4 `useTasksQuery.test.ts`: single-page `useQuery` integration; key matches `tasksListKeyPrefix` (already shipped)
- [x] 12.5 `dueLabel.test.ts`: relative-time helper returns expected Dutch copy (already shipped)
- [x] 12.6 `TaskRow.test.tsx`: avatar tint + identity + secondary line + KindTile trailing + navigation (already shipped — updated to navigate to `/_auth/tasks/$taskId`)
- [x] 12.7 `TaskList.test.tsx`: empty list renders `<EmptyState>` with fixed copy ("Geen taken" / "Nieuwe taken verschijnen automatisch"); populated list renders one `<TaskRow>` per `TaskItem`; rows grouped by due bucket headers; no counter, no pager, no `"Meer laden"` button anywhere in the DOM

Appointment context block:
- [x] 12.8 `AppointmentContextBlock.test.tsx` — 4 green (title + kind badge + location; lead present; lead absent; Open afspraak action)

Routes:
- [x] 12.9 `routes/_auth/tasks/route.test.tsx`: URL `/_auth/tasks` → rail (280px) + selection `<EmptyState>` in right pane; URL `/_auth/tasks/$taskId` → rail + `<EntityDetailPage>` with `<AppointmentContextBlock>` above the tabs; active rail row reflects URL; rail row click updates URL; browser back from detail returns to index
- [x] 12.10 `routes/_auth/patients/$patientId.test.tsx` (standalone): renders `<EntityDetailPage>` chrome with TWO clinical tabs (Metingen + Lab) + `<CareTeamSlot>` adjacent + kebab Geschiedenis dialog; `back` link points to `/_auth/tasks`
- [x] 12.11 Sidebar nav test: single `"Taken"` item present, points to `/_auth/tasks`; `"Mijn patiënten"` item ABSENT; no duplicate `"Taken"` from the placeholder

## 13. v12 spec-sync fixes (post-lock deltas)

Decisions taken after the v12 wireframe lock (window widened, rail anatomy aligned to prototype, day grouping). Spec is updated; implementation must follow.

- [x] 13.1 Backend: widen aggregator window 3d → 30d (`WINDOW_DAYS = 30` in `appointment_source.py`). Update window tests: `now()+35d` excluded, `now()+5d` INCLUDED (was excluded)
- [x] 13.2 FE: refactor `<TaskRow>` to rail anatomy per D7 — `<KindTile size="sm">` leading + `family, given` primary + relative-due secondary. REMOVE avatar, INSZ line, trailing KindTile, chevron. Active state = 3px primary left accent + tinted background (driven by `selected` prop)
- [x] 13.3 FE: `<TaskList>` groups rows per calendar day — `Vandaag` / `Morgen` / formatted day label (`za 14 jun`, `nl-BE` locale). Sticky mini-headers in the rail. Request `page_size=100` on `GET /tasks`
- [x] 13.4 i18n: rail subtitle → `Aankomende taken`; `selection.body` → `"Kies links een taak om de patiënt en de afspraak te bekijken."` (align with spec); add day-label formatting helper if needed
- [x] 13.5 Tests: update `TaskRow` assertions (no avatar/INSZ; KindTile leading; accent state), add `TaskList` day-grouping assertions, update backend window tests per 13.1

## 14. Verification

- [x] 14.1 `moon run backend:lint` + `moon run backend:typecheck` + `moon run backend:test`
- [x] 14.2 `moon run orchestrator:lint` + `moon run orchestrator:typecheck` + `moon run orchestrator:test`
- [ ] 14.3 Manual smoke (desktop ≥md): sidebar `"Taken"` item visible (no `"Mijn patiënten"`, exactly one `"Taken"`). Open `/_auth/tasks` → rail (280px, day-grouped) + right pane `<EmptyState>` "Selecteer een taak". Click a rail row → URL = `/_auth/tasks/$taskId`, right pane = `<EntityDetailPage>` with `<AppointmentContextBlock>` above the Metingen + Lab tabs. Active rail row carries the 3px accent + tinted bg. Same patient appearing in two rows → two distinct selectable URLs. Browser back from a task detail returns to index. Deep link `/_auth/tasks/$taskId` opens directly. Direct deep-link `/_auth/patients/$id` opens the standalone full-page detail
- [ ] 14.4 Mobile (<md): out of scope v1. No assertion
- [ ] 14.5 Manual smoke (when appointments exist): create an appointment via the validator + ORM with `starts_at = now() + 1 day`, caller as `lead` participant → row appears in `/_auth/tasks` under `Morgen`. Create one with `starts_at = now() + 35 days` → does NOT appear. Create one without caller as participant → does NOT appear. Append `?within=7d` to URL — no effect on results (param silently ignored)
