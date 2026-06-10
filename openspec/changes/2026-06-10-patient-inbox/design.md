## Context

`patients-base` shipped `/_auth/patients` as a `<DataTable<PatientRead>>` and `patient-profile-ui` shipped the patient detail page with three meta tabs (Overzicht, Zorgteam, Geschiedenis). Backend `GET /patients` supports `ListQuery` filters, search, and a tenant-scoped + care-team / PractitionerRole visibility predicate. Realtime invalidation runs through `patientsListKeyPrefix` + a topic registered by the list page.

Pathway has an `appointment` block type (template inside a pathway definition), but there is no runtime `appointments` table. PoC pathway runtime is BL-038 — not built. To make the inbox sort meaningful, this change ships the appointment domain itself. The frontend stays read-only; the backend exposes full CRUD so pathway runtime can later call into it without schema churn.

Tenancy, visibility, and realtime for patients are correct as-is and are not touched. This change reshapes the rendering surface + sort dimension + tab strip, AND introduces a new appointment-base capability.

## Goals / Non-Goals

**Goals:**
- Caregiver opens `/_auth/patients` and sees an inbox sorted by next upcoming appointment. Each row shows a mini-card with the next appointment's title + kind + local time + modality, or muted "no appointment" text.
- Switching to "Nieuw vs oud" reorders in place and updates URL — no full page reload. Sort survives row click + browser back.
- Inbox grows via infinite scroll; no spreadsheet pager.
- Caregiver opens a patient detail page and sees a header with demographics + a small care-team card, then three clinical tabs: Metingen + Labresultaten empty, Afspraken renders real data (read-only Upcoming + collapsible History).
- Backend ships `appointment-base` capability: table + participants + FHIR-aligned enums + 5 CRUD endpoints + tenant + patient-access visibility.
- `PatientRead` carries embedded `next_appointment` summary so the inbox card renders without N+1.
- Component split (`<PatientInboxRow>`, `<PatientDetailHeader>`) is clean enough that a future `smart` or `embed` surface can re-mount with its own host wrapper.

**Non-Goals:**
- Frontend write actions on appointments.
- Filters, search-as-you-type, bulk actions, read/unread state, row selection on the inbox.
- Real data for Metingen / Labresultaten tabs.
- Conflict / double-booking detection.
- Recurrence, reminders, notifications.
- Seeded synthetic appointments.
- Realtime topic for appointments.
- Patient-facing reads of appointments.
- A `smart` or `embed` surface itself — only the component split.
- Touching the patient visibility predicate or the patient realtime topic.

## Decisions

### D1 — Ship appointment domain with this change, not defer

The user explicitly asked for the inbox to be appointment-sorted. Without `appointments` rows the sort signal is null for every patient and the entire feature degrades to "newly_added" by default. Building a thin appointment domain (read-and-write backend, read-only frontend) is the cheapest path to a working inbox.

**Why:** Doing one combined backend bump now is smaller than (a) ship inbox without working sort, (b) ship appointment domain in a separate change, (c) re-wire the inbox after. Pathway runtime (BL-038) calls into `AppointmentService` later without schema churn — the FK column `pathway_block_instance_id` is already reserved on day one.

**Alternatives considered:**
- Mock the sort: `next_appointment_at` deterministically derived from `patient.id` hash. Rejected — fixture lie in a demo.
- Drop the sort: ship only `newly_added`. Rejected — doesn't match the user's brief; the sort registry abstraction loses its point with one strategy.

### D2 — Appointment schema follows FHIR `Appointment` shape but stays domain-internal

Columns mirror FHIR R4 `Appointment` where it fits cheaply (`start`, `end`, `status`, `participant`) but skip FHIR concepts that are heavy and not load-bearing for PoC (`serviceType`, `appointmentType`, `priority`, `serviceCategory`, `requestedPeriod`). `kind` is a domain enum (`consultation | lab | imaging | procedure | other`) — translated to FHIR `serviceType` coding only at the HiX adapter boundary at MVP. `status` is the full FHIR `AppointmentStatus` enum verbatim (10 values) so the wire is FHIR-faithful from day one — the cost is one enum, no other code changes.

