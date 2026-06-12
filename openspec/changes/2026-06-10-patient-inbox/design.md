## Context

`patients-base` shipped `/_auth/patients` as a `<DataTable<PatientRead>>`. `patient-profile-ui` shipped the patient detail page with three meta tabs (`Overzicht`, `Zorgteam`, `Geschiedenis`). The placeholder `/_auth/tasks` route renders nothing real.

This change reframes F4 from "patients overview" to **"caregiver task list"** under a single mental model: the task list at `/_auth/tasks` is a list of *things the logged-in caregiver needs to do*, aggregated server-side from one or more source domains. v1 ships exactly one source — **appointments booked in the next 3 days that the caregiver participates in**. Future sources (form responses, monitoring alerts, pathway-runtime work items) plug into the same envelope without a wire-shape change.

The change ships:
- A new backend `appointment-base` capability — **data layer only** (tables, ORM, migration, validator module). NO HTTP routes v1. Rows enter via test fixtures.
- A new backend `tasks-base` capability that is a **server-side aggregator endpoint** (`GET /tasks`) — NO `tasks` table, NO ORM `Task` model, NO HiX task adapter.
- A frontend `<TaskList>` + `<TaskRow>` at `/_auth/tasks` consuming `GET /tasks`.
- A patient detail re-layout (`patient-profile-ui`): two tabs (Metingen + Labresultaten) both empty-state v1. NO Afspraken tab — appointment-as-task surfacing lives entirely in `/_auth/tasks`.
- Route surgery: delete `/_auth/patients` list route, delete `/_auth/tasks.tsx` placeholder + `modules/tasks/` placeholder dir FIRST, then add the new `/_auth/tasks/` directory route + new `modules/tasks/` directory + `/_auth/tasks/$taskId` child.

Tenancy, visibility, and realtime for patients are correct as-is and are not touched.

## Goals / Non-Goals

**Goals:**
- Caregiver opens `/_auth/tasks` and sees a chronological list of items they need to act on in the next 3 days. v1 = upcoming appointments where they are a participant.
- Each row identifies the patient + the act-by time + the kind of work. Click → patient detail in a split-pane.
- Backend ships `appointment-base` (table + participants + FHIR-aligned enums + ORM models + alembic migration + `AppointmentValidator`). NO HTTP routes v1 — rows enter via test fixtures, future API change adds endpoints.
- Backend ships `tasks-base` as a *thin aggregator endpoint* that projects appointment rows into a uniform `TaskItem` envelope. Source-agnostic envelope means adding a second source is a backend-only change.
- Patient detail re-layout: sticky header + adjacent care-team card + two clinical tabs (`Metingen`, `Labresultaten`). Both empty-state v1.
- `<TaskRow>` + `<AppointmentContextBlock>` are surface-agnostic enough that a future `smart` or `embed` host can re-mount the same widgets with its own router wrapper. The patient-detail chrome reuses the existing `<EntityDetailPage>` + `<EntityDetailTabs>` primitives — no bespoke `<PatientDetailView>` ships.

**Non-Goals:**
- A `Afspraken` tab on patient detail. Appointments live as tasks in `/_auth/tasks` only.
- Frontend write actions on appointments (no create / edit / delete UI v1).
- A `tasks` table, `task_*` enums, a `Task` ORM model, or a HiX task adapter.
- Configurable task list time window (hardcoded ≤3 days v1).
- A sort registry / multiple sort strategies (single fixed sort: `due_at asc`).
- Counter / pager / infinite scroll on the task list (flat list within the 3-day window).
- Filters, search-as-you-type, bulk actions, row selection on the task list.
- A generic `<InboxRow>` / `<ListRow>` primitive — `<TaskRow>` is built directly, no abstraction layer.
- An `<AppointmentRow>` / `<AppointmentsSection>` / `<TabEmptyState>` component — not needed v1.
- Real data for Metingen / Labresultaten tabs.
- Conflict / double-booking detection, recurrence, reminders, notifications.
- Seeded synthetic appointments — demo runs through the empty-state until live data lands.
- Realtime topic for appointments / tasks.
- Patient-facing reads of appointments or tasks.
- A `smart` or `embed` surface itself — only the component split.
- Touching the patient visibility predicate or the patient realtime topic.
- Backend URL prefix split (`/caregiver/...` vs `/patient/...`) — deferred to a separate change.

