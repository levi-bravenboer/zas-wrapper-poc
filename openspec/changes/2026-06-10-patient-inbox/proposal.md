**Tier**: [poc]
**Promotes**: BL-037 (F4 patient domain — orchestrator patients-overview reshape) and partial scope of BL-038 (appointment domain prerequisite for the inbox sort signal).

## Why

`patients-base` shipped `/_auth/patients` as a generic `<DataTable<PatientRead>>` and `patient-profile-ui` shipped the detail page with three meta tabs (`Overzicht`, `Zorgteam`, `Geschiedenis`). Both work, but neither matches how a caregiver actually uses these screens in the demo story:

- A caregiver scanning the list is asking *"who needs me first?"*, not *"sort column X ascending and page through 25 rows"*. The DataTable surfaces a spreadsheet; the work is triage.
- The detail page's current tabs are mostly meta (demographics, audit). They don't show the clinical surfaces a caregiver needs — measurements, lab results, upcoming appointments.

To make the inbox actually triage-ordered, the backend needs the appointment domain itself — there is no `appointments` table in the PoC yet. Pathway `appointment` is a block-type template, not a runtime entity. This change therefore ships the appointment domain (read-and-write backend, read-only frontend) alongside the inbox + detail reshape. Future pathway runtime (BL-038) calls into the same `AppointmentService` to materialise pathway-driven appointments.

## What Changes

### New backend capability — `appointment-base`

- New `appointments` table (`patient_id` FK, `title`, `description`, `kind` enum, `starts_at`, `ends_at`, `modality` enum, `location_text`, `status` FHIR enum, `pathway_block_instance_id` nullable FK reserved for pathway runtime, inherited audit + soft-delete).
- New `appointment_participants` join table (`appointment_id`, `user_id`, `role` enum `lead | support | observer`) with a partial unique index enforcing exactly one active `lead` per appointment.
- Full CRUD endpoints: `GET /appointments`, `GET /appointments/{id}`, `POST /appointments`, `PATCH /appointments/{id}` (no participants — frozen after create in v1), `DELETE /appointments/{id}` (soft).
- Visibility: caregivers see appointments only for patients they can see (`require_patient_access`); admins tenant-wide. `patient`-role users are rejected (mobile-app patient reads land separately later).
- Validation: `ends_at > starts_at` strict; one `lead` required at create; participants frozen after create; on-site modality requires `location_text`; state-machine free for v1.
- HiX adapter module stub (`HixAppointmentAdapter`) raising `NotImplementedError` — same pattern as patient adapter, reserves the MVP wiring point.
- No seed data v1; no realtime topic v1 (plain stale-time refetch — added when frontend grows write actions or pathway runtime mutates appointments).

### Modified backend capability — `patients-base`

- Extend `PatientRead` with embedded nullable field `next_appointment: NextAppointmentSummary | None` projecting the patient's earliest `status='booked'` + future `starts_at` appointment row as `{ id, title, starts_at, ends_at, kind, modality }`. Implementation via lateral join or correlated subquery (NULLS LAST regardless of order direction).
- Extend `PatientRepository.allowed_order_by` with `next_appointment_starts_at` and `created_at`. Unknown values keep returning `422` from the `ListQuery` validator.

### Modified frontend capability — `patients-base` (orchestrator surface)

- Replace `/_auth/patients` DataTable with `<PatientInbox>`: avatar slab (deterministic-tinted initials — never a photo), identity column, sort-driven meta column, primary action chevron. Full row is the click target. No per-row kebab.
- Introduce a small sort registry (`apps/orchestrator/src/features/patient-inbox/sorts/`) — flat readonly array of strategy objects `{ id, label, queryParams, rowMeta }`. v1 ships two strategies:
  - `next_appointment` (default) — `order_by=next_appointment_starts_at&order=asc`. Meta column renders a two-line mini-card (kind icon + title / formatted local time + modality icon) when `next_appointment` is non-null; muted `"Geen geplande afspraak"` text when null.
  - `newly_added` — `order_by=created_at&order=desc`. Meta column renders muted `"toegevoegd N dagen geleden"`.