**Why:** FHIR-shape is the project's hard contract for clinical data; full-FHIR-schema is overkill for PoC and would inflate validation surface. This is the same trade-off `patients-base` made (FHIR shape, not FHIR library).

**Trade-off:** `entered-in-error` FHIR code has a hyphen, illegal in Python identifiers. Store as `entered_in_error` enum symbol, serialise as `entered-in-error` on wire. Pydantic field-serialiser handles the round-trip; spec scenario locks it.

### D3 — Participants frozen after create

`appointment_participants` is populated only at appointment-create time. `PATCH` rejects a `participants` field. To change attendees, caregiver deletes + recreates the appointment.

**Why:** v1 frontend is read-only — there is no write UI to mutate participants. Backend without a write UI implies clinical discipline rather than enforced workflow. The cost of supporting mid-flight participant edits is non-trivial (audit semantics, status implications, partial unique index on lead while transitioning) for zero PoC value.

**Alternatives considered:**
- Replace-all on PATCH (send full desired participants list). Rejected — costs participant-diff logic, partial-unique-index dance, plus audit ambiguity (was a removed user "soft-deleted" or "never on it"?). Not worth it without a UI.
- Dedicated add/remove endpoints. Rejected — more routes, more tests, same no-UI status.

**Future:** when a write UI lands, expand to replace-all on PATCH. Schema is forward-compatible (the participant join table is the right shape already).

### D4 — Lead participant enforced by partial unique index, not service-only

Service layer validates "exactly one lead at create". DB partial unique index `(appointment_id) WHERE role = 'lead' AND deleted_at IS NULL` is defence-in-depth — a buggy service code path or a future PATCH that mutates participants cannot leave the row in a multi-lead state.

**Why:** invariants worth holding belong in the DB.

### D5 — `next_appointment` embedded on `PatientRead`, projected via lateral join

```python
class NextAppointmentSummary(BaseModel):
    id: UUID
    title: str
    starts_at: datetime
    ends_at: datetime
    kind: AppointmentKind
    modality: AppointmentModality

class PatientRead(...):
    ...
    next_appointment: NextAppointmentSummary | None = None
```

The query projects a `LEFT JOIN LATERAL (SELECT id, title, starts_at, ends_at, kind, modality FROM appointments WHERE patient_id = p.id AND status = 'booked' AND starts_at >= now() AND deleted_at IS NULL AND tenant_id = p.tenant_id ORDER BY starts_at ASC LIMIT 1) na ON TRUE`. `ORDER BY na.starts_at NULLS LAST` for the synthetic sort key `next_appointment_starts_at`.

**Why:** one query, one projection. No N+1. The lateral join with `LIMIT 1` is the planner's friend given the supporting index `appointments(patient_id, starts_at) WHERE status='booked' AND deleted_at IS NULL`.

**Alternatives considered:**
- Two API calls (list + `?include=next_appointment`). Rejected — same cost, more knob.
- Client-side fetch per row. Rejected — N+1 on a 25-row page.
- Materialised view. Rejected — over-engineered for PoC; the lateral subquery is fast enough.

### D6 — Sort registry is a flat readonly array of strategy objects

```ts
export type PatientSortStrategy = {
  id: 'next_appointment' | 'newly_added';
  label: () => string;
  queryParams: () => Partial<ListQuery>;
  rowMeta: (p: PatientRead) => ReactNode;
};
export const patientSortStrategies: readonly PatientSortStrategy[] = [...];
```

`useSelectedSort()` reads `?sort=` from TanStack Router synchronously, defaults to `next_appointment`, warn-logs on unknown values, and exposes `setSort(id)` which calls `navigate({ search })`.