## Decisions

### D1 — Ship `appointment-base` as data layer only (NO HTTP routes v1)

The task list needs upcoming appointments to surface anything. Without `appointments` rows the task list is empty for every caregiver. The appointment domain ships in this change as **data layer only**: tables, enums, ORM models, alembic migration, and a reusable `AppointmentValidator` module.

NO HTTP routes (`GET /appointments`, `POST`, `PATCH`, `DELETE`) ship in this change. No `AppointmentService` (CRUD wrapper), no `AppointmentRepository`, no `HixAppointmentAdapter`. No `AppointmentRead` / `AppointmentCreate` / `AppointmentPatch` schemas. Rows enter the table via test fixtures using the validator.

**Why no HTTP routes v1:**
- No FE consumer exists v1 — `<TaskList>` reads only `/tasks`.
- No write UI exists v1 — no caller for POST/PATCH/DELETE.
- Shipping routes without consumers means shipping tests + maintenance burden for code that runs only in tests.
- A future change can add the HTTP surface in one focused PR when a consumer materialises (pathway runtime, write UI, HiX adapter integration). The schema + ORM + validator + table layout is the load-bearing part; HTTP is a thin shell.

**Why ship the validator now:** invariants (`ends_at > starts_at`, `modality=on_site ⇒ location_text`, participant rules) are domain logic that future writers reuse. Lives once, used by test fixtures + future API + future runtime.

**Alternatives considered:**
- Full CRUD v1. Rejected — no consumers; routes become orphan code.
- Defer appointment domain entirely. Rejected — `/tasks` aggregator needs the table to project from.
- Ship only ORM + migration, drop the validator. Rejected — every future writer would reimplement the rules.

### D2 — Appointment schema follows FHIR `Appointment` shape but stays domain-internal

Columns mirror FHIR R4 `Appointment` where it fits cheaply (`start`, `end`, `status`, `participant`) but skip FHIR concepts that are heavy and not load-bearing for PoC (`serviceType`, `appointmentType`, `priority`, `serviceCategory`, `requestedPeriod`). `kind` is a domain enum (`consultation | lab | imaging | procedure | other`) — translated to FHIR `serviceType` coding only at the HiX adapter boundary at MVP. `status` is the full FHIR `AppointmentStatus` enum verbatim (10 values) so the wire is FHIR-faithful from day one.

**Trade-off:** `entered-in-error` FHIR code has a hyphen, illegal in Python identifiers. Store as `entered_in_error` enum symbol, serialise as `entered-in-error` on wire. Pydantic field-serialiser handles the round-trip; spec scenario locks it.

### D3 — Participants frozen after create

`appointment_participants` is populated only at appointment-create time. `PATCH` rejects a `participants` field. To change attendees, caregiver deletes + recreates the appointment.

**Why:** v1 frontend is read-only — there is no write UI to mutate participants. Backend without a write UI implies clinical discipline rather than enforced workflow. Cost of supporting mid-flight participant edits is non-trivial (audit semantics, status implications, partial unique index on lead while transitioning) for zero PoC value.

### D4 — Lead participant enforced by partial unique index, not service-only

Service layer validates "exactly one lead at create". DB partial unique index `(appointment_id) WHERE role = 'lead' AND deleted_at IS NULL` is defence-in-depth — a buggy service code path or a future PATCH that mutates participants cannot leave the row in a multi-lead state.

### D-AGG — `/tasks` is a server-side aggregator, not a domain table

`tasks-base` exposes `GET /tasks` + `GET /tasks/{source}/{source_id}` and projects items from one or more underlying source domains into a uniform `TaskItem` envelope. There is **no** `tasks` table, **no** `task_*` Postgres enums, **no** `Task` ORM model, **no** HiX task adapter. The aggregator's plan is:

1. Resolve caller identity → tenant + user id.
2. For each enabled source (v1 = exactly `appointment`):
   a. Build the source-specific query: filter to the time window, filter to caller's participation, tenant-scope, join `patients` for the inline summary.
   b. Project source rows into `TaskItem` rows.
3. Concatenate, sort by `due_at asc`, paginate, return `Page[TaskItem]`.

