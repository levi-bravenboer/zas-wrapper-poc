**Tier**: [poc]
**Promotes**: BL-037 (F4 patient domain — caregiver attention surface), BL-065 (Real Inbox surface — promoted from placeholder), and partial scope of BL-038 (appointment domain prerequisite for the inbox signal).

## Why

`patients-base` shipped `/_auth/patients` as a generic `<DataTable<PatientRead>>` and `patient-profile-ui` shipped the patient detail page with three meta tabs (`Overzicht`, `Zorgteam`, `Geschiedenis`). The placeholder `/_auth/inbox` route (BL-065) reserves a sidebar slot but renders nothing. None of these match how a caregiver actually uses the orchestrator in the demo story:

- A caregiver asks *"what needs my attention right now?"* — not *"show me every patient in a spreadsheet"*. The DataTable surfaces a directory; the work is attention triage.
- A patient with three urgent items collapses into one row in a patient-overview list; an attention-first surface shows three rows. The right unit of attention is the **item**, not the patient.
- The current detail page tabs are meta-heavy (demographics, audit). The clinical surfaces a caregiver needs — measurements, lab results, upcoming appointments — are absent.
- For the inbox to be appointment-sorted, the appointment domain must exist; today only the pathway "appointment" block-type template exists (no runtime `appointments` table).

This change ships the caregiver attention inbox (item-based feed at `/_auth/inbox`), the appointment domain (full backend CRUD + read-only frontend), the patient detail re-layout, and the route surgery to make the new framing consistent. v1 ships **only Appointment items** in the inbox feed; the polymorphic architecture (FHIR-aligned `resourceType` envelope, backend `InboxItemSource` registry, frontend dispatcher) lets future change-windows add Task, Observation, etc. without route or component refactor.

## What Changes

### New backend capability — `inbox-base`

- New `GET /inbox/items` aggregator endpoint returning a paginated list of FHIR-Resource-shaped envelopes (`{ id, resourceType, subject (FHIR Reference), occurred_at, payload }`).
- `InboxService` with a `InboxItemSource` registry pattern. v1 registers exactly one source: `AppointmentInboxSource` over `AppointmentRepository`. Adding a future kind (Task, Observation, etc.) is one new source class + one registry entry — no route or service edits.
- v1 item criteria for `resourceType: "Appointment"`: `status='booked' AND starts_at >= now() AND deleted_at IS NULL` AND the source patient passes `require_patient_access` for the caller.
- Default sort `order_by=occurred_at&order=asc` (earliest attention-deadline first). Allow-list also includes `created_at` (newly-added strategy).
- Visibility: same caregiver predicate as `GET /patients/{id}` (no separate visibility surface). Admins see all tenant items.
- `Role.PATIENT` rejected with `403`.

### New backend capability — `appointment-base`

- New `appointments` table (`patient_id` FK, `title`, `description`, `kind` enum, `starts_at`, `ends_at`, `modality` enum, `location_text`, `status` FHIR enum, `pathway_block_instance_id` nullable column with NO FK in v1 per D18, audit + soft-delete inherited).
- New `appointment_participants` join table (`appointment_id`, `user_id`, `role` enum `lead | support | observer`) with a partial unique index enforcing exactly one active `lead` per appointment.
- Full CRUD: `GET /appointments`, `GET /appointments/{id}`, `POST /appointments`, `PATCH /appointments/{id}` (no participants — frozen after create v1), `DELETE /appointments/{id}` (soft).
- Visibility: caregivers see appointments only for patients they can see; admins tenant-wide. `patient` role rejected.
- Validation: `ends_at > starts_at` strict; one `lead` required at create; `modality='on_site'` requires `location_text`; state-machine free.
- HiX adapter module stub (`HixAppointmentAdapter`) — same pattern as patient adapter.
- No seed data v1; no realtime topic v1.

### Modified backend capability — `patients-base`

- The orchestrator's `/_auth/patients` list route is REMOVED (per D24). The backend `GET /patients` list endpoint is RETAINED for admin tooling + patient pickers + care-team flows. No new fields on `PatientRead` (the previously-considered `next_appointment` embed is no longer needed — inbox sorting happens server-side on `/inbox/items`).
- `order_by` allow-list explicitly rejects `next_appointment_starts_at` (sort moved to the inbox aggregator).

### Modified frontend capability — `patient-profile-ui`