**Why:** smallest abstraction that closes the user's "extensible sort" requirement. Adding a third strategy is one file + one array entry. If the third never lands the cost is ~30 lines.

**Hydration safety:** the hook resolves the active strategy synchronously on first render — there is NO render pass where the default strategy is selected while the URL specifies a non-default sort. TanStack Router exposes search params on the loader; the page uses the loader value as the initial state to avoid a default-flash on deep-linked loads.

**Alternatives considered:**
- Hardcoded switch in the page. Rejected — user asked for extensible.
- DI / context provider. Rejected — only the page consumes the registry.
- localStorage-backed sort. Rejected — breaks shareable URLs.

### D7 — Inbox row anatomy

```
[Avatar slab 40px] [Identity column flex-1] [Sort meta column max-240px] [Chevron]
```

- **Avatar slab:** initials only (first letter of `given_name` + first letter of `family_name`, uppercased) on a deterministically-tinted background derived from `hash(patient.id) % palette_size`. Never an `<img>`. Palette = 8 colours from the orchestrator Tailwind ZAS-teal palette.
- **Identity column:** line 1 `family_name, given_name`. Line 2 muted `INSZ • birth_date • org tree-path`.
- **Sort meta column:** populated by `strategy.rowMeta(patient)`. For `next_appointment` — when non-null, a two-line mini-card (kind icon + truncated title / formatted local time + modality icon); when null, plain muted text `"Geen geplande afspraak"` with no card chrome. For `newly_added` — single muted line `"toegevoegd N dagen geleden"`.
- **Chevron:** right end, full row is the click target.

No per-row kebab. No checkbox. No inline action.

**Why:** triage UX. Caregiver scans left-to-right: who → what → when → next.

### D8 — Browser-local timezone everywhere on the frontend

Backend stores `timestamptz` UTC. Wire emits ISO 8601. Frontend renders via `Intl.DateTimeFormat('nl-BE', { ... })` using the browser's local timezone. No tenant-level timezone setting, no Europe/Brussels hard-pin.

**Why:** ZAS is one timezone for now; rendering in browser-local works for the demo and for any future Belgian-hospital deployment. Tenant timezone setting is filed implicitly under MVP scope if a multi-region tenant ever appears.

### D9 — Infinite scroll, not classic pagination

Inbox uses `useInfiniteQuery` with backend `page_size=25`. Rows from all fetched pages render as a single continuous list. A `"Meer laden"` button appears at the end when `total_pages > fetched_pages`. No numbered pager, no Next/Prev.

**Why:** caregiver scans inbox top-down and stops when triage is done. A pager forces "page 1 of 4" reading, which is the spreadsheet rhythm the inbox UX was meant to leave behind.

**Trade-off:** Cmd-F search within the inbox is limited to what's rendered. Acceptable for PoC.

### D10 — Detail page tab strip = `Metingen / Labresultaten / Afspraken`, old tabs relocated

Tab strip becomes three clinical tabs:
- `Metingen` (id `measurements`) — empty state v1, hint references monitoring koppeling.
- `Labresultaten` (id `lab_results`) — empty state v1, hint references HiX koppeling.
- `Afspraken` (id `appointments`) — real data v1, read-only.

Old tabs relocate:
- `Overzicht` content (demographics + identifiers) → already in `<PatientDetailHeader>`. Tab dropped.
- `Zorgteam` content → `<CareTeamSlot>` moves to a header-adjacent card. Import path + prop signature unchanged so `care-teams-ui` is unaffected. Tab dropped.
- `Geschiedenis` content → `<PatientHistoryPanel>` moves into a kebab → `Geschiedenis` dialog. Tab dropped.

Default active tab = `measurements`. The user reads the page top-down; the first thing in view should be the most clinically dense surface they'll wire later.