- Active sort lives in URL search param `?sort=`. Deep-linked `?sort=newly_added` MUST be active on first paint (no flash of default). Sort persists across row click + browser back.
- Pagination via `useInfiniteQuery` against backend `page_size=25`. Continuous scroll + `"Meer laden"` button. No classic numbered pager.
- TanStack Query key = `[...patientsListKeyPrefix, { sort }]`. Existing realtime topic registration unchanged.

### Modified frontend capability — `patient-profile-ui`

- Replace tab strip with three clinical tabs in order: `Metingen` (id `measurements`), `Labresultaten` (id `lab_results`), `Afspraken` (id `appointments`). Default active tab = `measurements`.
- Hoist demographics + identifiers into the sticky `<PatientDetailHeader>` (drops the `Overzicht` tab).
- Move `<CareTeamSlot>` out of the tab body into a header-adjacent card (right of header on ≥md, stacked below on smaller). Export path + prop signature unchanged — `care-teams-ui` stays unaffected.
- Move audit history off the strip into a new `Geschiedenis` kebab entry that opens a shadcn `<Dialog>` rendering the existing `<PatientHistoryPanel>`.
- **Metingen** and **Labresultaten** tabs render `<TabEmptyState>` only (no backend wiring v1 — wiring lands in follow-ups).
- **Afspraken** tab renders real data, READ-ONLY: Upcoming section (status `booked`, `starts_at >= now()`, asc) + collapsible History section (everything else, desc). No create / edit / delete / status-change UI in v1.

### Architecture seam for future surfaces

- Extract `<PatientInboxRow>` and `<PatientDetailHeader>` as surface-agnostic primitives (no router import, no shell coupling). A future `smart` or `embed` surface can host them with its own wrapper. No `smart`/`embed` surface ships in this change.
- Regenerate OpenAPI + typed client.

## Capabilities

### Added Capabilities

- `appointment-base` — new backend capability covering appointment domain (table, participants, FHIR-aligned enums, CRUD endpoints, visibility, HiX adapter stub).

### Modified Capabilities

- `patients-base` — `PatientRead` gains embedded `next_appointment`; `order_by` allow-list gains `next_appointment_starts_at` + `created_at`; `/_auth/patients` swaps DataTable for `<PatientInbox>` with sort registry + infinite scroll + avatar slab.
- `patient-profile-ui` — detail tab strip replaced; demographics absorbed into header; CareTeamSlot relocated to header card; audit moved behind kebab; Afspraken tab renders real data read-only.

## Impact

- **Prerequisites**: `patients-base`, `patient-profile-ui`, and `users-base` (for participant FKs) archived. `care-teams-base` archived (CareTeamSlot stays compatible).
- **DB**:
  - New `appointments` table + `appointment_participants` table + three Postgres enums (`appointment_kind`, `appointment_status`, `appointment_modality`, plus `appointment_participant_role`).
  - One alembic migration.
- **Backend code** (`apps/backend/app/`):
  - `core/enums/appointment.py` — three enums.
  - `domain/appointment/` — ORM models for `Appointment` + `AppointmentParticipant`.
  - `repositories/appointment_repository.py` — `BaseListRepository` subclass with filterable / orderable / searchable fields.
  - `services/appointment/appointment_service.py` — create / read / list / patch / delete + tenant + patient-access enforcement.
  - `api/routers/appointment/appointment_router.py` — five routes, each with `# AUTH-HARDEN` markers.
  - `schemas/appointment/appointment.py` — `AppointmentCreate`, `AppointmentPatch`, `AppointmentRead`, `AppointmentParticipantRead`, `NextAppointmentSummary`.
  - `adapters/hix/appointments.py` — adapter stub.
  - `schemas/patient/patient.py` — add `next_appointment: NextAppointmentSummary | None` to `PatientRead`.
  - `repositories/patient_repository.py` — projection of `next_appointment` via lateral join; extend `allowed_order_by`.
  - Tests: new `tests/api/test_appointments_*.py` plus `tests/api/test_patient_list_sort.py` updates.