- Replace tab strip with three clinical tabs in order: `Metingen` (id `measurements`), `Labresultaten` (id `lab_results`), `Afspraken` (id `appointments`). Default active tab = `measurements`.
- Hoist demographics + identifiers into the sticky `<PatientDetailHeader>` (drops the `Overzicht` tab).
- Move `<CareTeamSlot>` out of the tab body into a header-adjacent card. Export path and prop signature unchanged — `care-teams-ui` stays unaffected.
- Move audit history off the strip into a new `Geschiedenis` kebab entry that opens a shadcn `<Dialog>` rendering the existing `<PatientHistoryPanel>`.
- **Metingen** and **Labresultaten** tabs render `<EmptyState>` only (no backend wiring v1).
- **Afspraken** tab renders real data, READ-ONLY: Upcoming section (status `booked`, future, asc) + collapsible History section (everything else, desc).

### New frontend capability — orchestrator inbox surface

- New `/_auth/inbox` route — the canonical caregiver attention surface. Replaces the BL-065 placeholder.
- New `/_auth/inbox/p/$patientId` child route — split-pane with inbox list (compact rail) + `<PatientDetailView>`.
- Existing `/_auth/patients/$patientId` route is RETAINED as a standalone full-page detail mount of the same `<PatientDetailView>`. Used by admin/users links, care-team links, mobile fallback (per D17).
- `/_auth/patients` (list route file) is DELETED.
- Sidebar nav: `"Mijn patiënten"` → `"Inbox"` pointing to `/_auth/inbox`.

Frontend item-level architecture:
- `<InboxItemRow>` is a dispatcher (per D23): looks up a row component in a flat `inboxRowRegistry` keyed by `resourceType`. v1 registers `Appointment → <AppointmentInboxRow>`. Unknown kinds render `<UnknownInboxRow>` with muted fallback copy + `console.warn`.
- Sort registry sorts ITEMS, not patients (per D19). v1 strategies: `next_attention` (default) maps to `order_by=occurred_at&order=asc`; `newly_added` maps to `order_by=created_at&order=desc`. `useSelectedInboxSort()` hook is hydration-safe.
- `<MasterDetailLayout>` is a new generic 3-state collapse primitive (full / compact 320px / hidden) reusable for any future master/detail surface.
- `<InboxRow>` is a new generic flat row primitive reusable beyond patient-context inboxes.
- `<Avatar>` lifted to support deterministic `tintBy` prop (palette at the design-system layer per Open Q2).

### Architecture seams

- `<PatientDetailView>` is a surface-agnostic primitive (no router import, no inbox import) per D16. Mounted by three+ hosts: inbox split-pane child route, standalone full-page route, future smart/embed surface.
- Backend `InboxItemSource` registry pattern (per D22) is the seam for future item kinds.
- Frontend `inboxRowRegistry` (per D23) is the seam for future row dispatch.
- Regenerate OpenAPI + typed client.

## Capabilities

### Added Capabilities

- `inbox-base` — new backend capability covering the `/inbox/items` aggregator + FHIR envelope + `InboxService` + source registry, plus the orchestrator inbox surface (sidebar entry, list route, split-pane child route, dispatcher, sort registry, row primitives).
- `appointment-base` — new backend capability covering appointment domain (table, participants, FHIR-aligned enums, CRUD endpoints, visibility, HiX adapter stub).

### Modified Capabilities

- `patients-base` — `/_auth/patients` list route REMOVED; sidebar entry replaced. `GET /patients` list endpoint retained. `order_by` allow-list explicitly excludes `next_appointment_starts_at`.
- `patient-profile-ui` — detail tab strip replaced; demographics absorbed into header; CareTeamSlot relocated to header card; audit moved behind kebab; Afspraken tab renders real data read-only. Detail route `/_auth/patients/$patientId` retained as standalone mount of new `<PatientDetailView>`.

## Impact

- **Prerequisites**: `patients-base`, `patient-profile-ui`, `users-base` (for participant FKs) archived. `care-teams-base` archived (CareTeamSlot stays compatible).
- **DB**:
  - New `appointments` table + `appointment_participants` table + four Postgres enums (`appointment_kind`, `appointment_status`, `appointment_modality`, `appointment_participant_role`).
  - One alembic migration.
- **Backend code** (`apps/backend/app/`):
  - `core/enums/appointment.py` — four enums.
  - `domain/appointment/` — ORM models.
  - `repositories/appointment_repository.py` — `BaseListRepository` subclass.
  - `services/appointment/appointment_service.py` — appointment CRUD + tenant + patient-access enforcement.
  - `services/inbox/inbox_service.py` — aggregator + source registry. NEW.
  - `services/inbox/sources/appointment_source.py` — `AppointmentInboxSource` registered v1. NEW.
  - `api/routers/appointment/appointment_router.py` — five CRUD routes.
  - `api/routers/inbox/inbox_router.py` — one aggregator route. NEW.
  - `schemas/appointment/appointment.py` — appointment schemas.
  - `schemas/inbox/inbox.py` — `InboxItem` envelope + `AppointmentInboxPayload`. NEW.
  - `adapters/hix/appointments.py` — adapter stub.