**Alternatives considered:**
- Keep all six tabs. Rejected — dilutes the clinical focus.
- Default to `Afspraken` (the only tab with real data). Considered — keeps demo lively. Rejected for v1 because the user spec'd `Metingen` first in their list; respect that order.

### D11 — Afspraken tab: Upcoming + History sections, READ-ONLY

`AppointmentsTab` calls `GET /appointments?filter[patient_id][eq]=<id>` and splits results client-side into Upcoming (status `booked` AND `starts_at >= now()`) + History (everything else). Upcoming is expanded, History is collapsible (collapsed default). Each row shows kind icon + title + local-time formatted `starts_at` + modality icon + truncated participants strip (lead first, max 3 visible, overflow `+N`). History rows additionally show a muted status chip (`Voltooid`, `Geannuleerd`, `Niet verschenen`, etc).

No buttons. No menus. No status changes. Read-only.

**Why:** caregiver glance-mode. Write actions land later via pathway runtime + a dedicated write UI change.

**Alternatives considered:**
- Two backend list calls (Upcoming + History endpoints). Rejected — same data, double the round trips, and one call is cheap.
- Flat list. Rejected — user picked split view.

### D12 — Component seam for future `smart` / `embed`

Two components extracted as **surface-agnostic** (no router import, no shell coupling):
- `<PatientInboxRow patient sortMeta onSelect />`
- `<PatientDetailHeader patient actions? />`

Orchestrator wraps both in router-aware wrappers (link to `/_auth/patients/$patientId`, kebab actions). A future `apps/smart-*` or embed host imports the same two components and supplies its own wrapper.

**Why:** cheapest way to honour the "architect for smart/embed later" requirement. One extra boundary on each side.

### D13 — HTML prototype first

Per project rule, tasks.md mandates self-contained HTML prototypes under `prototypes/inbox/v1.html` and `prototypes/detail/v1.html` using orchestrator Tailwind tokens. Sign-off on prototypes gates React + backend builds. Each iteration is a new `vN.html` — never edit prior versions.

### D14 — i18n: Dutch copy, English identifiers

Component names, sort ids, query params, enum values, file names, i18n keys are English (`next_appointment`, `newly_added`, `inbox.empty.next_appointment`). Display copy is Dutch (`"Nieuw vs oud"`, `"Nog geen metingen gekoppeld"`). All user-visible copy goes through `t()`.

## Risks / Trade-offs

- **R1 — Appointment domain bumps PR size significantly.** The single PR ships ~1 alembic migration + 4 new enums + 2 new tables + 1 service + 1 router + 5 schemas + 1 adapter stub + tests, plus the frontend reshape. **Trade-off accepted:** alternative (two PRs) requires throwing away an inbox built against a null sort and rewriting it once appointments arrive. Cost is review effort, not architectural debt.
- **R2 — Lateral join hot path.** Every `GET /patients` projects `next_appointment` even when sorted by `newly_added`. **Mitigation:** supporting index, `LIMIT 1`, planner short-circuit. If profiling regresses, gate with `select_options.include_next_appointment` flag — additive, non-breaking.
- **R3 — `entered-in-error` hyphen round-trip.** **Mitigation:** Pydantic field-serialiser maps the symbol; spec scenario locks the wire form. Tested both directions.
- **R4 — Read-only Afspraken tab might disappoint demo viewers expecting create UI.** **Mitigation:** empty-state copy plus product narrative: pathway runtime lands write semantics. Acceptable for PoC.
- **R5 — Avatar deterministic-color palette could land on a low-contrast tint for accessibility.** **Mitigation:** the 8-colour palette is curated from ZAS Tailwind tokens with WCAG AA on white-text overlay. Spec scenario asserts contrast-token usage, not raw hex.
- **R6 — Sort registry is one too many abstractions for two strategies.** **Mitigation accepted:** ~30 lines of indirection in exchange for the user's explicit "extensible sort" requirement. If a third strategy never lands, the cost is bounded.
- **R7 — `useSelectedSort` hydration-safety is router-implementation-coupled.** TanStack Router loader exposes search params synchronously; the hook reads them via `useSearch`. **Mitigation:** spec scenario explicitly forbids a default-flash render — the test acts as a regression guard if loader semantics change in a future TanStack Router upgrade.
- **R8 — Component split for smart/embed is speculative.** **Mitigation:** the split is a single component boundary, not a directory restructure or package extraction. Reverting is trivial.