The `id` field of `TaskItem` is synthetic: `f"{source}:{source_id}"`. The read-one route is `GET /tasks/{source}/{source_id}` so URLs are stable across sources.

**Why an aggregator endpoint instead of a `tasks` table:**
- A `tasks` table either duplicates the source row (sync hell) or wraps it (extra row per appointment, audit ambiguity).
- The aggregator is one SQL query per source — small, traceable, no materialisation drift.
- Adding a new source is a backend-only change. Wire shape is stable.
- The caller's "things to do" is inherently a *projection* of multiple domains — modelling it as a table fights that.

**Why server-side over frontend union:**
- One round-trip vs N.
- Pagination + ordering live in the source of truth.
- Adding a source doesn't ship a frontend change.
- Visibility/authz logic stays in the backend.

### D-WINDOW — Hardcoded 3-day window for the v1 `appointment` source

v1 `/tasks` projects ONLY appointments where `status = 'booked'` AND `starts_at BETWEEN now() AND now() + INTERVAL '3 days'`. The window is hardcoded — no `?within=` query param. Unknown query params are silently ignored (forward-compat when v2 ships `?within=`).

### D-PART — Participant-driven visibility, identical for admin and caregiver

A `TaskItem` is visible if and only if the caller is the relevant actor on the underlying source row. For the v1 `appointment` source: the caller has an active row in `appointment_participants` with `user_id = caller.id` (any role).

`Role.PATIENT` → `403`. Admin and caregiver share the same predicate — admin does NOT bypass to tenant-wide. An admin who is not a participant on any in-window appointment sees an empty list.

**Why identical for admin:** `/tasks` is a personal attention surface. Admins doing ops oversight use `/appointments` (when wired) or other admin endpoints. The FE doesn't consume `/appointments` list in v1, but the predicate-asymmetry is intentional: same backend, different consumers, different filters.

### D-NOSORT — Single fixed sort, no registry

`GET /tasks` accepts exactly `order_by=due_at` + `order=asc`. The frontend does NOT ship a sort tab strip, a `useSelectedSort` hook, or a strategy registry. Re-add when a 2nd source lands and the user picks a different rhythm.

### D7 — Task row anatomy

```
[Avatar slab 40px] [Identity column flex-1] [Kind tile max-240px] [Chevron]
```