- **Frontend code** (`apps/orchestrator/src/`):
  - New `features/patient-inbox/` module: `PatientInbox.tsx`, `PatientInboxRow.tsx`, `Avatar.tsx`, `sorts/{index,nextAppointment,newlyAdded}.ts`, `useSelectedSort.ts`.
  - Rewrite `routes/_auth/patients/index.tsx` to render `<PatientInbox>` (drops `FilterableListPage` + `DataTable` from this route).
  - New `features/patient-profile/PatientDetailHeader.tsx` (extract from current page).
  - Rewrite `features/patient-profile/PatientProfilePage.tsx` for new tab strip + adjacent CareTeamSlot card + kebab Geschiedenis dialog.
  - New `features/patient-appointments/` module: `AppointmentsTab.tsx`, `AppointmentRow.tsx` (read-only), section labels + collapsible history.
  - i18n: new `nl/patient-inbox.json`; extend `nl/patient-profile-ui.json`; new `nl/patient-appointments.json` for tab section labels and status chips.
- **OpenAPI / typed client**: regenerated.

## Risks and mitigations

- **R1 — Appointment domain is new scope, bumps surface area beyond the inbox reshape.** **Mitigation**: keep the v1 backend scope tight (no participant CRUD, no state machine, no realtime, no seed). Frontend stays read-only. Pathway runtime (BL-038) can add the rest incrementally without changing the schema.
- **R2 — `next_appointment` projection joins on every list call.** Lateral join per row, even when sort is `newly_added`. **Mitigation**: index `appointments(patient_id, starts_at) WHERE status='booked' AND deleted_at IS NULL`. Lateral `LIMIT 1` keeps the planner happy. If profiling shows regression, gate the projection behind a `select_options.include_next_appointment` flag — additive, non-breaking.
- **R3 — Frozen-after-create participants forces delete-and-recreate to change attendees.** **Mitigation accepted**: PoC clinical reality is one-lead-rarely-changes; UI doesn't expose write actions anyway. Participant edit endpoints filed for a follow-up if real demand surfaces.
- **R4 — Empty Metingen + Labresultaten tabs read as broken in demo.** **Mitigation**: `<TabEmptyState>` copy explicitly says "wordt geleverd door X" so a reader understands it's intentional, not unfinished.
- **R5 — Mini-card on the inbox row inflates row height + horizontal pressure.** **Mitigation**: card title truncates at 240px; date line stays single-line; modality icon is the same size as the kind icon (no extra padding). Prototype review locks the final visual budget.
- **R6 — `<DataTable>` removal breaks the `patients-base` realtime invalidation scenarios as written.** **Mitigation**: same TanStack Query key prefix + same realtime topic registration on `<PatientInbox>`. Scenarios re-anchored on the new component in the patients-base delta.
- **R7 — Lateral join across multiple tenants leaking data.** **Mitigation**: lateral join includes `appointments.tenant_id = patients.tenant_id` predicate defence-in-depth; spec scenario asserts no cross-tenant leak.
- **R8 — `entered-in-error` FHIR status uses a hyphen, illegal in Python identifiers.** **Mitigation**: store as `entered_in_error` in the enum, serialise as `entered-in-error` on the wire; spec scenario locks this round-trip.

## Out of scope

- Frontend write actions on appointments (create, edit, delete, status change, participant management). All filed for follow-up.
- Patient-facing read of appointments (mobile app). Mobile surface adds its own route later under `/mobile/appointments`.
- Real data wiring for `Metingen` and `Labresultaten` tabs. Empty states only.
- Realtime invalidation topic for appointments. Plain refetch v1; topic added when pathway runtime or write UI lands.
- Conflict / double-booking detection. None v1.
- Recurrence, reminders, notifications. Out per `scope.md` PoC Out-of-Scope.
- Seeded synthetic appointments. The seed cohort renders with empty `next_appointment` (and the `next_appointment` sort flat-orders by id) until pathway runtime or a future seed change populates the table.
- A `smart` or `embed` surface for inbox or detail. Components extracted to be re-mountable; the surface itself does not ship.
- Create-patient action on the inbox (BL-055 owns that).
- Identifier mutation, soft-delete flows beyond what `patient-profile-ui` already shipped.
- Pathway runtime materialising appointments from pathway `appointment` blocks (BL-038).