## Migration Plan

- **Data migration**: one alembic migration creates `appointments` + `appointment_participants` + four Postgres enums. No existing-row touchups.
- **`PatientRead.next_appointment`**: additive nullable field. Existing clients ignore it.
- **List route**: in-place swap. URL stays `/_auth/patients`, search params gain `sort`, realtime topic registration unchanged.
- **Detail route**: same URL. Tab strip changes; `<CareTeamSlot>` import path + signature preserved; `<PatientHistoryPanel>` import path preserved.
- **Rollback**: revert PR. No data to undo (no appointments seeded). The DataTable list page and the old tab strip are recoverable from git history.

## Locked wireframe

Accepted wireframe is `prototypes/inbox/v8.html`. See `prototypes/inbox/README.md` for the version history. v8 locks:

- Admin-page chrome (solid sidebar, pill filter row, soft Badge pills, underline Tabs for sort + detail tabs).
- **Three-state master/detail layout** (locked under D15 below).
- **`<PatientDetailView>` as a surface-agnostic primitive** (locked under D16 below).

### D15 — Three-state master/detail layout

1. **State 1** — no patient selected. URL = `/_auth/patients`. Master inbox renders at full width; right pane absent.
2. **State 2** — patient selected. URL = `/_auth/patients/$patientId`. Master compresses to a 320px rail (avatar + name + org tree-path + sort-strategy mini meta only — drops INSZ, team badge, kebab, sort counts, filter row, pager). Right pane renders `<PatientDetailView>`.
3. **State 3** — same URL as state 2, local UI toggle hides the master rail entirely (width 0). Detail fills the available width. A floating `panel-left-open` button at the top-left of the main area brings the rail back to state 2.

URL is the source of truth for **selection** (states 1 ↔ 2). The master-hidden boolean (state 2 ↔ 3) is session-local UI state, NOT in the URL — collapsing a deep-linked detail view should not change the shareable URL.

CSS transitions on master width are 250ms ease. Detail pane mounts/unmounts; no fade.

### D16 — `<PatientDetailView>` is a surface-agnostic primitive

`<PatientDetailView>` SHALL NOT import from `@tanstack/react-router`, the inbox module, or any orchestrator-shell-specific layout. Its prop signature:

```ts
type PatientDetailViewProps = {
  patient: PatientRead;
  defaultTab?: 'measurements' | 'lab_results' | 'appointments';
  actions?: ReactNode;                  // host injects its kebab / edit button cluster
  onClose?: () => void;                 // optional; if absent, no close affordance renders
  onEdit?: () => void;                  // optional
  onDelete?: () => void;                // optional
};
```

The component owns: header layout (avatar + name + INSZ pill + DOB + org Badge + actions slot), Zorgteam line via `<CareTeamSlot patientId={patient.id} />` (self-fetching — preserves the existing `care-teams-ui` consumer seam), tab strip, three tab bodies (Metingen empty, Labresultaten empty, Afspraken read-only Upcoming + History). It does NOT own: patient or appointments data fetching, navigation, dialog management.

`<CareTeamSlot>` is reused as-is (self-fetching via its existing internal query). Dropping a `careTeam` data prop keeps the consumer seam intact and avoids a breaking change to `care-teams-ui`. The component's surface-agnostic guarantee holds because the slot itself does not import router state.