- **Avatar slab:** initials only (first letter of `given_name` + first letter of `family_name`, uppercased) on a deterministically-tinted background derived from `hash(patient.id) % palette_size`. Never an `<img>`. Palette = 8 colours from the orchestrator Tailwind ZAS-teal palette with WCAG AA white-text contrast.
- **Identity column:** line 1 `family_name, given_name`. Line 2 muted `INSZ • kind label • relative due copy ("vandaag X uur" / "morgen X uur" / "over N dagen")`.
- **Kind tile:** `<KindTile>` for v1 appointment source (subtle color-mix tile with the kind's lucide icon). When a 2nd source lands, the trailing slot accepts any source-specific decoration.
- **Chevron:** right end, full row is the click target.

No per-row kebab. No checkbox. No inline action.

`<TaskRow>` is built directly (no generic `<InboxRow>` / `<ListRow>` abstraction layer in this change). Add one when a 2nd flat-list surface emerges.

### D8 — Browser-local timezone everywhere on the frontend

Backend stores `timestamptz` UTC. Wire emits ISO 8601. Frontend renders via `Intl.DateTimeFormat('nl-BE', { ... })` using the browser's local timezone. No tenant-level timezone setting, no Europe/Brussels hard-pin.

### D-FLAT — Flat list, no counter, no pager, no infinite scroll

The task list renders a single flat list of all `TaskItem`s returned by one `GET /tasks` call. No header counter (`12 taken`), no bottom pager strip, no `"Meer laden"` button. 3-day window caps the result size for any realistic caregiver to <50 items.

### D10 — Detail page tab strip = two tabs (`Metingen / Labresultaten`)

Tab strip becomes exactly two clinical tabs:
- `Metingen` (id `measurements`) — empty state v1, hint references monitoring koppeling.
- `Labresultaten` (id `lab_results`) — empty state v1, hint references HiX koppeling.

NO `Afspraken` tab. Appointment surfacing lives entirely in `/_auth/tasks` — there is no second place to see appointments. Patient-centric appointment history is out of scope; it lands as a separate change when prioritised.

Old tabs relocate:
- `Overzicht` content (demographics + identifiers) → absorbed into the `<PageHeader>` subtitle row (INSZ Badge + Geboren + org Badge). Tab dropped.
- `Zorgteam` content → `<CareTeamSlot>` moves to a header-adjacent card. Import path + prop signature unchanged so `care-teams-ui` is unaffected. Tab dropped.
- `Geschiedenis` content → `<PatientHistoryPanel>` moves into a kebab → `Geschiedenis` dialog. Tab dropped.

Default active tab = `measurements`. Empty-state copy explicitly references the data source ("Wordt geleverd door X").

### D12 — Component seam for future `smart` / `embed`

`<TaskRow>` is the only surface-agnostic primitive — no router import, no shell coupling. Takes `taskItem` + `onSelect`. The orchestrator wraps it in a router-aware row. A future `apps/smart-*` or embed host imports the same component and supplies its own wrapper.

The patient-detail chrome reuses the **existing** `<EntityDetailPage>` + `<EntityDetailTabs>` primitives (see D-LAYOUT-V12). No bespoke `<PatientDetailView>` ships — the standalone `PatientProfilePage` route and the tasks-context detail route both consume the same primitives. When a future smart/embed surface lands it imports the same primitives directly.

### D13 — HTML prototype first

Per project rule, `prototypes/inbox/v1.html` ... `v8.html` — **v8 accepted** as the locked wireframe. See `prototypes/inbox/README.md`. Each iteration is a new `vN.html` — never edit prior versions.

The prototype directory keeps the name `prototypes/inbox/` for archival continuity (these files are accepted-state artifacts, not concept references). Spec decisions D-FLAT + D-NOSORT supersede the prototype's pager strip and sort tabs; the React build follows the design.md decisions where they conflict with the prototype.

### D14 — i18n: Dutch copy, English identifiers

Component names, query params, enum values, file names, i18n namespaces are English (`/tasks`, `appointment`, `task_item`, `tasks.*`). Display copy is Dutch (`"Taken"`, `"Geen taken"`). All user-visible copy goes through `t()`.

Kind labels (`consultation`, `lab`, `imaging`, `procedure`, `other`) live in `nl/appointment.json` (appointment domain owns them). `<TaskRow>` calls `t('appointment:kind.<value>')` via cross-namespace lookup — no duplication. When a 2nd source lands with its own kind values, that source owns its label namespace.

### D-LAYOUT-V12 — Two-column rail + EntityDetailPage right pane (locks prototype v12)

The `/_auth/tasks` surface ships as a **plain two-column flex** — no master/detail collapse, no state machine. Both columns always visible at `≥md`:

- **LEFT** (`<TaskRail>`, fixed 280px): rows grouped by due bucket (`Vandaag` / `Morgen` / `Over N dagen`). Each row = kind tile + `family, given` + relative due copy. Active row carries a 3px left accent + tinted background.
- **RIGHT** (`<Outlet>`): two children:
  - Index route (`/_auth/tasks`): centered `<EmptyState>` with `Selecteer een taak` title + body referencing the rail.
  - Task detail route (`/_auth/tasks/$taskId`): reuses the existing `<EntityDetailPage>` chrome (eyebrow back link → `/_auth/tasks` index, `<PageHeader>` with `family, given` h1 + INSZ Badge default + Geboren muted + org Badge soft, `Bewerken` button + kebab actions slot). Body slot = `<AppointmentContextBlock task />` followed by `<EntityDetailTabs>` underline variant with `Metingen` + `Labresultaten`.

URL is the source of truth for **task selection** (not patient selection — same patient with two tasks → two distinct selectable URLs). Selection is shareable. No session-local UI state.

Below `md`, the rail and the right pane stack — rail collapses to an overflow drawer (out of scope v1 — the orchestrator scope is desktop-first; mobile work lands in a follow-up).

**Why this shape:**
- The locked v12 wireframe is the user-accepted reading. The 3-state collapse from earlier drafts was over-engineered for a personal attention surface where everyone wants both panes visible.
- Reusing `<EntityDetailPage>` means the right pane is visually identical to the standalone patient route — no bespoke `<PatientDetailView>` to maintain, no styling drift.
- URL keyed by `$taskId` makes "same patient, two tasks" addressable. Sharing a link drops a colleague on the same task card, not the same patient.

### D-CTX-BLOCK — Appointment context block lives above the tabs

A new task-scoped widget — `<AppointmentContextBlock>` at `modules/tasks/components/AppointmentContextBlock.tsx` — sits in the `<EntityDetailPage>` body slot, above `<EntityDetailTabs>`. Slim flat strip on a subtle `color-mix(primary-soft, background)` background; no inner card.

Anatomy:
- `<KindTile size="lg">` (40px tile, kind colour-mix bg).
- Title (`task.title`, text-[15px] medium).
- `<Badge variant="soft">{kind label}</Badge>`.
- Meta line (xs muted): `<clock-3>` + relative due copy + `<map-pin|video>` + `Op locatie · Polikliniek 3` or `Online` + `<user-round>` + `Lead {name}`.
- Right side: `Open afspraak` ghost button (deep link to the underlying appointment — no-op v1; HiX adapter / future Afspraken page consumes).

The block reads as "this task is what brought you here" — caregiver sees the patient + the act-by reason in one glance. The patient's two tabs sit underneath for clinical context that doesn't change per task.

### D-PATIENTS-ROUTE — Standalone `/_auth/patients/$id` retains existing `PatientProfilePage`

The standalone patient detail route at `/_auth/patients/$patientId` keeps the existing `<PatientProfilePage>` chrome verbatim — three tabs (Overzicht + Zorgteam + Geschiedenis) collapse to the **same two clinical tabs** that the tasks route uses (Metingen + Labresultaten), with `<CareTeamSlot>` relocated to the header card and `<PatientHistoryPanel>` behind a kebab → `Geschiedenis` dialog per D10.

This is the only surface that mounts the patient detail outside the tasks context. It serves: admin → user → patient links, care-team participant links, any non-tasks-context entry. No bespoke `<PatientDetailView>` primitive ships — both routes consume `<EntityDetailPage>` + `<EntityDetailTabs>` directly with their own subtitle / actions / body composition.

### D18 — `pathway_block_instance_id` ships as column-only without FK in v1

The `appointments.pathway_block_instance_id` column SHALL be created as `UUID NULL` in v1 alembic without a FOREIGN KEY constraint. The future pathway runtime change adds the FK once the `pathway_block_instances` table lands.

### D-EMPTY — No demo seed; task list empty-state holds the demo

There is NO `seed_appointments.py` and NO `seed_tasks.py` in this change. The demo runs against an empty task list until live data lands via the (out-of-scope) write UI or HiX adapter wiring.

Task-list empty-state copy is **single, source-agnostic**:
- title: `"Geen taken"`
- body: `"Nieuwe taken verschijnen automatisch"`

Same copy for caregiver and admin. No role-aware variants. Uses the existing `<EmptyState>` component directly (already supports icon-in-circle + headline + body — no `<TabEmptyState>` wrapper).

### D24 — `/_auth/patients` list route is deleted, no replacement

The orchestrator's `/_auth/patients` route (the patient list page built on `<DataTable<PatientRead>>`) is deleted by this change. The backend `GET /patients` list endpoint stays — admin tooling, patient pickers, and care-team flows still consume it.

User-facing caregiver access to "browse all patients in my tenant" is intentionally NOT replaced. The task list covers "things I need to do"; broader directory browsing is deferred until a stakeholder explicitly asks for it.

The patient detail route `/_auth/patients/$patientId` is RETAINED as a standalone full-page detail surface (per D-PATIENTS-ROUTE). Two URLs surface a patient:
- `/_auth/tasks/$taskId` — task-context detail; `<EntityDetailPage>` + `<AppointmentContextBlock>` + clinical tabs.
- `/_auth/patients/$patientId` — standalone non-task-context detail; `<EntityDetailPage>` + clinical tabs only (no appointment block).

Both routes share the same chrome (`<EntityDetailPage>` + `<EntityDetailTabs>`) and the same two clinical tabs (Metingen + Labresultaten). No bespoke `<PatientDetailView>` ships.

### D-PREFIX — Defer backend URL prefix split

A caregiver/admin-vs-patient URL prefix split (`/caregiver/...` vs `/patient/...`) is conceptually clean but not necessary for this change. New routes ship flat (`/tasks`, `/appointments`) matching the existing convention (`/patients`, `/care-teams`, ...). A separate change `backend-url-prefix-split` performs the rename in one sweep when prioritised.

### D-RENAME — Route + module rename sequence (placeholder first, new dir after)

`apps/orchestrator/src/routes/_auth/tasks.tsx` (single-file placeholder route) and `apps/orchestrator/src/modules/tasks/` (placeholder dir) collided in name with the new `routes/_auth/tasks/` directory route and new `modules/tasks/` directory. Delete the placeholders first; new dirs created after.

Order:
1. DELETE the placeholder route file `routes/_auth/tasks.tsx`.
2. DELETE the placeholder module dir `modules/tasks/` (`TasksPage.tsx`, `tasksPort.ts`, adapter, `types.ts`).
3. CREATE new `routes/_auth/tasks/` directory with `route.tsx`, `index.tsx`, `p/$patientId/index.tsx`.
4. CREATE new `modules/tasks/` directory with `TaskList.tsx`, `TaskRow.tsx`, `KindTile.tsx`, `useTasksQuery.ts`, `types.ts`, `dueLabel.ts`.

The tasks.md sequencing reflects this (delete tasks before create tasks).

## Risks / Trade-offs

- **R1 — Two new backend domains in one PR is larger than either alone.** **Mitigation:** they're independent (aggregator depends on appointments at the projection layer only). Independent migrations (only appointment has one), independent services, independent tests.
- **R2 — Empty seed means the demo shows empty-state.** **Mitigation accepted:** D-EMPTY rationale. Follow-up `seed_appointments.py` is a 30-min change when wanted.
- **R3 — `/_auth/patients` list route deletion breaks direct links.** **Mitigation:** existing internal links go through TanStack Router's typed routes — compile-time check catches breakage.
- **R4 — Participant-driven visibility means tasks for other caregivers do NOT surface in my task list.** This is intentional (D-PART) — the surface is personal attention. Team-handover view is a separate surface (out of scope).
- **R5 — Admins see empty task list in day-to-day use.** **Mitigation accepted (D-PART):** admins use `/appointments` directly for ops oversight (when wired); `/tasks` is the caregiver-attention model.
- **R6 — Frozen-after-create participants on appointments forces delete-and-recreate to change attendees.** **Mitigation accepted:** PoC clinical reality.
- **R7 — Empty Metingen + Labresultaten tabs read as broken in demo.** **Mitigation:** `<EmptyState>` copy explicitly says "wordt geleverd door X".
- **R8 — Mobile (<md viewport)** is out of scope v1 — the orchestrator is desktop-first. Below `md` the rail/right two-column stacks (rail collapses to a drawer). Mobile work is a follow-up change.
- **R9 — `entered-in-error` FHIR status hyphen vs Python identifier.** Stored as `entered_in_error`, serialised as `entered-in-error`. Tested round-trip.
- **R10 — Aggregator over one source v1 is over-engineered if a 2nd source never lands.** **Mitigation:** indirection is ~50 LOC. Wire shape stable, so cost is contained.
- **R11 — No patient-centric appointment history anywhere.** **Mitigation accepted:** out of scope for this change. Files as follow-up when stakeholder asks.
- **R12 — Route + module rename collision.** **Mitigation:** D-RENAME locks the sequence; tasks.md enforces delete-then-create order.

## Migration Plan

- **Data migration**: one alembic migration creates `appointments` + `appointment_participants` + four Postgres enums. No `tasks` table — `tasks-base` is route-only. No existing-row touchups.
- **Patient list route**: `/_auth/patients` route file is deleted. Existing direct links to that URL would 404. Sidebar nav swaps `"Mijn patiënten"` → `"Taken"` pointing to `/_auth/tasks`.
- **Patient detail route**: `/_auth/patients/$patientId` URL is unchanged; the standalone full-page detail keeps the existing `<PatientProfilePage>` shell, but its tab strip collapses to Metingen + Labresultaten + Zorgteam/Geschiedenis relocated per D10. Both routes share the same `<EntityDetailPage>` + `<EntityDetailTabs>` primitives.
- **Task-list route**: `/_auth/tasks.tsx` placeholder + `apps/orchestrator/src/modules/tasks/` placeholder directory deleted FIRST. New `/_auth/tasks/` directory route + new `modules/tasks/` directory + `/_auth/tasks/$taskId` child added AFTER (per D-RENAME).
- **Tab strip on detail page**: changes per `patient-profile-ui` delta (Metingen + Labresultaten only). `<CareTeamSlot>` import path + signature preserved; `<PatientHistoryPanel>` import path preserved.
- **Rollback**: revert PR. No appointment / task data to undo (no seed). The DataTable list page and the old tab strip are recoverable from git history. The `/_auth/tasks.tsx` placeholder returns.

## Locked wireframe

Accepted wireframe is `prototypes/inbox/v12.html`. See `prototypes/inbox/README.md` for the version history. v12 locks:

- **Two-column flex layout** (D-LAYOUT-V12 — 280px task rail left + `<EntityDetailPage>` right). No master/detail collapse. No state machine.
- **Right pane mirrors `<EntityDetailPage>` + `<EntityDetailTabs>` underline** (D-LAYOUT-V12).
- **Appointment context block** above tabs (D-CTX-BLOCK).
- **Flat list, no counter, no pager** (D-FLAT).
- **No bespoke `<PatientDetailView>`** — the standalone `/_auth/patients/$id` route and the tasks-context `/_auth/tasks/$taskId` route both consume `<EntityDetailPage>` directly.

Earlier versions (v8 master/detail; v10 scroll-stack; v11 single-card with bespoke chrome) are superseded — see `prototypes/inbox/README.md` for the iteration log.

## Component reuse audit

Before writing any new code, audit the existing orchestrator primitive surface.

### Reuse as-is

| Primitive | Used for |
|---|---|
| `components/layout/Shell.tsx` + `AppSidebar.tsx` | Outer chrome. |
| `components/layout/PageHeader.tsx` | Title + sub + actions slot inside `<EntityDetailPage>`. |
| `components/entity/EntityDetailPage.tsx` | Right-pane chrome on the task detail route + standalone patient route. |
| `components/entity/EntityDetailTabs.tsx` | Clinical tabs (underline variant) for both routes. |
| `components/ui/button.tsx` | Kebab + future write CTAs. |
| `components/ui/badge.tsx` | INSZ Badge (default variant), org Badge (soft variant). |
| `components/ui/dropdown-menu.tsx` | Page kebab on detail. |
| `components/ui/dialog.tsx` | Kebab `Geschiedenis` dialog + edit dialog. |
| `components/ui/avatar.tsx` + `AvatarFallback` | Sidebar pill + task row avatar. |
| `components/states/EmptyState.tsx` | `Metingen` / `Labresultaten` tab empty + task-list empty + selection-empty right pane. |
| `components/entity/EntityErrorCard.tsx` | Detail error fallback. |
| `components/entity/EntityNotFound.tsx` | Outside-visibility caregiver hitting `/_auth/patients/$id`. |
| `components/entity/EntityDetailSkeleton.tsx` | Detail loading skeleton. |
| `modules/patient/components/CareTeamSlot.tsx` | Mounted inside the `Overzicht`-equivalent panel of the standalone patient route (existing consumer seam unchanged). |
| `modules/patient/components/PatientHistoryPanel.tsx` | Mounted inside the `Geschiedenis` kebab Dialog. |
| `modules/patient/components/EditPatientDialog.tsx` | Reused by the kebab `Bewerken` entry. |
| `modules/patient/components/BreakGlassPrompt.tsx` | Existing 404 handler retained. |
| `modules/patient/api.ts` + `hooks/usePatient` | Patient detail fetch + soft-delete mutation. |
| `hooks/entity/useEntityDelete` | Destructive-confirm pattern for kebab `Verwijderen`. |
| `lib/api/client` typed client | Patient + appointment + tasks endpoints (post `typegen`). |
| `lib/i18n/*` + `useTranslation` | All copy through `t()`; new namespaces `tasks`, `appointment`; extend `patient-profile-ui`. |
| `components/ui/sonner` / `toaster` | Success + error toasts on edit / delete. |

### Drop on archive

These components were specific to the prior `/_auth/patients` DataTable list and `Overzicht` tab; they have no other consumers (verified in prereq 0.4).

| Primitive | Why |
|---|---|
| `modules/patient/components/PatientDemographicsPanel.tsx` | Content absorbed into the `PageHeader` subtitle row (INSZ Badge + Geboren + org Badge). |
| `modules/patient/components/PatientIdentifiersPanel.tsx` | INSZ becomes a Badge in the header. |
| `modules/patient/components/PatientsColumns.tsx` (`patientColumns`, `patientFilters`, `patientRowActions`) | DataTable-specific; list route is deleted. |
| `modules/tasks/TasksPage.tsx` + `tasksPort.ts` + adapter + `types.ts` | Placeholder fully replaced by the new task list surface. |

### New reusable primitives (broader value)

`<MasterDetailLayout>` SHIPPED earlier in this change and remains available for non-task surfaces (organisation browser, care-team browser). **Not used by `/_auth/tasks` v12** — the tasks surface is a plain two-column flex (see D-LAYOUT-V12). Keep it; deletion is out of scope.

`<InboxRow>` / `<ListRow>` (a generic flat-row primitive) is NOT built in this change. `<TaskRow>` is constructed directly. Add a generic abstraction when a 2nd flat-list surface emerges.

`<TabEmptyState>` is NOT built — `<EmptyState>` already covers the visual.

### New feature components (scope-bound)

| Component | Location | Notes |
|---|---|---|
| `<TaskList>` (rail) | `modules/tasks/TaskList.tsx` | The 280px task rail. Owns the `useTasksQuery` call, due-bucket grouping, row render, empty-state. Renders inside the parent `/_auth/tasks` route. |
| `<TaskRow>` | `modules/tasks/TaskRow.tsx` | Flat clickable row. v1 source-aware (renders `<KindTile>` from the appointment-source payload). When 2nd source lands, refactor to source-aware decoration. |
| `<KindTile>` | `modules/tasks/components/KindTile.tsx` | Subtle color-mix tile per `AppointmentKind`. Lives in `modules/tasks/` since no Afspraken tab consumes it. |
| `<AppointmentContextBlock>` | `modules/tasks/components/AppointmentContextBlock.tsx` | Slim flat strip rendered above `<EntityDetailTabs>` on the task detail route. Kind tile + title + meta + lead participant + `Open afspraak` ghost button. Surface-agnostic — props `{ task: TaskItem }`, no router import. |
| `<Avatar>` (initials with deterministic tint) | `components/ui/avatar.tsx` extension | Lift to shared with `tintBy?: string` prop. |
| `<PatientKebab>` | `modules/patient/components/PatientKebab.tsx` | `Bewerken` / `Verwijderen` / `Geschiedenis` entries. Reused by the task detail route and the standalone patient route. |

### Build order

1. Reusable layer: lift `<Avatar>` with `tintBy` (DONE). `<MasterDetailLayout>` is shipped but not consumed by this surface — leave for future.
2. Tasks primitives: `<KindTile>` + `<TaskRow>` + `useTasksQuery` + `<TaskList>` rail. (DONE)
3. `<AppointmentContextBlock>` — new component composing `<KindTile>` + Badge + meta line + ghost button.
4. Route shape: parent `_auth/tasks/route.tsx` = two-column flex (rail + `<Outlet>`). `_auth/tasks/index.tsx` = selection `<EmptyState>`. `_auth/tasks/$taskId/index.tsx` = fetch task + patient, mount `<EntityDetailPage>` with `<AppointmentContextBlock>` in body slot then `<EntityDetailTabs>` (Metingen + Lab).
5. Standalone patient route at `_auth/patients/$patientId/index.tsx` — collapse the existing 3 tabs down to Metingen + Lab + relocate Zorgteam/Geschiedenis per D10.

### Tests strategy

- `<AppointmentContextBlock>` tested in isolation with mock `TaskItem` (router-free).
- `<TaskRow>` tested via the existing FE tests (already in repo).
- Route integration tests: URL `/_auth/tasks` → `<EmptyState>` in right pane; URL `/_auth/tasks/$taskId` → `<EntityDetailPage>` with the context block; rail row click updates URL; rail active state reflects URL.

## Resolved questions

- **Q1 (counter):** RESOLVED by D-FLAT — no counter, no pager.
- **Q3 (`next_appointment` on `GET /patients/{id}`):** RESOLVED by D-AGG — no embedded next_appointment anywhere; aggregator is the canonical attention projection. `PatientRead` carries no appointment-derived fields.