- **Frontend code** (`apps/orchestrator/src/`):
  - New `components/layout/MasterDetailLayout.tsx` — generic 3-state primitive.
  - New `components/list/InboxRow.tsx` — generic flat row primitive.
  - Extend `components/ui/avatar.tsx` with `tintBy` prop.
  - New `modules/appointment/` — `KindTile`, `AppointmentRow`, `AppointmentsSection`, plus types + api.
  - New `modules/inbox/` — `sorts/`, `useSelectedInboxSort`, `useInboxQuery` (infinite), `InboxList`, `InboxItemRow` (dispatcher), `inboxRowRegistry`, `UnknownInboxRow`, `AppointmentInboxRow`, types.
  - New `modules/patient/components/` — `PatientDetailHeader`, `PatientDetailView`, `PatientKebab`.
  - Drop `modules/patient/components/` — `PatientDemographicsPanel`, `PatientIdentifiersPanel`, `PatientsColumns`.
  - New routes: `routes/_auth/inbox/route.tsx`, `routes/_auth/inbox/index.tsx`, `routes/_auth/inbox/p/$patientId/index.tsx`.
  - Modified: `routes/_auth/patients/$patientId/index.tsx` (mounts new `<PatientDetailView>`).
  - Deleted: `routes/_auth/patients/index.tsx`.
  - Sidebar update: `components/layout/AppSidebar.tsx` / `navItems.ts` swaps `"Mijn patiënten"` → `"Inbox"`.
  - i18n: new `nl/inbox.json`, new `nl/patient-appointments.json`, extend `nl/patient-profile-ui.json`.
- **OpenAPI / typed client**: regenerated.

## Risks and mitigations

- **R1 — Item-based reframing is a bigger architectural lift than appointments-only.** **Mitigation**: the surface-agnostic dispatcher pattern (D23) + backend source registry (D22) are both ≤30 lines. The cost is bounded; the alternative (refactor when tasks land) is bigger.
- **R2 — Aggregator endpoint with only one source v1 looks overbuilt.** **Mitigation accepted**: the registry abstraction is a Protocol + a one-entry list. Worth the seam.
- **R3 — `/_auth/patients` list route deletion breaks direct links.** **Mitigation**: existing internal links go through TanStack Router's typed routes — compile-time check catches breakage. External bookmarks (admins) 404 cleanly; this is acceptable PoC behaviour.
- **R4 — Caregivers may need to "browse all patients" outside the inbox.** **Mitigation accepted**: PoC seed cohort is small (<100 patients); inbox + filters cover the visible cohort. If a stakeholder requests a directory at MVP, file a follow-up.
- **R5 — `<UnknownInboxRow>` fallback hides forwards-compatibility bugs.** **Mitigation**: the `console.warn` plus a `data-resource-type` attribute on the row let a future test or E2E catch unexpected `resourceType` values in CI.
- **R6 — Lateral-join cost on `GET /patients` no longer applies (next_appointment dropped).** Net positive on patient list performance.
- **R7 — Frozen-after-create participants forces delete-and-recreate to change attendees.** **Mitigation accepted**: PoC clinical reality. Filed as BL-073.
- **R8 — Empty Metingen + Labresultaten tabs read as broken in demo.** **Mitigation**: `<EmptyState>` copy explicitly says "wordt geleverd door X".
- **R9 — Mobile (<md) split-pane fallback per D17.** Inbox item click navigates to `/_auth/patients/$patientId` standalone (no inbox column). Browser back returns to inbox.
- **R10 — `entered-in-error` FHIR status hyphen vs Python identifier.** Stored as `entered_in_error`, serialised as `entered-in-error`. Tested round-trip.

## Out of scope

- Frontend write actions on appointments (create, edit, delete, status change, participant management) — BL-072.
- Patient-facing read of appointments (mobile app) — BL-078.
- Real data wiring for `Metingen` and `Labresultaten` tabs — BL-074, BL-075.
- Realtime invalidation topic for appointments / inbox items — BL-076.
- Conflict / double-booking detection.
- Recurrence, reminders, notifications.
- Seeded synthetic appointments — BL-077 (cheap follow-up).
- A `smart` or `embed` surface for inbox or detail.
- Create-patient action (BL-055 owns).
- Identifier mutation, soft-delete flows beyond `patient-profile-ui` prior.
- Pathway runtime materialising appointments (BL-038); `pathway_block_instance_id` FK addition is BL-079.
- Second inbox item kind (Task / Observation / etc.) — backend + frontend pattern is in place; first follow-up adds Tasks via the existing tasks domain.
- A patient-directory browser to replace the deleted `/_auth/patients` list.
- Persisting the master-hidden toggle in the URL (it's session-local UI state per D15).