Mount points in v1:
- **Orchestrator inbox split-pane** — `routes/_auth/patients/route.tsx` (parent layout) renders `<PatientInbox>` + `<Outlet>`. `routes/_auth/patients/$patientId/index.tsx` (child) fetches the patient + care team and mounts `<PatientDetailView>` in the Outlet with router-bound `actions` + `onClose` callbacks.
- **Future smart / embed surface** — host imports the same component, provides its own data + actions wrapper. No code duplication.

A standalone full-page detail route is intentionally NOT added — the master-hidden toggle on the same URL covers that use case (per D15).

### D17 — Mobile (<md viewport) falls back to full-page navigation

Below the `md` breakpoint (`<768px`), the 3-state master/detail layout from D15 does NOT apply. Instead:

- `/_auth/patients` renders `<PatientInbox>` full-width.
- Clicking a row navigates to `/_auth/patients/$patientId` as a **full-page route** — `<PatientDetailView>` fills the viewport, the inbox unmounts.
- The browser back button returns to the inbox.
- State 3 (master-hidden toggle) does not exist on mobile.

`<MasterDetailLayout>` SHALL render its `master` slot full-width and skip the detail column when its container is below `md`. The route hierarchy is unchanged; only the rendering swaps.

**Why:** split-pane assumes ≥1024px breathing room. Forcing horizontal scroll or stacking both panes vertically defeats inbox UX on a phone. Mobile clinicians get the same URLs (shareable) with a single-pane UX matching what they'd expect from a mobile-first page.

### D18 — `pathway_block_instance_id` ships as column-only without FK in v1

The `appointments.pathway_block_instance_id` column SHALL be created as `UUID NULL` in v1 alembic without a FOREIGN KEY constraint. The future pathway runtime change (BL-038 follow-up) adds the FK once the `pathway_block_instances` table lands.

**Why:**
- Avoids conditional alembic logic (inspector calls + `if table_exists` branching).
- Avoids dropping + recreating the column later (data already present).
- Reserves the column shape now so no PATCH endpoint needs widening when the FK is added.
- BL-NNN follow-up tracks the FK addition.

## Component reuse audit

Before writing any new code, audit the existing orchestrator primitive surface. The build plan distinguishes **reuse-as-is**, **reuse with extension**, **drop** (delete on archive), and **new reusable** (build with broader value beyond patient-inbox).

### Reuse as-is

Existing primitives that cover the wireframe without modification:

| Primitive | Used for |
|---|---|
| `components/layout/Shell.tsx` + `AppSidebar.tsx` | Outer chrome — already correct vibe per locked wireframe. |
| `components/layout/PageHeader.tsx` | Title + sub + actions slot on `<PatientInbox>` and standalone `<PatientDetailView>` host. |
| `components/ui/button.tsx` (default/ghost/icon variants) | Primary "Nieuwe patiënt" CTA + kebab + edit. |
| `components/ui/badge.tsx` (default/soft/outline/muted) | INSZ default Badge, org soft Badge, status muted Badge, team soft Badge. |
| `components/ui/tabs.tsx` (underline variant) | Sort tabs on `<PatientInbox>` + clinical tabs on `<PatientDetailView>`. |
| `components/ui/input.tsx` | Search field in inbox filter row. |
| `components/ui/select.tsx` | Team / Status filter dropdowns. |
| `components/ui/dropdown-menu.tsx` | Kebab actions (per row + detail page). |
| `components/ui/dialog.tsx` | Kebab `Geschiedenis` dialog + edit dialog (reuses existing `EditPatientDialog`). |
| `components/ui/avatar.tsx` + `AvatarFallback` | Sidebar user pill + inbox row avatar + detail header avatar. |
| `components/states/EmptyState.tsx` | Generic empty-state base for `Metingen` / `Labresultaten` / `Afspraken` empty + inbox-empty + selection-empty right pane. |
| `components/entity/EntityErrorCard.tsx` | Detail-view error fallback. |
| `components/entity/EntityNotFound.tsx` | Outside-visibility caregiver hitting `/_auth/patients/$id`. |
| `components/entity/EntityDetailSkeleton.tsx` | Detail-pane loading skeleton. |
| `modules/patient/components/CareTeamSlot.tsx` | Mounted by `<PatientDetailView>` header line. Export + prop signature unchanged. |
| `modules/patient/components/PatientHistoryPanel.tsx` | Mounted inside the `Geschiedenis` kebab Dialog. |
| `modules/patient/components/EditPatientDialog.tsx` | Reused by the kebab `Bewerken` entry. |
| `modules/patient/components/BreakGlassPrompt.tsx` | Existing 404 handler retained. |
| `modules/patient/api.ts` + `hooks/usePatient` | Patient detail fetch + soft-delete mutation. |
| `hooks/entity/useEntityDelete` | Destructive-confirm pattern for kebab `Verwijderen`. |
| `lib/api/client` typed client | Patient + appointment endpoints (post `typegen`). |
| `lib/i18n/*` + `useTranslation` | All copy through `t()`; new namespaces `patient-inbox`, `patient-appointments`; extend `patient-profile-ui`. |
| `components/ui/sonner` / `toaster` | Success + error toasts on edit / delete. |

### Reuse with extension

| Primitive | Extension |
|---|---|
| `components/entity/EntityDetailPage.tsx` | Currently combines `PageHeader` + body in a single shell. For `<PatientDetailView>` standalone mount, wrap this around the view; for inbox split-pane mount, render `<PatientDetailView>` directly without `EntityDetailPage` chrome (the inbox layout provides the outer chrome). The component itself is unchanged. |
| `components/entity/EntityDetailTabs.tsx` | Already wraps shadcn `Tabs` underline. Use as-is for the clinical tab strip. |
| `hooks/use-paginated-query` | Inbox needs infinite pagination, not classic `Page[T]`. Either add a parallel `use-infinite-list-query` helper or use TanStack `useInfiniteQuery` directly with the patients endpoint. Decide during task 5.7. |

### Drop on archive

These components were specific to the prior `Overzicht` tab and are no longer mounted by `<PatientDetailView>` per locked spec. They have no other consumers in the codebase (verify in prereq task 0.6).

| Primitive | Why |
|---|---|
| `modules/patient/components/PatientDemographicsPanel.tsx` | Content absorbed into `<PatientDetailHeader>` (name + sub badges + DOB). |
| `modules/patient/components/PatientIdentifiersPanel.tsx` | INSZ becomes a Badge default pill in the header; other identifiers (rare in PoC) are out of v1 scope. |
| `modules/patient/components/PatientsColumns.tsx` (`patientColumns`, `patientFilters`, `patientRowActions`) | DataTable-specific; the inbox renders `<PatientInboxRow>` instead. Delete after `routes/_auth/patients/index.tsx` rewrite. |

### New reusable primitives (broader value beyond patient-inbox)

These three are built as **generic** components in shared locations because at least one future feature will reuse them:

1. **`<MasterDetailLayout>`** at `components/layout/MasterDetailLayout.tsx`. Props: `{ master, detail, masterCollapsed, onMasterCollapsedChange }`. Owns the 3-state CSS + transitions + floating reopen button. Generic over content. **Reuse targets:** future tasks inbox (`/_auth/inbox`), organisation browser, care-team browser.
2. **`<InboxRow>`** at `components/list/InboxRow.tsx`. Generic flat clickable row. Props: `{ leading, primary, secondary, trailing, selected, onSelect }`. Slot-based — no patient-specific logic. **Reuse targets:** tasks inbox, notification inbox, anywhere a "scannable list of clickable items" is the right primitive.
3. **`<TabEmptyState>`** (a variant of existing `EmptyState`) — adds the icon-in-circle + headline + hint shape locked in the spec. Could just be a `variant="centered"` prop on the existing `EmptyState`. Decide in task 6.3.

### New patient-feature components (scope-bound)

These live under `modules/patient/components/` and `modules/appointment/components/` — no broader reuse expected.

| Component | Location | Notes |
|---|---|---|
| `<PatientInbox>` | `modules/patient/components/PatientInbox.tsx` | Composes `<MasterDetailLayout>`. Owns sort registry, query, list render, infinite scroll. |
| `<PatientInboxRow>` | `modules/patient/components/PatientInboxRow.tsx` | Wraps generic `<InboxRow>` with patient-specific bindings: `<Avatar>` initials, family/given identity, INSZ/org sub-line, team `<Badge>`, sort-strategy meta slot, kebab. |
| `<Avatar>` (initials with deterministic tint) | `modules/patient/components/PatientAvatar.tsx` OR shared `components/ui/avatar.tsx` extension | If multiple modules want deterministic-tint initials, lift to the shared `Avatar` primitive with a `tintBy?: string` prop. Decide in task 5.1. Default: lift to shared — accessibility palette belongs at the design-system layer (resolves design.md Open Q2). |
| `<PatientDetailHeader>` | `modules/patient/components/PatientDetailHeader.tsx` | Surface-agnostic per D16 — no router import. Drives the title row inside `<PatientDetailView>`. |
| `<PatientDetailView>` | `modules/patient/components/PatientDetailView.tsx` | Surface-agnostic per D16. Composes `<PatientDetailHeader>`, `<CareTeamSlot>`, clinical Tabs, the three tab bodies. |
| `<KindTile>` | `modules/appointment/components/KindTile.tsx` | Subtle color-mix tile per `AppointmentKind`. Reused by inbox row meta + Afspraken tab rows. |
| `<AppointmentRow>` | `modules/appointment/components/AppointmentRow.tsx` | Kind tile + title + status Badge (history variant) + time/location/participants line. Reused in Afspraken tab + (future) caregiver appointments dashboard. |
| `<AppointmentsSection>` | `modules/appointment/components/AppointmentsSection.tsx` | Upcoming (expanded) + History (collapsible) split. Composes `<AppointmentRow>`. |
| `<KebabPatientActions>` | `modules/patient/components/PatientKebab.tsx` | `Bewerken` / `Verwijderen` / `Geschiedenis` entries. Wires `EditPatientDialog`, `useEntityDelete`, history `Dialog`. |
| Sort registry (`patientSortStrategies`, `useSelectedSort`) | `modules/patient/inbox/sorts/*` | Already specified earlier; module-local. |

### Build order (revised)

1. Reusable layer first: `<MasterDetailLayout>` + `<InboxRow>` + lift `<Avatar>` to support deterministic tint. Tests with stub content.
2. Appointment primitives: `<KindTile>`, `<AppointmentRow>`, `<AppointmentsSection>`. Backed by `AppointmentRead` typegen.
3. Patient-feature components: `<PatientDetailHeader>` → `<PatientDetailView>` → `<PatientInboxRow>` → `<PatientInbox>`.
4. Route layout: parent `route.tsx` + child `$patientId/index.tsx`. Wire query + mutations + dialogs.

### Tests strategy

- Generic primitives (`<MasterDetailLayout>`, `<InboxRow>`) get their own tests against contract — independent of patient domain.
- `<PatientDetailView>` is tested in isolation with mock props (router-free) to enforce D16.
- Route components get integration tests (router + query mocks) for: URL drives selection, browser back/forward preserves state, master-hidden toggle is local UI only.

## Open Questions

- **Q1:** Should the inbox surface a counter ("12 patiënten") above the list? Lockable visually now — prototype v8 puts it in the pager strip ("8 van 23") and drops the header counter. Confirm before task 5.7.
- **Q3:** Should `next_appointment` field be returned on `GET /patients/{id}` too (the detail endpoint)? Spec says yes; verify the patient detail page doesn't accidentally re-fetch appointments for the header by reading this field instead of paying for the Afspraken-tab list call.
